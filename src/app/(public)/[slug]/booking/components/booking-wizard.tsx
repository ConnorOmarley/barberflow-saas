'use client'

import { useState } from 'react'
import { createPublicAppointment } from '@/app/actions/public-booking'
import { StepService } from './step-service'
import { StepBarber } from './step-barber'
import { StepDatetime } from './step-datetime'
import { StepClient } from './step-client'
import { StepConfirm } from './step-confirm'
import type { Service } from './step-service'
import type { Barber } from './step-barber'
import type { ClientFormData } from './step-client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  barbershop: { id: string; name: string; slug: string; timezone: string }
  services: Service[]
  barbers: Barber[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

const STEP_LABELS: Record<number, string> = {
  1: 'PASSO 1 DE 4',
  2: 'PASSO 2 DE 4',
  3: 'PASSO 3 DE 4',
  4: 'PASSO 4 DE 4',
}

const STEP_TITLES: Record<number, string> = {
  1: 'Escolha o serviço',
  2: 'Escolha o barbeiro',
  3: 'Escolha a data e horário',
  4: 'Seus dados',
}

// ─── BookingWizard ───────────────────────────────────────────────────────────

/**
 * Wizard de agendamento público — state machine 4 steps + confirmação.
 *
 * Fluxo:
 *   Step 1: Selecionar serviço (StepService)
 *   Step 2: Selecionar barbeiro (StepBarber)
 *   Step 3: Selecionar data + slot (StepDatetime) — chama getAvailableSlots
 *   Step 4: Dados do cliente (StepClient) — chama createPublicAppointment
 *   Step 5: Confirmação (StepConfirm)
 *
 * Estado acumulado entre steps — não enviado ao servidor até o step 4.
 * barbershop_id NUNCA exposto ao cliente — resolvido via slug na Server Action.
 */
export function BookingWizard({ barbershop, services, barbers }: BookingWizardProps) {
  const [step, setStep] = useState(1)

  // Estado acumulado entre steps
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [confirmedAppointment, setConfirmedAppointment] = useState<{
    id: string
    start_time: string
  } | null>(null)

  // Progresso da barra (steps 1-4 apenas)
  const progressPercent = step <= TOTAL_STEPS ? (step / TOTAL_STEPS) * 100 : 100

  // ─── Handlers de step ────────────────────────────────────────────────────

  const handleStep1Complete = (service: Service) => {
    setSelectedService(service)
    setStep(2)
  }

  const handleStep2Complete = (barber: Barber) => {
    setSelectedBarber(barber)
    setStep(3)
  }

  const handleStep3Complete = (slotISO: string) => {
    setSelectedSlot(slotISO)
    setStep(4)
  }

  /**
   * Step 4 — Submete para a Server Action createPublicAppointment.
   * Se 'error' in result → throw new Error (capturado pelo StepClient)
   * Se 'data' → avança para o step de confirmação
   */
  const handleStep4Complete = async (clientData: ClientFormData) => {
    if (!selectedService || !selectedBarber || !selectedSlot) {
      throw new Error('Dados incompletos. Reinicie o agendamento.')
    }

    const result = await createPublicAppointment({
      barbershop_slug: barbershop.slug,
      service_id: selectedService.id,
      barber_id: selectedBarber.id,
      start_time: selectedSlot,
      client: {
        full_name: clientData.full_name,
        whatsapp_number: clientData.whatsapp_number,
        whatsapp_opt_in: clientData.whatsapp_opt_in,
      },
    })

    if ('error' in result) {
      throw new Error(result.error)
    }

    setConfirmedAppointment(result.data)
    setStep(5)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12">
      <div className="mx-4 w-full max-w-[560px]">
        {/* Brand mark — idêntico ao onboarding */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
            B
          </div>
          <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
            BARBERFLOW
          </span>
        </div>

        {/* Dots de progresso — somente nos steps 1-4 */}
        {step <= TOTAL_STEPS && (
          <div className="mb-6 flex justify-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const dotStep = i + 1
              const isActive = dotStep === step
              const isCompleted = dotStep < step
              return (
                <div
                  key={dotStep}
                  className={[
                    'h-2 rounded-full transition-all duration-300',
                    isActive
                      ? 'w-4 bg-[#d4a574]'
                      : isCompleted
                        ? 'w-2 bg-[#d4a574]/40'
                        : 'w-2 bg-white/15',
                  ].join(' ')}
                />
              )
            })}
          </div>
        )}

        {/* Card do wizard */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151922] shadow-2xl">
          {/* Barra de progresso no topo do card */}
          {step <= TOTAL_STEPS && (
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #e8c89a, #d4a574)',
                }}
              />
            </div>
          )}

          <div className="p-8 pt-9">
            {/* Label do passo — somente nos steps 1-4 */}
            {step <= TOTAL_STEPS && (
              <p className="mb-2 text-xs font-semibold tracking-[0.1em] text-[var(--text-secondary)]">
                {STEP_LABELS[step]}
              </p>
            )}

            {/* Título do step */}
            {step <= TOTAL_STEPS && (
              <h1 className="mb-6 text-xl font-bold text-foreground">
                {STEP_TITLES[step]}
              </h1>
            )}

            {/* Step 1 — Serviço */}
            {step === 1 && (
              <StepService services={services} onComplete={handleStep1Complete} />
            )}

            {/* Step 2 — Barbeiro */}
            {step === 2 && (
              <StepBarber
                barbers={barbers}
                onComplete={handleStep2Complete}
                onBack={() => setStep(1)}
              />
            )}

            {/* Step 3 — Data e horário */}
            {step === 3 && selectedService && selectedBarber && (
              <StepDatetime
                slug={barbershop.slug}
                barberId={selectedBarber.id}
                serviceId={selectedService.id}
                durationMinutes={selectedService.duration_minutes}
                timezone={barbershop.timezone}
                onComplete={handleStep3Complete}
                onBack={() => setStep(2)}
              />
            )}

            {/* Step 4 — Dados do cliente */}
            {step === 4 && (
              <StepClient onComplete={handleStep4Complete} onBack={() => setStep(3)} />
            )}

            {/* Step 5 — Confirmação */}
            {step === 5 && confirmedAppointment && selectedService && selectedBarber && (
              <StepConfirm
                appointment={confirmedAppointment}
                barbershopName={barbershop.name}
                barbershopSlug={barbershop.slug}
                serviceName={selectedService.name}
                barberName={selectedBarber.name}
                timezone={barbershop.timezone}
              />
            )}
          </div>
        </div>

        {/* Nome da barbearia abaixo do card */}
        <p className="mt-4 text-center text-xs text-[var(--text-secondary)]/60">
          {barbershop.name}
        </p>
      </div>
    </div>
  )
}
