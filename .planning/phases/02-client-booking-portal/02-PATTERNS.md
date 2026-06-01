# Phase 2: Client Booking Portal — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 14 (new/modified files inferred from Phase 2 scope)
**Analogs found:** 12 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/YYYYMMDD_phase2_schema.sql` | migration | CRUD | `supabase/migrations/20260529000001_initial_schema.sql` | exact |
| `src/lib/supabase/public.ts` | utility | request-response | `src/lib/supabase/server.ts` | role-match |
| `src/app/(public)/[slug]/layout.tsx` | layout | request-response | `src/app/(owner)/layout.tsx` | role-match |
| `src/app/(public)/[slug]/page.tsx` | component | request-response | `src/app/(owner)/dashboard/equipe/page.tsx` | role-match |
| `src/app/(public)/[slug]/booking/page.tsx` | component | request-response | `src/app/(owner)/onboarding/page.tsx` | role-match |
| `src/app/(public)/[slug]/booking/components/booking-wizard.tsx` | component | request-response | `src/app/(owner)/onboarding/page.tsx` | exact |
| `src/app/(public)/[slug]/booking/components/step-service.tsx` | component | request-response | `src/app/(owner)/onboarding/components/wizard-steps.tsx` | exact |
| `src/app/(public)/[slug]/booking/components/step-barber.tsx` | component | request-response | `src/app/(owner)/onboarding/components/wizard-steps.tsx` | exact |
| `src/app/(public)/[slug]/booking/components/step-datetime.tsx` | component | request-response | `src/app/(owner)/onboarding/components/wizard-steps.tsx` | role-match |
| `src/app/(public)/[slug]/booking/components/step-client.tsx` | component | request-response | `src/app/(owner)/onboarding/components/wizard-steps.tsx` (Step3Form) | exact |
| `src/app/(public)/[slug]/booking/components/step-confirm.tsx` | component | request-response | `src/app/(owner)/onboarding/components/wizard-steps.tsx` | role-match |
| `src/app/actions/public-booking.ts` | service | request-response | `src/app/actions/appointments.ts` | role-match |
| `src/middleware.ts` (modify) | middleware | request-response | `src/middleware.ts` | exact (self) |
| `src/types/database.types.ts` (regenerate) | config | — | `src/types/database.types.ts` | exact (self) |

---

## Pattern Assignments

### `src/lib/supabase/public.ts` (utility, request-response)

**Analogia:** `src/lib/supabase/server.ts` + `src/lib/supabase/client.ts`

**Contexto:** A Phase 2 precisa de leituras publicas (sem sessao autenticada) usando a anon key.
O codebase ja usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para o browser client — reutilizar a
mesma key para reads publicos no servidor e seguro pois as RLS policies controlam acesso.

**Padrao de imports** (baseado em `src/lib/supabase/server.ts` linhas 1-4):
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
```

