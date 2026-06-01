'use client'

import { useState } from 'react'
import { UserPlus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BarberCard } from './barber-card'
import { BarberDrawer } from './barber-drawer'
import type { Tables } from '@/types/database.types'

// Type defined here (not imported from server page) to avoid client<->server import cycle
export type BarberWithServiceCount = Tables<'barbers'> & {
  service_count: number
}

interface BarberListClientProps {
  barbers: BarberWithServiceCount[]
  services: Tables<'services'>[]
}

export function BarberListClient({ barbers, services }: BarberListClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBarber, setEditingBarber] = useState<Tables<'barbers'> | null>(null)

  function openCreate() {
    setEditingBarber(null)
    setDrawerOpen(true)
  }

  function openEdit(barber: Tables<'barbers'>) {
    setEditingBarber(barber)
    setDrawerOpen(true)
  }

  function handleSaved() {
    setDrawerOpen(false)
    setEditingBarber(null)
    // Server Component data re-fetches automatically via revalidatePath in Server Action
  }

  return (
    <>
      {/* Page header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
          Equipe
        </h1>
        <Button
          onClick={openCreate}
          className="h-10 gap-2 bg-amber-600 text-black hover:bg-amber-500 font-semibold"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Adicionar barbeiro
        </Button>
      </header>

      {/* Barber grid or empty state */}
      {barbers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <UsersRound className="h-10 w-10 text-[var(--text-tertiary)]" aria-hidden />
          <div className="text-center">
            <p className="text-[0.9375rem] font-semibold text-foreground">
              Nenhum barbeiro cadastrado
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Adicione seu primeiro barbeiro para começar a gerenciar a equipe.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="h-10 gap-2 bg-amber-600 text-black hover:bg-amber-500 font-semibold"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Adicionar barbeiro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {barbers.map((barber) => (
            <BarberCard
              key={barber.id}
              barber={barber}
              serviceCount={barber.service_count}
              onEdit={() => openEdit(barber)}
            />
          ))}
        </div>
      )}

      {/* Barber create/edit drawer */}
      <BarberDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        barber={editingBarber}
        services={services}
        onSaved={handleSaved}
      />
    </>
  )
}
