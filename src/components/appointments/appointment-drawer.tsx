'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientCombobox } from './client-combobox'
import { createAppointment } from '@/app/actions/appointments'

interface Barber {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
}

interface WorkingHour {
  start_time: string
  end_time: string
  day_of_week: number
  is_active: boolean
}

interface AppointmentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function generateTimeSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = []
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function getDayOfWeek(dateStr: string): number {
  // Date como "YYYY-MM-DD" — criar com timezone local correto
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

export function AppointmentDrawer({ open, onOpenChange }: AppointmentDrawerProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [newClientData, setNewClientData] = useState<{ full_name: string; whatsapp_number: string } | null>(null)
  const [selectedBarberId, setSelectedBarberId] = useState<string>('')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(false)
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Buscar barbeiros ao abrir o drawer
  useEffect(() => {
    if (!open) return
    setIsLoadingBarbers(true)
    const supabase = createClient()
    supabase
      .from('barbers')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setBarbers(data ?? [])
        setIsLoadingBarbers(false)
      })
  }, [open])

  // Buscar serviços quando barbeiro é selecionado
  useEffect(() => {
    if (!selectedBarberId) {
      setServices([])
      setSelectedServiceId('')
      return
    }
    setIsLoadingServices(true)
    setSelectedServiceId('')
    const supabase = createClient()
    supabase
      .from('barber_services')
      .select('service_id, services!inner(id, name, duration_minutes, price)')
      .eq('barber_id', selectedBarberId)
      .then(({ data }) => {
        const svcList: Service[] = (data ?? []).flatMap((row) => {
          const svc = row.services as unknown as Service | Service[]
          return Array.isArray(svc) ? svc : [svc]
        })
        setServices(svcList)
        setIsLoadingServices(false)
      })
  }, [selectedBarberId])

  // Gerar time slots ao selecionar barbeiro + data
  useEffect(() => {
    if (!selectedBarberId || !selectedDate) {
      setAvailableSlots([])
      setSelectedTime('')
      return
    }
    setIsLoadingSlots(true)
    setSelectedTime('')
    const supabase = createClient()
    const dayOfWeek = getDayOfWeek(selectedDate)

    supabase
      .from('working_hours')
      .select('start_time, end_time, day_of_week, is_active')
      .eq('barber_id', selectedBarberId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .then(async ({ data: workingData }) => {
        if (!workingData || workingData.length === 0) {
          setAvailableSlots([])
          setIsLoadingSlots(false)
          return
        }

        // Gerar todos os slots de todos os períodos do dia
        const allSlots: string[] = []
        for (const wh of workingData as WorkingHour[]) {
          const slots = generateTimeSlots(wh.start_time, wh.end_time)
          allSlots.push(...slots)
        }

        // Buscar agendamentos existentes para filtrar slots ocupados
        const dayStart = `${selectedDate}T00:00:00.000Z`
        const dayEnd = `${selectedDate}T23:59:59.999Z`
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('barber_id', selectedBarberId)
          .neq('status', 'CANCELLED')
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)

        const bookedSlots = new Set<string>()
        for (const appt of existingAppts ?? []) {
          const apptDate = new Date(appt.start_time)
          const slotStr = `${String(apptDate.getUTCHours()).padStart(2, '0')}:${String(apptDate.getUTCMinutes()).padStart(2, '0')}`
          bookedSlots.add(slotStr)
        }

        const freeSlots = allSlots.filter((s) => !bookedSlots.has(s))
        setAvailableSlots(freeSlots)
        setIsLoadingSlots(false)
      })
  }, [selectedBarberId, selectedDate])

  // Resetar estado ao fechar
  function handleOpenChange(v: boolean) {
    if (!v) {
      setSelectedClientId(null)
      setNewClientData(null)
      setSelectedBarberId('')
      setSelectedServiceId('')
      setSelectedDate('')
      setSelectedTime('')
      setNotes('')
      setErrorMessage(null)
      setServices([])
      setAvailableSlots([])
    }
    onOpenChange(v)
  }

  async function handleSubmit() {
    setErrorMessage(null)

    if (!selectedClientId && !newClientData) {
      setErrorMessage('Selecione ou crie um cliente.')
      return
    }
    if (!selectedBarberId) {
      setErrorMessage('Selecione um barbeiro.')
      return
    }
    if (!selectedServiceId) {
      setErrorMessage('Selecione um serviço.')
      return
    }
    if (!selectedDate) {
      setErrorMessage('Selecione uma data.')
      return
    }
    if (!selectedTime) {
      setErrorMessage('Selecione um horário.')
      return
    }

    // Montar ISO string para start_time (horário local como UTC simples)
    const startTimeISO = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()

    setIsLoading(true)
    const result = await createAppointment({
      barber_id: selectedBarberId,
      service_id: selectedServiceId,
      client_id: selectedClientId ?? undefined,
      new_client: newClientData ?? undefined,
      start_time: startTimeISO,
      notes: notes || undefined,
    })
    setIsLoading(false)

    if ('error' in result) {
      setErrorMessage(result.error)
      return
    }

    // Sucesso
    const barberName = barbers.find((b) => b.id === selectedBarberId)?.name ?? ''
    const clientLabel = newClientData?.full_name ?? 'cliente'
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
      new Date(`${selectedDate}T${selectedTime}:00`)
    )
    toast.success(
      `Agendamento confirmado para ${clientLabel} em ${dateFormatted} às ${selectedTime}.`,
      { description: barberName ? `Barbeiro: ${barberName}` : undefined }
    )
    handleOpenChange(false)
  }

  const selectedBarberName = barbers.find((b) => b.id === selectedBarberId)?.name

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col p-0"
        aria-label="Novo agendamento"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <SheetTitle>Novo Agendamento</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Seção: Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <ClientCombobox
              value={selectedClientId}
              onChange={(id) => {
                setSelectedClientId(id)
                if (id) setNewClientData(null)
              }}
              onNewClient={(data) => {
                setNewClientData(data)
                setSelectedClientId(null)
              }}
            />
          </div>

          <Separator />

          {/* Seção: Agendamento */}
          <div className="space-y-4">
            {/* Barbeiro */}
            <div className="space-y-2">
              <Label htmlFor="barber-select">Barbeiro *</Label>
              <Select
                value={selectedBarberId}
                onValueChange={setSelectedBarberId}
                disabled={isLoadingBarbers}
              >
                <SelectTrigger id="barber-select" aria-label="Selecionar barbeiro">
                  <SelectValue
                    placeholder={
                      isLoadingBarbers ? 'Carregando...' : 'Selecione um barbeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Serviço */}
            <div className="space-y-2">
              <Label htmlFor="service-select">Serviço *</Label>
              <Select
                value={selectedServiceId}
                onValueChange={setSelectedServiceId}
                disabled={!selectedBarberId || isLoadingServices}
              >
                <SelectTrigger id="service-select" aria-label="Selecionar serviço">
                  <SelectValue
                    placeholder={
                      !selectedBarberId
                        ? 'Selecione o barbeiro primeiro'
                        : isLoadingServices
                        ? 'Carregando...'
                        : services.length === 0
                        ? 'Nenhum serviço disponível'
                        : 'Selecione um serviço'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {services.map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      <span>{svc.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {svc.duration_minutes}min · R${' '}
                        {svc.price.toFixed(2)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="appointment-date">Data *</Label>
              <input
                id="appointment-date"
                type="date"
                min={getTodayStr()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Selecionar data"
              />
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <Label htmlFor="time-select">Horário *</Label>
              <Select
                value={selectedTime}
                onValueChange={setSelectedTime}
                disabled={!selectedBarberId || !selectedDate || isLoadingSlots}
              >
                <SelectTrigger id="time-select" aria-label="Selecionar horário">
                  <SelectValue
                    placeholder={
                      !selectedBarberId || !selectedDate
                        ? 'Selecione o barbeiro e a data primeiro'
                        : isLoadingSlots
                        ? 'Carregando horários...'
                        : availableSlots.length === 0
                        ? 'Nenhum horário disponível para este dia'
                        : 'Selecione um horário'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      <span className="tabular-nums">{slot}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBarberId && selectedDate && !isLoadingSlots && availableSlots.length === 0 && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedBarberName
                    ? `${selectedBarberName} não trabalha neste dia ou não tem horários disponíveis.`
                    : 'Nenhum horário disponível para este dia.'}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Seção: Observações */}
          <div className="space-y-2">
            <Label htmlFor="appointment-notes">Observações (opcional)</Label>
            <Textarea
              id="appointment-notes"
              rows={3}
              placeholder="Observações internas (não visíveis ao cliente)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Erro */}
          {errorMessage && (
            <Alert className="border-red-900/50 bg-red-950/30 text-red-400">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            aria-busy={isLoading}
            aria-label={isLoading ? 'Carregando...' : undefined}
            className="h-11 bg-amber-600 hover:bg-amber-500 text-black font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar agendamento'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
