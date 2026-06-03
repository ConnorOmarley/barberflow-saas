'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── createStampOnComplete ────────────────────────────────────────────────────

/**
 * createStampOnComplete — Helper interno para auto-stamp após COMPLETED.
 *
 * NÃO exportado — uso exclusivo de updateAppointmentStatus neste arquivo.
 * Duplicado intencionalmente de loyalty.ts para evitar import circular
 * entre Server Actions (Next.js não suporta imports circulares em 'use server').
 *
 * Trata 23505 (unique_violation) como no-op — idempotência garantida pelo
 * UNIQUE INDEX loyalty_stamps_appointment_id_idx no banco.
 *
 * Fire-and-forget: falha NUNCA bloqueia o status update (Pitfall 2 da RESEARCH).
 */
async function createStampOnComplete(appointmentId: string, barbershopId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    // Buscar client_id do appointment (barbershopId já validado pelo chamador via JWT)
    const { data: appt, error: apptError } = await admin
      .from('appointments')
      .select('client_id')
      .eq('id', appointmentId)
      .single()

    if (apptError || !appt?.client_id) {
      // Appointment não encontrado ou sem cliente — retorna silenciosamente
      return
    }

    const { error } = await admin
      .from('loyalty_stamps')
      .insert({
        barbershop_id: barbershopId,
        client_id: appt.client_id,
        appointment_id: appointmentId,
      })

    if (error) {
      if (error.code === '23505') {
        // Unique violation — stamp já existe para este appointment, no-op intencional
        return
      }
      console.error('[loyalty] stamp insert error:', error.message)
    }
  } catch (err) {
    console.error('[loyalty] createStampOnComplete error:', err)
  }
}

// ─── updateAppointmentStatus ──────────────────────────────────────────────────

/**
 * updateAppointmentStatus — Atualiza o status de um agendamento.
 *
 * barbershop_id sempre lido do JWT — nunca aceito como parâmetro.
 * Filtro duplo: eq('id') + eq('barbershop_id') — belt-and-suspenders com RLS.
 *
 * Threat model T-01-17: barbershop_id do JWT garante que barbeiro não pode
 * atualizar appointments de outro tenant.
 *
 * Auto-stamp: quando status = COMPLETED, dispara createStampOnComplete em
 * fire-and-forget — falha do stamp NUNCA bloqueia o status update.
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

  // Auto-stamp: fire-and-forget — falha nunca bloqueia status update
  if (status === 'COMPLETED') {
    void createStampOnComplete(appointmentId, barbershop_id)
  }

  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/fidelidade')
  return { success: true }
}

// ─── cancelAppointment ────────────────────────────────────────────────────────

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

// ─── createAppointment ────────────────────────────────────────────────────────

/**
 * createAppointment — Cria um agendamento manual com conflict check server-side.
 *
 * Threat model:
 *   T-01-19: end_time sempre computado do DB (services.duration_minutes) — cliente nunca pode
 *            passar end_time diretamente, prevenindo tampering de duração.
 *   T-01-22: new_client.whatsapp_opt_in sempre false no servidor — opt-in é Phase 5.
 *
 * barbershop_id e userId sempre lidos do JWT — nunca aceitos como parâmetros.
 */
export async function createAppointment(inputData: {
  barber_id: string
  service_id: string
  client_id?: string
  new_client?: { full_name: string; whatsapp_number: string }
  start_time: string // ISO string
  notes?: string
}): Promise<{ data: { id: string; start_time: string; end_time: string } } | { error: string }> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const userId = claimsData.claims.sub as string
  const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  // Validar campos obrigatórios
  if (!inputData.barber_id) return { error: 'Barbeiro é obrigatório' }
  if (!inputData.service_id) return { error: 'Serviço é obrigatório' }
  if (!inputData.client_id && !inputData.new_client) {
    return { error: 'Cliente é obrigatório' }
  }

  // Buscar duração do serviço no DB — server-side para prevenir tampering (T-01-19)
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', inputData.service_id)
    .single()

  if (serviceError || !serviceData) return { error: 'Serviço não encontrado' }

  // Computar end_time server-side a partir de duration_minutes do DB
  const startMs = new Date(inputData.start_time).getTime()
  const endTime = new Date(startMs + serviceData.duration_minutes * 60_000).toISOString()

  // Criar novo cliente inline se necessário
  let clientId = inputData.client_id
  if (!clientId && inputData.new_client) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        barbershop_id,
        full_name: inputData.new_client.full_name,
        whatsapp_number: inputData.new_client.whatsapp_number,
        whatsapp_opt_in: false, // T-01-22: sempre false — opt-in é Phase 5
      })
      .select('id')
      .single()

    if (clientError || !newClient) return { error: 'Erro ao cadastrar cliente' }
    clientId = newClient.id
  }

  // Conflict check app-layer (D-17) — T-01-20: documented race condition; Phase 2 adiciona GIST
  const { data: conflictData } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', inputData.barber_id)
    .neq('status', 'CANCELLED')
    .lt('start_time', endTime) // existing start < new end
    .gt('end_time', inputData.start_time) // existing end > new start
    .limit(1)

  if ((conflictData?.length ?? 0) > 0) {
    return { error: 'Horário indisponível. O barbeiro já tem um agendamento nesse horário.' }
  }

  // INSERT appointment
  const { data: appointment, error: insertError } = await supabase
    .from('appointments')
    .insert({
      barbershop_id,
      barber_id: inputData.barber_id,
      service_id: inputData.service_id,
      client_id: clientId!,
      start_time: inputData.start_time,
      end_time: endTime,
      status: 'CONFIRMED',
      notes: inputData.notes ?? null,
      booking_source: 'manual',
      created_by: userId,
    })
    .select('id, start_time, end_time')
    .single()

  if (insertError || !appointment) return { error: insertError?.message ?? 'Erro ao criar agendamento' }

  revalidatePath('/dashboard')
  revalidatePath('/agenda')
  return { data: appointment }
}
