'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getAuthContext(): Promise<
  { userId: string; barbershopId: string } | { error: string }
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return { error: 'Não autenticado' }

    const userId = data.claims.sub as string | undefined
    if (!userId) return { error: 'Usuário não encontrado' }

    // Read barbershop_id from profiles — source of truth, avoids JWT cache issues
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('barbershop_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.barbershop_id) {
      return { error: 'Barbearia não configurada' }
    }

    return { userId, barbershopId: profile.barbershop_id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro de autenticação' }
  }
}

// ─── linkBarberProfile ────────────────────────────────────────────────────────

export async function linkBarberProfile(
  barberId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData) return { error: 'Não autenticado' }

    const userId = claimsData.claims.sub as string

    const { error } = await supabase
      .from('barbers')
      .update({ profile_id: userId })
      .eq('id', barberId)
      .is('profile_id', null)

    if (error) return { error: error.message }

    revalidatePath('/agenda')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── createBarber ─────────────────────────────────────────────────────────────

export async function createBarber(formData: {
  name: string
  phone?: string
  photo_url?: string
  specialties?: string[]
}): Promise<{ data: { id: string; name: string } } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('barbers')
      .insert({
        name: formData.name,
        phone: formData.phone ?? null,
        photo_url: formData.photo_url ?? null,
        specialties: formData.specialties ?? null,
        barbershop_id: ctx.barbershopId,
      })
      .select('id, name')
      .single()

    if (error) return { error: error.message }

    revalidatePath('/dashboard/equipe')
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── updateBarber ─────────────────────────────────────────────────────────────

export async function updateBarber(payload: {
  id: string
  name?: string
  phone?: string
  photo_url?: string
  specialties?: string[]
  is_active?: boolean
}): Promise<{ success: true } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const { id, ...fields } = payload
    const admin = createAdminClient()

    const { error } = await admin
      .from('barbers')
      .update(fields)
      .eq('id', id)
      .eq('barbershop_id', ctx.barbershopId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/equipe')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── deactivateBarber ─────────────────────────────────────────────────────────

export async function deactivateBarber(
  barberId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { error } = await admin
      .from('barbers')
      .update({ is_active: false })
      .eq('id', barberId)
      .eq('barbershop_id', ctx.barbershopId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/equipe')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── inviteBarber ─────────────────────────────────────────────────────────────

export async function inviteBarber(
  email: string,
  barberId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/aceitar-convite`,
      data: {
        barbershop_id: ctx.barbershopId,
        role: 'barber',
        barber_id: barberId,
      },
    })

    if (error) {
      if (error.message.includes('already been registered'))
        return { error: 'Este email já está cadastrado no sistema.' }
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
