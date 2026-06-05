import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { ClientList } from './components/client-list'

export const metadata: Metadata = {
  title: 'Clientes | BarberFlow',
}

export type ClientWithStats = {
  id: string
  full_name: string
  whatsapp_number: string | null
  whatsapp_opt_in: boolean
  created_at: string
  totalAppointments: number
  lastAppointment: string | null
}

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) redirect('/entrar')

  const claims = claimsData.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  const { data: rawClients } = await supabase
    .from('clients')
    .select(`
      id, full_name, whatsapp_number, whatsapp_opt_in, created_at,
      appointments ( id, status, start_time )
    `)
    .eq('barbershop_id', barbershop_id)
    .order('full_name')

  const clients: ClientWithStats[] = (rawClients ?? []).map((c) => {
    const appts = (c.appointments ?? []) as { id: string; status: string; start_time: string }[]
    const nonCancelled = appts.filter((a) => a.status !== 'CANCELLED')
    const lastAppointment = nonCancelled.length > 0
      ? nonCancelled.reduce(
          (max, a) => (a.start_time > max ? a.start_time : max),
          nonCancelled[0]!.start_time,
        )
      : null

    return {
      id: c.id,
      full_name: c.full_name,
      whatsapp_number: c.whatsapp_number,
      whatsapp_opt_in: c.whatsapp_opt_in,
      created_at: c.created_at,
      totalAppointments: nonCancelled.length,
      lastAppointment,
    }
  })

  const handle = email.split('@')[0] ?? 'Dono'
  const derived = handle.split(/[._-]/)[0]
  const displayName = derived!.charAt(0).toUpperCase() + derived!.slice(1)

  return (
    <DashboardShell displayName={displayName} email={email}>
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ClientList clients={clients} />
      </div>
    </DashboardShell>
  )
}
