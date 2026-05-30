---
phase: "00-infrastructure-multi-tenancy-baseline"
plan: 5
subsystem: "auth-ui"
tags: ["auth", "signup", "login", "pkce", "supabase", "react-hook-form", "zod"]
dependency_graph:
  requires: ["00-04"]
  provides: ["owner-signup-ui", "owner-login-ui", "pkce-callback-route"]
  affects: ["middleware-routing", "owner-dashboard-shell", "barber-agenda-shell"]
tech_stack:
  added: []
  patterns: ["react-hook-form+zod", "supabase-browser-client", "supabase-server-route-handler", "suspense-boundary-for-searchparams"]
key_files:
  created: []
  modified:
    - "src/app/(auth)/cadastro/page.tsx"
    - "src/app/(auth)/entrar/page.tsx"
    - "src/app/auth/confirm/route.ts"
decisions:
  - "Wrapped useSearchParams() in Suspense boundary to fix Next.js SSG prerender error"
  - "Extracted EntrarForm into a sub-component to apply Suspense at the right granularity"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-30T14:45:21Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 0 Plan 5: Auth Pages (Signup, Login, PKCE Callback) Summary

Owner signup (/cadastro) and login (/entrar) pages with React Hook Form + Zod validation, Supabase auth calls, pt-BR UI-SPEC copy, and the PKCE email callback route handler (/auth/confirm).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Implement /cadastro and /entrar pages | 7247918 | src/app/(auth)/cadastro/page.tsx, src/app/(auth)/entrar/page.tsx |
| 2 | Implement /auth/confirm PKCE route handler | 799fb1b | src/app/auth/confirm/route.ts |

## What Was Built

### /cadastro (Owner Signup)

- `'use client'` component with React Hook Form + Zod validation
- Schema: `email: z.string().email()`, `password: z.string().min(8)`
- Calls `supabase.auth.signUp()` with `emailRedirectTo` pointing to `/auth/confirm?type=email&next=/dashboard`
- Redirects to `/entrar?verificacao=pendente` on success
- Supabase errors mapped to pt-BR user-facing messages (no raw error text exposed)
- Password show/hide toggle (Eye/EyeOff icons, `aria-label` for accessibility)
- Submit button: `min-h-[44px] h-11`, disabled + Loader2 spinner while submitting
- Brand mark: Scissors icon + "BarberFlow" above card
- Dark theme: `bg-background`, `bg-card`, amber `--primary` CTA

### /entrar (Owner Login)

- `'use client'` component with same form pattern
- Schema: `email: z.string().email()`, `password: z.string().min(1)`
- Calls `supabase.auth.signInWithPassword()`, redirects to `/dashboard` on success
- Shows verification pending banner when `?verificacao=pendente` in URL
- Shows password reset success banner when `?senha=alterada` in URL
- "Esqueci minha senha" link → `/recuperar-senha` in amber `text-primary`
- All errors mapped to pt-BR via error mapping table from UI-SPEC
- `useSearchParams()` wrapped in `<Suspense>` boundary (required by Next.js 15 for static generation)

### /auth/confirm (PKCE Callback Route Handler)

- `GET` route handler — no `'use client'` directive
- Reads `token_hash`, `type` (email | recovery | invite), `next` from searchParams
- Calls `await createClient()` (async server client) then `supabase.auth.verifyOtp({ type, token_hash })`
- Redirect logic:
  - `type === 'invite'` → `/aceitar-convite`
  - Other types → `next` param (e.g., `/dashboard`, `/nova-senha`)
  - Error or missing params → `/entrar?erro=link-invalido`
- Uses absolute URLs via `new URL(path, request.url)` for both localhost and production

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added Suspense boundary around useSearchParams() on /entrar**

- **Found during:** Build verification (`npm run build`)
- **Issue:** Next.js 15 requires `useSearchParams()` to be wrapped in a `<Suspense>` boundary when used in pages that can be statically generated. Without it, the build fails with "useSearchParams() should be wrapped in a suspense boundary at page /entrar".
- **Fix:** Extracted the form body into a `EntrarForm` sub-component and wrapped it with `<Suspense fallback={<div className="h-4" />}>` inside `EntrarPage`. This is the standard Next.js pattern for this case.
- **Files modified:** `src/app/(auth)/entrar/page.tsx`
- **Commit:** 7247918 (included in Task 1 commit)

## Threat Surface Scan

No new network endpoints or auth paths beyond what was planned:
- `/cadastro` calls Supabase Auth client-side (T-00-15 mitigated: Zod validates before any call)
- `/entrar` calls Supabase Auth client-side (T-00-13 mitigated: errors are generic pt-BR, no credential hints)
- `/auth/confirm` exchanges token_hash (T-00-14 mitigated: verifyOtp() codes are single-use, Supabase-enforced)
- T-00-16 mitigated: all Supabase raw errors mapped to generic pt-BR messages

## Known Stubs

None — both pages are fully wired. The /entrar page redirects to `/dashboard` which is the owner dashboard shell (implemented in a prior plan). No hardcoded empty data flows to UI rendering.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/(auth)/cadastro/page.tsx
- FOUND: src/app/(auth)/entrar/page.tsx
- FOUND: src/app/auth/confirm/route.ts
- FOUND: .planning/phases/00-infrastructure-multi-tenancy-baseline/00-05-SUMMARY.md

Commits exist:
- FOUND: 7247918 (feat(00-05): implement /cadastro and /entrar auth pages)
- FOUND: 799fb1b (feat(00-05): implement /auth/confirm PKCE callback route handler)

Build: PASSED (`npm run build` — 0 TypeScript errors, 13 static pages generated)
