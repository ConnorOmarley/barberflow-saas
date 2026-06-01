'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar } from '@/components/dashboard/primitives'
import { updateAppointmentStatus, cancelAppointment } from '@/app/actions/appointments'

// ------- Types -------

type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  clients: { full_name: string; whatsapp_number: string | null } | null
  services: { name: string; duration_minutes: number } | null
}

type Props = {
  appointments: Appointment[]
  selectedDateISO: string
  initialTab: string
}

// ------- Status helpers -------

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Agendado',
  CHECKED_IN: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  PENDING: 'badge-pill badge-pending',
  CONFIRMED: 'badge-pill badge-scheduled',
  CHECKED_IN: 'badge-pill badge-progress',
  COMPLETED: 'badge-pill badge-done',
  CANCELLED: 'badge-pill badge-cancelled',
}

const STATUS_RAIL_COLOR: Record<AppointmentStatus, string> = {
  PENDING: '#94a3b8',
  CONFIRMED: '#d4a574',
  CHECKED_IN: '#a78bfa',
  COMPLETED: '#34d399',
  CANCELLED: '#64748b',
}

// ------- Helpers -------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDayLabel(dateISO: string): string {
  const date = new Date(dateISO + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatWeekRange(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (dt: Date) =>
    dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${fmt(monday)} — ${fmt(sunday)}`
}

function shiftDate(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getMondayOfWeek(dateISO: string): Date {
  const d = new Date(dateISO + 'T00:00:00')
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  return monday
}

function isToday(dateISO: string): boolean {
  return new Date().toISOString().slice(0, 10) === dateISO
}

// ------- Cancel Dialog (inline minimal) -------

function CancelDialog({
  appointmentId,
  clientName,
  onSuccess,
  onClose,
}: {
  appointmentId: string
  clientName: string
  onSuccess: (id: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsLoading(true)
    setError(null)
    const result = await cancelAppointment(appointmentId, reason || undefined)
    setIsLoading(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      onSuccess(appointmentId)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="surface-card w-full max-w-[420px] rounded-xl p-6">
        <h2 className="text-[1rem] font-semibold text-foreground">Cancelar agendamento</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Esta ação não pode ser desfeita. O agendamento de{' '}
          <span className="font-medium text-foreground">{clientName}</span> será marcado como
          cancelado.
        </p>

        {error && (
          <Alert className="mt-3 border-red-900/50 bg-red-950/30 text-red-400">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <textarea
          className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-[var(--text-tertiary)] focus:border-[#d4a574]/50 focus:outline-none"
          rows={2}
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="mt-4 flex justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="min-w-[160px]"
          >
            {isLoading ? 'Cancelando...' : 'Cancelar agendamento'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ------- Appointment Row -------

function AppointmentRow({
  appointment,
  onCompleted,
  onCancelled,
  onOpenCancel,
}: {
  appointment: Appointment
  onCompleted: (id: string) => Promise<void>
  onCancelled: (id: string) => void
  onOpenCancel: (id: string, clientName: string) => void
}) {
  const [isUpdating, setIsUpdating] = useState(false)
  const status = appointment.status as AppointmentStatus
  const clientName = appointment.clients?.full_name ?? 'Cliente'
  const serviceName = appointment.services?.name ?? 'Serviço'

  async function handleComplete() {
    setIsUpdating(true)
    await onCompleted(appointment.id)
    setIsUpdating(false)
  }

  return (
    <div className="surface-card mb-2 flex items-center gap-3 px-4 py-3">
      {/* Time column */}
      <div className="w-[5.5rem] shrink-0 text-[0.8125rem] tabular-nums text-[var(--text-secondary)]">
        {formatTime(appointment.start_time)}
        <span className="mx-0.5 text-[var(--text-tertiary)]">–</span>
        {formatTime(appointment.end_time)}
      </div>

      {/* Status rail */}
      <div
        className="h-8 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_RAIL_COLOR[status] ?? '#94a3b8' }}
        aria-hidden
      />

      {/* Client avatar */}
      <Avatar name={clientName} size={36} />

      {/* Client + service info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium text-foreground">{clientName}</p>
        <p className="truncate text-xs text-[var(--text-secondary)]">{serviceName}</p>
      </div>

      {/* Status badge */}
      <span className={STATUS_BADGE_CLASS[status] ?? 'badge-pill badge-pending'}>
        {STATUS_LABEL[status] ?? status}
      </span>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4a574]/50"
            aria-label="Ações do agendamento"
            disabled={isUpdating}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== 'COMPLETED' && status !== 'CANCELLED' && (
            <DropdownMenuItem onClick={handleComplete} className="gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Concluir atendimento
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="gap-2 text-[var(--text-secondary)]"
            onClick={() => {
              /* Editar wired in plan 01-08 */
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
          {status !== 'CANCELLED' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="gap-2"
                onClick={() => onOpenCancel(appointment.id, clientName)}
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ------- Week View Column -------

function WeekColumn({
  dateISO,
  dayAppointments,
}: {
  dateISO: string
  dayAppointments: Appointment[]
}) {
  const today = isToday(dateISO)
  const d = new Date(dateISO + 'T00:00:00')
  const dayAbbr = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const dateNum = d.getDate()

  return (
    <div
      className={`flex min-h-[160px] flex-col rounded-lg p-2 ${
        today
          ? 'bg-white/[0.02] ring-1 ring-[#d4a574]/15'
          : 'border border-white/[0.04]'
      }`}
    >
      {/* Column header */}
      <div className={`mb-2 text-center ${today ? 'text-[#d4a574]' : 'text-[var(--text-secondary)]'}`}>
        <div className="text-xs capitalize">{dayAbbr}</div>
        <div className={`text-sm ${today ? 'font-bold' : 'font-medium'}`}>{dateNum}</div>
      </div>

      {/* Compact cards */}
      <div className="space-y-1">
        {dayAppointments.map((appt) => (
          <div
            key={appt.id}
            className="rounded bg-white/[0.04] px-2 py-1.5 text-[0.7rem] leading-tight"
          >
            <div className="tabular-nums text-[var(--text-tertiary)]">
              {formatTime(appt.start_time)}
            </div>
            <div className="truncate font-medium text-foreground">
              {appt.clients?.full_name ?? 'Cliente'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------- Main AgendaView -------

export function AgendaView({ appointments: initialAppointments, selectedDateISO, initialTab }: Props) {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState(initialTab)

  // Optimistic state for appointments list
  const [appointmentsState, setAppointmentsState] = useState<Appointment[]>(initialAppointments)
  const [actionError, setActionError] = useState<string | null>(null)

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<{
    id: string
    clientName: string
  } | null>(null)

  // Navigate to a different date, keeping current tab
  function navigateTo(dateISO: string) {
    router.push(`/agenda?date=${dateISO}&tab=${currentTab}`)
  }

  function handlePrev() {
    const days = currentTab === 'semana' ? -7 : -1
    navigateTo(shiftDate(selectedDateISO, days))
  }

  function handleNext() {
    const days = currentTab === 'semana' ? 7 : 1
    navigateTo(shiftDate(selectedDateISO, days))
  }

  function handleTabChange(tab: string) {
    setCurrentTab(tab)
    router.push(`/agenda?date=${selectedDateISO}&tab=${tab}`)
  }

  // Optimistic: mark appointment as COMPLETED immediately
  const handleCompleted = useCallback(
    async (id: string) => {
      const prev = appointmentsState.find((a) => a.id === id)
      if (!prev) return

      // Optimistic update
      setAppointmentsState((current) =>
        current.map((a) => (a.id === id ? { ...a, status: 'COMPLETED' } : a))
      )
      setActionError(null)

      const result = await updateAppointmentStatus(id, 'COMPLETED')
      if ('error' in result) {
        // Revert on error
        setAppointmentsState((current) =>
          current.map((a) => (a.id === id ? { ...a, status: prev.status } : a))
        )
        setActionError(result.error)
      }
    },
    [appointmentsState]
  )

  // Optimistic: remove cancelled appointment from active list
  const handleCancelled = useCallback((id: string) => {
    setAppointmentsState((current) => current.filter((a) => a.id !== id))
    setActionError(null)
  }, [])

  function openCancelDialog(id: string, clientName: string) {
    setCancelTarget({ id, clientName })
  }

  // Date display label
  const dateLabel =
    currentTab === 'semana' ? formatWeekRange(selectedDateISO) : formatDayLabel(selectedDateISO)

  // Week columns data
  const monday = getMondayOfWeek(selectedDateISO)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7">
      {/* Page header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.25rem] font-semibold tracking-tight text-foreground">
          Minha Agenda
        </h1>

        <div className="flex items-center gap-2">
          {/* Date navigator */}
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-foreground">
            {dateLabel}
          </span>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* New appointment button — wired in plan 01-08 */}
          <Button
            type="button"
            className="ml-2 h-10 gap-2 bg-amber-600 text-black hover:bg-amber-500"
            onClick={() => {
              /* AppointmentDrawer wired in plan 01-08 */
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo agendamento</span>
          </Button>
        </div>
      </header>

      {/* Action error alert */}
      {actionError && (
        <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-4 bg-white/[0.04]">
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
        </TabsList>

        {/* ---- DAY TAB ---- */}
        <TabsContent value="dia">
          {appointmentsState.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarX className="mb-4 h-10 w-10 text-[var(--text-tertiary)]" strokeWidth={1.5} />
              <p className="text-[0.9375rem] font-semibold text-foreground">
                Nenhum agendamento para este dia
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Use a navegação acima para ir a outro dia.
              </p>
            </div>
          ) : (
            <div>
              {appointmentsState.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appointment={appt}
                  onCompleted={handleCompleted}
                  onCancelled={handleCancelled}
                  onOpenCancel={openCancelDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- WEEK TAB ---- */}
        <TabsContent value="semana">
          <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
            {weekDays.map((dayISO) => {
              const dayAppts = appointmentsState.filter(
                (a) => a.start_time.slice(0, 10) === dayISO
              )
              return (
                <WeekColumn key={dayISO} dateISO={dayISO} dayAppointments={dayAppts} />
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel dialog */}
      {cancelTarget && (
        <CancelDialog
          appointmentId={cancelTarget.id}
          clientName={cancelTarget.clientName}
          onSuccess={handleCancelled}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}
