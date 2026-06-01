import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { BarberListClient } from './components/barber-list-client'
import type { BarberWithServiceCount } from './components/barber-list-client'

export const metadata: Metadata = {
  title: 'Equipe — BarberFlow',
}

export default async function EquipePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  // Fetch barbers with joined barber_services to count assigned services
  const { data: barbersRaw } = await supabase
    .from('barbers')
    .select('*, barber_services(service_id)')
    .eq('barbershop_id', barbershop_id)
    .order('name')

  // Fetch active services for service assignment in drawer
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .eq('is_active', true)
    .order('name')

  // Derive display name from email (consistent with dashboard/page.tsx pattern)
  const handle = email.split('@')[0] ?? 'Dono'
  const derived = handle.split(/[._-]/)[0]
  const displayName = derived.charAt(0).toUpperCase() + derived.slice(1)

  // Normalize barbers: extract service count, strip joined table data.
  // Cast to any for the join destructure — barber_services is appended by Supabase
  // but not in the generated Row type; rest is spread back as the base Row type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barbers: BarberWithServiceCount[] = (barbersRaw ?? []).map((b: any) => {
    const { barber_services, ...rest } = b
    return {
      ...rest,
      service_count: Array.isArray(barber_services) ? barber_services.length : 0,
    } as BarberWithServiceCount
  })

  return (
    <DashboardShell displayName={displayName} email={email}>
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        <BarberListClient
          barbers={barbers}
          services={services ?? []}
        />
      </div>
    </DashboardShell>
  )
}
