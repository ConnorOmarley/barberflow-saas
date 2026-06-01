'use client'

import { Button } from '@/components/ui/button'

interface Barber {
  id: string
  name: string
  photo_url: string | null
}

interface StepBarberProps {
  barbers: Barber[]
  onComplete: (barber: Barber) => void
  onBack: () => void
}

/**
 * Step 2 — Selecionar barbeiro.
 *
 * Exibe cards clicáveis com avatar (foto ou inicial) e nome.
 * Se barbers.length === 0: exibe mensagem de fallback.
 * Botão "Voltar" retorna para o Step 1.
 */
export function StepBarber({ barbers, onComplete, onBack }: StepBarberProps) {
  return (
    <div className="flex flex-col gap-4">
      {barbers.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[var(--text-secondary)]">Nenhum barbeiro disponível no momento.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">Escolha o barbeiro de preferência</p>
          <div className="flex flex-col gap-3">
            {barbers.map((barber) => (
              <button
                key={barber.id}
                type="button"
                onClick={() => onComplete(barber)}
                className="flex items-center gap-4 rounded-xl border border-white/10 px-4 py-4 text-left transition-all duration-150 hover:border-[#d4a574]/50 hover:bg-[#d4a574]/5 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/40"
              >
                {/* Avatar — foto ou inicial */}
                {barber.photo_url ? (
                  <img
                    src={barber.photo_url}
                    alt={barber.name}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d4a574]/20 text-sm font-bold text-[#d4a574]">
                    {barber.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-medium text-foreground">{barber.name}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-2 flex justify-start">
        <Button type="button" variant="ghost" onClick={onBack} className="h-11">
          Voltar
        </Button>
      </div>
    </div>
  )
}

export type { Barber }
