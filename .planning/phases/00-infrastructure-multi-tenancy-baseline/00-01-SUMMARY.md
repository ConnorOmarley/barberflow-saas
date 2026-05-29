---
phase: "00-infrastructure-multi-tenancy-baseline"
plan: 1
subsystem: "core-scaffold"
tags: ["next.js", "supabase", "rls", "jwt", "multi-tenancy", "shadcn"]

dependency_graph:
  requires: []
  provides:
    - "Next.js 15 project scaffold with pinned versions"
    - "Supabase migration: barbershops + profiles + clients tables with RLS"
    - "custom_access_token_hook for JWT app_metadata injection"
    - "on_auth_user_created trigger for barber invite profile creation"
    - "Dark theme CSS variables (BarberFlow design system)"
    - "shadcn/ui base-nova v4 with button, input, label, form, card, separator, alert, badge"
    - "Route groups: (auth), (owner), (barber) with placeholder pages"
  affects:
    - "All subsequent plans — every plan builds on this scaffold"
    - "Phase 1 onboarding flow uses profiles + barbershops tables"
    - "All RLS policies in future migrations must follow ::UUID cast pattern"

tech_stack:
  added:
    - "next@15.5.18 (pinned — not ^16 which breaks middleware.ts)"
    - "@supabase/ssr@0.10.3 (official SSR package, replaces deprecated auth-helpers-nextjs)"
    - "@supabase/supabase-js@2.106.2"
    - "react-hook-form@^7.76.1 + @hookform/resolvers@^5.4.0 + zod@^4.4.3"
    - "lucide-react@^1.17.0"
    - "shadcn/ui v4 (base-nova style, CSS variables enabled)"
    - "@base-ui/react (shadcn v4 primitive layer)"
    - "class-variance-authority, clsx, tailwind-merge"
    - "supabase CLI@2.102.0 (devDependency for migrations)"
    - "tailwindcss@^4, tw-animate-css"
  patterns:
    - "RLS tenant isolation via JWT app_metadata (not user_metadata)"
    - "custom_access_token_hook Postgres function for JWT custom claims"
    - "on_auth_user_created trigger reads raw_user_meta_data for invite flow"
    - "Dark-only theme via className='dark' on html element"

key_files:
  created:
    - path: "package.json"
      purpose: "Pinned next@15.5.18, all Phase 0 dependencies"
    - path: "supabase/migrations/20260529000001_initial_schema.sql"
      purpose: "barbershops + profiles + clients + RLS + hook + trigger"
    - path: "supabase/config.toml"
      purpose: "Activates custom_access_token_hook for local dev"
    - path: "src/app/globals.css"
      purpose: "BarberFlow dark theme CSS variables per UI-SPEC"
    - path: "src/app/layout.tsx"
      purpose: "Root layout with className=dark on html element"
    - path: "src/components/ui/form.tsx"
      purpose: "React Hook Form integration component (manual — shadcn v4 CLI omitted it)"
    - path: ".env.local.example"
      purpose: "Template for Supabase env vars"
    - path: ".gitignore"
      purpose: "Excludes .env.local, .next, node_modules, next-env.d.ts"
    - path: "components.json"
      purpose: "shadcn config: base-nova style, cssVariables=true"
    - path: "src/app/(auth)/cadastro/page.tsx"
      purpose: "Owner signup placeholder"
    - path: "src/app/(auth)/entrar/page.tsx"
      purpose: "Owner login placeholder"
    - path: "src/app/(auth)/recuperar-senha/page.tsx"
      purpose: "Password reset request placeholder"
    - path: "src/app/(auth)/nova-senha/page.tsx"
      purpose: "New password placeholder"
    - path: "src/app/(auth)/aceitar-convite/page.tsx"
      purpose: "Barber invite acceptance placeholder"
    - path: "src/app/(owner)/dashboard/page.tsx"
      purpose: "Owner dashboard placeholder"
    - path: "src/app/(owner)/layout.tsx"
      purpose: "Owner route group layout"
    - path: "src/app/(barber)/agenda/page.tsx"
      purpose: "Barber agenda placeholder"
    - path: "src/app/(barber)/layout.tsx"
      purpose: "Barber route group layout"
    - path: "src/app/auth/confirm/route.ts"
      purpose: "PKCE auth callback route handler placeholder"
  modified: []

decisions:
  - "Used shadcn v4 (base-nova) instead of old New York style — shadcn v4 is the current version; base-nova replaces New York in the new registry. CSS variables enabled as required."
  - "Created form.tsx manually — shadcn v4 CLI no longer outputs form.tsx automatically (uses RHF directly); component written to match shadcn pattern without @radix-ui/react-slot dependency"
  - "CSS variables use hsl() format not oklch — UI-SPEC specifies HSL values (0 0% 4% etc); kept hsl() wrapper for compatibility with both Tailwind 4 and the verifier grep checks"
  - "aria-invalid uses string 'true' | undefined — newer ARIA validation requires string value not boolean expression"

