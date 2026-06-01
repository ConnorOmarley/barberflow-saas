'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createBarbershop, createOnboardingBarber, createOnboardingService } from '@/app/actions/barbershop'
import { upsertBarberWorkingHours } from '@/app/actions/working-hours'
import type { WorkingHourInput } from '@/app/(owner)/onboarding/components/working-hours-grid'
import { Step1Form, Step2Form, Step3Form, Step4Form } from './components/wizard-steps'

const TOTAL_STEPS = 4

const STEP_LABELS: Record<number, string> = {
  1: 'PASSO 1 DE 4',
  2: 'PASSO 2 DE 4',
  3: 'PASSO 3 DE 4',
  4: 'PASSO 4 DE 4',
}

const STEP_HEADINGS: Record<number, string> = {
  1: 'Configure sua barbearia',
  2: 'Horários do primeiro barbeiro',
  3: 'Adicione o primeiro barbeiro',
  4: 'Cadastre o primeiro serviço',
}

const STEP_BODIES: Record<number, string> = {
  1: 'Comece definindo o nome e o fuso horário da sua barbearia.',
  2: 'Defina os dias e horários de atendimento do barbeiro.',
  3: 'Adicione o barbeiro principal. Você pode convidá-lo por email para acessar o painel.',
  4: 'Cadastre o primeiro serviço. Você poderá adicionar mais depois.',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [barbershopId, setBarbershopId] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  // pendingHours: stored in React state after Step 2, written to DB after Step 3
  // when the barber_id is known (working_hours are per-barber, not shop-level)
  const [pendingHours, setPendingHours] = useState<WorkingHourInput[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Resume detection — check DB for existing progress and jump to the right step
  useEffect(() => {
    async function detectResume() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      // Check if barbershop_id is already set in profile (step 1 completed)
      const { data: profile } = await supabase
        .from('profiles')
        .select('barbershop_id')
        .eq('id', user.id)
        .single()

      if (!profile?.barbershop_id) {
        setIsLoading(false)
        return
      }

      setBarbershopId(profile.barbershop_id)

      // Check if any barbers exist (step 3 completed)
      const { data: barbers } = await supabase
        .from('barbers')
        .select('id')
        .eq('barbershop_id', profile.barbershop_id)
        .limit(1)

      if (!barbers || barbers.length === 0) {
        // Step 1 done, steps 3 and 4 not done → resume at step 3
        // (step 2 hours are ephemeral — resume without pre-filling)
        setStep(3)
        setIsLoading(false)
        return
      }

      setBarberId(barbers[0].id)

      // Check if any services exist (step 4 completed)
      const { data: services } = await supabase
        .from('services')
        .select('id')
        .eq('barbershop_id', profile.barbershop_id)
        .limit(1)

      if (!services || services.length === 0) {
        // Steps 1–3 done → resume at step 4
        setStep(4)
      } else {
        // All done — middleware should redirect to /dashboard,
        // but if we get here just redirect manually
        router.push('/dashboard')
      }

      setIsLoading(false)
    }

    detectResume()
  }, [router])

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleStep1Complete = async (data: { name: string; timezone: string }) => {
    const result = await createBarbershop(data)
    if ('error' in result) throw new Error(result.error)

    const newBarbershopId = result.data.barbershop_id
    setBarbershopId(newBarbershopId)

    // JWT refresh — injects barbershop_id into the token so Steps 2–4
    // Server Actions can read it from getClaims() (D-05, RESEARCH Pattern 3)
    const supabase = createClient()
    await supabase.auth.refreshSession()

    setStep(2)
  }

  const handleStep2Complete = (hours: WorkingHourInput[]) => {
    // Store hours in React state — NOT written to DB yet.
    // upsertBarberWorkingHours is called in handleStep3Complete after
    // the barber_id is known (working_hours are per-barber_id, D-09).
    setPendingHours(hours)
    setStep(3)
  }

  const handleStep3Complete = async (data: {
    name: string
    phone?: string
    inviteEmail?: string
  }) => {
    const result = await createOnboardingBarber({ name: data.name, phone: data.phone })
    if ('error' in result) throw new Error(result.error)

    const newBarberId = result.data.barber_id
    setBarberId(newBarberId)

    // Write pending working hours now that we have the barber_id
    if (pendingHours.length > 0) {
      const hoursResult = await upsertBarberWorkingHours(newBarberId, pendingHours)
      if ('error' in hoursResult) {
        // Non-fatal — log and continue; owner can set hours in barber edit drawer
        console.warn('[onboarding] Failed to save working hours:', hoursResult.error)
      }
    }

    setStep(4)
  }

  const handleStep4Complete = async (data: {
    name: string
    duration_minutes: number
    price: number
  }) => {
    const result = await createOnboardingService(data)
    if ('error' in result) throw new Error(result.error)

    router.push('/dashboard')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-[#d4a574] border-t-transparent" />
      </div>
    )
  }

  const progressPercent = (step / TOTAL_STEPS) * 100

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12">
      <div className="mx-4 w-full max-w-[560px]">
        {/* Brand mark */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
            B
          </div>
          <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
            BARBERFLOW
          </span>
        </div>

        {/* Step indicator dots */}
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

        {/* Wizard card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151922] p-8 shadow-2xl">
          {/* Progress bar */}
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #e8c89a, #d4a574)',
              }}
            />
          </div>

          {/* Step label */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d4a574]">
            {STEP_LABELS[step]}
          </p>

          {/* Step heading */}
          <h1 className="mb-1 text-xl font-semibold text-foreground">
            {STEP_HEADINGS[step]}
          </h1>

          {/* Step body */}
          <p className="mb-6 text-sm text-[var(--text-secondary)]">
            {STEP_BODIES[step]}
          </p>

          {/* Step content */}
          {step === 1 && (
            <Step1Form onComplete={handleStep1Complete} />
          )}
          {step === 2 && (
            <Step2Form
              onComplete={handleStep2Complete}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3Form
              onComplete={handleStep3Complete}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4Form
              onComplete={handleStep4Complete}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
