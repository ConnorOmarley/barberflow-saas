'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, Scissors } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const recuperarSenhaSchema = z.object({
  email: z.string().email('Email inválido'),
})

type RecuperarSenhaFormValues = z.infer<typeof recuperarSenhaSchema>

export default function RecuperarSenhaPage() {
  const [emailSent, setEmailSent] = useState(false)
  const [sentToEmail, setSentToEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<RecuperarSenhaFormValues>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: RecuperarSenhaFormValues) {
    setErrorMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo:
        window.location.origin +
        '/auth/confirm?type=recovery&next=/nova-senha',
    })

    if (error) {
      setErrorMessage(
        'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'
      )
      return
    }

    setSentToEmail(values.email)
    setEmailSent(true)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Brand mark */}
      <div className="flex items-center gap-2 mb-8">
        <Scissors className="h-6 w-6 text-amber-600" strokeWidth={1.5} />
        <span className="font-display text-xl font-semibold tracking-wide text-white">
          BarberFlow
        </span>
      </div>

      <Card className="auth-card w-full max-w-[400px] rounded-xl bg-card border-0">
        <CardHeader className="space-y-1 pb-4">
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Recuperar senha
          </h1>
          {!emailSent && (
            <CardDescription className="text-sm text-muted-foreground">
              Informe seu email e enviaremos um link para redefinir sua senha
            </CardDescription>
          )}
          {/* Amber hairline divider */}
          <div className="w-8 h-px bg-amber-600 mt-2" />
        </CardHeader>

        <CardContent>
          {emailSent ? (
            /* Success state — replaces form in-place */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enviamos um link de recuperação para{' '}
                <span className="text-white font-medium">{sentToEmail}</span>.
                Verifique sua caixa de entrada e sua pasta de spam.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  href="/entrar"
                  className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
                >
                  Voltar para login
                </Link>
              </p>
            </div>
          ) : (
            /* Request form */
            <>
              {errorMessage && (
                <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="seu@email.com.br"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-black font-semibold transition-colors"
                    disabled={form.formState.isSubmitting}
                    aria-busy={form.formState.isSubmitting}
                    aria-label={
                      form.formState.isSubmitting ? 'Carregando...' : undefined
                    }
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              </Form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Lembrei minha senha.{' '}
                <Link
                  href="/entrar"
                  className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
                >
                  Voltar para login
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
