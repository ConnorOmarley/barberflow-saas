# Pitfalls Research — BarberFlow

**Domain:** Multi-tenant barbershop scheduling SaaS (Brazilian market)
**Researched:** 2026-05-29
**Confidence note:** WebSearch, Bash, and WebFetch tools are unavailable in this environment. All findings are drawn from training knowledge (cutoff August 2025) covering Supabase, PostgreSQL, WhatsApp Business API, Asaas, LGPD, and scheduling SaaS patterns. Confidence levels are assigned honestly. High-confidence items reflect widely documented, reproducible issues; medium items reflect common community knowledge; low items flag areas that should be validated against current official documentation before implementation.

---

## Critical Pitfalls

### CP-1: RLS Disabled by Default Does Not Mean "No Leakage by Default"

**What goes wrong:** Supabase creates tables without RLS enabled. A developer enables RLS on the primary `appointments` table but forgets to enable it on related tables (`appointment_services`, `barber_schedules`, `loyalty_stamps`). Those tables are unrestricted to authenticated users — any tenant's authenticated user can read or write all rows across all tenants.

**Why it happens:** The mental model is "I protected the main table." Supabase silently treats tables without RLS as "allow nothing from anon, allow everything from authenticated role." In a multi-tenant system, every authenticated user shares the `authenticated` role, so a barber from Tenant A can query Tenant B's `barber_schedules` table with a direct REST/GraphQL call.

**Consequences:** Cross-tenant data leakage. Customer PII visible to competing barbershop owners. LGPD violation. Potentially a ANPD enforcement event.

**Prevention:** Enable RLS on every single table at creation time. Make it a migration standard — no `CREATE TABLE` statement is valid without a following `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Add a CI check: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false` must return empty.

**Warning signs:** Any table created without an explicit RLS policy in the same migration file. Supabase dashboard will show a yellow warning icon on tables with RLS disabled — review these before every deploy.

**Phase that must address it:** Multi-tenancy foundation phase (first schema migration). Cannot be retrofitted.

**Confidence:** HIGH — this is Supabase's own documented warning and a widely reproduced issue.

---

### CP-2: Service Role Key Exposed in Edge Functions or Client Code

**What goes wrong:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. A developer uses it in an Edge Function to "make things easier," then accidentally includes it in a client bundle, a public environment variable (prefixed `NEXT_PUBLIC_`), or a repository commit.

**Why it happens:** Service role is the path of least resistance when RLS policies are blocking legitimate operations. Developers under time pressure paste it everywhere.

**Consequences:** Complete data exposure for all tenants. All RLS investment is nullified. The service role key cannot be rotated per-tenant — rotating it breaks the entire platform.

**Prevention:** Service role key lives only in server-side code (Next.js API routes, server components, Edge Functions running server-side). Never in `NEXT_PUBLIC_*` env vars. Never in client components. Code review must grep for `SERVICE_ROLE` in any file under `/app` or `/components`. Use the anon key + RLS for all client-side Supabase calls. For admin operations (e.g., creating a tenant), use a dedicated Next.js Server Action that calls Supabase with service role on the server.

**Warning signs:** Any `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` variable. Any import of the service role key in a file that also has `'use client'`.

**Phase that must address it:** Auth/multi-tenancy setup. Pre-launch security audit.

**Confidence:** HIGH — Supabase documentation explicitly calls this out.

---

### CP-3: RLS Policy Using `auth.uid()` Without Tenant Scoping

**What goes wrong:** A policy like `USING (created_by = auth.uid())` correctly scopes rows to the creating user but does not scope to the tenant. A barber who is authenticated can access appointments they created — even if they switch tenants. More subtly: the owner of Barbershop A can see all appointments across the platform if the policy is `USING (owner_id = auth.uid())` and the owner's UID appears in another table.

**Why it happens:** Policies are written row-by-row without thinking about the full join graph. A policy on `appointments` may be correct, but a policy on `barbers` that allows reading any barber by UID means a cross-tenant join can reconstruct data.

