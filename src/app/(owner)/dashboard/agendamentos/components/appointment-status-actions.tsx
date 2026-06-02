'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, QrCode, X } from 'lucide-react'
import { updateAppointmentStatus } from '@/app/actions/appointments'
import { generateQrToken } from '@/app/actions/qr-checkin'
import { AppointmentQRCode } from '@/components/qr/appointment-qr-code'
import { CancelDialog } from '@/components/appointments/cancel-dialog'
import type { AppointmentWithDetails } from '../page'

interface AppointmentStatusActionsProps {
  appointment: AppointmentWithDetails
}

export function AppointmentStatusActions({ appointment }: AppointmentStatusActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await updateAppointmentStatus(appointment.id, 'CONFIRMED')
      if ('error' in result) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowQr = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await generateQrToken(appointment.id)
      if ('error' in result) {
        setError(result.error)
      } else {
        setQrUrl(result.url)
        setQrOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await updateAppointmentStatus(appointment.id, 'COMPLETED')
      if ('error' in result) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const { status } = appointment

  // Transicoes terminais — sem botoes
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return null
  }

  // Objeto para o CancelDialog (T-02-18: dados minimos necessarios para o modal)
  const cancelDialogAppt = {
    id: appointment.id,
    clientName: appointment.clients?.full_name ?? 'Cliente',
    serviceName: appointment.services?.name ?? '',
    startTime: appointment.start_time,
    barberName: appointment.barbers?.name ?? '',
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {status === 'PENDING' && (
            <Button
              size="sm"
              disabled={isLoading}
              onClick={handleConfirm}
              className="h-8 gap-1.5 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar
            </Button>
          )}

          {status === 'CHECKED_IN' && (
            <Button
              size="sm"
              disabled={isLoading}
              onClick={handleComplete}
              className="h-8 gap-1.5 bg-green-600 text-xs font-semibold text-white hover:bg-green-700"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Marcar Concluido
            </Button>
          )}

          {status === 'CONFIRMED' && (
            <Button
              size="sm"
              disabled={isLoading}
              onClick={handleShowQr}
              className="h-8 gap-1.5 bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <QrCode className="h-3.5 w-3.5" />
              QR Check-In
            </Button>
          )}

          {(status === 'PENDING' || status === 'CONFIRMED') && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={() => setCancelOpen(true)}
              className="h-8 gap-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* CancelDialog — abre com campo de motivo e chama cancelAppointment internamente */}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        appointment={cancelDialogAppt}
        onCancelled={() => {
          setCancelOpen(false)
        }}
      />

      {/* QR Check-In overlay — dialog inline sem dependência de componente externo */}
      {qrOpen && qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-6">
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="absolute right-4 top-4 text-[var(--text-secondary)] hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-4 text-center text-base font-semibold text-foreground">
              QR Code de Check-In
            </h3>
            <AppointmentQRCode checkInUrl={qrUrl} />
          </div>
        </div>
      )}
    </>
  )
}
