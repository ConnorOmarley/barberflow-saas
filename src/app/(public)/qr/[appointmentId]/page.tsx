import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Página pública permalink do QR de Check-In.
 *
 * Esta página é PÚBLICA — sem autenticação necessária.
 * Mostra detalhes não-sensíveis do agendamento para que o cliente
 * saiba que está no lugar certo antes de receber o QR do owner.
 *
 * T-03-05: UUID v4 tem 122 bits de entropia — sem risco de adivinhação.
 * appointmentId é semi-público: página não exibe PII do cliente,
 * apenas nome da barbearia, serviço, barbeiro e data/hora.
 *
 * Middleware: /qr/ é bypassado pelo isPublicSlug regex — sem auth check.
 */

interface QrPageProps {
  params: Promise<{ appointmentId: string }>
}

export const metadata: Metadata = {
  title: 'QR Check-In | BarberFlow',
  description: 'Página de check-in QR para seu agendamento',
}

export default async function QrAppointmentPage({ params }: QrPageProps) {
  const { appointmentId } = await params

  // Buscar appointment via adminClient — dados não-sensíveis apenas
  const admin = createAdminClient()
  const { data: appointment, error } = await admin
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      barbers ( name ),
      services ( name ),
      barbershops ( name, timezone )
    `)
    .eq('id', appointmentId)
    .single()

  if (error || !appointment) {
    notFound()
  }

  // Narrowing dos joins
  const barbershop = appointment.barbershops as { name: string; timezone: string } | null
  const barber = appointment.barbers as { name: string } | null
  const service = appointment.services as { name: string } | null

  const timezone = barbershop?.timezone ?? 'America/Sao_Paulo'
  const appointmentDate = new Date(appointment.start_time)

  // Formatar data e hora na timezone da barbearia (padrão do projeto — Intl.DateTimeFormat pt-BR)
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(appointmentDate)

  const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(appointmentDate)

  const isCancelled = appointment.status === 'CANCELLED'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Brand mark */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
            B
          </div>
          <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
            BARBERFLOW
          </span>
        </div>

        {/* Card principal */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-6">
          {isCancelled ? (
            /* Estado cancelado */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-red-500/15">
                <span className="text-2xl">✕</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Agendamento cancelado</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {barbershop?.name ?? 'Barbearia'}
                </p>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Este agendamento foi cancelado e o QR Code não é mais válido.
              </p>
            </div>
          ) : (
            /* Estado ativo */
            <div className="flex flex-col gap-5">
              {/* Cabeçalho */}
              <div className="text-center">
                <h1 className="text-lg font-bold text-foreground">Seu Agendamento</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {barbershop?.name ?? 'Barbearia'}
                </p>
              </div>

              {/* Status badge */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-800/50 bg-blue-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
                  <span className="size-1.5 rounded-full bg-blue-400" />
                  {appointment.status === 'CONFIRMED' ? 'Confirmado' : appointment.status}
                </div>
              </div>

              {/* Resumo do agendamento */}
              <dl className="flex flex-col gap-3 text-sm">
                {service?.name && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--text-secondary)]">Serviço</dt>
                    <dd className="font-medium text-foreground">{service.name}</dd>
                  </div>
                )}
                {service?.name && <div className="h-px bg-white/[0.06]" />}

                {barber?.name && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--text-secondary)]">Barbeiro</dt>
                    <dd className="font-medium text-foreground">{barber.name}</dd>
                  </div>
                )}
                {barber?.name && <div className="h-px bg-white/[0.06]" />}

                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[var(--text-secondary)]">Data</dt>
                  <dd className="text-right font-medium capitalize text-foreground">
                    {dateFormatted}
                  </dd>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--text-secondary)]">Horário</dt>
                  <dd className="font-medium text-foreground">{timeFormatted}</dd>
                </div>
              </dl>

              {/* Instruções */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-3">
                <p className="text-xs leading-relaxed text-[var(--text-secondary)] text-center">
                  Aguarde o QR Code do estabelecimento no momento do check-in.
                  O barbeiro irá apresentar o código para você escanear.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
