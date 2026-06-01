'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

// ─── Schema Zod ───────────────────────────────────────────────────────────────

const clientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  whatsapp_number: z
    .string()
    .min(10, 'Número inválido')
    .regex(/^\+?[\d\s\-()]+$/, 'Formato inválido'),
  whatsapp_opt_in: z.boolean().default(false),
})

type ClientFormData = z.infer<typeof clientSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepClientProps {
  onComplete: (data: ClientFormData) => Promise<void>
  onBack: () => void
}

/**
 * Step 4 — Dados do cliente.
 *
 * Coleta nome completo, WhatsApp e opt-in para lembretes.
 * Padrão: React Hook Form + Zod (idêntico ao Step3Form do onboarding).
 *
 * LGPD:
 *   - whatsapp_opt_in default false (T-02-12)
 *   - Checkbox explícito com label legível
 *   - opt_in_timestamp gravado server-side na Server Action (não no form)
 *
 * Fluxo do submit:
 *   setIsLoading(true) → try { await onComplete(data) } catch { setError } → finally { setIsLoading(false) }
 */
export function StepClient({ onComplete, onBack }: StepClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optIn, setOptIn] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormData>,
    defaultValues: {
      full_name: '',
      whatsapp_number: '',
      whatsapp_opt_in: false,
    },
  })

  const onSubmit = async (formData: ClientFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await onComplete(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar agendamento.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Nome completo */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full-name">Nome completo</Label>
        <Input
          id="full-name"
          placeholder="Ex: João Silva"
          autoComplete="name"
          {...register('full_name')}
          aria-invalid={!!errors.full_name}
          className={errors.full_name ? 'border-destructive' : ''}
        />
        {errors.full_name && (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      {/* WhatsApp */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="whatsapp-number">WhatsApp</Label>
        <Input
          id="whatsapp-number"
          type="tel"
          placeholder="11 99999-9999"
          autoComplete="tel"
          {...register('whatsapp_number')}
          aria-invalid={!!errors.whatsapp_number}
          className={errors.whatsapp_number ? 'border-destructive' : ''}
        />
        {errors.whatsapp_number && (
          <p className="text-xs text-destructive">{errors.whatsapp_number.message}</p>
        )}
      </div>

      {/* Opt-in WhatsApp (LGPD — T-02-12) */}
      <div className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
        <Checkbox
          id="whatsapp-optin"
          checked={optIn}
          onCheckedChange={(checked) => {
            const value = checked === true
            setOptIn(value)
            setValue('whatsapp_opt_in', value)
          }}
          className="mt-0.5"
        />
        <Label
          htmlFor="whatsapp-optin"
          className="cursor-pointer text-sm font-normal leading-snug text-[var(--text-secondary)]"
        >
          Aceito receber lembretes e confirmações pelo WhatsApp
        </Label>
      </div>

      {/* Erro geral (retornado da Server Action) */}
      {error && (
        <Alert className="border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </Alert>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isLoading}
          className="h-11"
        >
          Voltar
        </Button>
        <Button type="submit" disabled={isLoading} className="h-11 min-w-[180px]">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Confirmar agendamento'
          )}
        </Button>
      </div>
    </form>
  )
}

export type { ClientFormData }
