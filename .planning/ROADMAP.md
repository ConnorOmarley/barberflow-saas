# Roadmap: BarberFlow

## Overview

BarberFlow is built in 9 phases that deliver progressively more value to barbershop owners and their clients. The foundation is non-negotiable: multi-tenancy RLS and Auth must be correct from day one — there is no retrofit path. From there, each phase delivers one coherent, verifiable capability: owners set up their shop, clients book online, customers check in via QR, loyalty stamps accumulate automatically, WhatsApp keeps everyone informed, billing gates access, financial reports close the loop, and white label branding completes the product. Every phase is independently testable before the next begins.

## Phases

- [ ] **Phase 0: Infrastructure & Multi-Tenancy Baseline** - Supabase schema with RLS on every table, JWT with role + tenant claims, Next.js route groups, CI guard
- [ ] **Phase 1: Owner Onboarding + Barber & Service Setup** - Guided onboarding, barber profiles, service catalogue, commission config, manual booking by staff
- [ ] **Phase 2: Client Booking Portal** - Public booking flow (service → barber → slot), real-time slot blocking, status lifecycle
- [ ] **Phase 3: QR Check-In** - Signed QR per appointment, scan-to-CHECKED_IN, revocation on cancel
- [ ] **Phase 4: Loyalty — Carimbo Digital** - Per-tenant loyalty rules, auto-stamp on COMPLETED, redemption by owner
- [ ] **Phase 5: WhatsApp Notifications** - Confirmation and reminder messages via WhatsApp Business API, LGPD opt-in
- [ ] **Phase 6: SaaS Billing (Asaas)** - Subscription creation on onboarding, access enforcement, idempotent webhook processing
- [ ] **Phase 7: Financial Reports & Dashboard** - Revenue dashboard, commission report, appointment history with filters
- [ ] **Phase 8: White Label Basics** - Per-tenant logo and colors, branding applied throughout client portal

## Phase Details

### Phase 0: Infrastructure & Multi-Tenancy Baseline
**Goal:** Every table has RLS enabled with tenant isolation enforced via JWT claims — the foundation that makes multi-tenancy impossible to bypass
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05 (schema + /aceitar-convite only — invite-sending UI in Phase 1), AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. Owner can create an account with email and password, receive a verification email, log in, and have their session persist across browser refreshes
  2. Owner can reset their password via an email link and regain access
  3. Barbeiro invited by email can accept the invite, create their own password, and log in seeing only their own agenda — not other barbers' data or financial settings
  4. Client can identify themselves by name and WhatsApp number when booking without needing to create an account
  5. Data from Barbearia A is never returned to a user authenticated to Barbearia B — confirmed by a CI query that asserts zero tables in `public` schema have `rowsecurity = false`
**Plans:** 8 plans
**UI hint:** yes

Plans:
- [x] 00-01-PLAN.md — Next.js 15 scaffold + Supabase migration (schema, RLS, JWT hook, trigger)
- [x] 00-02-PLAN.md — CI RLS assertion scripts (tests/ci_rls_check.sql, scripts/check-rls.sh)
- [x] 00-03-PLAN.md — [BLOCKING] Schema push to remote Supabase + TypeScript types codegen
- [x] 00-04-PLAN.md — Supabase utility files (client.ts, server.ts) + middleware.ts
- [ ] 00-05-PLAN.md — Auth pages: /cadastro (signup) + /entrar (login) + /auth/confirm (PKCE callback)
- [ ] 00-06-PLAN.md — Auth pages: /recuperar-senha + /nova-senha + /aceitar-convite
- [ ] 00-07-PLAN.md — Dashboard shells: owner /dashboard + barber /agenda
- [ ] 00-08-PLAN.md — End-to-end smoke test + CI RLS verification checkpoint

---
**Parallel track (start now, runs alongside Phase 0 and 1):** Submit all WhatsApp message templates to Meta for pre-approval. Approval takes 1–7 days and must complete before Phase 5 begins. Do not wait until Phase 5 to start this.

---

### Phase 1: Owner Onboarding + Barber & Service Setup
**Goal:** A new owner can complete guided onboarding and configure their entire shop — barbers, services, schedules, and commissions — in under 5 minutes, leaving the system ready to accept bookings
**Mode:** mvp
**Depends on:** Phase 0
**Requirements:** AUTH-04, AUTH-05 (invite-sending UI), BARB-01, BARB-02, BARB-03, BARB-04, BARB-05, SVC-01, SVC-02, SVC-03, BOOK-03, BOOK-05
**Success Criteria** (what must be TRUE):
  1. Owner completes barbershop onboarding in 4 steps or fewer after account creation and lands on a functional dashboard
  2. Owner can add a barber with name, photo, and specialties, set their working days and hours, and assign which services that barber offers
  3. Owner can define commission for each barber as a percentage or fixed amount per service
  4. Barber can log in, view their own schedule for the day and week, and mark an appointment as COMPLETED
  5. Owner or barber can create a manual appointment (walk-in or phone call) from the dashboard panel
  6. Owner can cancel any appointment from the panel with an optional reason
**Plans:** TBD
**UI hint:** yes

### Phase 2: Client Booking Portal
**Goal:** Any client can book an appointment at a specific barbershop — choosing service, barber, and available time slot — with no double-booking possible
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** BOOK-01, BOOK-02, BOOK-04
**Success Criteria** (what must be TRUE):
  1. Client can open the barbershop's booking portal, select a service and barber, see only available time slots (already-booked slots are hidden or greyed out), and confirm a booking
  2. If two clients attempt to book the same slot simultaneously, exactly one succeeds and the other receives a "slot unavailable" message — no double-booking occurs
  3. A newly created appointment starts in PENDING status; owner or barber can confirm it to CONFIRMED; the full status lifecycle (PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED) is functional
  4. Service duration is respected in slot calculation — a 75-minute service blocks 75 minutes, not just the starting slot
