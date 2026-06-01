'use client'

import { CalendarDays, User } from 'lucide-react'
import type { AppointmentWithDetails } from '../page'
import { AppointmentStatusActions } from './appointment-status-actions'

interface AppointmentListProps {
  appointments: AppointmentWithDetails[]
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: 'Pendente',
    className: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
  },
  CONFIRMED: {
    label: 'Confirmado',
    className: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
  },
  CHECKED_IN: {
    label: 'Check-in',
    className: 'border-purple-500/30 bg-purple-500/15 text-purple-400',
  },
  COMPLETED: {
    label: 'Concluido',
    className: 'border-green-500/30 bg-green-500/15 text-green-400',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'border-red-500/30 bg-red-500/15 text-red-400',
  },
}

function maskWhatsApp(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '')
  if (digits.length < 4) return whatsapp
  const last4 = digits.slice(-4)
  return `•••• ${last4}`
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatDateOnly(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function getDayKey(iso: string): string {
  return new Date(iso).toISOString().split('T')[0]!
}

export function AppointmentList({ appointments }: AppointmentListProps) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
        <CalendarDays className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Nenhum agendamento ainda.
        </p>
        <p className="mt-1 max-w-xs text-xs text-[var(--text-tertiary)]">
          Os agendamentos do portal aparecerao aqui como Pendentes.
        </p>
      </div>
    )
  }

  // Agrupar por dia (ja ordenados por start_time DESC pelo server)
  const groups: { dayKey: string; items: AppointmentWithDetails[] }[] = []
  let currentDay = ''

  for (const appt of appointments) {
    const day = getDayKey(appt.start_time)
    if (day !== currentDay) {
      currentDay = day
      groups.push({ dayKey: day, items: [] })
    }
    groups[groups.length - 1]!.items.push(appt)
  }

  return (
    <div className="space-y-6">
      {groups.map(({ dayKey, items }) => (
        <div key={dayKey}>
          {/* Cabecalho de data */}
          <div className="mb-3 flex items-center gap-3">
            <p className="text-xs font-semibold capitalize text-[var(--text-secondary)]">
              {formatDateOnly(`${dayKey}T12:00:00Z`)}
            </p>
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-[var(--text-tertiary)]">
              {items.length} agendamento{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Cards do dia */}
          <div className="space-y-2">
            {items.map((appt) => {
              const statusCfg = STATUS_CONFIG[appt.status] ?? {
                label: appt.status,
                className: 'border-white/10 bg-white/5 text-[var(--text-secondary)]',
              }

              return (
                <div
                  key={appt.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Informacoes principais */}
                    <div className="flex flex-1 flex-col gap-1.5">
                      {/* Hora + badges de status */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {formatDateTime(appt.start_time)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </span>
                        {appt.booking_source === 'portal' && (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--text-tertiary)]">
                            Portal
                          </span>
                        )}
                      </div>

                      {/* Servico + Barbeiro */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {appt.services?.name && (
                          <span className="text-sm text-[var(--text-secondary)]">
                            {appt.services.name}
                            {appt.services.duration_minutes
                              ? ` · ${appt.services.duration_minutes} min`
                              : ''}
                          </span>
                        )}
                        {appt.barbers?.name && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            c/ {appt.barbers.name}
                          </span>
                        )}
                      </div>

                      {/* Cliente */}
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                        <span className="text-sm font-medium text-foreground">
                          {appt.clients?.full_name ?? 'Cliente'}
                        </span>
                        {appt.clients?.whatsapp_number && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {maskWhatsApp(appt.clients.whatsapp_number)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acoes */}
                    <div className="shrink-0 sm:pl-4">
                      <AppointmentStatusActions appointment={appt} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
