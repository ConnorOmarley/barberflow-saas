'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * BarberServiceAssignment — tipo de atribuição de serviço a um barbeiro.
 * commission_type e commission_value são opcionais — podem ser null.
 */
export type BarberServiceAssignment = {
  service_id: string
  commission_type?: 'percent' | 'fixed' | null
  commission_value?: number | null
}

/**
 * syncBarberServices — Sincroniza os serviços de um barbeiro usando DELETE+INSERT.
 *
 * Nunca usa UPSERT — o padrão DELETE+INSERT garante que atribuições removidas
 * sejam eliminadas mesmo se o ID de barber_services não for conhecido pelo cliente.
 *
 * Threat model T-01-14: DELETE WHERE barber_id = ? + RLS subquery via barbers.barbershop_id
 * garante que owner só altera barbers do seu tenant (cross-tenant tampering bloqueado).
 *
 * barbershop_id nunca aceito como parâmetro — sempre lido do JWT.
 */
export async function syncBarberServices(
  barberId: string,
  assignments: BarberServiceAssignment[]
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershop_id) {
      return { error: 'Barbearia não encontrada.' }
    }

    // App-layer guard: verify barber belongs to this barbershop before writing
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id')
      .eq('id', barberId)
      .eq('barbershop_id', barbershop_id)
      .single()

    if (barberError || !barber) {
      return { error: 'Barbeiro não encontrado ou sem permissão.' }
    }

    // DELETE all existing assignments for this barber
    const { error: deleteError } = await supabase
      .from('barber_services')
      .delete()
      .eq('barber_id', barberId)

    if (deleteError) {
      return { error: deleteError.message }
    }

    // INSERT new assignments (only if any were provided)
    if (assignments.length > 0) {
      const { error: insertError } = await supabase
        .from('barber_services')
        .insert(
          assignments.map((a) => ({
            barber_id: barberId,
            service_id: a.service_id,
            commission_type: a.commission_type ?? null,
            commission_value: a.commission_value ?? null,
          }))
        )

      if (insertError) {
        return { error: insertError.message }
      }
    }

    revalidatePath('/dashboard/equipe')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}

// ─── syncServiceBarbers ───────────────────────────────────────────────────────
/**
 * syncServiceBarbers — Sincroniza quais barbeiros oferecem um determinado serviço.
 *
 * Chamado a partir do ServiceDrawer. Commission fields ficam NULL ao adicionar
 * pelo lado do serviço (per D-15 — commission é definida no drawer do barbeiro).
 *
 * Padrão: DELETE os barbeiros NOT IN barberIds, depois INSERT os faltantes com
 * ON CONFLICT DO NOTHING (via upsert ignoreDuplicates) para não sobrescrever
 * commission_type/commission_value já definidos no drawer do barbeiro.
 *
 * Threat model T-01-15: RLS em barber_services via subquery barbers.barbershop_id
 * garante que owner não atribui barbeiro de outro tenant.
 */
export async function syncServiceBarbers(
  serviceId: string,
  barberIds: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !claimsData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershop_id) {
      return { error: 'Barbearia não encontrada.' }
    }

    if (barberIds.length === 0) {
      // Nenhum barbeiro selecionado — remove todas as atribuições para este serviço
      const { error: deleteError } = await supabase
        .from('barber_services')
        .delete()
        .eq('service_id', serviceId)

      if (deleteError) {
        return { error: deleteError.message }
      }
    } else {
      // Remove barbeiros que NÃO estão na nova seleção
      const { error: deleteError } = await supabase
        .from('barber_services')
        .delete()
        .eq('service_id', serviceId)
        .not('barber_id', 'in', `(${barberIds.map((id) => `"${id}"`).join(',')})`)

      if (deleteError) {
        return { error: deleteError.message }
      }

      // Insere entradas faltantes — ignoreDuplicates preserva commission existente (D-15)
      const rows = barberIds.map((barberId) => ({
        barber_id: barberId,
        service_id: serviceId,
        commission_type: null as string | null,
        commission_value: null as number | null,
      }))

      const { error: insertError } = await supabase
        .from('barber_services')
        .upsert(rows, { onConflict: 'barber_id,service_id', ignoreDuplicates: true })

      if (insertError) {
        return { error: insertError.message }
      }
    }

    revalidatePath('/dashboard/servicos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}