**Consequences:** Data leakage through indirect queries. Difficult to detect in normal usage; trivial to exploit via direct API calls.

**Prevention:** Every RLS policy must include a tenant_id check: `USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))`. Store `tenant_id` in `auth.users.app_metadata` at signup and read it with `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` to avoid a subquery on every policy evaluation (the subquery version has serious N+1 performance implications at scale).

**Warning signs:** RLS policies that only check `auth.uid()` without a tenant_id column check. Any policy with a subquery against the users table.

**Phase that must address it:** Tenant schema design. Must be decided before any feature table is created.

**Confidence:** HIGH — documented PostgreSQL + Supabase multi-tenant pattern.

---

### CP-4: Double-Booking via Race Condition in Appointment Creation

**What goes wrong:** Two clients simultaneously select the same time slot for the same barber. Both read "slot available" (no appointment exists for that barber+time). Both submit. Both inserts succeed. Barber now has two appointments at the same time.

**Why it happens:** The availability check and the insert are two separate operations. Without a database-level lock, any concurrent requests between the SELECT and INSERT will both see the slot as free.

**Consequences:** Customer frustration (one gets a phantom booking). Barber overloaded. Refund required if pre-payment was taken. Trust damage in a word-of-mouth market.

**Prevention:** Use a PostgreSQL advisory lock or a `UNIQUE` constraint on `(barber_id, start_time)` combined with a check constraint for overlapping intervals. The cleanest pattern is a database function (Supabase RPC) that does the availability check and insert atomically within a serializable transaction. The function returns success or a conflict error; the application handles the conflict gracefully with a "slot just taken, pick another" message.

Example: `CREATE UNIQUE INDEX IF NOT EXISTS no_overlap ON appointments USING GIST (barber_id, tsrange(start_time, end_time, '[)'))` — PostgreSQL's range types with GIST index enforce no-overlap at the constraint level.

**Warning signs:** Availability check done in application code (Next.js) before calling Supabase insert. No unique or exclusion constraint on barber + time range.

**Phase that must address it:** Scheduling core phase. Must be in the initial appointment table design.

**Confidence:** HIGH — classic distributed systems problem, well-documented in scheduling SaaS post-mortems.

---

### CP-5: Webhook Duplicate Processing (Asaas and WhatsApp)

**What goes wrong:** Payment gateways (Asaas) retry webhook deliveries on timeout or 5xx response. The same `payment.confirmed` event arrives twice. Without idempotency handling, the system credits the payment twice, issues two appointment confirmations, or doubles loyalty stamps.

**Why it happens:** Webhook handlers are written as simple "receive event → do action" without checking if the event was already processed.

**Consequences:** Financial double-crediting. Duplicate WhatsApp messages sent to customers (they see two confirmations and lose trust). Loyalty stamp inflation.

**Prevention:** Every webhook handler must: (1) extract a unique event ID from the payload (Asaas provides `id` per event), (2) check an `processed_webhooks` table for this ID before processing, (3) insert the ID and process atomically in a transaction. This is the idempotency key pattern. Use `ON CONFLICT DO NOTHING` on the idempotency key insert to make it race-safe.

**Warning signs:** Webhook handler has no idempotency table. Webhook handler does not return 200 immediately before processing (should ack receipt first, process async). No dead-letter queue for failed webhook processing.

**Phase that must address it:** Billing/payment integration phase.

**Confidence:** HIGH — standard payment engineering requirement, documented by Asaas and all major gateways.

---

## Multi-Tenancy Risks (Supabase RLS)

### MT-1: JWT App Metadata Not Set at Tenant Signup

**What goes wrong:** During barbershop owner signup, the `tenant_id` is not written into `auth.users.app_metadata`. RLS policies that read `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` return NULL for new users. All their queries match nothing — they see an empty application — and developers interpret this as a UI bug rather than a data bug.

