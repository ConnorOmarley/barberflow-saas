'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoyaltyCardList } from './loyalty-card-list'
import { LoyaltyConfigSheet } from './loyalty-config'
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

interface FidelidadeClientProps {
  loyaltyRule: LoyaltyRuleRow | null
  stamps: StampWithClient[]
  redemptions: RedemptionSummary[]
  stampsRequired: number
}

export function FidelidadeClient({
  loyaltyRule,
  stamps,
  redemptions,
  stampsRequired,
}: FidelidadeClientProps) {
  const router = useRouter()
  const [configOpen, setConfigOpen] = useState(false)

  function handleSaved() {
    setConfigOpen(false)
    router.refresh()
  }

  // Extrair dados mínimos para LoyaltyConfigSheet
  const ruleForConfig = loyaltyRule
    ? {
        id: loyaltyRule.id,
        stamps_required: loyaltyRule.stamps_required,
        reward_description: loyaltyRule.reward_description,
      }
    : null

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fidelidade</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Carimbos digitais para seus clientes
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => setConfigOpen(true)}
        >
          <Settings className="h-4 w-4" />
          Configurar regra
        </Button>
      </div>

      {/* Lista de progresso */}
      <LoyaltyCardList
        loyaltyRule={loyaltyRule}
        stamps={stamps}
        redemptions={redemptions}
        stampsRequired={stampsRequired}
      />

      {/* Sheet de configuração */}
      <LoyaltyConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        rule={ruleForConfig}
        onSaved={handleSaved}
      />
    </div>
  )
}
