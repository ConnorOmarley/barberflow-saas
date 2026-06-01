'use server'

import { createClient } from '@/lib/supabase/server'
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
