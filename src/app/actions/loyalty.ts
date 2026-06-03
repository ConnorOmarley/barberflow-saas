'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

type LoyaltyRule = {
  id: string
  barbershop_id: string
  stamps_required: number
  reward_description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

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

// ─── createStampOnComplete ────────────────────────────────────────────────────

/**
 * createStampOnComplete — Helper interno (não exportado publicamente).
 *
 * Chamado em fire-and-forget após appointment status = COMPLETED.
 * Busca client_id do appointment via adminClient.
 * Trata 23505 (unique_violation) como no-op — stamp já existe para este appointment.
 * Nunca lança exceção — falha silenciosa intencional (Pitfall 2 da RESEARCH).
 */
async function createStampOnComplete(appointmentId: string, barbershopId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    // Buscar client_id do appointment (barbershopId já validado pelo chamador)
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

// ─── getLoyaltyRule ───────────────────────────────────────────────────────────

/**
 * getLoyaltyRule — Busca a regra de fidelidade ativa da barbearia autenticada.
 */
export async function getLoyaltyRule(): Promise<
  { data: LoyaltyRule | null } | { error: string }
> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('loyalty_rules')
      .select('*')
      .eq('barbershop_id', ctx.barbershopId)
      .maybeSingle()

    if (error) return { error: error.message }

    return { data: data ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── upsertLoyaltyRule ────────────────────────────────────────────────────────

/**
 * upsertLoyaltyRule — Cria ou atualiza a regra de fidelidade da barbearia.
 *
 * barbershop_id nunca aceito como parâmetro — lido de profiles via adminClient.
 * Threat T-04-06: barbershop_id vem exclusivamente de profiles, nunca do payload.
 */
export async function upsertLoyaltyRule(data: {
  stamps_required: number
  reward_description: string
}): Promise<{ data: { id: string } } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const { stamps_required, reward_description } = data

    // Validação server-side
    if (stamps_required < 1 || stamps_required > 100) {
      return { error: 'Número de carimbos deve ser entre 1 e 100' }
    }
    if (!reward_description || reward_description.trim().length === 0) {
      return { error: 'Descrição da recompensa é obrigatória' }
    }
    if (reward_description.length > 200) {
      return { error: 'Descrição deve ter no máximo 200 caracteres' }
    }

    const admin = createAdminClient()
    const { data: rule, error } = await admin
      .from('loyalty_rules')
      .upsert(
        {
          barbershop_id: ctx.barbershopId,
          stamps_required,
          reward_description: reward_description.trim(),
          is_active: true,
        },
        { onConflict: 'barbershop_id' }
      )
      .select('id')
      .single()

    if (error) return { error: error.message }

    revalidatePath('/dashboard/fidelidade')
    return { data: { id: rule.id } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

// ─── redeemLoyaltyCard ────────────────────────────────────────────────────────

/**
 * redeemLoyaltyCard — Registra um resgate de cartão fidelidade.
 *
 * Lógica de contagem de carimbos ativos:
 * - Busca MAX(loyalty_redemptions.created_at) para o cliente (último resgate)
 * - Conta stamps com created_at > esse timestamp (ou desde epoch se nunca resgatou)
 * - Valida que activeCount >= stamps_required da regra ativa
 */
export async function redeemLoyaltyCard(
  clientId: string
): Promise<{ success: true; stampsUsed: number } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()

    // Buscar regra ativa
    const { data: rule, error: ruleError } = await admin
      .from('loyalty_rules')
      .select('id, stamps_required, is_active')
      .eq('barbershop_id', ctx.barbershopId)
      .eq('is_active', true)
      .maybeSingle()

    if (ruleError) return { error: ruleError.message }
    if (!rule) return { error: 'Nenhuma regra de fidelidade ativa encontrada' }

    // Buscar último resgate do cliente nesta barbearia
    const { data: lastRedemption, error: redemptionError } = await admin
      .from('loyalty_redemptions')
      .select('created_at')
      .eq('barbershop_id', ctx.barbershopId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (redemptionError) return { error: redemptionError.message }

    // Reset point: contagem parte do último resgate (ou desde o início dos tempos)
    const sinceDate = lastRedemption?.created_at ?? '1970-01-01T00:00:00Z'

    // Contar carimbos ativos (após último resgate)
    const { count: activeCount, error: countError } = await admin
      .from('loyalty_stamps')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', ctx.barbershopId)
      .eq('client_id', clientId)
      .gt('created_at', sinceDate)

    if (countError) return { error: countError.message }

    const stampsCount = activeCount ?? 0

    if (stampsCount < rule.stamps_required) {
      return {
        error: `Carimbos insuficientes: ${stampsCount} de ${rule.stamps_required} necessários`,
      }
    }

    // Inserir resgate com snapshot de stamps_used
    const { error: insertError } = await admin
      .from('loyalty_redemptions')
      .insert({
        barbershop_id: ctx.barbershopId,
        client_id: clientId,
        redeemed_by: ctx.userId,
        stamps_used: stampsCount,
      })

    if (insertError) return { error: insertError.message }

    revalidatePath('/dashboard/fidelidade')
    return { success: true, stampsUsed: stampsCount }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

