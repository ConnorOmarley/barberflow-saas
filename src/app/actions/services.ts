'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── createService ────────────────────────────────────────────────────────────
// barbershop_id is NEVER accepted as a parameter — always read from JWT claims.
// Threat model T-01-15/T-01-16: owner cannot create services for another tenant.

export async function createService(data: {
  name: string
  duration_minutes: number
  price: number
  description?: string
}): Promise<
  { data: { id: string; name: string } } | { error: string }
> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData) return { error: 'Não autenticado' }

    const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershop_id) return { error: 'Barbearia não configurada' }

    const { data: service, error } = await supabase
      .from('services')
      .insert({
        barbershop_id,
        name: data.name,
        duration_minutes: data.duration_minutes,
        price: data.price,
      })
      .select('id, name')
      .single()

    if (error || !service) return { error: error?.message ?? 'Erro ao criar serviço' }

    revalidatePath('/dashboard/servicos')
    return { data: service }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── updateService ────────────────────────────────────────────────────────────
// Belt-and-suspenders: WHERE id AND barbershop_id (beyond RLS) per T-01-16.

export async function updateService(data: {
  id: string
  name?: string
  duration_minutes?: number
  price?: number
  is_active?: boolean
}): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData) return { error: 'Não autenticado' }

    const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershop_id) return { error: 'Barbearia não configurada' }

    const { id, ...fields } = data
    const { error } = await supabase
      .from('services')
      .update(fields)
      .eq('id', id)
      .eq('barbershop_id', barbershop_id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/servicos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── deactivateService ────────────────────────────────────────────────────────
// Sets is_active = false. Records are never deleted.

export async function deactivateService(
  serviceId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData) return { error: 'Não autenticado' }

    const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershop_id) return { error: 'Barbearia não configurada' }

    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', serviceId)
      .eq('barbershop_id', barbershop_id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/servicos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
