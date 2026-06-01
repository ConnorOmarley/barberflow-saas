'use client'

import { MoreHorizontal, Pencil, UserX, CalendarDays, Mail } from 'lucide-react'
import { Avatar } from '@/components/dashboard/primitives'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deactivateBarber } from '@/app/actions/barbers'
import type { Tables } from '@/types/database.types'
import { useState } from 'react'
import { toast } from 'sonner'

interface BarberCardProps {
  barber: Tables<'barbers'>
  serviceCount: number
  onEdit: () => void
}

export function BarberCard({ barber, serviceCount, onEdit }: BarberCardProps) {
  const [isDeactivating, setIsDeactivating] = useState(false)

  async function handleDeactivate() {
    if (!barber.is_active) return
    setIsDeactivating(true)
    const result = await deactivateBarber(barber.id)
    setIsDeactivating(false)
    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast.success('Barbeiro desativado com sucesso.')
    }
  }

  const specialties = barber.specialties ?? []

  return (
    <article className="surface-card p-5">
      {/* Top row: avatar + info + actions */}
      <div className="flex items-start gap-3">
        <Avatar name={barber.name} size={48} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[0.9375rem] font-semibold text-foreground truncate">
              {barber.name}
            </p>
            {/* Status badge */}
            {barber.is_active ? (
              <span className="badge-pill shrink-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                Ativo
              </span>
            ) : (
              <span className="badge-pill shrink-0 bg-white/5 text-[var(--text-tertiary)] border-white/10">
                Inativo
              </span>
            )}
          </div>
          {/* Invite pending indicator */}
          {!barber.profile_id && (
            <span className="mt-0.5 inline-block text-xs text-[#94a3b8] bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
              Convite pendente
            </span>
          )}
        </div>

        {/* Dropdown actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-[var(--text-secondary)]"
              aria-label="Ações do barbeiro"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            {barber.is_active && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  {isDeactivating ? 'Desativando...' : 'Desativar'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Specialties tags */}
      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {specialties.map((s) => (
            <span
              key={s}
              className="badge-pill bg-white/5 border border-white/10 text-[var(--text-secondary)]"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Services count */}
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {serviceCount} {serviceCount === 1 ? 'serviço ativo' : 'serviços ativos'}
      </p>

      {/* Footer actions */}
      <div className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Editar
        </Button>
        {!barber.profile_id && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-[#d4a574] hover:text-[#d4a574]"
            onClick={onEdit}
          >
            <Mail className="h-3 w-3" aria-hidden />
            Convidar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled
        >
          <CalendarDays className="h-3 w-3" aria-hidden />
          Ver agenda
        </Button>
      </div>
    </article>
  )
}
