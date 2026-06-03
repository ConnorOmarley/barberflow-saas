---
phase: 04-loyalty-carimbo-digital
plan: "01"
subsystem: database
tags: [postgres, rls, supabase, loyalty, migration, multi-tenancy]

# Dependency graph
requires:
  - phase: 01-barber-service-setup
    provides: tabelas barbershops, clients, appointments (FKs usadas pelas 3 novas tabelas)
  - phase: 02-client-booking-portal
    provides: appointments com status COMPLETED (trigger do carimbo)
provides:
  - Migration 20260603000001_phase4_schema.sql com DDL completo das 3 tabelas de fidelidade
  - loyalty_rules: uma regra por barbearia com UNIQUE(barbershop_id)
  - loyalty_stamps: append-only com UNIQUE INDEX em appointment_id (idempotência)
  - loyalty_redemptions: histórico de resgates com snapshot stamps_used e FK redeemed_by auth.users
  - RLS habilitado e policies FOR ALL TO authenticated em todas as 3 tabelas
affects:
  - 04-02 (dashboard fidelidade — importa tipos gerados)
  - 04-03 (testes — verifica contagem de carimbos e idempotência)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UNIQUE na coluna barbershop_id em loyalty_rules para habilitar upsert via ON CONFLICT"
    - "UNIQUE INDEX em appointment_id para idempotência de auto-stamp (double-stamp guard)"
    - "Snapshot de stamps_required em loyalty_redemptions para histórico imutável mesmo após mudança de regra"
    - "Sem ON DELETE CASCADE de loyalty_rules para loyalty_redemptions — histórico de resgates sobrevive a mudanças"

key-files:
  created:
    - supabase/migrations/20260603000001_phase4_schema.sql
  modified: []

key-decisions:
  - "UNIQUE(barbershop_id) em loyalty_rules impede duas regras por tenant no nível do banco (habilita upsert)"
  - "UNIQUE INDEX em loyalty_stamps.appointment_id é o guard primário contra double-stamp em retries"
  - "stamps_used em loyalty_redemptions armazena snapshot de stamps_required no momento do resgate — regras futuras não afetam histórico"
  - "Sem FK loyalty_rules → loyalty_redemptions: resgates devem sobreviver a mudança ou deleção da regra"
  - "Contagem de carimbos ativos = stamps com created_at > MAX(redemption.created_at) — abordagem de reset point"

patterns-established:
  - "Reset point pattern: contagem de carimbos ativos parte do último resgate (não do total menos resgates)"

requirements-completed: [LOY-01, LOY-02, LOY-03]

# Metrics
duration: 15min
completed: 2026-06-02
---

# Phase 4 Plan 01: Loyalty Schema Summary

**Migration com loyalty_rules (1 regra/barbearia), loyalty_stamps (UNIQUE appointment_id para idempotência) e loyalty_redemptions (snapshot stamps_used) com RLS tenant-isolado via JWT app_metadata cast ::UUID**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-02T00:00:00Z
- **Completed:** 2026-06-02T00:15:00Z
- **Tasks:** 1 de 2 (Task 2 = checkpoint humano pendente)
- **Files modified:** 1

## Accomplishments

- DDL completo das 3 tabelas de fidelidade com todos os constraints e índices
- RLS habilitado e policy FOR ALL TO authenticated em loyalty_rules, loyalty_stamps e loyalty_redemptions
- Guard de idempotência: UNIQUE INDEX loyalty_stamps_appointment_id_idx previne double-stamp no banco
- Snapshot histórico: campo stamps_used em loyalty_redemptions preserva regra vigente no momento do resgate
- Sem FK cascade de loyalty_rules para loyalty_redemptions — resgates sobrevivem a mudanças de regra

## Task Commits

1. **Task 1: Criar migration Phase 4 — tabelas de fidelidade com RLS** - `b2bd296` (feat)

**Task 2 (checkpoint):** aguardando `supabase db push` + `supabase gen types typescript` pelo usuário.

## Files Created/Modified

- `supabase/migrations/20260603000001_phase4_schema.sql` — DDL completo: loyalty_rules, loyalty_stamps, loyalty_redemptions com RLS e índices

## Decisions Made

- **UNIQUE(barbershop_id) em loyalty_rules via constraint na coluna:** habilita upsert com ON CONFLICT(barbershop_id) DO UPDATE — padrão usado nas Server Actions de Phase 4.
- **Sem stamped_at em loyalty_stamps:** usar created_at como timestamp do carimbo — schema mínimo conforme RESEARCH.md.
- **FK redeemed_by REFERENCES auth.users(id):** trilha de auditoria robusta — não pode ser forjada pelo cliente; Server Action lê userId do JWT.
- **RLS direto em barbershop_id:** loyalty_stamps e loyalty_redemptions têm barbershop_id próprio (não subquery via FK) — performance superior na hot path de contagem.

## Deviations from Plan

Nenhuma — plano executado exatamente como especificado.

## Issues Encountered

Nenhum.

## User Setup Required

**Checkpoint ativo — 2 comandos obrigatórios antes de continuar para 04-02:**

### 1. Aplicar migration no Supabase remoto

```
npx supabase db push
```

Esperado: `Applying migration 20260603000001_phase4_schema.sql` sem erros.

### 2. Regenerar tipos TypeScript

```
npx supabase gen types typescript --linked > src/types/database.types.ts
```

Esperado: arquivo `src/types/database.types.ts` atualizado sem erros.

### 3. Verificar que os novos tipos aparecem

```powershell
Select-String -Path "src/types/database.types.ts" -Pattern "loyalty_rules|loyalty_stamps|loyalty_redemptions"
```

Esperado: pelo menos 3 linhas — uma entrada por tabela na seção `Tables`.

Se algum comando falhar: verifique `.env.local` para SUPABASE_PROJECT_REF e rode `npx supabase login` se necessário.

## Next Phase Readiness

- **04-02 (Dashboard /dashboard/fidelidade):** bloqueado até checkpoint humano completar e tipos serem regenerados
- **04-03 (Testes):** bloqueado até 04-02 estar completo
- Após o checkpoint: planos 04-02 e 04-03 podem importar os tipos sem erro de compilação

---
*Phase: 04-loyalty-carimbo-digital*
*Completed: 2026-06-02*
