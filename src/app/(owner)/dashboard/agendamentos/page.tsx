import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { AppointmentList } from './components/appointment-list'

export const metadata: Metadata = {
  title: 'Agendamentos | BarberFlow',
}

export type AppointmentWithDetails = {
  id: string
  start_time: string
  end_time: string
  status: string
  booking_source: string | null
  notes: string | null
  barbers: { name: string } | null
  services: { name: string; duration_minutes: number } | null
  clients: { full_name: string; whatsapp_number: string } | null
}

export default async function AgendamentosPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) redirect('/entrar')

  const claims = claimsData.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, start_time, end_time, status, booking_source, notes,
      barbers ( name ),
      services ( name, duration_minutes ),
      clients ( full_name, whatsapp_number )
    `)
    .eq('barbershop_id', barbershop_id)
    .order('start_time', { ascending: false })
    .limit(100)

  const pendingCount = (appointments ?? []).filter((a) => a.status === 'PENDING').length

  // Derivar nome de exibicao a partir do email (padrao consistente com outras paginas)
  const handle = email.split('@')[0] ?? 'Dono'
  const derived = handle.split(/[._-]/)[0]
  const displayName = derived.charAt(0).toUpperCase() + derived.slice(1)

  return (
    <DashboardShell displayName={displayName} email={email}>
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Todos os agendamentos do seu estabelecimento
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="ml-auto inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-400">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <AppointmentList appointments={(appointments ?? []) as AppointmentWithDetails[]} />
      </div>
    </DashboardShell>
  )
}
