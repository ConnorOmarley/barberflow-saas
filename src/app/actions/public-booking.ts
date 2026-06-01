'use server'

import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Helpers de Timezone ──────────────────────────────────────────────────────

/**
 * Retorna o UTC offset como string '-03:00' ou '+00:00'.
 * Usa Intl.DateTimeFormat com timeZoneName 'longOffset'.
 * dateStr: 'YYYY-MM-DD' — usa T12:00:00Z para evitar edge cases de DST.
 */
function getUTCOffset(dateStr: string, timezone: string): string {
  const dt = new Date(`${dateStr}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(dt)
  const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  // Extrai '-03:00' de 'GMT-03:00' ou '+00:00' de 'GMT+0'
  const raw = offset.replace('GMT', '')
  if (!raw || raw === '+0' || raw === '-0') return '+00:00'
  // Normaliza para HH:MM com dois dígitos
  const match = raw.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return '+00:00'
  const sign = match[1]
  const hours = match[2].padStart(2, '0')
  const minutes = match[3] ?? '00'
  return `${sign}${hours}:${minutes}`
}

/**
 * Retorna 0 (Dom) a 6 (Sáb) para uma data 'YYYY-MM-DD' na timezone dada.
 * Usa T12:00:00Z para evitar edge cases de DST.
 */
function getLocalDayOfWeek(dateStr: string, timezone: string): number {
  const dt = new Date(`${dateStr}T12:00:00Z`)
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(dt)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekdayStr] ?? 0
}

/**
 * Converte 'YYYY-MM-DD' + 'HH:MM:SS' na timezone da barbearia para ISO UTC string.
 */
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): string {
  const offset = getUTCOffset(dateStr, timezone)
  return new Date(`${dateStr}T${timeStr}${offset}`).toISOString()
}

/**
 * Retorna o início do dia (00:00:00) na timezone da barbearia, em UTC ISO string.
 */
function localDateToUTCStart(dateStr: string, timezone: string): string {
  const offset = getUTCOffset(dateStr, timezone)
  return new Date(`${dateStr}T00:00:00${offset}`).toISOString()
}

/**
 * Retorna o fim do dia (23:59:59) na timezone da barbearia, em UTC ISO string.
 */
function localDateToUTCEnd(dateStr: string, timezone: string): string {
  const offset = getUTCOffset(dateStr, timezone)
  return new Date(`${dateStr}T23:59:59${offset}`).toISOString()
}

/**
 * Normaliza número de WhatsApp para o formato E.164 (+55XXXXXXXXXXX).
 */
function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length >= 10) return `+55${digits}`
  return digits // fallback — validação de formato feita pelo Zod
}

// ─── Tipos de entrada ────────────────────────────────────────────────────────

type GetAvailableSlotsInput = {
  barbershop_slug: string
  barber_id: string
  service_id: string
  date: string // 'YYYY-MM-DD' na timezone da barbearia
}

type GetAvailableSlotsResult = { slots: string[] } | { error: string }

type CreatePublicAppointmentInput = {
  barbershop_slug: string
  service_id: string
  barber_id: string
  start_time: string // ISO UTC string selecionado no step-datetime
  client: {
    full_name: string
    whatsapp_number: string
    whatsapp_opt_in: boolean
  }
}

type CreatePublicAppointmentResult =
  | { data: { id: string; start_time: string } }
  | { error: string }

// ─── getAvailableSlots ───────────────────────────────────────────────────────

/**
 * Retorna os slots disponíveis para um barbeiro + serviço + data.
 *
 * Segurança:
 *   - Usa createPublicClient() para SELECT (anon key + RLS)
 *   - Seleciona apenas start_time e end_time dos appointments (não expõe client_id)
 *   - barbershop_id nunca aceito como parâmetro — resolvido via slug
 *
 * Algoritmo:
 *   1. Resolver barbershop pelo slug → id + timezone
 *   2. Calcular day_of_week da data na timezone da barbearia
 *   3. Buscar working_hours do barbeiro para o dia
 *   4. Buscar duration_minutes do serviço
 *   5. Buscar appointments existentes do barbeiro no dia (não CANCELLED)
 *   6. Gerar slots de 30 em 30 min e filtrar os ocupados
 */
export async function getAvailableSlots(
  input: GetAvailableSlotsInput
): Promise<GetAvailableSlotsResult> {
  try {
    const supabase = createPublicClient()

    // 1. Resolver barbershop pelo slug
    const { data: barbershop, error: barbershopError } = await supabase
      .from('barbershops')
      .select('id, timezone')
      .eq('slug', input.barbershop_slug)
      .single()

    if (barbershopError || !barbershop) {
      return { error: 'Barbearia não encontrada' }
    }

    // 2. Calcular day_of_week da data na timezone da barbearia
    const dayIndex = getLocalDayOfWeek(input.date, barbershop.timezone)

    // 3. Buscar working_hours do barbeiro para este dia
    const { data: workingHours, error: whError } = await supabase
      .from('working_hours')
      .select('start_time, end_time')
      .eq('barber_id', input.barber_id)
      .eq('day_of_week', dayIndex)
      .eq('is_active', true)

    if (whError) return { error: whError.message }
    if (!workingHours || workingHours.length === 0) return { slots: [] }

    // 4. Buscar duração do serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', input.service_id)
      .single()

    if (serviceError || !service) return { error: 'Serviço não encontrado' }

    // 5. Buscar appointments existentes no dia (UTC range), não CANCELLED
    //    Seleciona APENAS start_time e end_time — não expõe dados pessoais (T-02-14)
    const dayStartUTC = localDateToUTCStart(input.date, barbershop.timezone)
    const dayEndUTC = localDateToUTCEnd(input.date, barbershop.timezone)

    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('barber_id', input.barber_id)
      .neq('status', 'CANCELLED')
      .gte('start_time', dayStartUTC)
      .lt('start_time', dayEndUTC)

    // 6. Gerar slots de 30 em 30 minutos e filtrar os ocupados
    const slotInterval = 30 // minutos — granularidade fixa
    const duration = service.duration_minutes
    const slots: string[] = []

    for (const wh of workingHours) {
      const whStartMs = new Date(
        localTimeToUTC(input.date, wh.start_time, barbershop.timezone)
      ).getTime()
      const whEndMs = new Date(
        localTimeToUTC(input.date, wh.end_time, barbershop.timezone)
      ).getTime()

      let cursor = whStartMs

      while (cursor + duration * 60_000 <= whEndMs) {
        const slotStart = cursor
        const slotEnd = cursor + duration * 60_000

        // Verificar overlap com appointments existentes
        // Overlap: slotStart < apptEnd && slotEnd > apptStart
        const hasConflict = (existingAppointments ?? []).some((appt) => {
          const apptStart = new Date(appt.start_time).getTime()
          const apptEnd = new Date(appt.end_time).getTime()
          return slotStart < apptEnd && slotEnd > apptStart
        })

        if (!hasConflict) {
          slots.push(new Date(slotStart).toISOString())
        }

        cursor += slotInterval * 60_000
      }
    }

    return { slots }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── createPublicAppointment ─────────────────────────────────────────────────

/**
 * Cria um agendamento público com deduplicação de cliente.
 *
 * Segurança (threat model):
 *   T-02-09: barbershop_id NUNCA vem do cliente — resolvido via slug server-side
 *   T-02-10: end_time calculado server-side a partir de services.duration_minutes
 *   T-02-12: opt_in_timestamp gravado server-side; opt_in_source = 'booking_portal'
 *   T-02-15: app-layer conflict check + exclusion constraint GIST (23P01)
 *
 * Fluxo:
 *   1. Resolver barbershop_id via slug
 *   2. Buscar duration_minutes server-side (anti-tamper)
 *   3. Calcular end_time server-side
 *   4. Normalizar WhatsApp
 *   5. Upsert cliente por (barbershop_id, whatsapp_number) via adminClient
 *   6. App-layer conflict check
 *   7. INSERT appointment via adminClient (status='PENDING', booking_source='portal')
 *   8. Capturar 23P01 (exclusion_violation) e retornar mensagem amigável
 */
export async function createPublicAppointment(
  input: CreatePublicAppointmentInput
): Promise<CreatePublicAppointmentResult> {
  try {
    const supabase = createPublicClient()

    // 1. Resolver barbershop_id via slug — NUNCA aceitar como parâmetro
    const { data: barbershop, error: barbershopError } = await supabase
      .from('barbershops')
      .select('id, timezone')
      .eq('slug', input.barbershop_slug)
      .single()

    if (barbershopError || !barbershop) {
      return { error: 'Barbearia não encontrada' }
    }

    // 2. Buscar duration_minutes server-side — previne tampering (T-02-10)
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', input.service_id)
      .single()

    if (serviceError || !service) {
      return { error: 'Serviço não encontrado' }
    }

    // 3. Calcular end_time server-side
    const startMs = new Date(input.start_time).getTime()
    const endTime = new Date(startMs + service.duration_minutes * 60_000).toISOString()

    // 4. Normalizar número de WhatsApp para E.164
    const normalizedWhatsApp = normalizeWhatsApp(input.client.whatsapp_number)

    // 5. Upsert cliente por (barbershop_id, whatsapp_number) via adminClient
    //    ignoreDuplicates: false → atualiza full_name se cliente já existir
    const admin = createAdminClient()

    const { data: client, error: clientError } = await admin
      .from('clients')
      .upsert(
        {
          barbershop_id: barbershop.id,
          full_name: input.client.full_name,
          whatsapp_number: normalizedWhatsApp,
          whatsapp_opt_in: input.client.whatsapp_opt_in,
          opt_in_source: input.client.whatsapp_opt_in ? 'booking_portal' : null,
          opt_in_timestamp: input.client.whatsapp_opt_in ? new Date().toISOString() : null,
        },
        {
          onConflict: 'barbershop_id,whatsapp_number',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single()

    if (clientError || !client) {
      return { error: clientError?.message ?? 'Erro ao registrar cliente' }
    }

    // 6. App-layer conflict check — defesa complementar à exclusion constraint (T-02-15)
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('barber_id', input.barber_id)
      .neq('status', 'CANCELLED')
      .lt('start_time', endTime) // existing start < new end
      .gt('end_time', input.start_time) // existing end > new start
      .limit(1)

    if ((conflict?.length ?? 0) > 0) {
      return { error: 'Horário indisponível. Escolha outro horário.' }
    }

    // 7. INSERT appointment via adminClient
    //    status='PENDING' — portal sempre cria como pendente (BOOK-04)
    //    booking_source='portal' — identifica origem
    //    created_by=null — cliente anônimo não tem auth.users row (Pitfall 6)
    const { data: appointment, error: insertError } = await admin
      .from('appointments')
      .insert({
        barbershop_id: barbershop.id,
        barber_id: input.barber_id,
        service_id: input.service_id,
        client_id: client.id,
        start_time: input.start_time,
        end_time: endTime,
        status: 'PENDING',
        booking_source: 'portal',
        created_by: null,
      })
      .select('id, start_time')
      .single()

    // 8. Capturar 23P01 (exclusion_violation) — race condition protegida pela constraint GIST
    if (insertError) {
      if (insertError.code === '23P01') {
        return { error: 'Horário indisponível. Escolha outro horário.' }
      }
      return { error: insertError.message ?? 'Erro ao criar agendamento' }
    }

    if (!appointment) {
      return { error: 'Erro ao criar agendamento' }
    }

    revalidatePath('/dashboard')
    return { data: appointment }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