**Prevention:** Use a Supabase Auth hook (`auth.on_signup` trigger or a Database Function trigger on `auth.users`) to write `tenant_id` into `app_metadata` immediately after user row creation. Verify that the JWT refresh cycle propagates the new metadata (Supabase JWTs are valid for 1 hour by default; the user may need to re-login or call `refreshSession()` to get a JWT that includes the new metadata).

**Confidence:** HIGH — documented Supabase Auth behavior.

---

### MT-2: Permissive Policies on Lookup Tables

**What goes wrong:** Tables like `services`, `barber_types`, or `plan_features` are treated as "global" and given `USING (true)` policies. They actually contain per-tenant configurations. Tenant A sees Tenant B's service prices.

**Prevention:** Every table must have a `tenant_id` column OR be truly global (and contain no tenant-specific data). Lookup tables that are per-tenant must have RLS scoped to tenant_id. Truly global tables (e.g., a list of Brazilian states) can have `USING (true)`.

**Confidence:** HIGH.

---

### MT-3: Supabase Realtime and RLS

**What goes wrong:** Supabase Realtime subscriptions (`supabase.channel().on('postgres_changes')`) respect RLS only if `SET LOCAL role = authenticated` is active during the subscription. In some SDK versions and configurations, Realtime bypasses RLS and broadcasts all row changes to all connected clients. A barber's live presence dashboard could receive appointment change events from other tenants.

**Prevention:** Use Supabase Realtime with `private` channels (Broadcast with authorization) rather than raw postgres_changes for sensitive data. Alternatively, use a server-side Edge Function to filter events before pushing to clients. Verify the current Supabase JS SDK version's behavior against the official changelog before going live — this behavior has changed across SDK versions.

**Warning signs:** Using `postgres_changes` on `appointments` or `presence` tables without verifying that the subscription is scoped by tenant_id in the filter parameter.

**Confidence:** MEDIUM — Supabase has improved this over time; requires verification against the current SDK version (as of Aug 2025, RLS on Realtime is partially supported but requires explicit filter configuration).

---

### MT-4: Migrations That Forget to Backfill tenant_id

**What goes wrong:** A new feature adds a table without `tenant_id`. Six months later, when multi-tenant isolation is needed for that table, backfilling `tenant_id` on millions of rows requires downtime or a dangerous live migration.

**Prevention:** Every table gets `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` as a non-nullable column from day one. No exceptions. Enforce in code review.

**Confidence:** HIGH.

---

### MT-5: Storage Bucket Policies Not Tenant-Scoped

**What goes wrong:** Supabase Storage buckets for barbershop logos, barber photos, and QR code assets are set to `public` or have permissive policies. A direct URL request can retrieve any tenant's files without authentication.

**Prevention:** Storage objects must be in private buckets with RLS-equivalent policies. Use signed URLs (time-limited) for serving images rather than public URLs. Store objects under a path that includes `tenant_id` as the first path segment (`/{tenant_id}/{filename}`) and enforce this in the storage policy: `USING (bucket_id = 'barber-assets' AND (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'tenant_id')`.

**Confidence:** HIGH — documented Supabase Storage RLS pattern.

---

## Scheduling Logic Traps

### SL-1: Timezone Handling — Storing Local Time Instead of UTC

**What goes wrong:** The Next.js form sends appointment time as the browser's local timezone. Brazil spans four timezones (BRT, BRST, AMT, FNT). The backend stores this as-is. A barber in Manaus (AMT, UTC-4) and a client booking from São Paulo (BRT, UTC-3) end up with appointments offset by one hour.

**Prevention:** Store ALL timestamps in UTC in the database. Convert to the barbershop's configured timezone only for display. Store `timezone` per barbershop tenant (e.g., `America/Sao_Paulo`, `America/Manaus`). Use `date-fns-tz` or `luxon` in the frontend for timezone-aware display. In PostgreSQL, use `TIMESTAMPTZ` columns (not `TIMESTAMP`).

**Warning signs:** Database columns typed as `TIMESTAMP` (without timezone). Frontend sending ISO strings without timezone offset. No `timezone` field on the barbershop tenant record.

