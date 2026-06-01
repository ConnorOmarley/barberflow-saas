import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { ServicosClient } from './components/servicos-client'

export const metadata: Metadata = {
  title: 'Serviços — BarberFlow',
}

export default async function ServicosPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  // Fetch services with barber_services join to count assigned barbers
  const { data: services } = await supabase
    .from('services')
    .select('*, barber_services(barber_id)')
    .eq('barbershop_id', barbershop_id)
    .order('name')

  // Fetch active barbers for assignment in drawer
  const { data: barbers } = await supabase
    .from('barbers')
    .select('id, name')
    .eq('barbershop_id', barbershop_id)
    .eq('is_active', true)
    .order('name')

  // Derive displayName from profile or email handle
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', claims.sub as string)
    .maybeSingle()

  const handle = email.split('@')[0] ?? 'Dono'
  const derived = handle.split(/[._-]/)[0]
  const displayName =
    profile?.full_name?.trim() ||
    derived.charAt(0).toUpperCase() + derived.slice(1)

  return (
    <DashboardShell displayName={displayName} email={email}>
      <ServicosClient
        services={services ?? []}
        barbers={barbers ?? []}
      />
    </DashboardShell>
  )
}
