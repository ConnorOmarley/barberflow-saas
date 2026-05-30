---
phase: "00-infrastructure-multi-tenancy-baseline"
plan: 7
subsystem: auth-ui
tags: [dashboard-shell, server-components, auth-guard, getClaims, role-badge]
dependency_graph:
  requires: [00-04, 00-05, 00-06]
  provides: [owner-dashboard-shell, barber-agenda-shell, signOut-server-action]
  affects: [middleware-defense-in-depth]
tech_stack:
  added: []
  patterns: [getClaims-auth-guard, server-action-signout, route-group-layouts]
key_files:
  created:
    - src/app/actions/auth.ts
  modified:
    - src/app/(owner)/layout.tsx
    - src/app/(owner)/dashboard/page.tsx
    - src/app/(barber)/layout.tsx
    - src/app/(barber)/agenda/page.tsx
decisions:
  - "getClaims() used in both layouts and pages for defense-in-depth alongside middleware"
  - "Barber layout redirects role=owner to /dashboard (not /entrar) — owner is authenticated but in wrong route group"
  - "signOut Server Action extracted to src/app/actions/auth.ts for reuse across both shells"
  - "Disabled Configurar barbearia CTA uses title attribute as tooltip — no Radix Tooltip installed in Phase 0"
metrics:
  duration: 15
  completed: "2026-05-30T22:59:00Z"
  tasks_completed: 2
  files_modified: 5
requirements: [AUTH-02, AUTH-04, AUTH-06]
---

# Phase 0 Plan 7: Dashboard Shells (Owner + Barber) Summary

Owner and barber dashboard shells with getClaims()-based server-side auth guards, role badges, signout Server Action, and empty state placeholders matching the Navalha Dourada design system.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Owner layout auth guard + dashboard shell | ca6df17 | layout.tsx, dashboard/page.tsx, actions/auth.ts |
| 2 | Barber layout auth guard + agenda shell | fe77748 | layout.tsx, agenda/page.tsx |

## What Was Built

### src/app/actions/auth.ts
Server Action (`'use server'`) with `signOut()` that calls `supabase.auth.signOut()` and redirects to `/entrar`. Reused by both owner dashboard and barber agenda shell via form action.

### src/app/(owner)/layout.tsx
Server Component layout. Calls `getClaims()` — redirects to `/entrar` if no claims or if `role !== 'owner'`. Second auth layer on top of middleware (defense in depth, T-00-21).

### src/app/(owner)/dashboard/page.tsx
Server Component. Reads JWT claims for email display. Header: BarberFlow brand (Scissors icon + Cormorant font), amber "Dono" badge, user email, "Sair" form button. Main: empty state "Sua barbearia está quase pronta" with disabled "Configurar barbearia" CTA (Phase 1 will enable it).

### src/app/(barber)/layout.tsx
Server Component layout. Calls `getClaims()` — redirects to `/entrar` if not authenticated, redirects to `/dashboard` if `role !== 'barber'` (owner cross-role protection, T-00-20).

### src/app/(barber)/agenda/page.tsx
Server Component. Header: BarberFlow brand, amber outline "Barbeiro" badge, user email, "Sair" form button. Main: empty state "Nenhum agendamento ainda" with body "Seus agendamentos confirmados aparecerão aqui." No CTA button in Phase 0.

## Threat Mitigations Applied

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-00-20 | Barber layout redirects role=owner to /dashboard |
| T-00-21 | Both layouts call getClaims() server-side — second guard after middleware |
| T-00-22 | signOut Server Action calls supabase.auth.signOut() to clear server-side session cookie |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| src/app/(owner)/dashboard/page.tsx | ~53 | "Configurar barbearia" button is disabled — intentional Phase 0 placeholder; Phase 1 will wire to onboarding flow |

The disabled button is intentional per the plan spec ("Phase 1 will enable it") and not a blocker for this plan's goal.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Build Verification

`npm run build` passed with zero TypeScript errors. `/dashboard` and `/agenda` routes compile as Dynamic (server-rendered), confirmed in build output.

## Self-Check: PASSED

- [x] src/app/actions/auth.ts exists
- [x] src/app/(owner)/layout.tsx exists and has getClaims()
- [x] src/app/(owner)/dashboard/page.tsx exists with "Dono", "Sair", "Sua barbearia"
- [x] src/app/(barber)/layout.tsx exists and has getClaims() + dashboard redirect
- [x] src/app/(barber)/agenda/page.tsx exists with "Barbeiro", "Sair", "Nenhum agendamento"
- [x] Commit ca6df17 exists (Task 1)
- [x] Commit fe77748 exists (Task 2)
- [x] npm run build: PASS (zero errors)