**Confidence:** HIGH — universal scheduling bug, affects every multi-region system.

---

### SL-2: Slot Duration Mismatch — Service Duration Ignored

**What goes wrong:** The booking UI shows 30-minute slots. A "beard trim + haircut" service takes 75 minutes. The system only blocks the starting slot. The next customer books the 30-minute slot that falls in the middle of the 75-minute service. Barber gets double-booked mid-service.

**Prevention:** Slot availability calculation must use `start_time + service_duration` as the end time. The exclusion constraint (`tsrange` GIST index) uses the actual end time. When a service has multiple components (combo service), sum all durations including any configured buffer time between appointments (e.g., 10 minutes for cleanup).

**Warning signs:** Availability query only checks `start_time` equality. No `end_time` or `duration` column on appointments.

**Confidence:** HIGH — common in naive scheduling implementations.

---

### SL-3: Barber Working Hours Not Enforced at Database Level

**What goes wrong:** Barber schedule is configured as "Monday 9:00-18:00." The availability endpoint enforces this. However, a manual booking created directly through the admin panel bypasses the availability check. Barber ends up with a Sunday appointment they didn't agree to.

**Prevention:** Working hours enforcement should be a database-level check constraint (not just application logic) OR enforced in a single shared function called by both the customer-facing booking and the admin manual booking. Do not duplicate the availability logic in multiple code paths.

**Confidence:** MEDIUM — common in systems with both customer and admin booking paths.

---

### SL-4: Cancellation Window Logic Runs in Client Timezone

**What goes wrong:** Policy says "cancel up to 2 hours before appointment." The comparison is done in the client's browser: `Date.now() < appointmentTime - 2h`. A client in a different timezone manipulates their system clock or the comparison drifts due to timezone offset. Client successfully cancels a no-show appointment retroactively.

**Prevention:** Cancellation window enforcement must be computed server-side using the server's UTC clock compared to the appointment's UTC timestamp. Client-side UI can show the deadline, but the server makes the final call.

**Confidence:** HIGH.

---

### SL-5: Loyalty Stamp Awarded Before Payment Confirmed

**What goes wrong:** The appointment flow is: Book → Pay → Arrive → QR Check-In → Complete → Stamp. If the stamp is awarded at `CHECKED_IN` rather than `COMPLETED`, a client who checks in but the barber cancels mid-service gets a stamp for a service they didn't receive. More critically, if the payment webhook is delayed (PIX payment not yet confirmed), the stamp is awarded for an unpaid service.

**Prevention:** Loyalty stamps are awarded only at the `COMPLETED → STAMP_AWARDED` transition, after both QR check-in AND payment confirmation are verified. Use a state machine for appointment status transitions. Define valid transitions: `PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED` (with explicit rules about when each transition is permitted).

**Confidence:** HIGH.

---

## WhatsApp / Compliance Risks

### WA-1: Message Template Not Pre-Approved Before Go-Live

**What goes wrong:** WhatsApp Business API (Meta) requires all outbound notification messages to use pre-approved templates. Template approval takes 24-72 hours (sometimes longer, with rejections requiring revision). A team that ships the WhatsApp reminder feature on launch day without pre-approved templates ships a feature that silently fails — the API returns errors, reminders are not sent, customers miss appointments.

**Prevention:** Submit all message templates (appointment reminder, cancellation notice, loyalty milestone, re-engagement message) for approval at least 2 weeks before the target launch date. Use a WhatsApp BSP (Business Solution Provider) like Twilio, Zenvia, or Take Blip — they often have pre-approved template libraries for appointment reminders that can be reused immediately. Treat template approval as a dependency blocker for the WhatsApp feature phase, not an afterthought.

**Warning signs:** Template submission happens in the same sprint as WhatsApp integration code. Using free-text messages in the early prototype (the API may allow this in sandbox mode but it does not work in production).

**Confidence:** HIGH — Meta's WhatsApp Business API documentation explicitly requires template pre-approval for non-session messages.

---

