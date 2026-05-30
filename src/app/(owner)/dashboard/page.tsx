import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/actions/auth'

export const metadata: Metadata = {
  title: 'Dashboard — BarberFlow',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/entrar')
  }

  const email = data.claims.email as string | undefined

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        {/* Brand mark */}
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
          <span className="font-display text-sm font-semibold tracking-wide text-foreground">
            BarberFlow
          </span>
        </div>

        {/* Right: role badge + email + signout */}
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-600 text-black text-xs font-semibold hover:bg-amber-600">
            Dono
          </Badge>
          {email && (
            <span className="text-sm text-muted-foreground hidden sm:block">
              {email}
            </span>
          )}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sair
            </Button>
          </form>
        </div>
      </header>

      {/* Main content area — empty state */}
      <main className="flex-1 bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        {/* Amber hairline accent */}
        <div className="w-8 h-px bg-amber-600 mb-2" />
        <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
          Sua barbearia está quase pronta
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Complete o cadastro da sua barbearia para começar a aceitar agendamentos.
        </p>
        <Button
          disabled
          title="Em breve"
          className="mt-2 bg-amber-600 text-black font-semibold opacity-50 cursor-not-allowed h-11 px-6"
        >
          Configurar barbearia
        </Button>
      </main>
    </div>
  )
}
