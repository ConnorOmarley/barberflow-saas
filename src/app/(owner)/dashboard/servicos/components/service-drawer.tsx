'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createService, updateService, deactivateService } from '@/app/actions/services'
import { syncServiceBarbers } from '@/app/actions/barber-services'
import type { Database } from '@/types/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceData = Database['public']['Tables']['services']['Row'] & {
  barber_services: { barber_id: string }[]
}

interface ServiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: ServiceData | null
  barbers: { id: string; name: string }[]
  onSaved: () => void
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  duration_minutes: z.coerce.number().min(1, 'Duração inválida'),
  price: z.coerce.number().min(0, 'Preço inválido'),
  description: z.string().optional(),
})

type ServiceFormValues = z.infer<typeof serviceSchema>

// ─── Quick-fill templates ─────────────────────────────────────────────────────

const QUICK_TEMPLATES = [
  { label: 'Corte (30min, R$40)', name: 'Corte', duration_minutes: 30, price: 40 },
  { label: 'Barba (20min, R$25)', name: 'Barba', duration_minutes: 20, price: 25 },
  { label: 'Corte + Barba (50min, R$60)', name: 'Corte + Barba', duration_minutes: 50, price: 60 },
] as const

// ─── Duration options ─────────────────────────────────────────────────────────

const DURATION_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 75, 90]

// ─── ServiceDrawer ────────────────────────────────────────────────────────────

export function ServiceDrawer({
  open,
  onOpenChange,
  service,
  barbers,
  onSaved,
}: ServiceDrawerProps) {
  const isEditing = service !== null
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedBarberIds, setSelectedBarberIds] = useState<Set<string>>(new Set())
  const [isDeactivating, setIsDeactivating] = useState(false)

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      duration_minutes: 30,
      price: 0,
      description: '',
    },
  })

  // Sync form defaults and barber selection when editing
  useEffect(() => {
    if (open) {
      setErrorMessage(null)
      setIsDeactivating(false)

      if (service) {
        form.reset({
          name: service.name,
          duration_minutes: service.duration_minutes,
          price: Number(service.price),
          description: '',
        })
        setSelectedBarberIds(new Set(service.barber_services.map((bs) => bs.barber_id)))
      } else {
        form.reset({ name: '', duration_minutes: 30, price: 0, description: '' })
        setSelectedBarberIds(new Set())
      }
    }
  }, [open, service, form])

  function applyTemplate(template: (typeof QUICK_TEMPLATES)[number]) {
    form.reset({
      name: template.name,
      duration_minutes: template.duration_minutes,
      price: template.price,
      description: '',
    })
  }

  function toggleBarber(barberId: string) {
    setSelectedBarberIds((prev) => {
      const next = new Set(prev)
      if (next.has(barberId)) {
        next.delete(barberId)
      } else {
        next.add(barberId)
      }
      return next
    })
  }

  async function onSubmit(values: ServiceFormValues) {
    setErrorMessage(null)

    let serviceId: string

    if (isEditing && service) {
      const result = await updateService({
        id: service.id,
        name: values.name,
        duration_minutes: values.duration_minutes,
        price: values.price,
      })
      if ('error' in result) {
        setErrorMessage(result.error)
        return
      }
      serviceId = service.id
    } else {
      const result = await createService({
        name: values.name,
        duration_minutes: values.duration_minutes,
        price: values.price,
        description: values.description,
      })
      if ('error' in result) {
        setErrorMessage(result.error)
        return
      }
      serviceId = result.data.id
    }

    // Sync barber assignments (commission_type/value left NULL per D-15)
    const syncResult = await syncServiceBarbers(serviceId, Array.from(selectedBarberIds))
    if ('error' in syncResult) {
      setErrorMessage(syncResult.error)
      return
    }

    onSaved()
  }

  async function handleDeactivate() {
    if (!service) return
    setIsDeactivating(true)
    setErrorMessage(null)

    const result = await deactivateService(service.id)
    if ('error' in result) {
      setErrorMessage(result.error)
      setIsDeactivating(false)
      return
    }

    onSaved()
  }

  const { isSubmitting } = form.formState

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-[480px]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {/* Error alert */}
          {errorMessage && (
            <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form id="service-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Section: Detalhes do serviço */}
              <div>
                <p className="mb-3 text-sm font-semibold text-foreground">Detalhes do serviço</p>

                {/* Quick-fill templates (only on create) */}
                {!isEditing && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map((template) => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#d4a574]/40 hover:text-[#d4a574]"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nome */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Corte Degradê" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Duração */}
                <FormField
                  control={form.control}
                  name="duration_minutes"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Duração *</FormLabel>
                      <FormControl>
                        <Select
                          value={String(field.value)}
                          onValueChange={(val) => field.onChange(Number(val))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a duração" />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_OPTIONS.map((min) => (
                              <SelectItem key={min} value={String(min)}>
                                {min} min
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Preço */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Preço *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Descrição (optional) */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Descreva os detalhes do serviço..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Section: Barbeiros — separator above */}
              <Separator />
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">
                  Barbeiros que oferecem este serviço
                </p>
                <p className="mb-3 text-xs text-[var(--text-secondary)]">
                  Selecione quais barbeiros realizam este serviço
                </p>

                {barbers.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Nenhum barbeiro ativo encontrado.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {barbers.map((barber) => {
                      const checked = selectedBarberIds.has(barber.id)
                      return (
                        <li key={barber.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`barber-${barber.id}`}
                            checked={checked}
                            onCheckedChange={(_checked) => toggleBarber(barber.id)}
                          />
                          {/* Avatar 24px */}
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.5625rem] font-semibold text-foreground"
                            aria-hidden
                          >
                            {barber.name
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                          <Label
                            htmlFor={`barber-${barber.id}`}
                            className="cursor-pointer text-sm text-foreground"
                          >
                            {barber.name}
                          </Label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-white/[0.06]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isDeactivating}
          >
            Fechar
          </Button>

          <Button
            type="submit"
            form="service-form"
            className="bg-[#d4a574] font-semibold text-[#0b0f17] hover:bg-[#c8995f]"
            disabled={isSubmitting || isDeactivating}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar serviço'
            )}
          </Button>

          {isEditing && service?.is_active && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDeactivate}
              disabled={isSubmitting || isDeactivating}
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desativando...
                </>
              ) : (
                'Desativar serviço'
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
