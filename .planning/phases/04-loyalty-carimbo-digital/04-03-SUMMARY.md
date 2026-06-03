---
phase: "04-loyalty-carimbo-digital"
plan: "03"
subsystem: "loyalty-ui"
tags: ["loyalty", "stamps", "client-component", "progress-bar", "redemption"]
dependency_graph:
  requires:
    - "04-01"  # schema loyalty_rules + loyalty_stamps + loyalty_redemptions
    - "04-02"  # Server Actions loyalty.ts + page.tsx + fidelidade-client.tsx + loyalty-config.tsx
  provides:
    - "LoyaltyCardList — lista de progresso por cliente com barra de progresso e botão Resgatar"
  affects:
    - "src/app/(owner)/dashboard/fidelidade/"
tech_stack:
  added: []
  patterns:
    - "useTransition para Server Action call com loading state por cliente"
    - "buildClientProgress — algoritmo de contagem de stamps ativos com lastRedemption baseline"
    - "Renderização condicional de botão Resgatar baseada em isFull (activeStamps >= stampsRequired)"
key_files:
  created: []
  modified:
    - "src/app/(owner)/dashboard/fidelidade/components/loyalty-card-list.tsx"
decisions:
  - "LoyaltyCardList contém apenas lista + botão Resgatar; header e LoyaltyConfigSheet ficam em FidelidadeClient (evitar duplicação)"
  - "Algoritmo de contagem JS-side idêntico ao SQL-side do Server Action (RESEARCH Pitfall 3)"
  - "redeemingId rastreado por clientId + isPending para loading state granular por card"
  - "stampsRequired > 0 guard no cálculo de percent evita divisão por zero"
metrics:
  duration: "~15 minutos"
  completed: "2026-06-03"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 4 Plan 03: LoyaltyCardList — Progresso por Cliente + Botão Resgatar

**One-liner:** Client Component com grid de cards por cliente, barra de progresso dourada (#d4a574), contagem de stamps ativos com baseline lastRedemption e botão Resgatar condicional.

## What Was Built

`LoyaltyCardList` substituiu o stub criado no plano 04-02 com implementação completa:

- **Grid de cards por cliente:** grid responsivo (1/2/3 colunas), ordenado por stamps desc (cartelas completas primeiro)
- **Algoritmo `buildClientProgress`:** para cada cliente, calcula `activeStamps` contando apenas stamps com `created_at > lastRedemption` (ou `'1970-01-01T00:00:00Z'` se nunca resgatou) — espelho exato da lógica SQL do `redeemLoyaltyCard` Server Action
- **Barra de progresso:** `bg-[#d4a574]` para cartela incompleta, `bg-amber-500` para completa, com `transition-all`
- **Destaque visual para cartela completa:** `border-amber-600/50 bg-amber-950/20` e contador em `text-amber-400`
- **Botão Resgatar condicional:** renderizado SOMENTE quando `isFull = activeStamps >= stampsRequired`
- **Loading state granular:** `isRedeemingThis = redeemingId === client.clientId && isPending` — apenas o card do cliente sendo resgatado mostra spinner
- **Banner de programa inativo:** Alert amarelo quando `loyaltyRule.is_active === false`
- **Estado vazio:** mensagem centralizada quando nenhum cliente tem carimbos
- **Tipos locais:** sem dependência de `database.types` para isolamento e robustez

## Commits

| Hash | Message |
|------|---------|
| `1782ff4` | chore: merge master — trazer commits fase 3 e 4 para worktree 04-03 |
| `016d25b` | feat(phase-4): LoyaltyCardList — progresso por cliente + botão Resgatar |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicated header and LoyaltyConfigSheet from LoyaltyCardList**

- **Found during:** Analysis before Task 1 implementation
- **Issue:** The plan's JSX structure included a `<header>` and `<LoyaltyConfigSheet>` inside `LoyaltyCardList`. However, `fidelidade-client.tsx` (created in 04-02) already has its own header with "Configurar regra" button and `LoyaltyConfigSheet`. Including these again in `LoyaltyCardList` would create duplicate UI elements and duplicate sheet instances.
- **Fix:** `LoyaltyCardList` renders only the list portion (alerts + empty state + cards grid). Header and config sheet remain exclusively in `FidelidadeClient`.
- **Files modified:** `src/app/(owner)/dashboard/fidelidade/components/loyalty-card-list.tsx`
- **Commit:** `016d25b`

**2. [Rule 3 - Blocking] Worktree merge required before implementation**

- **Found during:** Start of execution
- **Issue:** The worktree `agent-a5e80ec28571e31b0` was 15+ commits behind master. Phase 4 files (loyalty schema, server actions, page.tsx, fidelidade-client.tsx) existed only in the main checkout, not in the worktree.
- **Fix:** `git merge master --no-commit --no-ff` brought all Phase 3 and Phase 4 files into the worktree. Committed as chore merge.
- **Commit:** `1782ff4`

## Verification Results

```
npx tsc --noEmit  →  0 errors (empty output = success)

grep "export function LoyaltyCardList"  →  line 91 ✓
grep "isFull"                           →  lines 149, 162, 179, 190, 197 ✓
grep "stampsRequired"                   →  lines 33, 95, 105, 149, 152, 153, 182 ✓
grep "Resgatar"                         →  lines 196, 210 ✓
grep "buildClientProgress"              →  lines 51, 101 ✓
```

## Known Stubs

None — implementação completa. O stub do plano 04-02 foi inteiramente substituído.

## Threat Flags

None — nenhuma superfície nova além do planejado. `clientId` passado ao Server Action `redeemLoyaltyCard` que lê `barbershop_id` exclusivamente de `profiles` (T-04-08 mitigado). Guard client-side redundante em `handleRedeem` não substitui validação server-side (T-04-09 mitigado no Server Action).

## Self-Check: PASSED

- [x] `loyalty-card-list.tsx` existe no worktree: `/c/Users/alber/OneDrive/Documentos/VsCode/barberflow-saas/.claude/worktrees/agent-a5e80ec28571e31b0/src/app/(owner)/dashboard/fidelidade/components/loyalty-card-list.tsx`
- [x] Commit `016d25b` existe: feat(phase-4): LoyaltyCardList — progresso por cliente + botão Resgatar
- [x] `npx tsc --noEmit` retornou 0 erros
- [x] `export function LoyaltyCardList` presente
- [x] Botão Resgatar condicional em `{isFull && (...)}`
- [x] Algoritmo `buildClientProgress` com baseline `lastRedemption`
- [x] Estado vazio presente para `clientProgress.length === 0`
