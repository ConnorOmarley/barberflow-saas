'use client'

// NOTE: Este componente é um stub — implementação completa no plano 04-03.
// Renderiza placeholder enquanto a lista de progresso/resgate não está implementada.

import type { Database } from '@/types/database.types'

type LoyaltyRuleRow = Database['public']['Tables']['loyalty_rules']['Row']

interface StampWithClient {
  client_id: string
  created_at: string
  clients: { id: string; full_name: string; whatsapp_number: string } | null
}

interface RedemptionSummary {
  client_id: string
  created_at: string
}

interface LoyaltyCardListProps {
  loyaltyRule: LoyaltyRuleRow | null
  stamps: StampWithClient[]
  redemptions: RedemptionSummary[]
  stampsRequired: number
}

export function LoyaltyCardList({
  loyaltyRule,
  stamps,
  redemptions,
  stampsRequired,
}: LoyaltyCardListProps) {
  // Suprimir warnings de variáveis não usadas até implementação completa (04-03)
  void redemptions

  if (!loyaltyRule) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-sm">
          Nenhuma regra de fidelidade configurada.
        </p>
        <p className="text-[var(--text-tertiary)] text-xs mt-1">
          Configure uma regra de fidelidade para começar a usar o sistema de carimbos.
        </p>
      </div>
    )
  }

  // Calcular clientes únicos com carimbos
  const uniqueClients = new Map<string, { name: string; stampCount: number }>()
  for (const stamp of stamps) {
    const clientId = stamp.client_id
    const name = stamp.clients?.full_name ?? 'Cliente'
    const existing = uniqueClients.get(clientId)
    if (existing) {
      existing.stampCount++
    } else {
      uniqueClients.set(clientId, { name, stampCount: 1 })
    }
  }

  const clientList = Array.from(uniqueClients.entries())

  if (clientList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-sm">
          Nenhum carimbo registrado ainda.
        </p>
        <p className="text-[var(--text-tertiary)] text-xs mt-1">
          Carimbos são adicionados automaticamente quando agendamentos são concluídos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">
        Meta: {stampsRequired} carimbos — {loyaltyRule.reward_description}
      </p>
      <ul className="space-y-2">
        {clientList.map(([clientId, { name, stampCount }]) => (
          <li
            key={clientId}
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="text-sm text-[var(--text-secondary)]">
              {stampCount} / {stampsRequired} carimbos
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
