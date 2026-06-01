import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { AgendaView } from './agenda-view'

export const metadata: Metadata = {
  title: 'Minha Agenda — BarberFlow',
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const userId = claims.sub as string
  const email = (claims.email as string | undefined) ?? ''

  // Resolve searchParams
  const { date: dateParam, tab: tabParam } = await searchParams
  const activeTab = tabParam === 'semana' ? 'semana' : 'dia'

  // Parse selected date (YYYY-MM-DD, default to today)
  let selectedDate: Date
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    selectedDate = new Date(dateParam + 'T00:00:00')
  } else {
    selectedDate = new Date()
  }

  const selectedDateISO = selectedDate.toISOString().slice(0, 10)

  // Find barber row via profile_id linkage
  const { data: barberRow } = await supabase
    .from('barbers')
    .select('id, name')
    .eq('profile_id', userId)
    .maybeSingle()

  // Derive display name from email if needed
  const handle = email.split('@')[0] ?? 'Barbeiro'
  const derived = handle.split(/[._-]/)[0]
  const displayName =
    barberRow?.name?.trim() ||
    derived.charAt(0).toUpperCase() + derived.slice(1)

  // Empty state when barber profile is not linked yet
  if (!barberRow) {
    return (
      <DashboardShell role="barber" displayName={displayName} email={email}>
        <div className="px-5 py-6 lg:px-8 lg:py-7">
          <header className="mb-6">
            <h1 className="text-[1.625rem] font-bold tracking-tight text-foreground">
              Minha Agenda
            </h1>
          </header>
          <div className="surface-card flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a574]/25 bg-[#d4a574]/10">
              <CalendarDays className="h-6 w-6 text-[#d4a574]" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Aguardando configuração
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Seu perfil ainda não está vinculado a um barbeiro. Aguarde o dono
              da barbearia completar a configuração.
            </p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  // Compute date range for query
  let rangeStart: string
  let rangeEnd: string

  if (activeTab === 'semana') {
    // Get Monday of the selected date's ISO week
    const day = selectedDate.getDay() // 0=Sun, 1=Mon, ...6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(selectedDate)
    monday.setDate(selectedDate.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    rangeStart = monday.toISOString()
    rangeEnd = sunday.toISOString()
  } else {
    // Day tab: full day
    const dayStart = new Date(selectedDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(selectedDate)
    dayEnd.setHours(23, 59, 59, 999)

    rangeStart = dayStart.toISOString()
    rangeEnd = dayEnd.toISOString()
  }

  // Fetch appointments for this barber in the date range
  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, start_time, end_time, status, notes, clients!inner(full_name, whatsapp_number), services!inner(name, duration_minutes)'
    )
    .eq('barber_id', barberRow.id)
    .neq('status', 'CANCELLED')
    .gte('start_time', rangeStart)
    .lte('start_time', rangeEnd)
    .order('start_time')

  return (
    <DashboardShell role="barber" displayName={displayName} email={email}>
      <AgendaView
        appointments={appointments ?? []}
        selectedDateISO={selectedDateISO}
        initialTab={activeTab}
      />
    </DashboardShell>
  )
}