**Padrao do client** (baseado em `src/lib/supabase/admin.ts` linhas 11-22 — mesma estrutura sem service role):
```typescript
/**
 * Public Supabase client — anon key, sem sessao.
 * Use APENAS para leituras publicas em Server Components e Server Actions do portal de agendamento.
 * RLS policies de SELECT com anon role controlam o que e visivel.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

---

### `src/app/(public)/[slug]/layout.tsx` (layout, request-response)

**Analogia:** `src/app/(owner)/layout.tsx`

**Contexto:** O layout publico NAO autentica — apenas existe para criar o route group `(public)`.
Ao contrario de `(owner)/layout.tsx`, nao faz redirect em caso de ausencia de sessao.

**Padrao de imports** (baseado em `src/app/(owner)/layout.tsx` linhas 1-2):
```typescript
import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
```

**Padrao do layout** (baseado em `src/app/(owner)/layout.tsx` linhas 4-23 — sem auth check):
```typescript
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  // Valida que o slug existe — 404 se nao existir
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  return <>{children}</>
}
```

**Diferenca critica vs layouts autenticados:** Nenhum `getClaims()`, nenhum `redirect('/entrar')`.

---

### `src/app/(public)/[slug]/page.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/dashboard/equipe/page.tsx`

**Padrao de imports** (baseado em `src/app/(owner)/dashboard/equipe/page.tsx` linhas 1-6):
```typescript
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
```

**Padrao de data fetching** (baseado em `src/app/(owner)/dashboard/equipe/page.tsx` linhas 12-35):
```typescript
export default async function BarbershopLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, timezone')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  return (
    // landing page publica — sem DashboardShell
    <div className="min-h-screen bg-background">
      {/* ... */}
    </div>
  )
}
```

**Diferenca critica:** Usa `createPublicClient()` em vez de `createClient()`. Sem `getClaims()`.
Sem `DashboardShell` — layout proprio minimalista.

---

### `src/app/(public)/[slug]/booking/page.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/page.tsx` (Server Component wrapper que alimenta o wizard)

**Padrao de data pre-loading** (baseado em `src/app/(owner)/dashboard/equipe/page.tsx` linhas 24-36):
```typescript
export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, timezone')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  // Pre-load services + barbers para o wizard — sem waterfalls no cliente
  const [{ data: services }, { data: barbers }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('barbershop_id', barbershop.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('barbers')
      .select('id, name, photo_url')
      .eq('barbershop_id', barbershop.id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <BookingWizard
      barbershop={barbershop}
      services={services ?? []}
      barbers={barbers ?? []}
    />
  )
}
```

---

### `src/app/(public)/[slug]/booking/components/booking-wizard.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/page.tsx` — padrao de wizard multi-step com estado React

**Padrao de imports** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 1-9):
```typescript
'use client'

import { useState } from 'react'
```

**Padrao de step state machine** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 11-32):
```typescript
const TOTAL_STEPS = 4  // servico, barbeiro, data/hora, dados do cliente

const STEP_LABELS: Record<number, string> = {
  1: 'PASSO 1 DE 4',
  2: 'PASSO 2 DE 4',
  3: 'PASSO 3 DE 4',
  4: 'PASSO 4 DE 4',
}
```

**Padrao de dots de progresso** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 192-211):
```tsx
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
```

**Padrao da progress bar no card** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 216-228):
```tsx
<div className="absolute inset-x-0 top-0 h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
  <div
    className="h-full transition-all duration-300 ease-in-out"
    style={{
      width: `${progressPercent}%`,
      background: 'linear-gradient(90deg, #e8c89a, #d4a574)',
    }}
  />
</div>
```

**Padrao do container do wizard** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 178-213):
```tsx
return (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12">
    <div className="mx-4 w-full max-w-[560px]">
      {/* Brand mark identico ao onboarding */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
          B
        </div>
        <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
          BARBERFLOW
        </span>
      </div>
      {/* dots */}
      {/* wizard card com overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151922] p-8 shadow-2xl */}
    </div>
  </div>
)
```

**Padrao de step handlers** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 109-163):
```typescript
// Estado acumulado entre steps — nao enviado ao servidor ate o step final
const [selectedService, setSelectedService] = useState<ServiceRow | null>(null)
const [selectedBarber, setSelectedBarber] = useState<BarberRow | null>(null)
const [selectedSlot, setSelectedSlot] = useState<string | null>(null) // ISO string

const handleStep1Complete = (service: ServiceRow) => {
  setSelectedService(service)
  setStep(2)
}

const handleStep2Complete = (barber: BarberRow) => {
  setSelectedBarber(barber)
  setStep(3)
}

const handleStep3Complete = (slotISO: string) => {
  setSelectedSlot(slotISO)
  setStep(4)
}

// Step 4 (dados do cliente) chama a Server Action
const handleStep4Complete = async (clientData: ClientFormData) => {
  const result = await createPublicAppointment({ ... })
  if ('error' in result) throw new Error(result.error)
  setStep(5) // step de confirmacao/sucesso
}
```

---

### `src/app/(public)/[slug]/booking/components/step-service.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/components/wizard-steps.tsx` (Step4Form — selecao de servico)

**Padrao de imports** (baseado em `wizard-steps.tsx` linhas 1-20):
```typescript
'use client'

import { Button } from '@/components/ui/button'
import type { Tables } from '@/types/database.types'
```

**Padrao de selecao visual (card grid, nao form):**
```tsx
// Selecao por click — sem form submit, sem RHF (nao e entrada de texto)
interface StepServiceProps {
  services: Pick<Tables<'services'>, 'id' | 'name' | 'duration_minutes' | 'price'>[]
  onComplete: (service: typeof services[number]) => void
}

export function StepService({ services, onComplete }: StepServiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {services.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onComplete(s)}
          className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left transition-colors hover:border-[#d4a574]/40 hover:bg-[#d4a574]/5"
        >
          <div>
            <p className="font-medium text-foreground">{s.name}</p>
            <p className="text-sm text-[var(--text-secondary)]">{s.duration_minutes} min</p>
          </div>
          <p className="font-semibold text-[#d4a574]">
            {(s.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </button>
      ))}
    </div>
  )
}
```

---

### `src/app/(public)/[slug]/booking/components/step-barber.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/components/wizard-steps.tsx` — mesmo padrao de selecao de card sem form

**Padrao de props** (baseado na estrutura do Step-Service acima):
```typescript
interface StepBarberProps {
  barbers: Pick<Tables<'barbers'>, 'id' | 'name' | 'photo_url'>[]
  onComplete: (barber: typeof barbers[number]) => void
  onBack: () => void
}
```

**Padrao de botao Voltar** (baseado em `wizard-steps.tsx` linhas 308-311):
```tsx
<div className="flex justify-between mt-4 gap-3">
  <Button type="button" variant="ghost" onClick={onBack} className="h-11">
    Voltar
  </Button>
</div>
```

---

### `src/app/(public)/[slug]/booking/components/step-datetime.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/components/working-hours-grid.tsx` — selecao de slot de tempo

**Contexto:** Sem analog exato (slot picker nao existe no codebase). Mais proximo e o WorkingHoursGrid
que manipula horarios. Ver secao "No Analog Found" para detalhes.

**Padrao de props esperado:**
```typescript
interface StepDatetimeProps {
  barbershopId: string
  barberId: string
  serviceId: string
  durationMinutes: number
  timezone: string
  onComplete: (slotISO: string) => void
  onBack: () => void
}
```

**Padrao de loading state** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 168-174):
```tsx
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="size-8 animate-spin rounded-full border-2 border-[#d4a574] border-t-transparent" />
    </div>
  )
}
```

---

### `src/app/(public)/[slug]/booking/components/step-client.tsx` (component, request-response)

**Analogia:** `src/app/(owner)/onboarding/components/wizard-steps.tsx` (Step3Form — coleta de dados do cliente)

**Padrao RHF + Zod** (baseado em `wizard-steps.tsx` linhas 206-248):
```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

