---
phase: "00-infrastructure-multi-tenancy-baseline"
plan: 8
subsystem: "verification"
tags: ["smoke-test", "ci-rls", "security-hardening", "phase-gate"]
key-files:
  created:
    - supabase/migrations/20260530000004_security_hardening.sql
  modified: []
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 1
---

# Plan 00-08 Summary — Phase 0 Quality Gate

## What Was Verified

**Automated checks (Task 1) — all pass:**
- `npx tsc --noEmit` → 0 errors
- `npm run build` → compiled successfully, 13 routes, /dashboard is 0 KB client JS (server-rendered)
- 14 required files present (auth pages, layouts, supabase utils, middleware, types)
- `middleware.ts` uses `getClaims()`, never `getSession()`
- No service-role key in any `NEXT_PUBLIC_` var
- RLS assertion: `SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=false` → **0** (AUTH-08)

**Human smoke test (Task 2) — confirmed by user ("Tudo certo"):**
- Signup → email verification → login → /dashboard (AUTH-01, AUTH-02)
- Password reset → email link → /nova-senha → login (AUTH-03)
- Unauthenticated access to protected route → redirect to /entrar
- Owner accessing /agenda → redirect to /dashboard (role isolation, AUTH-06)
- /aceitar-convite renders; /auth/confirm processes invite tokens (AUTH-05 Phase 0 scope)
- pt-BR copy + dark premium UI throughout

## Security Hardening

Migration `20260530000004_security_hardening.sql` resolved the Supabase Security
Advisor warnings:
- `search_path=''` pinned on `handle_new_user_from_invite` + `custom_access_token_hook`
- `EXECUTE` revoked from public/anon/authenticated on the trigger function
- Leaked-password protection enabled in the Auth dashboard (manual)

Intentionally retained: `clients.anon_client_insert` (public booking, Phase 2).

## Commits

| Commit | Description |
|--------|-------------|
| 1cd85e8 | feat(security): hardening migration for Phase 0 advisor warnings |

## Deviations

- `scripts/check-rls.sh` expects a linked Supabase CLI; this session applied the
  schema via the Dashboard SQL editor + MCP, so the RLS assertion was run as the
  equivalent SQL query in the Dashboard (returned 0). Functionally equivalent.
- Extensive UI work happened between plans 07 and 08 (full premium dashboard
  redesign to a locked visual reference) — outside the original plan scope but
  build/type-clean and committed.

## Self-Check: PASSED

All Phase 0 success criteria verified. Phase 0 complete.
