import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { AppShell } from '@/components/shell/app-shell'

export const metadata: Metadata = {
  title: 'Minha agenda — BarberFlow',
}

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/entrar')
  }

  const email = (data.claims.email as string | undefined) ?? ''

  return (
    <AppShell role="barber" email={email} section="Minha agenda">
      <div className="mx-auto flex max-w-md flex-col items-center pt-16 text-center">
        {/* Empty-agenda motif — ruled lines like a paper appointment book */}
        <div className="relative mb-8 h-24 w-44">
          <div className="absolute inset-0 flex flex-col justify-between opacity-40">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="h-px w-full bg-[var(--shell-edge)]" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-600/30 bg-card">
              <CalendarDays className="h-5 w-5 text-amber-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="mb-4 h-px w-8 bg-amber-600" />
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Nenhum agendamento ainda
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Quando o dono configurar os serviços e seus horários, seus
          atendimentos confirmados aparecerão aqui — organizados por dia.
        </p>
      </div>
    </AppShell>
  )
}
