'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

const cadastroSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type CadastroFormValues = z.infer<typeof cadastroSchema>

function mapSupabaseError(message: string): string {
  if (message.includes('User already registered') || message.includes('already registered')) {
    return 'Este email já está cadastrado. Tente entrar ou recuperar sua senha.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirme seu email antes de entrar. Verifique sua caixa de entrada.'
  }
  return 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'
}

export default function CadastroPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<CadastroFormValues>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: CadastroFormValues) {
    setErrorMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin + '/auth/confirm?type=email&next=/dashboard',
      },
    })

    if (error) {
      setErrorMessage(mapSupabaseError(error.message))
      return
    }

    router.push('/entrar?verificacao=pendente')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex items-center gap-2">
        <Scissors className="h-7 w-7 text-primary" />
        <span className="text-2xl font-semibold text-foreground">BarberFlow</span>
      </div>

      <Card className="w-full max-w-[400px] rounded-xl border bg-card">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Crie sua conta</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Comece a gerenciar sua barbearia hoje
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <FormLabel>Senha</FormLabel>
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
                  'Criar conta'
                )}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/entrar" className="text-primary hover:underline">
              Entrar na conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
