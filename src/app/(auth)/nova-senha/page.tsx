'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, Scissors, Eye, EyeOff } from 'lucide-react'
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

const novaSenhaSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type NovaSenhaFormValues = z.infer<typeof novaSenhaSchema>

export default function NovaSenhaPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<NovaSenhaFormValues>({
    resolver: zodResolver(novaSenhaSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        setTokenExpired(true)
      }
    }
    checkSession()
  }, [])

  async function onSubmit(values: NovaSenhaFormValues) {
    setErrorMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      setErrorMessage(
        'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'
      )
      return
    }

    router.push('/entrar?senha=alterada')
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
            Criar nova senha
          </h1>
          <CardDescription className="text-sm text-muted-foreground">
            Escolha uma senha segura para sua conta
          </CardDescription>
          {/* Amber hairline divider */}
          <div className="w-8 h-px bg-amber-600 mt-2" />
        </CardHeader>

        <CardContent>
          {tokenExpired ? (
            <Alert className="border-red-900/50 bg-red-950/30 text-red-400">
              <AlertDescription>
                Este link de recuperação expirou. Solicite um novo link na{' '}
                <Link
                  href="/recuperar-senha"
                  className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
                >
                  página de recuperação de senha
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : (
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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Mínimo 8 caracteres"
                              autoComplete="new-password"
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={
                                showPassword ? 'Ocultar senha' : 'Mostrar senha'
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar nova senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirm ? 'text' : 'password'}
                              placeholder="Repita a senha"
                              autoComplete="new-password"
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((prev) => !prev)}
                              aria-label={
                                showConfirm ? 'Ocultar senha' : 'Mostrar senha'
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                              tabIndex={-1}
                            >
                              {showConfirm ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
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
                      'Salvar nova senha'
                    )}
                  </Button>
                </form>
              </Form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