const clientSchema = z.object({
  full_name: z.string().min(2, 'Nome e obrigatorio'),
  whatsapp_number: z.string().min(10, 'Numero invalido'),
  whatsapp_opt_in: z.boolean(),
})
type ClientFormData = z.infer<typeof clientSchema>
```

**Padrao de form submit com loading + error** (baseado em `wizard-steps.tsx` linhas 88-98):
```typescript
const onSubmit = async (formData: ClientFormData) => {
  setIsLoading(true)
  setError(null)
  try {
    await onComplete(formData)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao confirmar.')
  } finally {
    setIsLoading(false)
  }
}
```

**Padrao de Alert de erro** (baseado em `wizard-steps.tsx` linhas 103-105):
```tsx
{error && (
  <Alert className="border-red-900/50 bg-red-950/30 text-red-400 text-sm px-4 py-3">
    {error}
  </Alert>
)}
```

**Padrao de input com Label** (baseado em `wizard-steps.tsx` linhas 108-119):
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="full-name">Nome completo</Label>
  <Input
    id="full-name"
    placeholder="Ex: Joao Silva"
    {...register('full_name')}
    aria-invalid={!!errors.full_name}
  />
  {errors.full_name && (
    <p className="text-xs text-destructive">{errors.full_name.message}</p>
  )}
</div>
```