### WA-2: LGPD Opt-In Not Captured at the Right Moment

**What goes wrong:** WhatsApp reminders are sent to all clients who provided a phone number. Under Brazil's Lei Geral de Proteção de Dados (LGPD, Law 13.709/2018), sending marketing or automated messages requires explicit, informed consent. The consent must be recorded with: what the user agreed to, when, and via which interface. Sending reminders without documented consent exposes the platform to ANPD enforcement and civil liability.

**Why it happens:** Consent is added as a checkbox in the booking form as an afterthought, or assumed because the user "gave their phone number."

**Prevention:** Capture explicit opt-in during client registration (not buried in terms of service). Store: `whatsapp_opt_in: boolean`, `opt_in_timestamp: timestamptz`, `opt_in_source: text` (e.g., "booking_form_v2"). Provide a clear opt-out mechanism accessible from every message (reply STOP, or a link). Never send appointment reminders to users where `whatsapp_opt_in = false`. Treat opt-out requests as high priority — process within 24 hours per LGPD Article 18.

**Warning signs:** No `whatsapp_opt_in` column on the customers table. Opt-in checkbox pre-checked by default. No opt-out mechanism in message templates.

**Confidence:** HIGH — LGPD is in force, ANPD is actively enforcing, WhatsApp + LGPD is a documented risk area for Brazilian SaaS.

---

### WA-3: WhatsApp Rate Limits and Quality Rating Degradation

**What goes wrong:** A new WhatsApp Business Account starts with a messaging limit of 1,000 unique conversations per day (Tier 1). A barbershop with 500 active clients receives reminders for all their appointments in a single morning batch. The account hits the limit, remaining reminders fail silently. Worse: if clients report messages as spam (because they forgot they opted in, or the template feels irrelevant), the account quality rating drops from Green → Yellow → Red. At Red, the account is suspended.

**Prevention:** Implement rate-limiting and staggered sending for reminders (spread over a time window, not all at once). Monitor quality rating via the Meta Business API. Warm up new phone numbers gradually (start with 250 conversations/day, increase over weeks). Choose reminder templates carefully — they should be genuinely useful, not promotional. Separate transactional reminders (high value, low spam risk) from re-engagement messages (higher spam risk).

**Confidence:** MEDIUM — Meta's tier limits are documented but change periodically; verify against current Meta Business documentation before implementation.

---

### WA-4: Session vs. Template Message Confusion

**What goes wrong:** WhatsApp has two message types: template messages (for outbound, non-session) and session messages (free-text within a 24-hour window after the user last messaged). Developers assume they can send any message if the user "recently interacted." A client who booked 3 days ago is outside the 24-hour window — a free-text follow-up message is rejected. The code silently swallows the error.

**Prevention:** Always use pre-approved templates for automated outbound messages regardless of session state. Only use free-text in genuinely interactive chatbot flows. Log all WhatsApp API errors explicitly — do not swallow HTTP 4xx responses.

**Confidence:** HIGH — documented Meta WhatsApp Business API behavior.

---

## Payment Webhook Pitfalls

### PW-1: Webhook Endpoint Returns 500 on First Delivery, Processes on Retry

**What goes wrong:** The Asaas webhook hits the endpoint. The database is momentarily slow. The handler returns 500. Asaas retries 15 minutes later. The second delivery succeeds. Now the developer adds business logic that sends a WhatsApp confirmation on payment. Without idempotency, the customer receives two "payment confirmed" messages 15 minutes apart.

**Prevention:** Idempotency key pattern (see CP-5). Additionally: always return 200 immediately upon receipt and process asynchronously. Use a background queue (Supabase Edge Function with a job queue, or a simple `pending_webhooks` table with a cron Edge Function) to handle the actual processing. This decouples receipt from processing and makes retries harmless.

**Confidence:** HIGH.

---

### PW-2: Missing Webhook Signature Verification

**What goes wrong:** The webhook endpoint accepts any POST request. An attacker sends a crafted `payment.confirmed` event for an appointment they haven't paid for. The system marks the appointment as paid and confirms it.

