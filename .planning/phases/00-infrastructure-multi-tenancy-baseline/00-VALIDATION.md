---
phase: 0
slug: infrastructure-multi-tenancy-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (greenfield — no test infra yet; Wave 0 = Plan 02 creates SQL scripts) |
| **Config file** | none — Plan 02 creates `tests/ci_rls_check.sql`, `tests/rls_isolation.sql`, `tests/rls_clients.sql` |
| **Quick run command** | `psql "$DATABASE_URL" -f tests/ci_rls_check.sql` |
| **Full suite command** | `bash scripts/check-rls.sh` |
| **Estimated runtime** | ~5 seconds (SQL only — no JS framework) |

---

## Sampling Rate

- **After every task commit:** Run `psql "$DATABASE_URL" -f tests/ci_rls_check.sql` (verifies RLS on all tables)
- **After every plan wave:** Run `bash scripts/check-rls.sh` + manual browser smoke test
- **Before `/gsd:verify-work`:** All AUTH-* manually verified; full SQL suite green
- **Max feedback latency:** 5 seconds (SQL assertion)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-01-01 | 01 | 1 | AUTH-04, AUTH-07, AUTH-08 | T-0-05 | barbershop_id in JWT app_metadata, not user_metadata | unit (SQL) | `psql "$DATABASE_URL" -f tests/ci_rls_check.sql` | ❌ Wave 0 | ⬜ pending |
| 00-01-02 | 01 | 1 | AUTH-04, AUTH-05 | T-0-06 | Invite trigger creates profile row with barbershop_id | unit (SQL) | manual | N/A | ⬜ pending |
| 00-02-01 | 02 | 1 | AUTH-08, AUTH-06 | T-0-01, T-0-05 | Zero tables without RLS; cross-tenant isolation | unit (SQL) | `psql "$DATABASE_URL" -f tests/ci_rls_check.sql && psql "$DATABASE_URL" -f tests/rls_isolation.sql && psql "$DATABASE_URL" -f tests/rls_clients.sql` | ❌ Wave 0 | ⬜ pending |
| 00-03-01 | 03 | 2 | AUTH-08 | T-0-01 | Schema pushed; types generated from live DB | unit (SQL) | `psql "$DATABASE_URL" -f tests/ci_rls_check.sql` | ✅ (created by Plan 02) | ⬜ pending |
| 00-03-02 | 03 | 2 | AUTH-04, AUTH-06 | T-0-04 | custom_access_token_hook registered; JWT contains role + barbershop_id | manual | — | N/A | ⬜ pending |
| 00-04-01 | 04 | 3 | AUTH-02 | T-0-02 | getClaims() used; getSession() absent | unit (source) | `grep -r "getSession" src/ \| grep -v "__tests__"` returns empty | N/A | ⬜ pending |
| 00-04-02 | 04 | 3 | AUTH-02, AUTH-06 | T-0-02 | middleware.ts refreshes session; redirects by role | manual (browser) | — | N/A | ⬜ pending |
| 00-05-01 | 05 | 4 | AUTH-01, AUTH-02 | T-0-03 | Signup creates user + verification email sent; login returns session | manual (browser) | — | N/A | ⬜ pending |
| 00-05-02 | 05 | 4 | AUTH-01 | T-0-03 | PKCE callback verifies token; session persists across refresh | manual (browser) | — | N/A | ⬜ pending |
| 00-06-01 | 06 | 4 | AUTH-03 | — | Password reset email sent; /nova-senha updates password | manual (browser) | — | N/A | ⬜ pending |
| 00-06-02 | 06 | 4 | AUTH-05 | T-0-06 | /aceitar-convite page renders; barber can set password | manual (browser) | — | N/A | ⬜ pending |
| 00-07-01 | 07 | 5 | AUTH-02, AUTH-06 | T-0-02 | Owner sees /dashboard shell; barber sees /agenda shell; cross-role redirects work | manual (browser) | — | N/A | ⬜ pending |
| 00-07-02 | 07 | 5 | AUTH-06 | T-0-05 | Server layout validates role claim; unauthenticated → /entrar | manual (browser) | — | N/A | ⬜ pending |
| 00-08-01 | 08 | 6 | AUTH-08 | T-0-01 | tsc + build pass; CI RLS check passes | unit | `npx tsc --noEmit && npm run build && bash scripts/check-rls.sh` | ✅ | ⬜ pending |
| 00-08-02 | 08 | 6 | AUTH-01–AUTH-08 | all | Full auth smoke test | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = Plan 02 (CI RLS assertion scripts — runs in parallel with Plan 01, Wave 1)

- [ ] `tests/ci_rls_check.sql` — asserts zero tables in `public` schema have `rowsecurity = false` (covers AUTH-08)
- [ ] `tests/rls_isolation.sql` — verifies cross-tenant isolation using `SET LOCAL request.jwt.claims` with two different `barbershop_id` values (covers AUTH-06)
- [ ] `tests/rls_clients.sql` — verifies anon client insert allowed without auth.users row (covers AUTH-07)
- [ ] `scripts/check-rls.sh` — shell runner that calls all SQL scripts and exits non-zero on failure

*No JavaScript test framework needed for Phase 0 — all testable behaviors are SQL-level or manual browser flows.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner signup + verification email | AUTH-01 | Requires Supabase email in loop (SMTP or Inbucket) | Create account at /cadastro; check email for verification link; click link; confirm session active |
| Owner login session persistence | AUTH-02 | Requires browser refresh cycle | Login at /entrar; refresh page; confirm still logged in |
| Password reset flow | AUTH-03 | Requires email delivery | Request reset at /recuperar-senha; check email; click link; set new password at /nova-senha; login with new password |
| Barber invite acceptance | AUTH-05 | Requires Supabase admin invite + email | (Phase 1 sends invite; Phase 0 tests /aceitar-convite route renders) Trigger invite manually via Supabase Dashboard; check barber email; click link; confirm /aceitar-convite loads and allows password set |
| Middleware role-based redirect | AUTH-06 | Requires active session + browser | Login as owner; confirm redirect to /(owner)/dashboard; logout; login as barber; confirm redirect to /(barber)/agenda |
| custom_access_token_hook | AUTH-04, AUTH-06 | Requires Supabase Dashboard configuration | After hook registration, login; inspect JWT in browser devtools (Supabase session); confirm `app_metadata` contains `role` and `barbershop_id` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Plans 02 creates SQL scripts before Plan 03 pushes schema)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (SQL assertions)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
