'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, CheckSquare, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Panel, PanelHeader } from '@/components/dashboard/primitives'
import Link from 'next/link'

const STORAGE_KEY = 'setup_checklist_dismissed'

interface ChecklistItem {
  label: string
  href: string
  done: boolean
}

interface SetupChecklistProps {
  barbershopId: string
}

/**
 * SetupChecklist — Widget de progresso de configuração da barbearia.
 *
 * Exibe 4 itens de setup. Persiste dismiss em localStorage.
 * Oculto quando todos os 4 itens estiverem completos OU quando dispensado.
 */
export function SetupChecklist({ barbershopId }: SetupChecklistProps) {
  const [dismissed, setDismissed] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>([
    { label: 'Adicione horários de funcionamento', href: '/dashboard/equipe', done: false },
    { label: 'Cadastre seu primeiro barbeiro', href: '/dashboard/equipe', done: false },
    { label: 'Defina os serviços oferecidos', href: '/dashboard/servicos', done: false },
    { label: 'Configure comissões da equipe', href: '/dashboard/equipe', done: false },
  ])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Verificar dismiss no localStorage
    const storedDismiss = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY) === 'true'
      : false
    setDismissed(storedDismiss)
    if (storedDismiss) {
      setIsLoaded(true)
      return
    }

    // Buscar contagens para verificar status de cada item
    const supabase = createClient()

    async function loadProgress() {
      // 1. Contar barbeiros ativos
      const { count: barbersCount } = await supabase
        .from('barbers')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .eq('is_active', true)

      // 2. Contar serviços ativos
      const { count: servicesCount } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .eq('is_active', true)

      // 3. Contar working_hours via barbeiros da barbearia
      const { data: barberIds } = await supabase
        .from('barbers')
        .select('id')
        .eq('barbershop_id', barbershopId)

      let workingHoursCount = 0
      let commissionCount = 0

      if (barberIds && barberIds.length > 0) {
        const ids = barberIds.map((b) => b.id)

        const { count: whCount } = await supabase
          .from('working_hours')
          .select('id', { count: 'exact', head: true })
          .in('barber_id', ids)
          .eq('is_active', true)

        workingHoursCount = whCount ?? 0

        // 4. Contar barber_services com commission_value não nulo
        const { count: commCount } = await supabase
          .from('barber_services')
          .select('barber_id', { count: 'exact', head: true })
          .in('barber_id', ids)
          .not('commission_value', 'is', null)

        commissionCount = commCount ?? 0
      }

      setItems([
        {
          label: 'Adicione horários de funcionamento',
          href: '/dashboard/equipe',
          done: workingHoursCount > 0,
        },
        {
          label: 'Cadastre seu primeiro barbeiro',
          href: '/dashboard/equipe',
          done: (barbersCount ?? 0) > 0,
        },
        {
          label: 'Defina os serviços oferecidos',
          href: '/dashboard/servicos',
          done: (servicesCount ?? 0) > 0,
        },
        {
          label: 'Configure comissões da equipe',
          href: '/dashboard/equipe',
          done: commissionCount > 0,
        },
      ])
      setIsLoaded(true)
    }

    loadProgress()
  }, [barbershopId])

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setDismissed(true)
  }

  const completedCount = items.filter((i) => i.done).length
  const allDone = completedCount === items.length
  const progressPercent = (completedCount / items.length) * 100

  // Ocultar se dispensado ou todos completos
  if (!isLoaded || dismissed || allDone) return null

  return (
    <Panel className="p-0">
      <PanelHeader
        title="Configure sua barbearia"
        icon={<CheckSquare className="h-4 w-4" />}
        action={
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dispensar checklist de configuração"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5 pb-5">
        {/* Barra de progresso */}
        <div
          className="h-1.5 w-full rounded-full overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-label={`${completedCount} de ${items.length} itens concluídos`}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #e8c89a, #d4a574)',
            }}
          />
        </div>

        <p className="text-xs text-[var(--text-secondary)] mb-3 tabular-nums">
          {completedCount} de {items.length} itens concluídos
        </p>

        {/* Itens da checklist */}
        <div className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-3">
              {item.done ? (
                <CheckCircle2
                  className="h-[18px] w-[18px] shrink-0 text-emerald-400"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="h-[18px] w-[18px] shrink-0 text-[var(--text-tertiary)]"
                  aria-hidden
                />
              )}
              <span
                className={`flex-1 text-sm ${
                  item.done
                    ? 'line-through text-[var(--text-tertiary)]'
                    : 'text-foreground'
                }`}
              >
                {item.label}
              </span>
              {!item.done && (
                <Link
                  href={item.href}
                  className="ml-auto text-xs text-[#d4a574] hover:underline whitespace-nowrap"
                >
                  Configurar →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