**Prevention:** Asaas includes a signature header with each webhook (verify against the platform documentation for the exact header name and HMAC algorithm). Verify the signature on every incoming request before processing. Reject and log any request with an invalid or missing signature.

**Warning signs:** Webhook handler does not check any header from Asaas. No signature verification middleware.

**Confidence:** HIGH — standard webhook security practice.

---

### PW-3: Tenant Plan Downgrade Not Propagated Correctly

**What goes wrong:** Barbershop owner cancels their SaaS subscription. Asaas sends a `subscription.cancelled` event. The system receives it but only updates a `status` column on the subscription record. The tenant's features are not gated — they continue using premium features for free indefinitely because the feature-gating logic checks `plan_type` (which was never updated) rather than `subscription_status`.

**Prevention:** Subscription status changes must propagate to a `tenant_features` or `tenant_plan` table that the feature-gating middleware reads on every request. Use a denormalized `is_active` flag on the tenant record (updated by the webhook handler) for performance. Test plan downgrade and cancellation flows explicitly before launch.

**Confidence:** HIGH — common SaaS billing logic gap.

---

### PW-4: PIX Payment Expiration Not Handled

**What goes wrong:** A client initiates PIX payment and gets a QR code. PIX codes typically expire after 30 minutes (configurable, but Asaas has defaults). The client pays 45 minutes later, after the code expired. Asaas does not receive the payment. The appointment stays in `PENDING` and is eventually auto-cancelled. The client's money was not charged (PIX rejected the expired code), but they think they paid. They arrive at the barbershop expecting a confirmed appointment.

**Prevention:** Set explicit expiration on PIX QR codes. Display a countdown timer in the booking UI. Send a "your payment code has expired, please rebook" message if the user does not complete payment within the window. Implement appointment auto-cancellation for expired unpaid appointments as a scheduled Edge Function (cron). Make the expiration and auto-cancel behavior clear to users before they initiate PIX.

**Confidence:** HIGH — PIX QR code expiration is a documented characteristic of the PIX protocol.

---

## QR Check-In Pitfalls

### QR-1: Static QR Code That Can Be Screenshotted and Reused

**What goes wrong:** The QR code for an appointment is generated once and stored in the database. A client screenshots it. Six months later, they use the old screenshot to attempt a check-in for a different visit (or shares it with a friend). The system marks them as CHECKED_IN for an appointment that has already been completed or cancelled.

**Prevention:** QR codes must be time-limited and single-use. Generate a signed token with: `appointment_id`, `issued_at`, `expires_at` (e.g., valid only from 30 minutes before the appointment to 30 minutes after). On scan, verify: (1) token signature is valid, (2) current time is within the valid window, (3) this token has not already been used (mark as consumed in a `used_qr_tokens` table). Use a cryptographically signed JWT or HMAC for the token to prevent forgery.

**Warning signs:** QR code is a plain URL with only the appointment ID. No expiration logic. No "token already used" check.

**Confidence:** HIGH — standard QR security pattern.

---

### QR-2: Offline Check-In Failure with No Graceful Fallback

**What goes wrong:** The barbershop has spotty internet (very common in Brazilian interior cities). Client arrives, barber tries to scan QR, the Supabase call fails. There is no offline fallback. Client waits. The system shows an error. Barber defaults to manual confirmation — but the loyalty stamp is never awarded because the QR check-in event was never recorded. Client loses their stamp.

**Prevention:** The barber-facing scan page must: (1) show a clear error state with a "manual confirm" button, (2) manual confirmation queues a check-in event in local storage, (3) on reconnect, sync queued events. The loyalty stamp must be awarded by the COMPLETED status transition (server-side), not only by the QR scan event. This makes the QR scan a fast-path optimization, not the only path.

**Confidence:** MEDIUM — offline handling patterns are well-known; implementation specifics depend on chosen approach (PWA service worker, optimistic updates).

---

### QR-3: QR Code for Cancelled or Rescheduled Appointments Remains Valid