**Plans:** TBD
**UI hint:** yes

### Phase 3: QR Check-In
**Goal:** A confirmed client can scan a QR code at the barbershop and automatically register their presence, triggering the CHECKED_IN status without any staff action
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** QR-01, QR-02, QR-03, QR-04
**Success Criteria** (what must be TRUE):
  1. Every confirmed appointment has a unique QR code the client can access (displayed on screen or sent via link) — no Storage bucket PNG is required
  2. Client scans the QR with their phone camera and the appointment status changes to CHECKED_IN automatically, without staff needing to do anything
  3. Scanning the QR outside the ±30-minute window around the appointment time is rejected with a clear message — the QR does not change the appointment status
  4. When an appointment is cancelled or rescheduled, its QR code is revoked and a scan attempt returns an invalid/expired response
**Plans:** TBD
**UI hint:** yes

### Phase 4: Loyalty — Carimbo Digital
**Goal:** Clients automatically accumulate loyalty stamps as appointments are completed, and owners can redeem rewards when a client's card is full
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** LOY-01, LOY-02, LOY-03
**Success Criteria** (what must be TRUE):
  1. Owner can configure the loyalty rule for their barbershop (e.g., "10 haircuts = 1 free") from the dashboard
  2. When a barber marks an appointment COMPLETED, a loyalty stamp is automatically registered on the client's card — no manual action needed
  3. Owner can see a client's loyalty card progress in the dashboard and redeem a completed card (applying a discount or free service) with a single action
**Plans:** TBD
**UI hint:** yes

### Phase 5: WhatsApp Notifications
**Goal:** Clients automatically receive WhatsApp messages confirming their booking and reminding them before the appointment, with explicit LGPD opt-in captured and stored
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** WA-01, WA-02, WA-03
**Success Criteria** (what must be TRUE):
  1. When an appointment is confirmed, the client receives a WhatsApp message confirming the date, time, barber, and service — only if they opted in
  2. Client receives a WhatsApp reminder X hours before their appointment, where X is configured by the owner in the dashboard
  3. During booking, the client sees an explicit opt-in checkbox for WhatsApp messages (LGPD compliant); the `opt_in_timestamp` and `opt_in_source` are stored in the database; clients who did not opt in receive no WhatsApp messages
  4. Owner can enable or disable each notification type (confirmation, reminder) independently from the dashboard
**Plans:** TBD
**UI hint:** yes

---
**Pre-condition:** All WhatsApp message templates must be pre-approved by Meta before this phase begins. Submit templates during Phase 0/1 (2-week lead time required).

---

### Phase 6: SaaS Billing (Asaas)
**Goal:** Every barbershop on the platform has an active Asaas subscription created during onboarding, and access is automatically blocked if their subscription lapses
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** BILL-01, BILL-02, BILL-03, BILL-04
**Success Criteria** (what must be TRUE):
  1. When a barbershop completes onboarding, a monthly subscription is automatically created in Asaas — the owner does not need to do this manually
  2. When an Asaas webhook signals a payment failure or subscription lapse, access to the barbershop's dashboard is blocked and the owner sees a clear "payment required" screen
  3. Owner receives a notification (email or dashboard alert) before the subscription due date and again when a payment is declined
  4. Replaying the same Asaas webhook multiple times produces no duplicate effects — subscriptions are not created twice, access blocks are not toggled incorrectly (idempotent processing verified by `webhook_events` table)
**Plans:** TBD

### Phase 7: Financial Reports & Dashboard
**Goal:** Owners have a complete financial view of their barbershop — daily/weekly/monthly revenue, commission breakdowns per barber, and searchable appointment history
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** FIN-01, FIN-02, FIN-03
**Success Criteria** (what must be TRUE):
  1. Owner's dashboard shows total revenue for today, this week, and this month, updated as appointments are marked COMPLETED
  2. Owner can view a commission report filtered by barber and date range, showing each barber's earnings for the period
  3. Owner can search appointment history using filters for date range, barber, client name, and appointment status, and see results in a readable list
**Plans:** TBD
**UI hint:** yes

### Phase 8: White Label Basics
**Goal:** Every client-facing portal reflects the barbershop's own brand — logo and colors — rather than BarberFlow's identity
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** WL-01, WL-02
**Success Criteria** (what must be TRUE):
  1. Owner can upload a logo and select primary brand colors from the barbershop settings panel
  2. When any client visits that barbershop's booking portal, they see the barbershop's logo and colors throughout — no BarberFlow branding is visible on the client-facing pages
**Plans:** TBD
**UI hint:** yes

## Progress

**Execution order:** 0 → 1 → 2 → 3 → 4 → 5 (can run after 2) → 6 (can run after 1) → 7 (can run after 1) → 8 (can run after 2)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Infrastructure & Multi-Tenancy Baseline | 4/8 | In Progress | - |
| 1. Owner Onboarding + Barber & Service Setup | 0/TBD | Not started | - |
| 2. Client Booking Portal | 0/TBD | Not started | - |
| 3. QR Check-In | 0/TBD | Not started | - |
| 4. Loyalty — Carimbo Digital | 0/TBD | Not started | - |
| 5. WhatsApp Notifications | 0/TBD | Not started | - |
| 6. SaaS Billing (Asaas) | 0/TBD | Not started | - |
| 7. Financial Reports & Dashboard | 0/TBD | Not started | - |
| 8. White Label Basics | 0/TBD | Not started | - |
