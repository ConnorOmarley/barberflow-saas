'use server'

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// CRITICAL: Do NOT add `export const runtime = 'edge'`
// crypto.createHmac is Node.js runtime only — not available in Edge Runtime.

/**
 * generateQrToken — Gera token HMAC-SHA256 para check-in de um agendamento.
 *
 * Token format: base64url(payload) + "." + hexSig
 * Payload: `${appointmentId}|${issuedAt}|${startUnix}`
 *
 * Usa adminClient para buscar o agendamento sem exigir JWT do chamador
 * (o link pode ser gerado server-side na página de confirmação pública).
 */
export async function generateQrToken(
  appointmentId: string
): Promise<{ url: string } | { error: string }> {
  try {
    const admin = createAdminClient()

    const { data: appointment, error } = await admin
      .from('appointments')
      .select('id, start_time, status')
      .eq('id', appointmentId)
      .single()

    if (error || !appointment) return { error: 'Agendamento não encontrado' }
    if (appointment.status === 'CANCELLED') return { error: 'Agendamento cancelado' }

    const issuedAt = Math.floor(Date.now() / 1000)
    const startUnix = Math.floor(new Date(appointment.start_time).getTime() / 1000)

    const payload = `${appointmentId}|${issuedAt}|${startUnix}`
    const sig = crypto
      .createHmac('sha256', process.env.QR_HMAC_SECRET!)
      .update(payload)
      .digest('hex')
    const token = `${Buffer.from(payload).toString('base64url')}.${sig}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    return { url: `${appUrl}/qr/check-in?token=${encodeURIComponent(token)}` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ---------------------------------------------------------------------------
// Private helper — fire-and-forget broadcast para dashboard em tempo real
// ---------------------------------------------------------------------------

async function broadcastCheckIn(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `checkin:${barbershopId}`,
          event: 'arrival',
          payload: { appointmentId },
        },
      ],
    }),
  })
}

/**
 * processQrCheckIn — Verifica token HMAC e registra check-in atomicamente.
 *
 * Rota pública — sem JWT do chamador. Usa adminClient exclusivamente.
 *
 * Guards aplicados em ordem (fail-fast antes de qualquer DB call extra):
 *   1. Decode + parse do token (formato válido)
 *   2. HMAC constant-time compare (timingSafeEqual)
 *   3. Busca appointment no DB (adminClient)
 *   4. Verificar status == 'CONFIRMED' (antes de qualquer check de tempo)
 *   5. Janela de tempo ±30 minutos do start_time do DB
 *   6. INSERT atômico em used_qr_tokens (único guard de single-use)
 *   7. UPDATE appointments.status = 'CHECKED_IN'
 *   8. Broadcast Realtime (fire-and-forget) + revalidatePath
 *
 * Threat model: T-03-08, T-03-09, T-03-10, T-03-11 — todos mitigados aqui.
 */
export async function processQrCheckIn(
  token: string
): Promise<{ success: true; clientName: string; appointmentId: string } | { error: string }> {
  try {
    // --- Step 1: Decode token ---
    const parts = token.split('.')
    if (parts.length !== 2) return { error: 'Token inválido' }
    const [encodedPayload, providedSig] = parts

    let rawPayload: string
    try {
      rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8')
    } catch {
      return { error: 'Token inválido' }
    }

    const segments = rawPayload.split('|')
    if (segments.length !== 3) return { error: 'Token inválido' }
    const [appointmentId] = segments
    if (!appointmentId) return { error: 'Token inválido' }

    // --- Step 2: Verificar HMAC (constant-time) ---
    const expectedSig = crypto
      .createHmac('sha256', process.env.QR_HMAC_SECRET!)
      .update(rawPayload)
      .digest('hex')

    // timingSafeEqual requer buffers de mesmo tamanho — verificar antes
    const providedBuf = Buffer.from(providedSig, 'hex')
    const expectedBuf = Buffer.from(expectedSig, 'hex')
    if (providedBuf.length !== expectedBuf.length) return { error: 'Assinatura inválida' }

    const sigValid = crypto.timingSafeEqual(providedBuf, expectedBuf)
    if (!sigValid) return { error: 'Assinatura inválida' }

    // --- Step 3: Buscar appointment (adminClient — sem auth do caller) ---
    const admin = createAdminClient()
    const { data: appointment } = await admin
      .from('appointments')
      .select('id, status, start_time, barbershop_id, clients(full_name)')
      .eq('id', appointmentId)
      .single()

    if (!appointment) return { error: 'Agendamento não encontrado' }

    // --- Step 4: Verificar status (ANTES da janela de tempo) ---
    if (appointment.status !== 'CONFIRMED') {
      return { error: `Agendamento não confirmado (status: ${appointment.status})` }
    }

    // --- Step 5: Verificar janela de tempo (±30 min a partir do start_time do DB) ---
    const now = Math.floor(Date.now() / 1000)
    const startUnix = Math.floor(new Date(appointment.start_time).getTime() / 1000)
    const WINDOW = 30 * 60 // 30 minutos em segundos

    if (now < startUnix - WINDOW || now > startUnix + WINDOW) {
      return { error: 'Fora da janela de check-in (±30 minutos do horário)' }
    }

    // --- Step 6: Single-use enforcement atômico ---
    // Armazenar SHA-256 do token completo (nunca o token raw) — T-03-SC
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: inserted, error: insertError } = await admin
      .from('used_qr_tokens')
      .insert({ appointment_id: appointmentId, token_hash: tokenHash })
      .select('id')

    // Supabase retorna error.code '23505' (unique_violation) quando o token já existe.
    // Verificar inserted vazio como defesa extra contra ON CONFLICT DO NOTHING.
    if (insertError?.code === '23505' || !inserted || inserted.length === 0) {
      return { error: 'QR Code já utilizado' }
    }
    if (insertError) {
      return { error: 'Erro ao registrar check-in' }
    }

    // --- Step 7: Atualizar status para CHECKED_IN ---
    const { error: updateError } = await admin
      .from('appointments')
      .update({ status: 'CHECKED_IN', updated_at: new Date().toISOString() })
      .eq('id', appointmentId)

    if (updateError) return { error: 'Erro ao registrar check-in' }

    // --- Step 8: Broadcast Realtime (fire-and-forget) + revalidate ---
    broadcastCheckIn(appointment.barbershop_id, appointmentId).catch(() => {})

    const clientName =
      (appointment.clients as { full_name: string } | null)?.full_name ?? 'Cliente'

    return { success: true, clientName, appointmentId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
