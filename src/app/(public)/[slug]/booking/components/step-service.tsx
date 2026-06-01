'use client'

import { Button } from '@/components/ui/button'

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
}

interface StepServiceProps {
  services: Service[]
  onComplete: (service: Service) => void
}

/**
 * Step 1 — Selecionar serviço.
 *
 * Exibe cards clicáveis com nome, duração e preço.
 * Preço armazenado como NUMERIC(10,2) em reais (ex: 35.00) — NÃO dividir por 100.
 * Ao clicar em um serviço: chama onComplete(service) e avança para o próximo step.
 */
export function StepService({ services, onComplete }: StepServiceProps) {
  if (services.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[var(--text-secondary)]">Nenhum serviço disponível no momento.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-2 text-sm text-[var(--text-secondary)]">
        Selecione o serviço desejado
      </p>
      {services.map((service) => (
        <button
          key={service.id}
          type="button"
          onClick={() => onComplete(service)}
          className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-4 text-left transition-all duration-150 hover:border-[#d4a574]/50 hover:bg-[#d4a574]/5 focus:outline-none focus:ring-2 focus:ring-[#d4a574]/40"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-foreground">{service.name}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {service.duration_minutes} min
            </p>
          </div>
          <p className="ml-4 shrink-0 font-semibold text-[#d4a574]">
            {Number(service.price).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
        </button>
      ))}
    </div>
  )
}

// Exporta o tipo Service para reutilização no wizard
export type { Service }

// Botão de voltar não é exibido no Step 1 (é o primeiro step)
export function StepServiceBackButton({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null
  return (
    <div className="mt-4 flex justify-start">
      <Button type="button" variant="ghost" onClick={onBack} className="h-11">
        Voltar
      </Button>
    </div>
  )
}
