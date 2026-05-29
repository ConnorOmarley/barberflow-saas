# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-29)

**Core value:** A client can book a haircut online at any registered barbershop, show up, scan the QR, get served, and accumulate loyalty points — all without paper or manual WhatsApp.
**Current focus:** Phase 0 — Infrastructure & Multi-Tenancy Baseline

## Current Position

Phase: 0 of 8 (Infrastructure & Multi-Tenancy Baseline)
Plan: 2 of 8 in current phase (Plan 2 COMPLETE)
Status: Executing — ready for Plan 3
Last activity: 2026-05-29 — Plan 2 complete: CI RLS assertion scripts and isolation tests

Progress: [██░░░░░░░░] 8%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~56 minutes
- Total execution time: ~1.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 0 | 2/8 | ~112 min | ~56 min |

**Recent Trend:**
- Last 5 plans: Plan 00-01 (110 min), Plan 00-02 (2 min)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Multi-tenancy via single Supabase schema + RLS (not schema-per-tenant) — impossible to retrofit, must be Phase 0
- Roadmap: QR tokens are HMAC-signed with issued_at + expires_at — client-side rendering, no Storage bucket
- Roadmap: Asaas for SaaS billing (Brazilian platform, supports PIX + recorrência)
- Roadmap: WhatsApp templates must be submitted to Meta during Phase 0/1 (2-week approval lead time)
- Plan 00-01: shadcn v4 (base-nova) used instead of deprecated New York style — CSS variables enabled as required
- Plan 00-01: form.tsx created manually (shadcn v4 CLI omits it) — RHF integration without @radix-ui/react-slot
- Plan 00-01: HSL values used in globals.css for theme vars (hsl() format) — matches UI-SPEC value strings
- Plan 00-02: check-rls.sh uses supabase CLI (supabase db query) as primary method — no DATABASE_URL hardcoded, no credentials in script
- Plan 00-02: rls_isolation.sql uses SET LOCAL to simulate JWT context switches within a single transaction — proves RLS enforcement at DB layer

### Pending Todos

None.

### Blockers/Concerns

- **Phase 5 pre-condition:** WhatsApp message templates need Meta pre-approval. Submit templates during Phase 0 or Phase 1 work — do not wait until Phase 5 starts.
- **RESOLVED:** `custom_access_token_hook` confirmed — implemented in migration 20260529000001_initial_schema.sql, activated in supabase/config.toml
- **RESOLVED:** `@supabase/ssr` confirmed as current package at v0.10.3 — installed and pinned

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-29
Stopped at: Plan 00-02 complete — CI RLS assertion scripts and isolation tests. Ready for Plan 00-03.
Resume file: .planning/phases/00-infrastructure-multi-tenancy-baseline/00-03-PLAN.md
