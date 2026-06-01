'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CancelDialog, type CancelDialogAppointment } from './cancel-dialog'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  CHECKED_IN: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-scheduled',
  CHECKED_IN: 'badge-progress',
  COMPLETED: 'badge-done',
  CANCELLED: 'badge-cancelled',
}

export interface AppointmentEditData {
  id: string
  clientName: string
  serviceName: string
  barberName: string
  startTime: string
  endTime: string
  status: string
}

interface AppointmentEditDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  appointment: AppointmentEditData | null
  onCancelled: () => void
}

/**
 * AppointmentEditDrawer — Exibe resumo de um agendamento e permite cancelamento.
 *
 * Per D-19: expõe botão "Cancelar agendamento" destrutivo que abre CancelDialog.
 * Disparado via DropdownMenu "Editar" em /agenda e /dashboard.
 */
export function AppointmentEditDrawer({
  open,
  onOpenChange,
  appointment,
  onCancelled,
}: AppointmentEditDrawerProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  function handleCancelled() {
    setCancelDialogOpen(false)
    onCancelled()
    onOpenChange(false)
  }

  const cancelDialogAppointment: CancelDialogAppointment | null = appointment
    ? {
        id: appointment.id,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        startTime: appointment.startTime,
        barberName: appointment.barberName,
      }
    : null

  const formattedStart = appointment
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(appointment.startTime))
    : ''

  const formattedEnd = appointment
    ? new Intl.DateTimeFormat('pt-BR', {
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(appointment.endTime))
    : ''

  const statusLabel = appointment ? (STATUS_LABEL[appointment.status] ?? appointment.status) : ''
  const statusClass = appointment ? (STATUS_CLASS[appointment.status] ?? '') : ''
  const isCancelled = appointment?.status === 'CANCELLED'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] flex flex-col p-0"
          aria-label="Detalhes do agendamento"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
            <SheetTitle>Detalhes do agendamento</SheetTitle>
            {appointment && (
              <SheetDescription>
                {appointment.clientName} — {appointment.serviceName}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {appointment && (
              <div className="rounded-lg bg-[var(--surface-raised,#1a1f2a)] p-4 space-y-3">
                {/* Nome do cliente */}
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {appointment.clientName}
                  </p>
                  <span
                    className={`badge-pill ${statusClass} mt-1 inline-block`}
                    aria-label={`Status: ${statusLabel}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Serviço + Barbeiro */}
                <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                  <p>
                    <span className="font-medium text-foreground">Serviço:</span>{' '}
                    {appointment.serviceName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Barbeiro:</span>{' '}
                    {appointment.barberName}
                  </p>
                </div>

                {/* Data/hora */}
                <div className="text-sm text-[var(--text-secondary)]">
                  <p>
                    <span className="font-medium text-foreground">Data/Hora:</span>{' '}
                    <span className="tabular-nums">{formattedStart}</span>
                    {formattedEnd && (
                      <span className="tabular-nums"> — {formattedEnd}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-6 py-4 flex justify-between gap-3">
            {!isCancelled && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                aria-label="Cancelar este agendamento"
              >
                Cancelar agendamento
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className={isCancelled ? 'ml-auto' : ''}
            >
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* CancelDialog renderizado dentro do EditDrawer — D-19 */}
      <CancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        appointment={cancelDialogAppointment}
        onCancelled={handleCancelled}
      />
    </>
  )
}
