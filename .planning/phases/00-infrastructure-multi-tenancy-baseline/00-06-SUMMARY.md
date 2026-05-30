---
phase: "00-infrastructure-multi-tenancy-baseline"
plan: 6
subsystem: auth-ui
tags: [auth, password-reset, invite-acceptance, design-system, navalha-dourada]
dependency_graph:
  requires: ["00-04", "00-05"]
  provides: ["recuperar-senha", "nova-senha", "aceitar-convite", "navalha-dourada-design"]
  affects: ["cadastro", "entrar"]
tech_stack:
  added: []
  patterns:
    - "Zod .refine() for password confirmation cross-field validation"
    - "useEffect + getUser() for expired token detection (T-00-17 mitigation)"
    - "Two-state UI pattern: form state → success state (in-place replacement)"
    - "Navalha Dourada design: auth-card CSS class + font-display + amber hairline divider"
key_files:
  created:
    - src/app/(auth)/nova-senha/page.tsx
    - src/app/(auth)/aceitar-convite/page.tsx
  modified:
    - src/app/(auth)/recuperar-senha/page.tsx
    - src/app/(auth)/cadastro/page.tsx
    - src/app/(auth)/entrar/page.tsx
    - src/app/layout.tsx
    - src/app/globals.css
    - src/components/ui/input.tsx
decisions:
  - "getUser() used for expired token detection (not getClaims() — no such API exists in @supabase/ssr)"
  - "nova-senha expired token error shows inline link to /recuperar-senha for better UX"
  - "cadastro and entrar elevated with Navalha Dourada design as part of this plan (not a new plan)"
metrics:
  duration_minutes: 25
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 8
---

# Phase 0 Plan 6: Auth Pages — Password Reset + Invite Acceptance Summary

**One-liner:** Complete auth flow pages (recuperar-senha, nova-senha, aceitar-convite) with expired-token detection, Zod password confirmation, and Navalha Dourada design system applied to all 5 auth pages.

---

## Tasks Completed

### Task 1: /recuperar-senha password reset request page

Implemented full two-state page:
- **State 1 (form):** Email input + `resetPasswordForEmail()` call with `redirectTo: /auth/confirm?type=recovery&next=/nova-senha`
- **State 2 (success):** Form replaced in-place with success message showing submitted email, per UI-SPEC
- Brand mark (Scissors + "BarberFlow" in Cormorant Garamond) + auth-card + amber hairline divider
- "Lembrei minha senha. Voltar para login" secondary link → /entrar

### Task 2: /nova-senha and /aceitar-convite pages

**nova-senha:**
- `updateUser({ password })` on submit → redirect to `/entrar?senha=alterada`
- `useEffect` + `getUser()` detects expired/invalid recovery token → shows inline error and hides form (T-00-17 mitigation)
- Zod `.refine()` for `password === confirmPassword` with "As senhas não coincidem"
- Password show/hide toggle on both fields (Eye/EyeOff + pt-BR aria-labels)

**aceitar-convite:**
- Same `updateUser()` pattern → redirect to `/agenda`
- Same expired token detection via `getUser()`
- Card heading "Você foi convidado!" + subheading "Crie sua senha para acessar o painel da barbearia" (Phase 0 fallback — barbershop name not available)
- Same password show/hide pattern

### Design system elevation (cadastro + entrar)

Both pages updated with Navalha Dourada design:
- `auth-card` CSS class (amber border + box-shadow + fadeSlideUp animation)
- Brand mark with `font-display` (Cormorant Garamond)
- Amber hairline divider `w-8 h-px bg-amber-600`
- Amber button (`bg-amber-600 hover:bg-amber-500 text-black`)
- Amber links (`text-amber-500 hover:text-amber-400`)
- entrar: styled success banners for `?verificacao=pendente` and `?senha=alterada`

---

## Commits

| Hash | Description |
|------|-------------|
| 3de0def | feat(00-06): implement Navalha Dourada design system |
| b92b46e | feat(00-06): implement /recuperar-senha password reset request page |
| 3f13548 | feat(00-06): implement /nova-senha and /aceitar-convite pages |
| 569cd0e | feat(00-06): elevate /cadastro and /entrar with Navalha Dourada design |

---

## Deviations from Plan

### Auto-additions (Rule 2)

**1. [Rule 2 - Security] getClaims() does not exist — used getUser() instead**
- **Found during:** Task 2
- **Issue:** The plan specified `supabase.auth.getClaims()` for session detection, but this method does not exist in the `@supabase/ssr` v0.10.3 client API
- **Fix:** Used `supabase.auth.getUser()` instead — returns `{ data: { user }, error }` which achieves the same expired-token detection. If `error` is set or `data.user` is null, the token is expired/invalid.
- **Files modified:** `src/app/(auth)/nova-senha/page.tsx`, `src/app/(auth)/aceitar-convite/page.tsx`
- **Commit:** 3f13548

**2. [Rule 2 - UX] Design system applied to cadastro + entrar**
- **Found during:** Design system elevation step
- **Issue:** Instructions required elevating cadastro and entrar with Navalha Dourada design; these were not in the original plan tasks but were specified in the executor instructions
- **Fix:** Applied auth-card class, font-display brand mark, amber hairline divider, and amber styling to both pages while preserving all existing logic
- **Files modified:** `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/entrar/page.tsx`
- **Commit:** 569cd0e

---

## Verification Results

All plan verification checks passed:

```
PASS: recuperar-senha page correct
PASS: nova-senha and aceitar-convite pages correct
```

TypeScript: `npx tsc --noEmit` — zero errors

Build: `npm run build` — succeeded, all 13 pages compiled. Font network warnings (fonts.gstatic.com unreachable in this environment) are non-fatal and pre-existing — they do not block the build.

Route table confirmed:
- /aceitar-convite — static
- /cadastro — static
- /entrar — static
- /nova-senha — static
- /recuperar-senha — static

---

## Known Stubs

None — all pages are fully implemented with real Supabase auth calls. No placeholder data flows to UI.

---

## Threat Surface Scan

No new network endpoints introduced. All pages are client-side auth forms. Threat mitigations T-00-17 through T-00-19 are implemented:

| Threat | Mitigation Status |
|--------|-------------------|
| T-00-17: updateUser() without active session | Mitigated — getUser() check on page load |
| T-00-18: Invite token reuse | Mitigated — handled by Supabase verifyOtp() in /auth/confirm |
| T-00-19: Password confirmation bypass | Mitigated — Zod .refine() on both password fields |

---

## Self-Check: PASSED

Files created/exist:
- FOUND: src/app/(auth)/nova-senha/page.tsx
- FOUND: src/app/(auth)/aceitar-convite/page.tsx
- FOUND: src/app/(auth)/recuperar-senha/page.tsx
- FOUND: src/app/(auth)/cadastro/page.tsx
- FOUND: src/app/(auth)/entrar/page.tsx

Commits confirmed in git log (3de0def, b92b46e, 3f13548, 569cd0e).
