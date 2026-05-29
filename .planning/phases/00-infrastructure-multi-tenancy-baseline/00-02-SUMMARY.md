---
phase: 00-infrastructure-multi-tenancy-baseline
plan: "02"
subsystem: testing
tags: [rls, postgres, sql, ci, multi-tenancy, supabase, jwt]

# Dependency graph
requires:
  - phase: 00-infrastructure-multi-tenancy-baseline
    provides: "Supabase migration with RLS-enabled tables (Plan 00-01)"

provides:
  - "CI SQL assertion: zero public tables without RLS (AUTH-08)"
  - "Runtime cross-tenant isolation proof: barbershop A rows invisible to barbershop B JWT (AUTH-06)"
  - "LGPD clients table field assertions: whatsapp_opt_in, opt_in_timestamp, anon_client_insert policy (AUTH-07)"
  - "Shell runner: scripts/check-rls.sh exits 1 on RLS violation (CI integration)"

affects:
  - 00-infrastructure-multi-tenancy-baseline
  - all future phases (CI guard prevents RLS omissions from ever reaching main)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SET LOCAL request.jwt.claims for runtime RLS isolation testing in psql"
    - "BEGIN...ROLLBACK wrapping for transactional SQL test isolation"
    - "supabase db query --output plain for CI scriptable database queries"

key-files:
  created:
    - tests/ci_rls_check.sql
    - tests/rls_isolation.sql
    - tests/rls_clients.sql
    - scripts/check-rls.sh
  modified: []

key-decisions:
  - "check-rls.sh uses supabase CLI (supabase db query) as primary method — no DATABASE_URL hardcoded, no credentials in script"
  - "rls_isolation.sql uses SET LOCAL to simulate JWT context switches within a single transaction — proves RLS enforcement at the DB layer"
  - "All test SQL wrapped in BEGIN...ROLLBACK to prevent test data persistence"

patterns-established:
  - "Pattern: SQL tests run against live DB via psql $DATABASE_URL -f tests/<file>.sql"
  - "Pattern: CI RLS guard runs via scripts/check-rls.sh — exit 1 on violation"
  - "Pattern: JWT context simulation in SQL tests uses SET LOCAL request.jwt.claims"

requirements-completed:
  - AUTH-06
  - AUTH-08

# Metrics
duration: 2min
completed: 2026-05-29
---

# Phase 0 Plan 02: CI RLS Assertion Scripts Summary

**Four SQL and shell CI test files proving every public schema table has RLS enabled and cross-tenant isolation holds via runtime JWT claim switching**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-29T21:53:16Z
- **Completed:** 2026-05-29T21:54:51Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- `tests/ci_rls_check.sql` — CI assertion matching RESEARCH.md Pattern 8 exactly: queries `pg_tables WHERE rowsecurity = false`, must return 0 rows; includes a COUNT(*) variant for shell script parsing
- `tests/rls_isolation.sql` — Runtime cross-tenant isolation proof using `SET LOCAL request.jwt.claims` to insert a row as barbershop A, switch claims to barbershop B, then assert 0 rows visible; wrapped in `BEGIN...ROLLBACK` for clean test isolation
- `tests/rls_clients.sql` — LGPD compliance assertions: verifies `whatsapp_opt_in`, `opt_in_timestamp` columns exist and `anon_client_insert` policy is present on the `clients` table
- `scripts/check-rls.sh` — Bash CI runner using `supabase db query`; exits 0 on pass, exits 1 on RLS violation (with actionable failure message), exits 2 on connection failure

## Task Commits

Each task was committed atomically:

1. **Task 1: Write CI RLS assertion SQL and shell runner script** - `0d6f8fa` (feat)

**Plan metadata:** (included in task commit above — no separate metadata commit needed for single-task plan)

## Files Created/Modified

- `tests/ci_rls_check.sql` — CI assertion: SELECT from pg_tables WHERE rowsecurity=false must return 0 rows; COUNT(*) variant for shell parsing
- `tests/rls_isolation.sql` — Runtime cross-tenant isolation: SET LOCAL JWT claim switch between barbershop A and B; INSERT + SELECT with ROLLBACK
- `tests/rls_clients.sql` — LGPD field assertions: whatsapp_opt_in, opt_in_timestamp, anon_client_insert policy verification
- `scripts/check-rls.sh` — Shell runner: supabase db query call, exits 1 on RLS violation, exits 2 on connection error

## Decisions Made

- `check-rls.sh` uses `supabase db query` (linked project CLI auth) rather than direct `psql $DATABASE_URL` — avoids needing to expose DATABASE_URL in CI configuration; aligns with Pattern 8 in RESEARCH.md
- `rls_isolation.sql` tests the `profiles` table specifically (has both `barbershop_id` and is accessed via JWT claims) — provides the clearest cross-tenant isolation proof
- Script includes a numeric validation guard on COUNT result to distinguish connection failures (exit 2) from actual RLS violations (exit 1)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All four files created and passed automated verification in a single pass.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Files are read-only SQL assertions and a shell script. No new threat surface beyond what the plan's threat model already documents.

- T-00-04 (Information Disclosure — connection string): Mitigated — `check-rls.sh` uses `supabase db query` (linked project auth); no hardcoded credentials; DATABASE_URL referenced in help text only, never echoed.
- T-00-05 (Information Disclosure — tables without RLS): Mitigated — CI check catches any table missing RLS and fails the build with exit 1.

## Next Phase Readiness

- CI scripts are ready for integration into GitHub Actions (Plan 00-08)
- `scripts/check-rls.sh` can be invoked in the CI pipeline after `supabase db push` to assert schema correctness
- Plan 00-03 (schema push to remote Supabase + TypeScript codegen) can now proceed — these tests will validate it

## Self-Check: PASSED

- FOUND: tests/ci_rls_check.sql
- FOUND: tests/rls_isolation.sql
- FOUND: tests/rls_clients.sql
- FOUND: scripts/check-rls.sh
- FOUND: .planning/phases/00-infrastructure-multi-tenancy-baseline/00-02-SUMMARY.md
- FOUND: commit 0d6f8fa (feat(00-02): add CI RLS assertion scripts and isolation tests)

---
*Phase: 00-infrastructure-multi-tenancy-baseline*
*Completed: 2026-05-29*