**Padrao de Checkbox** (baseado em `wizard-steps.tsx` linhas 281-305):
```tsx
<div className="flex items-center gap-2">
  <Checkbox
    id="whatsapp-optin"
    checked={optIn}
    onCheckedChange={(checked: boolean) => {
      setOptIn(checked)
      setValue('whatsapp_opt_in', checked)
    }}
  />
  <Label htmlFor="whatsapp-optin" className="cursor-pointer font-normal text-sm">
    Aceito receber lembretes pelo WhatsApp
  </Label>
</div>
```

**Padrao de botao com spinner** (baseado em `wizard-steps.tsx` linhas 312-320):
```tsx
<Button type="submit" disabled={isLoading} className="h-11 min-w-[160px] ml-auto">
  {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar agendamento'}
</Button>
```

---

### `src/app/(public)/[slug]/booking/components/step-confirm.tsx` (component, request-response)

**Analogia:** Tela de sucesso. Sem analog exato — o onboarding nao tem tela de sucesso, apenas
`router.push('/dashboard')`. Pattern minimalista: icone + mensagem + link para nova reserva.

**Padrao de loading spinner** (baseado em `src/app/(owner)/onboarding/page.tsx` linhas 168-174):
```tsx
// Reutilizar o mesmo spinner ring do projeto
<div className="size-8 animate-spin rounded-full border-2 border-[#d4a574] border-t-transparent" />
```

---

### `src/app/actions/public-booking.ts` (service, request-response)

**Analogia:** `src/app/actions/appointments.ts` — mesma estrutura de Server Action com CRUD

**Diferenca critica:** Nao usa `getClaims()` (cliente nao autenticado). Usa `createPublicClient()`
para reads e `createAdminClient()` para o INSERT final (bypassa RLS para clientes anonimos).

**Padrao de imports** (baseado em `src/app/actions/appointments.ts` linhas 1-3):
```typescript
'use server'

import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
```

**Padrao de validacao + lookup de barbershop por slug** (sem analog — novo padrao):
```typescript
export async function createPublicAppointment(input: {
  barbershop_slug: string
  service_id: string
  barber_id: string
  start_time: string // ISO string
  client: {
    full_name: string
    whatsapp_number: string
    whatsapp_opt_in: boolean
  }
}): Promise<{ data: { id: string; start_time: string } } | { error: string }> {
  // 1. Resolver barbershop_id a partir do slug
  const supabase = createPublicClient()
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id')
    .eq('slug', input.barbershop_slug)
    .single()

  if (!barbershop) return { error: 'Barbearia nao encontrada' }
```

**Padrao de compute end_time server-side** (baseado em `src/app/actions/appointments.ts` linhas 114-125):
```typescript
  // Buscar duracao do servico no DB — server-side para prevenir tampering (T-01-19)
  const { data: serviceData } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', input.service_id)
    .single()

  if (!serviceData) return { error: 'Servico nao encontrado' }

  const startMs = new Date(input.start_time).getTime()
  const endTime = new Date(startMs + serviceData.duration_minutes * 60_000).toISOString()
```

**Padrao de conflict check** (baseado em `src/app/actions/appointments.ts` linhas 147-157):
```typescript
  const { data: conflictData } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', input.barber_id)
    .neq('status', 'CANCELLED')
    .lt('start_time', endTime)
    .gt('end_time', input.start_time)
    .limit(1)

  if ((conflictData?.length ?? 0) > 0) {
    return { error: 'Horario indisponivel. Escolha outro horario.' }
  }
```

