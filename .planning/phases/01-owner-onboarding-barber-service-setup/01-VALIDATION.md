---
phase: 01
slug: owner-onboarding-barber-service-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (Phase 0 did not add testing infrastructure) |
| **Config file** | None |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

**Note:** No test runner (Jest, Vitest, Playwright) is installed. Phase 1 validation relies on:
1. TypeScript compilation (`npm run build`) — catches type errors
2. ESLint (`npm run lint`) — catches code quality issues
3. Manual testing of each success criterion via Supabase local studio (port 54323) and inbucket email viewer (port 54324)

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full build green + all 6 success criteria manually verified

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 01-01-T1 | 01 | 1 | AUTH-04, BARB-01–03, SVC-01–03 | RLS on all 5 new tables; subquery for barber_services/working_hours | build | `npm run build` | ⬜ pending |
| 01-01-T2 | 01 | 1 | AUTH-04, AUTH-05 | admin client only in Server Actions; service role key never in client | build + sql | `npm run build && supabase db query "SELECT tablename FROM pg_tables WHERE schemaname='public'"` | ⬜ pending |
| 01-02-T1 | 02 | 2 | AUTH-04 | middleware redirects /onboarding → /dashboard when barbershop_id in JWT | build | `npm run build` | ⬜ pending |
| 01-02-T2 | 02 | 2 | AUTH-04 | barbershop_id sourced from JWT, never from request body | build | `npm run build` | ⬜ pending |
| 01-03-T1 | 03 | 3 | AUTH-04 | Step 1 creates barbershops row; duplicate prevention | build | `npm run build` | ⬜ pending |
| 01-03-T2 | 03 | 3 | AUTH-04, BARB-02 | JWT refreshSession called after Step 1; working_hours attached to first barber | build | `npm run build` | ⬜ pending |
| 01-04-T1 | 04 | 3 | AUTH-05 | inviteUserByEmail uses admin client only; barber_id passed in metadata | build | `npm run build` | ⬜ pending |
| 01-04-T2 | 04 | 3 | AUTH-05 | trigger sets barbers.profile_id from raw_user_meta_data | build + sql | `npm run build` | ⬜ pending |
| 01-05-T1 | 05 | 4 | BARB-01, BARB-02, BARB-03 | photo path uses UUID barberId, not user input | build | `npm run build` | ⬜ pending |
| 01-05-T2 | 05 | 4 | BARB-01, BARB-02, BARB-03 | working_hours DELETE+INSERT (not UPSERT) | build | `npm run build` | ⬜ pending |
| 01-06-T1 | 06 | 4 | SVC-01, SVC-02, SVC-03 | service barbershop_id from JWT | build | `npm run build` | ⬜ pending |
| 01-07-T1 | 07 | 5 | BARB-04, BARB-05 | barber sees only their own appointments (RLS) | build | `npm run build` | ⬜ pending |
| 01-07-T2 | 07 | 5 | BARB-04, BARB-05, BOOK-05 | date param re-fetches correct appointments | build | `npm run build` | ⬜ pending |
| 01-08-T1 | 08 | 5 | BOOK-03, BOOK-05 | ClientCombobox + CancelDialog | build | `npm run build` | ⬜ pending |
| 01-08-T2 | 08 | 5 | BOOK-03, BOOK-05 | app-layer conflict check before INSERT; appointments never deleted | build | `npm run build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test runner is installed — `npm run build` serves as the primary automated quality gate.
- `src/types/database.types.ts` must be regenerated after the Phase 1 migration runs (Plan 01-01, Task 2 via `supabase gen types typescript --local`).

*Existing build infrastructure (`next build` + `eslint`) covers the automated quality gate for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner completes 4-step wizard and lands on /dashboard | AUTH-04 | UI flow | 1. Create account; 2. Open /onboarding; 3. Complete all 4 steps; 4. Verify redirect to /dashboard |
| Wizard resumes from last completed step | AUTH-04 | Requires DB state check | Complete Step 1, close browser, reopen /onboarding — should land on Step 2 |
| Owner sends barber invite, barber receives email | AUTH-05 | External email delivery | Open inbucket at port 54324; verify invite email arrives |
| Barber accepts invite, profile_id set in barbers | AUTH-05 | DB trigger verification | After acceptance: `supabase db query "SELECT profile_id FROM barbers WHERE name='...'"` |
| Barber sees only their own appointments | BARB-04 | Multi-user test | Login as barber; verify /agenda shows only appointments for that barber's barbers.id |
| Barber marks appointment as COMPLETED | BARB-05 | Status lifecycle | Click Complete on appointment row; verify DB status = COMPLETED |
| Manual appointment conflict check | BOOK-03 | Race condition scenario | Create two overlapping appointments for same barber; second should fail with conflict error |
| Appointment cancelled with reason stored | BOOK-05 | DB field verification | Cancel appointment; verify cancelled_at, cancelled_by, cancel_reason populated in DB |

---

## Validation Sign-Off

- [ ] All tasks have automated verify (`npm run build`) or are manual-only with test instructions
- [ ] Sampling continuity: `npm run build` after every task commit
- [ ] Wave 0: no test runner needed — build is the gate
- [ ] No watch-mode flags in any verification command
- [ ] Feedback latency < 60s (`npm run build` ~30s)
- [ ] `nyquist_compliant: true` set in frontmatter after phase execution

**Approval:** pending
