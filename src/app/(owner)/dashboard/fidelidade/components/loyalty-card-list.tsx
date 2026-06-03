'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { redeemLoyaltyCard } from '@/app/actions/loyalty'

// ─── Types ────────────────────────────────────────────────────────────────────

type StampRow = {
  client_id: string
  created_at: string
  clients: { id: string; full_name: string; whatsapp_number: string | null } | null
}

type RedemptionRow = {
  client_id: string
  created_at: string
}

type LoyaltyRule = {
  id: string
  stamps_required: number
  reward_description: string
  is_active: boolean
}

interface LoyaltyCardListProps {
  loyaltyRule: LoyaltyRule | null
  stamps: StampRow[]
  redemptions: RedemptionRow[]
  stampsRequired: number
}

// ─── Algoritmo de contagem de stamps ativos ───────────────────────────────────
//
// Para cada cliente:
//   lastRedemption = MAX(redemptions.created_at WHERE client_id matches) ?? '1970-01-01'
//   activeStamps = stamps com created_at > lastRedemption
//
// RESEARCH Pitfall 3: o reset point é o último resgate, não contagem total de stamps.

type ClientProgress = {
  clientId: string
  fullName: string
  whatsappNumber: string | null
  activeStamps: number
}

function buildClientProgress(
  stamps: StampRow[],
  redemptions: RedemptionRow[],
): ClientProgress[] {
  // 1. Mapear último resgate por clientId (MAX created_at)
  const lastRedemptionMap = new Map<string, string>()
  for (const r of redemptions) {
    const existing = lastRedemptionMap.get(r.client_id)
    if (!existing || r.created_at > existing) {
      lastRedemptionMap.set(r.client_id, r.created_at)
    }
  }

  // 2. Acumular stamps ativos por clientId
  const progressMap = new Map<string, ClientProgress>()

  for (const stamp of stamps) {
    const clientId = stamp.client_id
    const lastRedemption = lastRedemptionMap.get(clientId) ?? '1970-01-01T00:00:00Z'
    const isActive = stamp.created_at > lastRedemption

    const existing = progressMap.get(clientId)
    if (existing) {
      if (isActive) existing.activeStamps++
    } else {
      progressMap.set(clientId, {
        clientId,
        fullName: stamp.clients?.full_name ?? 'Cliente',
        whatsappNumber: stamp.clients?.whatsapp_number ?? null,
        activeStamps: isActive ? 1 : 0,
      })
    }
  }

  // 3. Converter em array ordenado por activeStamps DESC (cartelas completas primeiro)
  return Array.from(progressMap.values()).sort((a, b) => b.activeStamps - a.activeStamps)
}

// ─── LoyaltyCardList ──────────────────────────────────────────────────────────

export function LoyaltyCardList({
  loyaltyRule,
  stamps,
  redemptions,
  stampsRequired,
}: LoyaltyCardListProps) {
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const clientProgress = buildClientProgress(stamps, redemptions)

  function handleRedeem(clientId: string, activeStamps: number) {
    // Guard client-side redundante — o servidor re-valida independentemente (T-04-09)
    if (activeStamps < stampsRequired) return

    setRedeemingId(clientId)
    setErrorMsg(null)

    startTransition(async () => {
      const result = await redeemLoyaltyCard(clientId)
      if ('error' in result) {
        setErrorMsg(result.error)
      }
      // Se success: revalidatePath já foi chamado pelo Server Action — página atualiza
      setRedeemingId(null)
    })
  }

  return (
    <>
      {/* Banner quando programa está inativo */}
      {loyaltyRule && !loyaltyRule.is_active && (
        <Alert className="mb-4 border-yellow-900/50 bg-yellow-950/30 text-yellow-400">
          <AlertDescription>Programa de fidelidade pausado</AlertDescription>
        </Alert>
      )}

      {/* Erro de resgate */}
      {errorMsg && (
        <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Estado vazio */}
      {clientProgress.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-[0.9375rem] font-semibold text-foreground">
            Nenhum cliente com carimbos ainda
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Os carimbos aparecem automaticamente ao concluir agendamentos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clientProgress.map((client) => {
            const isFull = client.activeStamps >= stampsRequired
            const percent = Math.min(
              100,
              stampsRequired > 0
                ? Math.round((client.activeStamps / stampsRequired) * 100)
                : 0,
            )
            const isRedeemingThis = redeemingId === client.clientId && isPending

            return (
              <div
                key={client.clientId}
                className={`rounded-lg border p-4 ${
                  isFull
                    ? 'border-amber-600/50 bg-amber-950/20'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {/* Nome e contador */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.fullName}</p>
                    {client.whatsappNumber && (
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {client.whatsappNumber}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      isFull ? 'text-amber-400' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {client.activeStamps}/{stampsRequired}
                  </span>
                </div>

                {/* Barra de progresso dourada */}
                <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isFull ? 'bg-amber-500' : 'bg-[#d4a574]'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Botão Resgatar — SOMENTE quando cartela completa (isFull) */}
                {isFull && (
                  <Button
                    type="button"
                    onClick={() => handleRedeem(client.clientId, client.activeStamps)}
                    disabled={isRedeemingThis || isPending}
                    className="mt-3 w-full bg-amber-600 font-semibold text-black hover:bg-amber-500"
                  >
                    {isRedeemingThis ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resgatando...
                      </>
                    ) : (
                      `Resgatar — ${loyaltyRule?.reward_description ?? 'recompensa'}`
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
