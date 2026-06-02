'use client'

import { useState } from 'react'
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

function BarberAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [imgError, setImgError] = useState(false)

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover"
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d4a574]/20 text-sm font-bold text-[#d4a574]">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

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
                <BarberAvatar name={barber.name} photoUrl={barber.photo_url} />
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