**Padrao de upsert cliente + INSERT appointment via adminClient** (baseado em `src/app/actions/appointments.ts` linhas 128-176):
```typescript
  const admin = createAdminClient()

  // Upsert cliente por whatsapp_number — evita duplicatas
  const { data: client, error: clientError } = await admin
    .from('clients')
    .upsert(
      {
        barbershop_id: barbershop.id,
        full_name: input.client.full_name,
        whatsapp_number: input.client.whatsapp_number,
        whatsapp_opt_in: input.client.whatsapp_opt_in,
        opt_in_source: 'booking_portal',
        opt_in_timestamp: input.client.whatsapp_opt_in ? new Date().toISOString() : null,
      },
      { onConflict: 'barbershop_id,whatsapp_number', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (clientError || !client) return { error: 'Erro ao registrar cliente' }

  // INSERT appointment — booking_source = 'portal'
  const { data: appointment, error: insertError } = await admin
    .from('appointments')
    .insert({
      barbershop_id: barbershop.id,
      barber_id: input.barber_id,
      service_id: input.service_id,
      client_id: client.id,
      start_time: input.start_time,
      end_time: endTime,
      status: 'PENDING',
      booking_source: 'portal',
      created_by: client.id, // cliente anonimo — usar client_id como created_by
    })
    .select('id, start_time')
    .single()

  if (insertError || !appointment) return { error: insertError?.message ?? 'Erro ao criar agendamento' }

  return { data: appointment }
```

