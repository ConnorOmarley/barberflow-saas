# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-29)

**Core value:** A client can book a haircut online at any registered barbershop, show up, scan the QR, get served, and accumulate loyalty points — all without paper or manual WhatsApp.
**Current focus:** Phase 0 — Infrastructure & Multi-Tenancy Baseline

## Current Position

Phase: 0 of 8 (Infrastructure & Multi-Tenancy Baseline)
Plan: 0 of 8 in current phase
Status: Ready to execute
Last activity: 2026-05-29 — Phase 0 planned: 8 plans in 6 waves (UI-SPEC approved, research complete, verification passed)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
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

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 5 pre-condition:** WhatsApp message templates need Meta pre-approval. Submit templates during Phase 0 or Phase 1 work — do not wait until Phase 5 starts.
- **Phase 0 open question:** Confirm `custom_access_token_hook` setup in Supabase Auth for JWT custom claims before building.
- **Phase 0 open question:** Confirm `@supabase/ssr` is the current package (not `auth-helpers-nextjs`).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-29
Stopped at: Phase 0 fully planned — 8 plans, 6 waves, verification passed. Ready to execute.
Resume file: .planning/phases/00-infrastructure-multi-tenancy-baseline/00-01-PLAN.md
