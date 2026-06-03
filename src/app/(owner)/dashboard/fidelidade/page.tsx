import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { FidelidadeClient } from './components/fidelidade-client'
import type { Database } from '@/types/database.types'

export const metadata: Metadata = {
  title: 'Fidelidade — BarberFlow',
}

type LoyaltyRuleRow = Database['public']['Tables']['loyalty_rules']['Row']

export default async function FidelidadePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  // Buscar regra de fidelidade ativa
  const { data: loyaltyRule } = await supabase
    .from('loyalty_rules')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .maybeSingle()

  // Buscar carimbos com join em clients
  const { data: stampsRaw } = await supabase
    .from('loyalty_stamps')
    .select('client_id, created_at, clients(id, full_name, whatsapp_number)')
    .eq('barbershop_id', barbershop_id)
    .order('created_at', { ascending: true })

  // Buscar resgates
  const { data: redemptionsRaw } = await supabase
    .from('loyalty_redemptions')
    .select('client_id, created_at')
    .eq('barbershop_id', barbershop_id)
    .order('created_at', { ascending: false })

  // Derive displayName from profile or email handle (padrão servicos/page.tsx)
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

  // Normalizar stamps para tipo consistente
  const stamps = (stampsRaw ?? []).map((s) => ({
    client_id: s.client_id,
    created_at: s.created_at,
    clients: Array.isArray(s.clients)
      ? (s.clients[0] ?? null)
      : (s.clients ?? null),
  }))

  const redemptions = (redemptionsRaw ?? []).map((r) => ({
    client_id: r.client_id,
    created_at: r.created_at,
  }))

  const rule: LoyaltyRuleRow | null = loyaltyRule ?? null

  return (
    <DashboardShell displayName={displayName} email={email}>
      <FidelidadeClient
        loyaltyRule={rule}
        stamps={stamps}
        redemptions={redemptions}
        stampsRequired={rule?.stamps_required ?? 10}
      />
    </DashboardShell>
  )
}
