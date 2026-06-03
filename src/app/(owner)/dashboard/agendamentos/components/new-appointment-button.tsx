'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppointmentDrawer } from '@/components/appointments/appointment-drawer'

export function NewAppointmentButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 bg-[#d4a574] text-[#0b0f17] font-semibold hover:bg-[#e8c89a]"
      >
        <Plus className="size-4" />
        Novo agendamento
      </Button>
      <AppointmentDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