metrics:
  duration: "~110 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 28
  files_modified: 2
---

# Phase 0 Plan 1: Next.js 15 Scaffold + Supabase Migration Summary

**One-liner:** Next.js 15.5.18 scaffold with pinned @supabase/ssr@0.10.3, shadcn/ui v4, and complete Supabase migration establishing barbershops/profiles/clients tables with RLS enforced via JWT app_metadata custom claims hook.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Scaffold Next.js 15 + install dependencies + route groups | 5411162 | package.json, src/app/globals.css, src/app/layout.tsx, src/components/ui/, route group pages |
| 2 | Supabase migration: schema + RLS + JWT hook | c0cf128 | supabase/migrations/20260529000001_initial_schema.sql, supabase/config.toml |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Created form.tsx manually**
- **Found during:** Task 1 — shadcn v4 CLI did not generate form.tsx
- **Issue:** `npx shadcn@latest add form` silently completed without creating the file. shadcn v4 restructured the registry and form.tsx is no longer a standalone CLI component.
- **Fix:** Created `src/components/ui/form.tsx` manually following the shadcn React Hook Form integration pattern, adapted for the new shadcn v4 environment (no @radix-ui/react-slot dependency, uses @base-ui/react pattern).
- **Files modified:** `src/components/ui/form.tsx`
- **Commit:** 5411162

**2. [Rule 1 - Bug] Fixed aria-invalid type error**
- **Found during:** Task 1 — IDE diagnostic on form.tsx
- **Issue:** `aria-invalid={!!error}` (boolean) fails ARIA validation — value must be string `"true"` or `undefined`
- **Fix:** Changed to `aria-invalid={error ? "true" : undefined}`
- **Files modified:** `src/components/ui/form.tsx`
- **Commit:** 5411162

### Style Variant Deviation

**shadcn style: base-nova instead of New York**
- **Context:** The plan specified "New York style" but shadcn v4 (current: 4.8.3) removed the `--style` flag and replaced the New York preset with `base-nova` as the new default.
- **Impact:** Visual differences are cosmetic only. CSS variables are enabled as required. The component APIs and structure are identical.
- **Assessment:** This is a version progression, not a regression. base-nova is the current production equivalent of New York.

## Success Criteria Verification

- [x] Next.js 15 project with next pinned to 15.5.18 builds successfully — PASS (`npm run build` clean)
- [x] Route groups (auth), (owner), (barber) exist with placeholder pages — PASS
- [x] supabase/migrations/20260529000001_initial_schema.sql contains all tables, RLS, hook, trigger — PASS
- [x] Dark theme CSS variables match UI-SPEC color contract — PASS (--background: hsl(0 0% 4%), --primary: hsl(38 92% 50%))
- [x] .env.local.example present; .env.local in .gitignore — PASS

## Known Stubs

The following placeholder files return `null` or `'ok'` — these are intentional stubs per plan spec:
- `src/app/(auth)/cadastro/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(auth)/entrar/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(auth)/recuperar-senha/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(auth)/nova-senha/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(auth)/aceitar-convite/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(owner)/dashboard/page.tsx` — placeholder (Phase 0 scope)
- `src/app/(barber)/agenda/page.tsx` — placeholder (Phase 0 scope)
- `src/app/auth/confirm/route.ts` — placeholder (Phase 0 scope)

These are resolved in later plans within Phase 0 (Plans 3-8).

## Threat Surface Scan

No new threat surface introduced beyond what is defined in the plan's threat model:
- T-00-01: ::UUID cast enforced in all 7 RLS policy expressions — MITIGATED
- T-00-02: user_metadata not referenced in any RLS policy (only in trigger function, reading raw_user_meta_data as designed) — MITIGATED
- T-00-03: .env.local in .gitignore, only .env.local.example committed, service role key is not in NEXT_PUBLIC_ vars — MITIGATED
- T-00-SC: All packages from npm legitimacy audit — MITIGATED

## Self-Check: PASSED

Files verified:
- package.json — FOUND (next@15.5.18, @supabase/ssr@0.10.3)
- supabase/migrations/20260529000001_initial_schema.sql — FOUND (3 tables, 3×RLS, hook, trigger)
- supabase/config.toml — FOUND ([auth.hook.custom_access_token] enabled)
- src/app/globals.css — FOUND (--background: hsl(0 0% 4%), --primary: hsl(38 92% 50%))
- src/app/layout.tsx — FOUND (className="dark" on html element)
- src/components/ui/form.tsx — FOUND

Commits verified:
- 5411162 chore(00-01): scaffold Next.js 15 — FOUND
- c0cf128 feat(00-01): Supabase migration — FOUND
