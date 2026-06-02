'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCheckInNotifications(
  barbershopId: string,
  onCheckIn: (appointmentId: string) => void
) {
  // Memoizar onCheckIn para evitar re-subscribe desnecessário
  const stableOnCheckIn = useCallback(onCheckIn, [onCheckIn])

  useEffect(() => {
    const supabase = createClient()

    // Usar postgres_changes como estratégia primária:
    // Mais robusto que Broadcast puro — funciona mesmo se broadcastCheckIn() falhar silenciosamente.
    // O trade-off é latência ligeiramente maior (~100-200ms vs ~50ms do Broadcast).
    const channel = supabase
      .channel(`checkin-${barbershopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as { status: string }).status === 'CHECKED_IN') {
            stableOnCheckIn((payload.new as { id: string }).id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [barbershopId, stableOnCheckIn])
}