**Padrao de error handling** (baseado em `src/app/actions/appointments.ts` linhas 15-40):
```typescript
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

---

### `src/middleware.ts` (modify — adicionar rota publica ao matcher)

**Analogia:** `src/middleware.ts` (self) — apenas adicionar `/[slug]/**` como rota publica

**Mudanca necessaria** (baseado em `src/middleware.ts` linhas 35-50):
```typescript
// Adicionar ao inicio da funcao — antes das Rules A-E existentes:
const isPublicBookingRoute = pathname.match(/^\/[a-z0-9-]+($|\/(booking.*)?)$/)
if (isPublicBookingRoute) {
  return response // passa sem verificacao de auth
}
```

**Atencao:** O matcher regex atual ja exclui `_next/static`, `_next/image` e `favicon.ico`.
O pattern `/[slug]` deve evitar conflito com `/entrar`, `/cadastro`, `/dashboard`, `/agenda`, `/onboarding`.

---

## Shared Patterns

### Client Publico (sem autenticacao)
**Source:** `src/lib/supabase/public.ts` (a criar)
**Apply to:** `src/app/(public)/[slug]/layout.tsx`, `src/app/(public)/[slug]/page.tsx`,
`src/app/(public)/[slug]/booking/page.tsx`, `src/app/actions/public-booking.ts`

```typescript
// Para reads em Server Components/Actions sem sessao:
const supabase = createPublicClient()

// Para writes (INSERT de clients e appointments) sem sessao:
const admin = createAdminClient()
```

### Wizard Multi-Step com Estado React
**Source:** `src/app/(owner)/onboarding/page.tsx` (linhas 34-165)
**Apply to:** `src/app/(public)/[slug]/booking/components/booking-wizard.tsx`

Estrutura: estado `step` + handlers `handleStepNComplete` + estado acumulado entre steps
(`selectedService`, `selectedBarber`, `selectedSlot`). O submit real so acontece no step final.

```typescript
const [step, setStep] = useState(1)
const [selectedService, setSelectedService] = useState<ServiceRow | null>(null)
const [selectedBarber, setSelectedBarber] = useState<BarberRow | null>(null)
const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
const [isSubmitting, setIsSubmitting] = useState(false)
```

### Form com RHF + Zod
**Source:** `src/app/(owner)/onboarding/components/wizard-steps.tsx` (linhas 62-98)
**Apply to:** `src/app/(public)/[slug]/booking/components/step-client.tsx`

```typescript
const schema = z.object({ ... })
type FormData = z.infer<typeof schema>

const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
})
```

### Error Handling em Server Actions
**Source:** `src/app/actions/appointments.ts` (linhas 15-40), `src/app/actions/barbers.ts` (linhas 9-36)
**Apply to:** `src/app/actions/public-booking.ts`

Retorno discriminado `{ data } | { error: string }`. Try/catch com catch de `err instanceof Error`.
Nunca lanca excecao — sempre retorna `{ error }`.

```typescript
} catch (err) {
  return { error: err instanceof Error ? err.message : 'Erro inesperado' }
}
```

### Tipo de dados via Tables<>
**Source:** `src/app/(owner)/dashboard/equipe/components/barber-list-client.tsx` (linha 8, 11-12)
**Apply to:** Todos os components da Phase 2

```typescript
import type { Tables } from '@/types/database.types'

// Para tipo de linha completa de uma tabela:
type ServiceRow = Tables<'services'>

// Para subconjunto de colunas (sem tabela auxiliar):
type ServicePreview = Pick<Tables<'services'>, 'id' | 'name' | 'duration_minutes' | 'price'>
```

### Componentes shadcn/ui disponiveis
**Source:** `src/components/ui/` (inventario completo)
**Apply to:** Todos os components do portal publico

Instalados e usaveis sem instalacao adicional:
- `Button` — variantes `default`, `ghost`, `outline`
- `Input` — campos de texto
- `Label` — labels de form
- `Alert` — erros inline
- `Checkbox` — opt-in WhatsApp
- `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` — dropdowns
- `Sheet` / `SheetContent` — drawers laterais (se necessario)
- `Separator` — divisores visuais
- `Badge` — tags de status
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` — abas (se necessario)

### Spinner de loading
**Source:** `src/app/(owner)/onboarding/page.tsx` (linhas 168-174)
**Apply to:** Qualquer estado de loading no portal publico

```tsx
<div className="size-8 animate-spin rounded-full border-2 border-[#d4a574] border-t-transparent" />
```

### Token de design (cores)
**Source:** `src/app/(owner)/onboarding/page.tsx` + `src/components/shell/dashboard-shell.tsx`
**Apply to:** Todos os components visuais do portal

```
bg-[#151922]          — card background (igual ao wizard de onboarding)
border-white/[0.07]   — borda de card
text-[#d4a574]        — accent/dourado
bg-[#d4a574]          — botao primario / progress bar
bg-background         — fundo da pagina
text-[var(--text-secondary)]  — texto secundario
```

---

## No Analog Found

| File | Role | Data Flow | Razao |
|------|------|-----------|-------|
| `src/app/(public)/[slug]/booking/components/step-datetime.tsx` | component | request-response | Slot picker com disponibilidade em tempo real nao existe no codebase. O analog mais proximo e WorkingHoursGrid mas ela e um editor, nao um seletor de slots. Ver RESEARCH.md para patterns externos. |
| `src/lib/supabase/public.ts` | utility | request-response | Nao existe client anon sem cookies no codebase (todos os clients existentes usam cookies ou service role). Estrutura baseada em `admin.ts` sem o service role key. |

---

## Observacoes de Seguranca (Multi-Tenancy)

1. **Reads publicos:** `createPublicClient()` usa anon key. As RLS policies da Phase 0 ja protegem
   reads cross-tenant — um slug so expoe dados do proprio `barbershop_id`.

2. **Writes anonimos:** `createPublicClient()` usa adminClient para INSERT de `clients` e `appointments`.
   O `barbershop_id` NUNCA vem do cliente — sempre resolvido no servidor via `slug → barbershop.id`.

3. **end_time server-side:** Mesmo padrao de `appointments.ts` linhas 114-125 — duração lida do DB,
   nunca aceita do cliente. Previne tampering de duracao (T-01-19).

4. **whatsapp_opt_in:** Sempre gravado com `opt_in_source: 'booking_portal'` e `opt_in_timestamp`
   quando true — requisito LGPD documentado em CLAUDE.md.

5. **Conflict check:** Mesmo padrao de `appointments.ts` linhas 147-157. Race condition conhecida
   (T-01-20) — mitigado pela exclusion constraint GIST que deve ser adicionada na migration da Phase 2.

---

## Metadata

**Escopo de busca de analogs:** `src/app/`, `src/lib/`, `src/components/`, `src/types/`
**Arquivos escaneados:** 18 arquivos lidos, 6 glob scans
**Data de mapeamento:** 2026-06-01
