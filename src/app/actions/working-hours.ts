'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type WorkingHourInput = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6
  start_time: string
  end_time: string
  is_active: boolean
}

export async function upsertBarberWorkingHours(
  barberId: string,
  hours: WorkingHourInput[],
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: authData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !authData?.claims) return { error: 'Não autenticado.' }

    const userId = authData.claims.sub as string | undefined
    if (!userId) return { error: 'Usuário não encontrado.' }

    const admin = createAdminClient()

    // Get barbershop_id from profiles (source of truth)
    const { data: profile } = await admin.from('profiles').select('barbershop_id').eq('id', userId).single()
    const barbershopId = profile?.barbershop_id
    if (!barbershopId) return { error: 'Barbearia não encontrada.' }

    // Verify barber belongs to this barbershop (belt-and-suspenders)
    const { data: barber, error: barberError } = await admin
      .from('barbers')
      .select('id')
      .eq('id', barberId)
      .eq('barbershop_id', barbershopId)
      .single()

    if (barberError || !barber) return { error: 'Barbeiro não encontrado ou sem permissão.' }

    // DELETE all existing working_hours for this barber
    const { error: deleteError } = await admin.from('working_hours').delete().eq('barber_id', barberId)
    if (deleteError) return { error: deleteError.message }

    // INSERT the new set (only active days)
    const activeHours = hours.filter((h) => h.is_active)
    if (activeHours.length > 0) {
      const { error: insertError } = await admin.from('working_hours').insert(
        activeHours.map((h) => ({
          barber_id: barberId,
          day_of_week: h.day_of_week,
          start_time: h.start_time,
          end_time: h.end_time,
          is_active: true,
        })),
      )
      if (insertError) return { error: insertError.message }
    }

    revalidatePath('/dashboard/equipe')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}
