'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cancelAppointment } from '@/app/actions/appointments'

export interface CancelDialogAppointment {
  id: string
  clientName: string
  serviceName: string
  startTime: string
  barberName: string
}

interface CancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: CancelDialogAppointment | null
  onCancelled: () => void
}

export function CancelDialog({
  open,
  onOpenChange,
  appointment,
  onCancelled,
}: CancelDialogProps) {
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm() {
    if (!appointment) return
    setIsLoading(true)
    const result = await cancelAppointment(appointment.id, reason || undefined)
    setIsLoading(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success('Agendamento cancelado com sucesso.')
    setReason('')
    onCancelled()
    onOpenChange(false)
  }

  function handleClose() {
    if (!isLoading) {
      setReason('')
      onOpenChange(false)
    }
  }

  const formattedDate = appointment
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(appointment.startTime))
    : ''

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Cancelar agendamento</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. O agendamento será marcado como cancelado.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="px-0 py-2">
            {/* Resumo do agendamento */}
            <div className="rounded-lg bg-[var(--surface-raised,#1a1f2a)] p-3 mb-4 text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-foreground mb-1">{appointment.clientName}</p>
              <p>{appointment.serviceName}</p>
              <p>{formattedDate}</p>
              <p>Barbeiro: {appointment.barberName}</p>
            </div>

            {/* Motivo do cancelamento */}
            <div className="space-y-2">
              <label
                htmlFor="cancel-reason"
                className="text-sm font-medium text-foreground"
              >
                Motivo do cancelamento (opcional)
              </label>
              <Textarea
                id="cancel-reason"
                rows={2}
                placeholder="Ex: Cliente remarcou para outra data"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !appointment}
            aria-busy={isLoading}
            aria-label={isLoading ? 'Carregando...' : undefined}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              'Cancelar agendamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
