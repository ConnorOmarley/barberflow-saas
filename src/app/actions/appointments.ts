'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * updateAppointmentStatus — Atualiza o status de um agendamento.
 *
 * barbershop_id sempre lido do JWT — nunca aceito como parâmetro.
 * Filtro duplo: eq('id') + eq('barbershop_id') — belt-and-suspenders com RLS.
 *
 * Threat model T-01-17: barbershop_id do JWT garante que barbeiro não pode
 * atualizar appointments de outro tenant.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { error } = await supabase
    .from('appointments')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * cancelAppointment — Cancela um agendamento via UPDATE (nunca DELETE).
 *
 * Per D-18: appointments são NUNCA deletados — apenas status atualizado para CANCELLED.
 * Todos os campos de cancelamento são settados: cancelled_at, cancelled_by, cancel_reason.
 *
 * barbershop_id sempre lido do JWT.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const userId = claimsData.claims.sub as string
  const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancel_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  return { success: true }
}

// Note: createAppointment will be added to this file in plan 01-08.
