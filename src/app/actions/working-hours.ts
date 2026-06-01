'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// WorkingHourInput represents one slot per weekday for a barber.
// Multiple rows per day are not supported in the onboarding wizard
// (split shifts are a barber edit drawer feature — plan 01-05).
export type WorkingHourInput = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
  is_active: boolean
}

// ─── upsertBarberWorkingHours ─────────────────────────────────────────────────
// DELETE all existing rows for barberId, then INSERT the new set.
// RLS enforces that barber.barbershop_id = JWT barbershop_id (T-01-07 mitigation).
// barberId is provided by the caller (Step 3 handler after createOnboardingBarber),
// but RLS validates ownership at the DB level — app-layer check is a secondary guard.

export async function upsertBarberWorkingHours(
  barberId: string,
  hours: WorkingHourInput[],
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: authData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !authData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const barbershopId = authData.claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershopId) {
      return { error: 'Barbearia não encontrada.' }
    }

    // App-layer guard: verify barber belongs to this barbershop before writing
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id')
      .eq('id', barberId)
      .eq('barbershop_id', barbershopId)
      .single()

    if (barberError || !barber) {
      return { error: 'Barbeiro não encontrado ou sem permissão.' }
    }

    // DELETE all existing working_hours for this barber
    const { error: deleteError } = await supabase
      .from('working_hours')
      .delete()
      .eq('barber_id', barberId)

    if (deleteError) {
      return { error: deleteError.message }
    }

    // INSERT the new set (only active days are written to DB)
    const activeHours = hours.filter((h) => h.is_active)
    if (activeHours.length > 0) {
      const { error: insertError } = await supabase.from('working_hours').insert(
        activeHours.map((h) => ({
          barber_id: barberId,
          day_of_week: h.day_of_week,
          start_time: h.start_time,
          end_time: h.end_time,
          is_active: true,
        })),
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
