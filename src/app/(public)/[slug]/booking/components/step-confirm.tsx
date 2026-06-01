'use client'

import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepConfirmProps {
  appointment: {
    id: string
    start_time: string
  }
  barbershopName: string
  barbershopSlug: string
  serviceName: string
  barberName: string
  timezone: string
}

/**
 * Step 5 — Confirmação do agendamento.
 *
 * Exibe resumo do agendamento criado:
 *   - Ícone de check dourado
 *   - "Agendamento confirmado!"
 *   - Status PENDENTE (aguardando confirmação da barbearia)
 *   - Resumo: serviço, barbeiro, data e hora (convertidos para timezone da barbearia)
 *   - Botão para fazer novo agendamento (recarrega a página)
 *
 * start_time é ISO UTC — exibido na timezone da barbearia via Intl.DateTimeFormat.
 */
export function StepConfirm({
  appointment,
  barbershopName,
  barbershopSlug,
  serviceName,
  barberName,
  timezone,
}: StepConfirmProps) {
  const appointmentDate = new Date(appointment.start_time)

  // Formata data completa: "segunda-feira, 2 de junho de 2026"
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(appointmentDate)

  // Formata hora: "14:30"
  const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(appointmentDate)

  const handleNewBooking = () => {
    window.location.href = `/${barbershopSlug}/booking`
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      {/* Ícone de sucesso */}
      <div className="flex size-16 items-center justify-center rounded-full bg-[#d4a574]/15">
        <CheckCircle className="size-9 text-[#d4a574]" />
      </div>

      {/* Título */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Agendamento confirmado!</h2>
        <p className="text-sm text-[var(--text-secondary)]">{barbershopName}</p>
      </div>

      {/* Status badge */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/50 bg-amber-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Pendente
      </div>

      {/* Resumo do agendamento */}
      <div className="w-full rounded-xl border border-white/[0.07] bg-[#0b0f17] p-4">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-secondary)]">Serviço</dt>
            <dd className="font-medium text-foreground">{serviceName}</dd>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-secondary)]">Barbeiro</dt>
            <dd className="font-medium text-foreground">{barberName}</dd>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className="flex items-start justify-between gap-2">
            <dt className="text-[var(--text-secondary)]">Data</dt>
            <dd className="text-right font-medium capitalize text-foreground">
              {dateFormatted}
            </dd>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-secondary)]">Horário</dt>
            <dd className="font-medium text-foreground">{timeFormatted}</dd>
          </div>
        </dl>
      </div>

      {/* Mensagem de status */}
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Seu agendamento está{' '}
        <span className="font-semibold text-amber-400">PENDENTE</span> e será confirmado
        em breve pela barbearia.
      </p>

      {/* Ação */}
      <Button
        type="button"
        variant="outline"
        onClick={handleNewBooking}
        className="h-11 w-full border-white/10 text-foreground hover:border-[#d4a574]/40 hover:bg-[#d4a574]/5"
      >
        Fazer novo agendamento
      </Button>
    </div>
  )
}
