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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { WorkingHoursGrid, type WorkingHourInput } from './working-hours-grid'

// ─── Brazilian timezones ──────────────────────────────────────────────────────
const BRAZIL_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Maceio', label: 'Maceió (GMT-3)' },
  { value: 'America/Bahia', label: 'Salvador (GMT-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
]

// ─── Default working hours (Seg–Sex open 09–18, Dom+Sáb closed) ──────────────
export const DEFAULT_WORKING_HOURS: WorkingHourInput[] = [
  { day_of_week: 0, start_time: '09:00', end_time: '18:00', is_active: false }, // Dom
  { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_active: true },  // Seg
  { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_active: true },  // Ter
  { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_active: true },  // Qua
  { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_active: true },  // Qui
  { day_of_week: 5, start_time: '09:00', end_time: '18:00', is_active: true },  // Sex
  { day_of_week: 6, start_time: '09:00', end_time: '18:00', is_active: false }, // Sáb
]

// ─── Quick-fill service templates ─────────────────────────────────────────────
const SERVICE_TEMPLATES = [
  { label: 'Corte (30min, R$40)', name: 'Corte', duration_minutes: 30, price: 40 },
  { label: 'Barba (20min, R$25)', name: 'Barba', duration_minutes: 20, price: 25 },
  { label: 'Corte + Barba (50min, R$60)', name: 'Corte + Barba', duration_minutes: 50, price: 60 },
]

// ─── Duration options ─────────────────────────────────────────────────────────
const DURATION_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 75, 90]

// ──────────────────────────────────────────────────────────────────────────────
// Step 1: Nome da barbearia + Fuso horário
// ──────────────────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z.string().min(1, 'Nome da barbearia é obrigatório'),
  timezone: z.string().min(1, 'Fuso horário é obrigatório'),
})
type Step1Data = z.infer<typeof step1Schema>

interface Step1FormProps {
  onComplete: (data: Step1Data) => Promise<void>
  initialData?: Partial<Step1Data>
}

