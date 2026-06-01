'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * linkBarberProfile — Server Action called after a barber accepts an invite.
 *
 * The Postgres trigger on_invite_accepted is the primary mechanism.
 * This Server Action is the fallback per RESEARCH.md open question #1.
 *
 * Security: UPDATE WHERE profile_id IS NULL prevents overwriting an existing
 * profile_id. RLS on public.barbers blocks cross-tenant updates automatically
 * via the JWT barbershop_id claim.
 *
 * Threat model T-01-10: Tampering protection via idempotent UPDATE WHERE
 * profile_id IS NULL + RLS enforcement.
 */
export async function linkBarberProfile(
  barberId: string
): Promise<{ success: boolean } | { error: string }> {
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
}

/**
 * createBarber — Cria um novo barbeiro para a barbearia do owner autenticado.
 *
 * barbershop_id sempre lido do JWT — nunca aceito como parâmetro do formulário.
 * Threat model T-01-12: barberId é UUID do DB (não user input).
 */
export async function createBarber(formData: {
  name: string
  phone?: string
  photo_url?: string
  specialties?: string[]
}): Promise<{ data: { id: string; name: string } } | { error: string }> {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { data, error } = await supabase
    .from('barbers')
    .insert({
      name: formData.name,
      phone: formData.phone ?? null,
      photo_url: formData.photo_url ?? null,
      specialties: formData.specialties ?? null,
      barbershop_id,
    })
    .select('id, name')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/equipe')
  return { data }
}

/**
 * updateBarber — Atualiza dados de um barbeiro existente.
 *
 * barbershop_id sempre lido do JWT para validação de tenant.
 * Filtro duplo: eq('id') + eq('barbershop_id') — belt-and-suspenders com RLS.
 */
export async function updateBarber(payload: {
  id: string
  name?: string
  phone?: string
  photo_url?: string
  specialties?: string[]
  is_active?: boolean
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { id, ...fields } = payload

  const { error } = await supabase
    .from('barbers')
    .update(fields)
    .eq('id', id)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/equipe')
  return { success: true }
}

/**
 * deactivateBarber — Marca barbeiro como inativo (is_active = false).
 *
 * Soft delete: o registro permanece no banco, agendamentos existentes são preservados.
 * barbershop_id do JWT garante que owner só desativa barbeiros do seu tenant.
 */
export async function deactivateBarber(
  barberId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { error } = await supabase
    .from('barbers')
    .update({ is_active: false })
    .eq('id', barberId)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/equipe')
  return { success: true }
}

/**
 * inviteBarber — Envia convite por email para um barbeiro acessar o painel.
 *
 * Usa createAdminClient (service role) — operação privilegiada de auth.
 * barbershop_id e role injetados via data — não vêm do formulário.
 *
 * Threat model T-01-13: barbershop_id do JWT; error message não vaza estado interno.
 * Segurança: createAdminClient() nunca exportado para client components.
 */
export async function inviteBarber(
  email: string,
  barberId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Não autorizado' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/aceitar-convite`,
    data: {
      barbershop_id,
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
}
