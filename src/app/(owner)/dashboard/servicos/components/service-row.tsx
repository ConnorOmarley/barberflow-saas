'use client'

import { MoreHorizontal, Pencil, PowerOff } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database.types'

// Color dots cycling through 6 brand-harmonised hues (per UI-SPEC)
const COLOR_DOTS = [
  '#d4a574', // gold
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#60a5fa', // blue
  '#f87171', // red
  '#f59e0b', // amber
]

type ServiceData = Database['public']['Tables']['services']['Row'] & {
  barber_services: { barber_id: string }[]
}

interface ServiceRowProps {
  service: ServiceData
  barberCount: number
  colorIndex: number
  onEdit: () => void
  onDeactivate: () => void
}

export function ServiceRow({
  service,
  barberCount,
  colorIndex,
  onEdit,
  onDeactivate,
}: ServiceRowProps) {
  const dotColor = COLOR_DOTS[colorIndex % COLOR_DOTS.length]

  const priceFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(service.price))

  return (
    <div className="group flex min-h-[56px] items-center gap-4 px-5 hover:bg-white/[0.02]">
      {/* Color dot */}
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden
      />

      {/* Service name */}
      <span className="flex-1 text-sm font-medium text-foreground">{service.name}</span>

      {/* Duration chip */}
      <span className="tabular-nums text-xs text-[var(--text-secondary)]">
        {service.duration_minutes} min
      </span>

      {/* Price */}
      <span className="w-24 text-right tabular-nums text-sm font-semibold text-foreground">
        {priceFormatted}
      </span>

      {/* Barbers count */}
      <span className="hidden w-28 text-right text-xs text-[var(--text-tertiary)] sm:block">
        {barberCount} barbeiro{barberCount !== 1 ? 's' : ''}
      </span>

      {/* Status badge */}
      <span
        className={`hidden rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold sm:inline-flex ${
          service.is_active
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-white/[0.06] text-[var(--text-tertiary)]'
        }`}
      >
        {service.is_active ? 'Ativo' : 'Inativo'}
      </span>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
          aria-label="Ações"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          {service.is_active && (
            <DropdownMenuItem variant="destructive" onClick={onDeactivate}>
              <PowerOff className="mr-2 h-4 w-4" />
              Desativar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
