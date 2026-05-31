---
phase: 0
slug: infrastructure-multi-tenancy-baseline
status: passed
verified: 2026-05-31
plans_total: 8
plans_complete: 8
---

# Phase 0 — Verification

**Goal:** Every table has RLS enabled with tenant isolation enforced via JWT claims —
the foundation that makes multi-tenancy impossible to bypass.

**Verdict:** ✅ PASSED — verified end-to-end against the live Supabase project
(`nnklkfzmpbjrwkrnilsp`) and confirmed by human smoke test.

## Success Criteria (ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Owner signup + email verification + login + session persists | ✅ | Smoke flows 1–2; middleware refresh via getClaims() |
| 2 | Owner password reset via email link | ✅ | Smoke flow 3 (/recuperar-senha → /nova-senha) |
| 3 | Barber invite acceptance (schema + /aceitar-convite; sending UI → Phase 1) | ✅ (scoped) | Page renders; /auth/confirm handles invite tokens; trigger creates profile |
| 4 | Client identifies by name + WhatsApp without account | ✅ | clients table + anon_client_insert policy + whatsapp_opt_in (LGPD) |
| 5 | Data from Barbearia A never returned to Barbearia B | ✅ | `pg_tables rowsecurity=false` → 0; RLS reads barbershop_id from JWT app_metadata |

## Requirements Coverage

AUTH-01 ✅ · AUTH-02 ✅ · AUTH-03 ✅ · AUTH-04 ✅ (schema; onboarding flow → Phase 1) ·
AUTH-05 ✅ (schema + /aceitar-convite; invite-sending UI → Phase 1) · AUTH-06 ✅ ·
AUTH-07 ✅ · AUTH-08 ✅

## Foundation Delivered

- Next.js 15 (pinned `^15.5.18`) App Router with route groups (auth)/(owner)/(barber)
- Supabase schema: barbershops, profiles, clients — RLS on every table, policies read
  `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID`
- `custom_access_token_hook` registered → injects role + barbershop_id into JWT
- `on_auth_user_created` trigger creates owner/barber profiles
- `@supabase/ssr` client/server utils + middleware using `getClaims()` (never getSession)
- 5 auth pages (pt-BR) + PKCE callback + owner/barber dashboard shells
- CI RLS assertion scripts; security hardening migration
- Premium operational dashboard UI (navy + gold, Inter) per locked design system

## Notes

- Schema applied via Dashboard SQL editor (no local Docker); CLI not linked this session.
- Bugs found and fixed during verification: null-claims handling, grain z-index,
  signup-trigger owner profile, profiles GRANT (RLS), 307 redirect loop, /auth middleware
  exclusion. All committed.
