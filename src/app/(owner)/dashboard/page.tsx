import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Check, Store, Users, Scissors } from 'lucide-react'
import { AppShell } from '@/components/shell/app-shell'

export const metadata: Metadata = {
  title: 'Visão geral — BarberFlow',
}

const JOURNEY = [
  {
    icon: Check,
    title: 'Conta criada',
    desc: 'Seu acesso de dono está pronto.',
    done: true,
  },
  {
    icon: Store,
    title: 'Configurar barbearia',
    desc: 'Nome, endereço, horário de funcionamento e fuso.',
    done: false,
  },
  {
    icon: Users,
    title: 'Adicionar barbeiros',
    desc: 'Convide sua equipe e defina comissões.',
    done: false,
  },
  {
    icon: Scissors,
    title: 'Cadastrar serviços',
    desc: 'Defina cortes, durações e preços.',
    done: false,
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/entrar')
  }

  const email = (data.claims.email as string | undefined) ?? ''

  return (
    <AppShell role="owner" email={email} section="Visão geral">
      <div className="mx-auto max-w-2xl">
        {/* Editorial intro */}
        <div className="mb-8">
          <div className="mb-4 h-px w-8 bg-amber-600" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Vamos preparar sua barbearia
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Quatro passos separam você de receber o primeiro agendamento. O
            primeiro já está feito.
          </p>
        </div>

        {/* Journey */}
        <ol className="overflow-hidden rounded-xl border border-[var(--shell-edge)] bg-card">
          {JOURNEY.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-4 border-b border-[var(--shell-edge)] p-5 last:border-b-0"
            >
              {/* Step marker — honed edge when done */}
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? 'step-done' : 'step-soon'
                }`}
              >
                <step.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] tabular-nums text-muted-foreground/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3
                    className={`text-sm font-medium ${
                      step.done ? 'text-foreground' : 'text-foreground/80'
                    }`}
                  >
                    {step.title}
                  </h3>
                  {step.done ? (
                    <span className="text-[0.625rem] uppercase tracking-wide text-amber-500">
                      concluído
                    </span>
                  ) : (
                    <span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground/60">
                      em breve
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-center text-xs text-muted-foreground/70">
          A configuração da barbearia abre na próxima atualização.
        </p>
      </div>
    </AppShell>
  )
}
