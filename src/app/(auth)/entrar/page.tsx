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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  if (message.includes('Too many requests') || message.includes('rate limit')) {
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
        <Alert className="mb-4">
          <AlertDescription>
            Verifique seu email para ativar sua conta.
          </AlertDescription>
        </Alert>
      )}

      {senhaAlterada && (
        <Alert className="mb-4">
          <AlertDescription>
            Senha alterada com sucesso. Entre com sua nova senha.
          </AlertDescription>
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
                    className="text-xs text-primary hover:underline"
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
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
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

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full min-h-[44px] h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={form.formState.isSubmitting}
            aria-busy={form.formState.isSubmitting}
            aria-label={form.formState.isSubmitting ? 'Carregando...' : undefined}
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
        <Link href="/cadastro" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  )
}

export default function EntrarPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex items-center gap-2">
        <Scissors className="h-7 w-7 text-primary" />
        <span className="text-2xl font-semibold text-foreground">BarberFlow</span>
      </div>

      <Card className="w-full max-w-[400px] rounded-xl border bg-card">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Bem-vindo de volta</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Entre na sua conta BarberFlow
          </CardDescription>
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
