---
phase: 02-client-booking-portal
plan: "01"
subsystem: database
tags: [migration, rls, scheduling, multi-tenancy]
dependency_graph:
  requires: [01-06-SUMMARY.md]
  provides: [appointments_no_overlap constraint, anon RLS policies, clients upsert constraint]
  affects: [appointments table, clients table, barber_services table, working_hours table, services table, barbers table, barbershops table]
tech_stack:
  added: [btree_gist extension]
  patterns: [EXCLUDE USING gist, partial exclusion constraint, anon RLS policies]
key_files:
  created:
    - supabase/migrations/20260601000001_phase2_schema.sql
  modified: []
decisions:
  - "Half-open tsrange '[)' chosen so contiguous slots do not conflict at boundaries"
  - "Partial constraint WHERE (status != 'CANCELLED') frees cancelled slots immediately for rebooking"
  - "Anon INSERT policies not added — portal writes use service role via adminClient"
  - "DROP NOT NULL on created_by is backward-compatible: Phase 1 data already has it populated"
metrics:
  duration: "~5 min"
  completed: "2026-06-01"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 2 Plan 01: Phase 2 Database Migration Summary

**One-liner:** Exclusion constraint GIST por barber_id + tsrange semi-aberto previne double-booking no banco; 6 políticas anon habilitam leitura pública para o portal de agendamento.

## What Was Built

Migration SQL `20260601000001_phase2_schema.sql` com 5 seções:

- **SECTION A:** `CREATE EXTENSION IF NOT EXISTS btree_gist` — necessário antes da constraint GIST em UUID
- **SECTION B:** `appointments_no_overlap` — exclusion constraint parcial com `tsrange('[)')` e `WHERE (status != 'CANCELLED')`
- **SECTION C:** `clients_barbershop_whatsapp_unique` — UNIQUE(barbershop_id, whatsapp_number) para upsert no portal
- **SECTION D:** `ALTER COLUMN created_by DROP NOT NULL` — permite agendamentos de clientes sem auth.users
- **SECTION E:** 6 políticas RLS SELECT para role `anon`:
  1. `anon_barbershops_select` — USING (true)
  2. `anon_services_select` — USING (is_active = true)
  3. `anon_barbers_select` — USING (is_active = true)
  4. `anon_working_hours_select` — USING (is_active = true)
  5. `anon_appointments_select` — USING (status != 'CANCELLED')
  6. `anon_barber_services_select` — USING (true)

## Checkpoint Status

Plano pausado em `checkpoint:human-verify` — aguardando `supabase db push` pelo usuário e regeneracao de `src/types/database.types.ts`.

## Deviations from Plan

None — migration criada exatamente conforme especificado no plano 02-01-PLAN.md.

## Known Stubs

None — este plano cria apenas SQL. O arquivo `src/types/database.types.ts` sera atualizado pelo usuario via `supabase gen types typescript` apos o `db push`.

## Threat Flags

None — todas as superficies de seguranca estao dentro do threat model do plano (T-02-01 a T-02-SC).

## Self-Check: PASSED

- [x] `supabase/migrations/20260601000001_phase2_schema.sql` existe
- [x] `grep -c "appointments_no_overlap"` >= 1
- [x] `grep -c "anon_barbershops_select"` >= 1
- [x] `grep -c "DROP NOT NULL"` >= 1
- [x] `grep -c "btree_gist"` >= 1
- [x] `grep -c "clients_barbershop_whatsapp_unique"` >= 1
- [x] `grep -c "anon_barber_services_select"` >= 1
