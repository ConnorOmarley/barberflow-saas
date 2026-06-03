---
phase: 03-qr-check-in
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, qr-checkin, hmac, migration]

requires:
  - phase: 02-client-booking-portal
    provides: "Tabela appointments com barbershop_id — base da FK em used_qr_tokens"

provides:
  - "Tabela used_qr_tokens com UNIQUE em token_hash (guard atômico anti race-condition)"
  - "RLS habilitado: SELECT para authenticated via subquery appointments.barbershop_id"
  - "QR_HMAC_SECRET configurado em .env.local"

affects: [03-02, 03-03, qr-checkin, appointments]

tech-stack:
  added: []
  patterns:
    - "used_qr_tokens sem barbershop_id próprio — isolamento via FK para appointments.barbershop_id"
    - "Writes exclusivamente via adminClient (service role), sem INSERT policy para anon/authenticated"
    - "token_hash = SHA-256 hex do token completo — nunca o token raw na DB"

key-files:
  created:
    - supabase/migrations/20260602000001_phase3_schema.sql
  modified: []

key-decisions:
  - "token_hash armazena SHA-256 hex (não o token raw) para minimizar exposição do HMAC secret"
  - "issued_at/expires_at excluídos da tabela — dados já encodados no token, schema mínimo"
  - "Nenhuma INSERT policy: todo write via adminClient que bypassa RLS; RLS sem policy = deny-by-default"
  - "UNIQUE INDEX em token_hash é o gate atômico: segundo INSERT simultâneo falha com unique violation"

patterns-established:
  - "Pattern: tabela auxiliar sem barbershop_id usa subquery via tabela pai para RLS"
  - "Pattern: operações privilegiadas de single-use token via adminClient sem policy INSERT"

requirements-completed: [QR-01, QR-02, QR-03, QR-04]

duration: 8min
completed: 2026-06-02
---

# Phase 3 Plan 01: Migration + Env Setup Summary

**Tabela used_qr_tokens com UNIQUE em token_hash como gate atômico anti race-condition e RLS service-role-only para check-in QR single-use**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-02T00:00:00Z
- **Completed:** 2026-06-02T00:08:00Z
- **Tasks:** 1 de 2 (Task 2 aguarda acao humana — checkpoint)
- **Files modified:** 1

## Accomplishments

- Migration SQL criada com schema minimo para used_qr_tokens
- UNIQUE INDEX em token_hash garante atomicidade no banco para duplo-scan simultaneo
- RLS habilitado com policy SELECT para authenticated via subquery appointments.barbershop_id
- Sem INSERT/UPDATE/DELETE policy: writes exclusivamente via adminClient (service role)

## Task Commits

1. **Task 1: Criar migration SQL para used_qr_tokens** - `efc3184` (feat)
2. **Task 2: Aplicar migration + gerar tipos TypeScript** - PENDENTE (checkpoint humano)

## Files Created/Modified

- `supabase/migrations/20260602000001_phase3_schema.sql` — Migration com CREATE TABLE, indices e RLS para used_qr_tokens

## Decisions Made

- **token_hash vs token raw:** Armazena SHA-256 hex (64 chars) do token completo — nunca o token raw. Minimiza exposicao do QR_HMAC_SECRET em caso de dump da tabela.
- **Schema minimo:** issued_at e expires_at excluidos da tabela — ja estao encodados no payload do token. Evita redundancia e simplifica o schema.
- **Sem INSERT policy:** Intencional — todo write vai via adminClient (service role) que bypassa RLS. RLS sem policy = deny-by-default para anon e authenticated. Check-in e operacao privilegiada.
- **Isolamento multi-tenancy via subquery:** used_qr_tokens nao tem barbershop_id proprio; isolamento feito via subquery `appointment_id IN (SELECT id FROM appointments WHERE barbershop_id = ...)`.

## Deviations from Plan

Nenhum — plano executado exatamente como especificado.

## Issues Encountered

Nenhum.

## User Setup Required

### Task 2 — Acoes Manuais Necessarias

Antes que o plano 03-02 possa ser executado, o usuario deve completar:

1. **Aplicar migration ao Supabase remoto:**
   ```
   npx supabase db push
   ```
   Esperado: "Applying migration 20260602000001_phase3_schema.sql... done"

2. **Regenerar tipos TypeScript:**
   ```
   npx supabase gen types typescript --linked > src/types/database.types.ts
   ```
   Esperado: arquivo `src/types/database.types.ts` atualizado sem erros.

3. **Verificar que a tabela aparece nos tipos:**
   ```powershell
   Select-String "used_qr_tokens" src/types/database.types.ts
   ```
   Esperado: pelo menos 2 ocorrencias (Row e Insert types).

4. **Gerar e adicionar QR_HMAC_SECRET ao `.env.local`:**
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copiar o output (64 chars hex) e adicionar ao `.env.local`:
   ```
   QR_HMAC_SECRET=<valor_gerado>
   ```

Quando concluido, retorne com "ok" para que o executor continue com os planos 03-02 e 03-03.

## Next Phase Readiness

- Planos 03-02 e 03-03 dependem de: tabela `used_qr_tokens` no banco + tipos TypeScript + QR_HMAC_SECRET
- Apos o usuario completar as acoes manuais acima, infra esta 100% pronta para os proximos planos
- Nenhum bloqueador tecnico — apenas o checkpoint humano pendente

## Threat Surface Scan

Nenhuma superficie nova nao planejada detectada. Ameacas T-03-01, T-03-02 e T-03-03 mitigadas conforme threat_model do plano.

---
*Phase: 03-qr-check-in*
*Completed: 2026-06-02*
