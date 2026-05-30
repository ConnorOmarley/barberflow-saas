'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

const entrarSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

type EntrarFormValues = z.infer<typeof entrarSchema>

function mapSupabaseError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Email ou senha incorretos. Verifique seus dados e tente novamente.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirme seu email antes de entrar. Verifique sua caixa de entrada.'
  }
  if (
    message.includes('Too many requests') ||
    message.includes('rate limit')
  ) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }
  return 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'
}

function EntrarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const verificacaoPendente = searchParams.get('verificacao') === 'pendente'
  const senhaAlterada = searchParams.get('senha') === 'alterada'

  const form = useForm<EntrarFormValues>({
    resolver: zodResolver(entrarSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: EntrarFormValues) {
    setErrorMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setErrorMessage(mapSupabaseError(error.message))
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      {verificacaoPendente && (
        <Alert className="mb-4 border-amber-900/50 bg-amber-950/20 text-amber-300">
          <AlertDescription>
            Verifique seu email para ativar sua conta.
          </AlertDescription>
        </Alert>
      )}

      {senhaAlterada && (
        <Alert className="mb-4 border-green-900/50 bg-green-950/20 text-green-300">
          <AlertDescription>
            Senha alterada com sucesso. Entre com sua nova senha.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Senha</FormLabel>
                  <Link
                    href="/recuperar-senha"
                    className="text-xs text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      autoComplete="current-password"
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
              'Entrar na conta'
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link
          href="/cadastro"
          className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </>
  )
}

export default function EntrarPage() {
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
            Bem-vindo de volta
          </h1>
          <CardDescription className="text-sm text-muted-foreground">
            Entre na sua conta BarberFlow
          </CardDescription>
          {/* Amber hairline divider */}
          <div className="w-8 h-px bg-amber-600 mt-2" />
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-4" />}>
            <EntrarForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
