'use client'

import { useState, useCallback } from 'react'
import { useCheckInNotifications } from '@/lib/hooks/use-check-in-notifications'
import { CheckCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CheckInListenerProps {
  barbershopId: string
}

interface CheckInToast {
  id: string
  appointmentId: string
  timestamp: number
}

export function CheckInListener({ barbershopId }: CheckInListenerProps) {
  const [toasts, setToasts] = useState<CheckInToast[]>([])
  const router = useRouter()

  const handleCheckIn = useCallback(
    (appointmentId: string) => {
      const toast: CheckInToast = {
        id: crypto.randomUUID(),
        appointmentId,
        timestamp: Date.now(),
      }

      setToasts((prev) => [...prev, toast])

      // Auto-dismiss após 5 segundos
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 5000)

      // Revalidar a lista de agendamentos para mostrar o novo status
      router.refresh()
    },
    [router]
  )

  useCheckInNotifications(barbershopId, handleCheckIn)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-[#0b0f17] px-4 py-3 shadow-lg"
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle className="size-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Cliente chegou!</p>
            <p className="text-xs text-[var(--text-secondary)]">Check-in registrado</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="ml-2 text-[var(--text-secondary)] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