**What goes wrong:** Client reschedules appointment. A new QR code is generated. The old QR code is not invalidated. Client scans the old code by mistake (or maliciously). System checks appointment_id and sees the original appointment record (now cancelled) and processes the check-in anyway.

**Prevention:** On any appointment status change to `CANCELLED` or `RESCHEDULED`, immediately revoke all QR tokens associated with that appointment (mark them as revoked in the `used_qr_tokens` table or set a `revoked_at` timestamp). The QR verification step must check revocation status before processing.

**Confidence:** HIGH.

---

## Onboarding Pitfalls

### ON-1: Too Many Setup Steps Before the "Aha Moment"

**What goes wrong:** The onboarding flow requires: create account → verify email → fill barbershop profile → add barbers → configure services → set working hours → configure payment → set up WhatsApp → then see the booking portal. A busy barbershop owner with 10 minutes to evaluate the product abandons on step 4. Activation rate collapses.

**Why it happens:** Product teams design onboarding to collect all the data needed for full functionality, rather than the minimum needed to demonstrate value.

**Prevention:** Design onboarding with a single "minimum viable barbershop" path: (1) create account + barbershop name (2 fields), (2) add one barber + one service (can be edited later), (3) see a working booking link immediately. Everything else (payment config, WhatsApp, loyalty, commissions) is deferred to contextual prompts after the owner has seen the product work. Use a progress checklist pattern (like Stripe's "Set up your account" sidebar), not a blocking wizard.

**Warning signs:** Onboarding has more than 4 mandatory steps before the user sees their booking portal.

**Confidence:** HIGH — well-documented SaaS activation pattern; barbershop owner demographics (often non-technical, time-poor) make this especially acute.

---

### ON-2: Asaas Subscription Not Activated During Trial — Silent Free Tier

**What goes wrong:** The platform has a 14-day free trial. The Asaas subscription is only created when the owner explicitly clicks "upgrade." Most owners complete the trial, love the product, but never see a prompt to activate billing. They continue on a de-facto free tier because no webhook ever fires to downgrade them. Revenue is lost; the operator doesn't know which "active" tenants are actually paying.

**Prevention:** Create the Asaas subscription record in trial status at signup. Define trial expiry logic explicitly in a scheduled job. Send "your trial expires in X days" reminders at day 10, day 13, day 14. On trial expiry, gate features explicitly rather than allowing indefinite access.

**Confidence:** MEDIUM — specific to the trial + billing integration design.

---

## Mobile Performance Pitfalls

### MP-1: Large JavaScript Bundle Kills First Load on 4G

**What goes wrong:** The Next.js app ships a 1.5MB+ JS bundle. On a Brazilian mid-range Android device on 4G (~5 Mbps), Time to Interactive exceeds 8 seconds. The customer booking portal — the highest-traffic page — feels slow enough that clients abandon before booking. This directly impacts barbershop owner revenue and their perception of the product.

**Prevention:** Use Next.js App Router's default server components to avoid shipping component code to the client. Use `next/dynamic` with `ssr: false` only where needed. Analyze bundle with `@next/bundle-analyzer`. Target a First Contentful Paint under 2 seconds on simulated 3G in Lighthouse. The booking flow pages (service selection, time picker) must be especially lean.

**Warning signs:** No bundle analysis in CI. Heavy client-side libraries (e.g., full date-picker libraries, large icon sets) imported globally. No code splitting.

**Confidence:** HIGH — well-documented Next.js performance pattern; Brazilian mobile market characteristics (mid-range devices, variable connectivity) are well-documented.

---

### MP-2: Unoptimized Images for Barber Photos and Logos

**What goes wrong:** Barbershop owners upload a 4MB iPhone photo of their barber. It is stored in Supabase Storage and served at full resolution. Every client loading the booking portal downloads 4MB of images. Mobile data costs in Brazil make this a real user complaint.

**Prevention:** Use Next.js `<Image>` component with `width`, `height`, and `quality` props for all user-uploaded content. Configure `next.config.js` `images.remotePatterns` to include the Supabase Storage domain. On upload, either process images server-side (resize to max 800px wide, convert to WebP) using a Supabase Edge Function with Sharp, or use Supabase's image transformation API (`?width=400&quality=80` URL parameters, available on paid plans).

**Confidence:** HIGH.

---

### MP-3: No Skeleton / Loading States — Perceived Slowness

**What goes wrong:** The availability calendar fetches data from Supabase on mount. On slow connections, the user stares at a blank or spinner screen for 2-3 seconds. Even if the actual data load is fast, the perceived experience feels broken. Users tap repeatedly, generating multiple requests, sometimes booking the same slot multiple times.

**Prevention:** Implement skeleton loading states for all data-dependent UI (calendar, barber list, service list). Use React Suspense boundaries with fallback skeletons. Disable booking submit button immediately on first click (prevent double-submit). Use optimistic UI updates where safe.

**Confidence:** HIGH.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Schema / Multi-tenancy setup | RLS not enabled on all tables | CI check for tables without RLS enabled |
| Schema / Multi-tenancy setup | tenant_id missing on future tables | Mandatory column in all migrations |
| Auth flow | JWT app_metadata not set at signup | Auth trigger + session refresh after signup |
| Appointment booking | Double-booking race condition | PostgreSQL exclusion constraint via GIST index |
| Appointment booking | Service duration ignored in slot blocking | end_time = start_time + duration in all queries |
| QR Check-In | Static QR reuse / replay attack | Signed, time-limited, single-use tokens |
| QR Check-In | Offline scan failure loses loyalty stamp | Stamp on COMPLETED status, not QR scan event |
| WhatsApp reminders | Template not approved before launch | Submit templates 2+ weeks before feature ship date |
| WhatsApp reminders | LGPD opt-in not captured | Explicit opt-in field with timestamp at registration |
| Asaas billing | Duplicate webhook processing | Idempotency key table for all webhook events |
| Asaas billing | PIX expiry not communicated | Countdown timer in UI + auto-cancel cron job |
| Asaas billing | Plan downgrade not gated | Feature gating reads from live subscription status |
| Onboarding | Too many mandatory setup steps | Maximum 4 steps to working booking portal |
| Mobile performance | Large JS bundle | Bundle analysis in CI, target <2s FCP on 3G |

---

## Sources

All findings are drawn from documented knowledge (training cutoff August 2025). External verification was not possible in this session (network tools unavailable). The following sources should be consulted before implementation:

- Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
- Supabase multi-tenant patterns: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime + RLS: https://supabase.com/docs/guides/realtime/authorization
- Meta WhatsApp Business API template guidelines: https://developers.facebook.com/docs/whatsapp/message-templates/
- LGPD full text (Law 13.709/2018): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Asaas webhook documentation: https://docs.asaas.com/docs/webhooks
- PIX specification and QR code standards: https://www.bcb.gov.br/estabilidadefinanceira/pix
- PostgreSQL range exclusion constraints: https://www.postgresql.org/docs/current/rangetypes.html
- Next.js performance (Image, bundle analysis): https://nextjs.org/docs/app/building-your-application/optimizing

**Confidence assessment by area:**

| Area | Level | Reason |
|---|---|---|
| Supabase RLS pitfalls | HIGH | Core PostgreSQL + Supabase documented behavior |
| Scheduling race conditions | HIGH | Classic CS problem, well-documented patterns |
| WhatsApp template approval | HIGH | Meta's documented API requirement |
| LGPD compliance | HIGH | Law in force, ANPD publicly enforcing |
| Asaas webhook idempotency | HIGH | Standard payment engineering requirement |
| QR security patterns | HIGH | Standard token security patterns |
| Supabase Realtime + RLS | MEDIUM | Behavior has evolved; needs current doc verification |
| WhatsApp rate limits / tiers | MEDIUM | Meta changes these periodically |
| Mobile performance specifics | HIGH | Next.js + Brazilian market characteristics well-documented |