export function Step1Form({ onComplete, initialData }: Step1FormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(initialData?.timezone ?? 'America/Sao_Paulo')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: initialData?.name ?? '', timezone: initialData?.timezone ?? 'America/Sao_Paulo' },
  })

  const onSubmit = async (formData: Step1Data) => {
    setIsLoading(true)
    setError(null)
    try {
      await onComplete({ ...formData, timezone })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <Alert className="border-red-900/50 bg-red-950/30 text-red-400 text-sm px-4 py-3">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shop-name">Nome da barbearia</Label>
        <Input
          id="shop-name"
          placeholder="Ex: Barbearia do João"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone-trigger">Fuso horário</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger
            id="timezone-trigger"
            className="w-full h-10"
          >
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {BRAZIL_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end mt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 min-w-[160px]"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Próximo'}
        </Button>
      </div>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 2: Horários do primeiro barbeiro
// working_hours are per-barber — Step 2 sets hours for the first barber
// created in Step 3. Hours are stored in React state until barber_id is known.
// ──────────────────────────────────────────────────────────────────────────────

interface Step2FormProps {
  onComplete: (hours: WorkingHourInput[]) => void
  onBack: () => void
  initialData?: WorkingHourInput[]
}

export function Step2Form({ onComplete, onBack, initialData }: Step2FormProps) {
  const [hours, setHours] = useState<WorkingHourInput[]>(
    initialData ?? DEFAULT_WORKING_HOURS,
  )

  const handleNext = () => {
    // Hours stored in React state (pendingHours in page.tsx) —
    // NOT saved to DB here. upsertBarberWorkingHours is called after Step 3
    // when the barber_id is known.
    onComplete(hours)
  }

  const handleSkip = () => {
    onComplete([])
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkingHoursGrid value={hours} onChange={setHours} />

      <div className="flex justify-between mt-2 gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="h-11">
          Voltar
        </Button>
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="ghost" onClick={handleSkip} className="h-11">
            Pular
          </Button>
          <Button type="button" onClick={handleNext} className="h-11 min-w-[120px]">
            Próximo
          </Button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 3: Primeiro barbeiro
// ──────────────────────────────────────────────────────────────────────────────

const step3Schema = z.object({
  name: z.string().min(1, 'Nome do barbeiro é obrigatório'),
  phone: z.string().optional(),
  sendInvite: z.boolean().optional(),
  inviteEmail: z.string().email('Email inválido').optional().or(z.literal('')),
})
type Step3Data = z.infer<typeof step3Schema>

interface Step3FormProps {
  onComplete: (data: { name: string; phone?: string; inviteEmail?: string }) => Promise<void>
  onBack: () => void
  initialData?: Partial<Step3Data>
}

export function Step3Form({ onComplete, onBack, initialData }: Step3FormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendInvite, setSendInvite] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { name: initialData?.name ?? '', phone: initialData?.phone ?? '' },
  })

  const onSubmit = async (formData: Step3Data) => {
    setIsLoading(true)
    setError(null)
    try {
      await onComplete({
        name: formData.name,
        phone: formData.phone || undefined,
        inviteEmail: sendInvite && formData.inviteEmail ? formData.inviteEmail : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <Alert className="border-red-900/50 bg-red-950/30 text-red-400 text-sm px-4 py-3">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="barber-name">Nome do barbeiro</Label>
        <Input
          id="barber-name"
          placeholder="Ex: Carlos Silva"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="barber-phone">Telefone (opcional)</Label>
        <Input
          id="barber-phone"
          type="tel"
          placeholder="(11) 99999-9999"
          {...register('phone')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="send-invite"
            checked={sendInvite}
            onCheckedChange={(checked: boolean) => setSendInvite(checked)}
          />
          <Label htmlFor="send-invite" className="cursor-pointer font-normal">
            Convidar por email para acessar o painel
          </Label>
        </div>
        {sendInvite && (
          <div className="flex flex-col gap-1.5 pl-6">
            <Input
              id="invite-email"
              type="email"
              placeholder="email@barbeiro.com"
              {...register('inviteEmail')}
              aria-label="Email do barbeiro para convite"
            />
            {errors.inviteEmail && (
              <p className="text-xs text-destructive">{errors.inviteEmail.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2 gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="h-11">
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 min-w-[120px] ml-auto"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Próximo'}
        </Button>
      </div>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 4: Primeiro serviço
// ──────────────────────────────────────────────────────────────────────────────

const step4Schema = z.object({
  name: z.string().min(1, 'Nome do serviço é obrigatório'),
  duration_minutes: z.number().int().min(1, 'Duração é obrigatória'),
  price: z.number().min(0, 'Preço inválido'),
})
type Step4Data = z.infer<typeof step4Schema>

interface Step4FormProps {
  onComplete: (data: Step4Data) => Promise<void>
  onBack: () => void
}

export function Step4Form({ onComplete, onBack }: Step4FormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<string>('30')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: { name: '', duration_minutes: 30, price: 0 },
  })

  const applyTemplate = (template: (typeof SERVICE_TEMPLATES)[number]) => {
    setValue('name', template.name)
    setValue('duration_minutes', template.duration_minutes)
    setValue('price', template.price)
    setDuration(String(template.duration_minutes))
  }

  const onSubmit = async (formData: Step4Data) => {
    setIsLoading(true)
    setError(null)
    try {
      await onComplete({ ...formData, duration_minutes: parseInt(duration, 10) || formData.duration_minutes })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <Alert className="border-red-900/50 bg-red-950/30 text-red-400 text-sm px-4 py-3">
          {error}
        </Alert>
      )}

      {/* Quick-fill template buttons */}
      <div className="flex flex-wrap gap-2">
        {SERVICE_TEMPLATES.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => applyTemplate(t)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#d4a574]/40 hover:text-[#d4a574]"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="service-name">Nome do serviço</Label>
        <Input
          id="service-name"
          placeholder="Ex: Corte degradê"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="service-duration">Duração</Label>
        <Select
          value={duration}
          onValueChange={(val) => {
            setDuration(val)
            setValue('duration_minutes', parseInt(val, 10))
          }}
        >
          <SelectTrigger id="service-duration" className="w-full h-10">
            <SelectValue placeholder="Selecione a duração" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.duration_minutes && (
          <p className="text-xs text-destructive">{errors.duration_minutes.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="service-price">Preço</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">
            R$
          </span>
          <Input
            id="service-price"
            type="number"
            min={0}
            step={0.01}
            className="pl-8 tabular-nums"
            {...register('price', { valueAsNumber: true })}
            aria-invalid={!!errors.price}
          />
        </div>
        {errors.price && (
          <p className="text-xs text-destructive">{errors.price.message}</p>
        )}
      </div>

      <div className="flex justify-between mt-2 gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="h-11">
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 min-w-[200px] ml-auto"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Concluir configuração'
          )}
        </Button>
      </div>
    </form>
  )
}
