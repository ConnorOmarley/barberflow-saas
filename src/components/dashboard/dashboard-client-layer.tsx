'use client'

import { useState } from 'react'
import { AppointmentDrawer } from '@/components/appointments/appointment-drawer'
import { SetupChecklist } from '@/components/dashboard/setup-checklist'

interface DashboardClientLayerProps {
  barbershopId: string
}

/**
 * DashboardClientLayer — Camada client do dashboard que gerencia:
 * - Estado de abertura do AppointmentDrawer (Novo Agendamento)
 * - SetupChecklist widget
 *
 * Mantém dashboard/page.tsx como Server Component enquanto os componentes
 * interativos ficam aqui como 'use client'.
 */
export function DashboardClientLayer({ barbershopId }: DashboardClientLayerProps) {
  const [appointmentDrawerOpen, setAppointmentDrawerOpen] = useState(false)

  return (
    <>
      {/* SetupChecklist: visível enquanto houver itens incompletos */}
      <SetupChecklist barbershopId={barbershopId} />

      {/* AppointmentDrawer: overlay global */}
      <AppointmentDrawer
        open={appointmentDrawerOpen}
        onOpenChange={setAppointmentDrawerOpen}
      />
    </>
  )
}
