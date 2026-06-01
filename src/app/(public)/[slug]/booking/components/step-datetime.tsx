'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { getAvailableSlots } from '@/app/actions/public-booking'

interface StepDatetimeProps {
  slug: string
  barberId: string
  serviceId: string
  durationMinutes: number
  timezone: string
  onComplete: (slotISO: string) => void
  onBack: () => void
}

/**
 * Step 3 — Selecionar data e horário.
 *
 * Comportamento:
 *   - Ao montar e ao mudar a data: chama getAvailableSlots() server action
 *   - Exibe spinner durante o carregamento
 *   - Exibe grid 3 colunas com os horários disponíveis
 *   - Horário selecionado: borda dourada
 *   - Botão "Confirmar horário" desabilitado até selecionar um slot
 *
 * Slots retornados são ISO UTC strings. Exibição convertida para timezone da barbearia.
 */
export function StepDatetime({
  slug,
  barberId,
  serviceId,
  timezone,
  onComplete,
  onBack,
}: StepDatetimeProps) {
  // Data inicial: hoje no formato 'YYYY-MM-DD'
  const todayStr = new Date().toISOString().slice(0, 10)

  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [slots, setSlots] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  /**
   * Formata um ISO UTC slot para exibição na timezone da barbearia.
   * Retorna algo como '09:00'.
   */
  function formatSlot(isoUTC: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoUTC))
  }

  /**
   * Busca slots disponíveis para a data selecionada.
   */
  const fetchSlots = useCallback(
    async (date: string) => {
      setIsLoading(true)
      setError(null)
      setSelectedSlot(null)
      setSlots([])

      const result = await getAvailableSlots({
        barbershop_slug: slug,
        barber_id: barberId,
        service_id: serviceId,
        date,
      })

      if ('error' in result) {
        setError(result.error)
      } else {
        setSlots(result.slots)
      }

      setIsLoading(false)
    },
    [slug, barberId, serviceId]
  )

  // Busca slots ao montar e ao trocar a data
  useEffect(() => {
    fetchSlots(selectedDate)
  }, [selectedDate, fetchSlots])

  const handleConfirm = () => {
    if (selectedSlot) {
      onComplete(selectedSlot)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Seletor de data */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-date" className="text-sm font-medium text-foreground">
          Data
        </label>
        <input
          id="booking-date"
          type="date"
          value={selectedDate}
          min={todayStr}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-11 rounded-lg border border-white/10 bg-[#0b0f17] px-3 text-foreground focus:border-[#d4a574]/50 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/20"
        />
      </div>

      {/* Estado: carregando */}
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="size-8 animate-spin rounded-full border-2 border-[#d4a574] border-t-transparent" />
        </div>
      )}

      {/* Estado: erro */}
      {!isLoading && error && (
        <Alert className="border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </Alert>
      )}

      {/* Estado: sem horários */}
      {!isLoading && !error && slots.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nenhum horário disponível para este dia.
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]/60">
            Tente selecionar outra data.
          </p>
        </div>
      )}

      {/* Grid de slots */}
      {!isLoading && slots.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Horário disponível</p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(isSelected ? null : slot)}
                  className={[
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/40',
                    isSelected
                      ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                      : 'border-white/10 text-foreground hover:border-[#d4a574]/40 hover:bg-[#d4a574]/5',
                  ].join(' ')}
                >
                  {formatSlot(slot)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="h-11">
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedSlot}
          className="h-11 min-w-[160px]"
        >
          Confirmar horário
        </Button>
      </div>
    </div>
  )
}
