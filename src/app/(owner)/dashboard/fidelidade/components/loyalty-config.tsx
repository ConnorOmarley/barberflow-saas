'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { upsertLoyaltyRule } from '@/app/actions/loyalty'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: { id: string; stamps_required: number; reward_description: string } | null
  onSaved: () => void
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const loyaltyConfigSchema = z.object({
  stamps_required: z.coerce.number().min(1, 'Mínimo 1 carimbo').max(100, 'Máximo 100 carimbos'),
  reward_description: z.string().min(1, 'Descrição é obrigatória').max(200, 'Máximo 200 caracteres'),
})

type LoyaltyConfigFormValues = z.infer<typeof loyaltyConfigSchema>

// ─── LoyaltyConfigSheet ───────────────────────────────────────────────────────

export function LoyaltyConfigSheet({
  open,
  onOpenChange,
  rule,
  onSaved,
}: LoyaltyConfigProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<LoyaltyConfigFormValues>({
    resolver: zodResolver(loyaltyConfigSchema) as Resolver<LoyaltyConfigFormValues>,
    defaultValues: {
      stamps_required: 10,
      reward_description: 'Corte grátis',
    },
  })

  // Sync form defaults quando o Sheet abre
  useEffect(() => {
    if (open) {
      setErrorMessage(null)
      if (rule) {
        form.reset({
          stamps_required: rule.stamps_required,
          reward_description: rule.reward_description,
        })
      } else {
        form.reset({
          stamps_required: 10,
          reward_description: 'Corte grátis',
        })
      }
    }
  }, [open, rule, form])

  async function onSubmit(values: LoyaltyConfigFormValues) {
    setErrorMessage(null)

    const result = await upsertLoyaltyRule(values)

    if ('error' in result) {
      setErrorMessage(result.error)
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
          <SheetTitle>{rule ? 'Editar Regra de Fidelidade' : 'Configurar Fidelidade'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {/* Error alert */}
          {errorMessage && (
            <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form id="loyalty-config-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Número de carimbos */}
              <FormField
                control={form.control}
                name="stamps_required"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carimbos necessários *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="10"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Quantos carimbos o cliente precisa para resgatar a recompensa
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição da recompensa */}
              <FormField
                control={form.control}
                name="reward_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição da recompensa *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Ex: Corte grátis"
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      O que o cliente ganha ao completar o cartão (máx. 200 caracteres)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-white/[0.06]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Fechar
          </Button>

          <Button
            type="submit"
            form="loyalty-config-form"
            className="bg-[#d4a574] font-semibold text-[#0b0f17] hover:bg-[#c8995f]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar configuração'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
