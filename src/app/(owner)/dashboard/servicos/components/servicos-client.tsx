'use client'

import { useState } from 'react'
import { Plus, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ServiceRow } from './service-row'
import { ServiceDrawer } from './service-drawer'
import type { Database } from '@/types/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row'] & {
  barber_services: { barber_id: string }[]
}

type BarberOption = { id: string; name: string }

interface ServicosClientProps {
  services: ServiceRow[]
  barbers: BarberOption[]
}

export function ServicosClient({ services: initialServices, barbers }: ServicosClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceRow | null>(null)

  function handleNew() {
    setEditingService(null)
    setDrawerOpen(true)
  }

  function handleEdit(service: ServiceRow) {
    setEditingService(service)
    setDrawerOpen(true)
  }

  function handleSaved() {
    setDrawerOpen(false)
    setEditingService(null)
    // Page data refreshed via revalidatePath in Server Actions
  }

  const activeServices = initialServices.filter((s) => s.is_active)
  const inactiveServices = initialServices.filter((s) => !s.is_active)
  const orderedServices = [...activeServices, ...inactiveServices]

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7">
      {/* ── Page header ── */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-foreground">
            Serviços
          </h1>
          <p className="mt-2 text-[0.875rem] text-[var(--text-secondary)]">
            Gerencie o catálogo de serviços da sua barbearia.
          </p>
        </div>
        <Button
          onClick={handleNew}
          className="h-9 bg-[#d4a574] font-semibold text-[#0b0f17] hover:bg-[#c8995f]"
          size="sm"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novo serviço
        </Button>
      </header>

      {/* ── Service list ── */}
      {orderedServices.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : (
        <div className="surface-card overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4a574]/10">
              <Scissors className="h-4 w-4 text-[#d4a574]" />
            </span>
            <div>
              <p className="text-[0.9375rem] font-semibold text-foreground">
                Catálogo de Serviços
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {activeServices.length} serviço{activeServices.length !== 1 ? 's' : ''} ativo
                {activeServices.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Rows */}
          <ul>
            {orderedServices.map((service, index) => (
              <li key={service.id} className="border-b border-white/[0.04] last:border-0">
                <ServiceRow
                  service={service}
                  barberCount={service.barber_services.length}
                  colorIndex={index}
                  onEdit={() => handleEdit(service)}
                  onDeactivate={() => handleEdit(service)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Drawer ── */}
      <ServiceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        service={editingService}
        barbers={barbers}
        onSaved={handleSaved}
      />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-5 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d4a574]/10">
        <Scissors className="h-8 w-8 text-[#d4a574]" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">Nenhum serviço cadastrado</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
        Adicione os serviços oferecidos pela sua barbearia — cortes, barbas e muito mais.
      </p>
      <Button
        onClick={onNew}
        className="mt-6 h-9 bg-[#d4a574] font-semibold text-[#0b0f17] hover:bg-[#c8995f]"
        size="sm"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar primeiro serviço
      </Button>
    </div>
  )
}
