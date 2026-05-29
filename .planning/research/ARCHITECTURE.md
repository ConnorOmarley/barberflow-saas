# Architecture Research — BarberFlow

**Researched:** 2026-05-29
**Overall confidence:** HIGH (Supabase RLS patterns, Next.js App Router, real-time channels) / MEDIUM (Asaas webhook specifics, WhatsApp Business API delivery receipt shape)

---

## High-Level Architecture

BarberFlow is a multi-tenant SaaS with three distinct user classes (Platform Admin, Barbershop Owner/Staff, Client) and two distinct portals, backed by a single Supabase project with RLS-enforced tenant isolation.

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                │
│                                                         │
│  /app/(platform)/...     →  Platform admin (internal)   │
│  /app/(dashboard)/...    →  Owner + barber portal       │
│  /app/(booking)/[slug]/. →  Client booking portal       │
│  /app/api/webhooks/...   →  Inbound webhooks            │
└────────────────┬────────────────────────────────────────┘
                 │
     ┌───────────┼────────────────┐
     │           │                │
     ▼           ▼                ▼
Supabase     Supabase         Supabase
  Auth         DB              Storage
 (JWT)     (Postgres          (logos,
           + RLS)           QR codes,
                            barber photos)
     │           │
     │     Supabase
     │     Realtime
     │   (channels per
     │    barbershop)
     │
     ▼
Supabase Edge Functions
  ├── /whatsapp-reminder   (cron-triggered)
  ├── /asaas-webhook       (HTTP POST from Asaas)
  ├── /qr-checkin          (validates + updates status)
  └── /generate-qr         (creates QR on booking confirm)

External Services
  ├── Asaas (SaaS billing: subscriptions, PIX, boleto)
  ├── WhatsApp Business API (Z-API / Evolution API / official)
  └── (future) Payment gateway for client-side bookings
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|---------------|----------|
| Next.js App Router | UI rendering, API routes, webhook ingestion, SSR for booking portal | Presentation + thin API layer |
| Supabase Auth | JWT issuance, user roles via `app_metadata`, invite flows | Identity only |
| Supabase Postgres + RLS | All persistent data, tenant isolation enforced at DB layer | Source of truth |
| Supabase Realtime | Push status changes to dashboard and booking portal | Event broadcast only — no business logic |
| Supabase Storage | Binary assets: logos, QR code PNGs, barber profile images | Immutable-ish files, public URLs per tenant |
| Edge Functions | Background jobs + inbound webhooks — the only place secrets leave Next.js | Async side effects |
| Asaas | Recurring billing for barbershop subscriptions, PIX/boleto issuance | External billing authority |
| WhatsApp API | Outbound notification delivery | Notification channel only |

---

## Multi-Tenancy Data Model

### Recommended Approach: Single Schema + RLS (Row-Level Security)

**Do not use schema-per-tenant for this project.** Schema-per-tenant requires dynamic connection strings or `search_path` manipulation, breaks Supabase's managed Auth, and makes cross-tenant reporting (needed for platform billing/analytics) painful. RLS on a single `public` schema is the standard Supabase multi-tenant pattern and scales comfortably to thousands of tenants.

### Tenant Identity

Every table that contains tenant data has a `barbershop_id UUID NOT NULL` foreign key. RLS policies gate all reads and writes through this column.

```sql
-- Core tenant table
CREATE TABLE barbershops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,          -- URL identifier: /booking/[slug]
  name        TEXT NOT NULL,
  owner_id    UUID REFERENCES auth.users(id) NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial', -- trial | starter | pro
  asaas_customer_id TEXT,                    -- Asaas external ID
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- All tenant-scoped tables share this shape:
CREATE TABLE barbers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id  UUID REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  user_id        UUID REFERENCES auth.users(id),  -- NULL until invite accepted
  ...
);
```

### Role Hierarchy (via Supabase Auth `app_metadata`)

```
app_metadata.role = 'platform_admin'   -- BarberFlow staff
app_metadata.role = 'owner'            -- Barbershop owner (set on signup)
app_metadata.role = 'barber'           -- Invited barber
app_metadata.role = 'client'           -- Self-registered client
app_metadata.barbershop_id = <uuid>    -- Set for owner/barber/client
```

Roles are written by a trusted Edge Function or Supabase DB trigger — never by client code.

### RLS Policy Pattern

```sql
-- Helper function (call once)
CREATE OR REPLACE FUNCTION get_my_barbershop_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::uuid;
$$;

-- Example: barbers table
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- Owner sees all their barbers
CREATE POLICY "owner_select" ON barbers
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

-- Barber sees only themselves
CREATE POLICY "barber_select_self" ON barbers
  FOR SELECT USING (user_id = auth.uid());

-- Client booking portal: read-only barber list for a specific barbershop
-- (Pass barbershop_id as a claim or use anon key with service-role lookup)
CREATE POLICY "public_read_active_barbers" ON barbers
  FOR SELECT USING (is_active = true AND barbershop_id = get_my_barbershop_id());
```

**Key insight:** The client booking portal uses the **anon key** but still benefits from RLS. Pass `barbershop_id` as a PostgREST query filter — the policy verifies it matches the JWT claim (for logged-in clients) or allows public reads on non-sensitive columns.

### Critical Tables

```
barbershops          (1 per tenant)
  └── barbers        (N per barbershop)
  └── services       (N per barbershop)
  └── barber_services (junction: which barber does what)
  └── working_hours  (per barber, per day-of-week)
  └── appointments
        ├── id, barbershop_id, client_id, barber_id, service_id
        ├── scheduled_at, duration_minutes
        ├── status: PENDING|CONFIRMED|CHECKED_IN|COMPLETED|CANCELLED
        ├── qr_token UUID UNIQUE  (generated on CONFIRMED)
        └── payment_status: PENDING|PAID|WAIVED
  └── loyalty_cards  (per client per barbershop)
  └── loyalty_stamps (1 row per earned stamp)
  └── notifications_config (WhatsApp reminder settings per barbershop)
  └── commissions    (rules: barber_id + service_id + rate)
```

### Multi-Tenancy Anti-Patterns to Avoid

- **Never** filter by tenant in application code alone — always enforce in RLS. App-layer filtering is defense in depth, not the security boundary.
- **Never** use the service-role key in browser/client code. Service role bypasses RLS entirely.
- **Never** store `barbershop_id` only in application state — it must be in the JWT `app_metadata` so RLS can read it without an extra DB round-trip.

---

## Data Flow

### Booking Flow

```
Client (browser)
  → GET /booking/[slug]             Next.js SSR: resolves barbershop by slug
  → Selects service + barber        Client queries available slots (DB function)
  → Submits booking form            POST /api/bookings
      ├── Insert appointment (status=PENDING)
      ├── Edge Fn: generate-qr      Creates QR token, stores PNG in Storage
      ├── Update appointment (status=CONFIRMED, qr_token=...)
      └── Realtime: broadcast to dashboard channel
```

### QR Check-In Flow

```
Client scans QR code
  → GET /check-in/[qr_token]        Next.js route (or static QR URL)
  → POST /api/check-in { token }
      ├── Edge Fn: qr-checkin
      │     ├── Validate token exists and status=CONFIRMED
      │     ├── UPDATE appointments SET status=CHECKED_IN
      │     └── Realtime broadcast: channel `barbershop:[id]` → event `checkin`
      └── Client sees confirmation screen

Dashboard (owner/barber browser)
  → Subscribed to channel `barbershop:[id]`
  → Receives `checkin` event → updates live list without page refresh
```

### Asaas Billing Flow

```
Barbershop owner completes onboarding
  → POST /api/subscriptions/create
      ├── Edge Fn calls Asaas API: create customer + subscription
      ├── Stores asaas_customer_id on barbershops row
      └── Sets plan = 'trial' until first payment confirmed

Asaas fires webhook → POST /api/webhooks/asaas
  ├── Verify Asaas signature header
  ├── Match event type:
  │     PAYMENT_CONFIRMED → set plan='active', log payment
  │     PAYMENT_OVERDUE   → set plan='suspended', block dashboard access
  │     SUBSCRIPTION_CANCELLED → set plan='cancelled'
  └── Return 200 immediately (async processing via DB trigger or queue)
```

### WhatsApp Reminder Flow

```
Supabase Cron (pg_cron) fires daily at 08:00 BRT
  → Calls Edge Fn: whatsapp-reminder
      ├── Query: appointments WHERE scheduled_at BETWEEN now()+reminder_hours AND ...
      │          AND status=CONFIRMED AND reminder_sent=false
      ├── For each: call WhatsApp API (Z-API / Evolution API)
      ├── On success: UPDATE appointments SET reminder_sent=true
      └── Log delivery attempt to notification_logs table

Re-engagement cron fires weekly
  → Query clients WHERE last_appointment < now() - barbershop.reengagement_days
  → Send "Faz X dias que você não veio..." message
```

---

## Real-Time Architecture

### Pattern: Supabase Realtime Broadcast Channels

Use **Broadcast** (not Postgres Changes) for the live dashboard. Postgres Changes triggers a DB listener on every row change, which is heavier and exposes raw DB event shapes to clients. Broadcast gives you a clean, typed event bus per barbershop.

```
Channel name: barbershop:{barbershop_id}

Events:
  appointment:created   { appointment_id, client_name, service_name, scheduled_at }
  appointment:checkin   { appointment_id, client_name, barber_id }
  appointment:completed { appointment_id, barber_id, duration_minutes }
  appointment:cancelled { appointment_id }
  queue:updated         { queue: [...current checked-in clients in order] }
```

### Channel Authorization

Supabase Realtime channels support JWT-based authorization. Only users whose JWT contains the matching `barbershop_id` can join `barbershop:{barbershop_id}`. Set this in Supabase dashboard: Realtime > Policies.

```typescript
// Dashboard subscriber (owner/barber)
const channel = supabase.channel(`barbershop:${barbershopId}`, {
  config: { broadcast: { self: false } }
})
channel.on('broadcast', { event: 'appointment:checkin' }, (payload) => {
  updateLiveQueue(payload)
})
channel.subscribe()

// Publisher (Edge Function or Next.js API route after status update)
await supabase.channel(`barbershop:${barbershopId}`)
  .send({ type: 'broadcast', event: 'appointment:checkin', payload: { ... } })
```

### QR Check-In Real-Time Path

The QR token is a UUID stored on the appointment row. The check-in URL is:
`https://barberflow.app/check-in/{qr_token}`

This URL can be encoded into a QR code as a PNG stored in Supabase Storage, or generated on-the-fly on the check-in page by reading the appointment's `qr_token`. **Generate on-the-fly using a client-side QR library** — this avoids storage costs and regeneration headaches when the appointment is cancelled.

Recommended QR library: `qrcode` (npm) — pure JS, works in Edge Functions and browser.

### Live Dashboard: Present vs Waiting

```
State machine for live list:
  CONFIRMED   → "Aguardando Check-In" (scheduled but not arrived)
  CHECKED_IN  → "Presente" (arrived, waiting for barber)
  IN_SERVICE  → "Em atendimento" (barber started — optional status)
  COMPLETED   → removed from live list

Dashboard query on load (SSR or initial fetch):
  SELECT * FROM appointments
  WHERE barbershop_id = $1
    AND DATE(scheduled_at) = CURRENT_DATE
    AND status IN ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE')
  ORDER BY scheduled_at ASC

Then real-time events patch this in-memory list — no full refetch needed.
```

---

## Background Jobs

### Cron Strategy: pg_cron + Edge Functions

Supabase provides `pg_cron` as a Postgres extension. The recommended pattern is:

1. `pg_cron` fires at the scheduled time and calls an HTTP request to a Supabase Edge Function via `pg_net` (also a built-in extension).
2. The Edge Function contains the business logic and has access to secrets (WhatsApp API key, etc.).

This is preferable to Vercel Cron because:
- Runs entirely within Supabase infrastructure (no Vercel dependency for background logic)
- Has access to DB directly without needing an authenticated HTTP call back to Next.js
- Easier to test in isolation

```sql
-- Example: daily WhatsApp reminder at 08:00 BRT (11:00 UTC)
SELECT cron.schedule(
  'whatsapp-daily-reminders',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/whatsapp-reminder',
    headers := '{"Authorization": "Bearer <service_role_key>"}',
    body := '{}'
  ) AS request_id;
  $$
);
```

**Confidence note:** `pg_net` is available as an extension in Supabase managed projects (HIGH confidence — this is well-documented). The service role key used here must be stored as a Supabase secret, not hardcoded.

### Webhook Handling Pattern

Inbound webhooks (Asaas, WhatsApp delivery receipts) must:

1. **Respond 200 immediately** — webhook providers retry on timeout/5xx. Never do slow work synchronously.
2. **Verify signature** — Asaas signs payloads with HMAC-SHA256; verify before processing.
3. **Write to an events table first** (idempotent insert), then process asynchronously.

```typescript
// /app/api/webhooks/asaas/route.ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('asaas-access-token') // Asaas uses access token header

  if (!verifyAsaasToken(sig)) return new Response('Unauthorized', { status: 401 })

  // Write raw event — idempotent by event ID
  const event = JSON.parse(body)
  await supabaseAdmin.from('webhook_events').upsert({
    id: event.id,
    source: 'asaas',
    payload: event,
    processed: false
  }, { onConflict: 'id' })

  return new Response('ok', { status: 200 }) // Respond immediately
}

// Separate Edge Function or DB trigger processes webhook_events rows
```

### WhatsApp API Provider Choice

The "official" Meta WhatsApp Business API requires a Facebook Business account and approval process. For Brazilian market at MVP scale, **Z-API** or **Evolution API** are the pragmatic choices:

- **Z-API** (paid, hosted SaaS) — simplest integration, REST API, no infrastructure to manage. Recommended for MVP.
- **Evolution API** (open source, self-hosted) — more control, no per-message cost, but requires hosting.
- **Official Meta Cloud API** — free per message tier, but approval overhead and webhook complexity. Consider for scale.

For BarberFlow: start with Z-API for MVP, plan migration path to official API.

**Confidence:** MEDIUM — based on Brazilian developer community patterns as of training data. Verify current Z-API pricing before committing.

### Asaas Integration Notes

Asaas is a Brazilian payment platform (HIGH confidence on existence and general API shape). Key integration points:

- **Customer creation:** `POST /v3/customers` with CPF/CNPJ
- **Subscription creation:** `POST /v3/subscriptions` with `billingType: PIX|BOLETO|CREDIT_CARD`
- **Webhook events to handle:** `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `SUBSCRIPTION_CANCELLED`
- **Authentication:** `access_token` header (not Bearer, not OAuth — their own scheme)

Store `asaas_subscription_id` and `asaas_customer_id` on the `barbershops` row. Never store payment card data — Asaas handles PCI compliance.

---

## File Storage Strategy

### Supabase Storage Buckets

```
barbershop-assets/         (public bucket)
  ├── {barbershop_id}/logo.{ext}
  ├── {barbershop_id}/barbers/{barber_id}.{ext}
  └── {barbershop_id}/branding/cover.{ext}

qr-codes/                  (NOT needed — generate client-side)
  (skip this bucket; QR codes render from qr_token in browser)
```

**Public bucket vs private:** Barbershop logos and barber photos are public (shown on booking portal without auth). Use the public bucket. Storage RLS still applies for writes — only the owner can upload to their `{barbershop_id}/` path.

```sql
-- Storage RLS: only the barbershop owner can write their assets
CREATE POLICY "owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'barbershop-assets'
    AND (storage.foldername(name))[1] = get_my_barbershop_id()::text
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
  );
```

### File Upload Pattern

Use Supabase client-side upload directly from the browser (signed upload URL pattern for large files, direct upload for small images). Do not route file bytes through Next.js API — it adds latency and hits Vercel's 4.5 MB body size limit on serverless functions.

```typescript
// Browser: direct upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('barbershop-assets')
  .upload(`${barbershopId}/logo.webp`, file, { upsert: true })
```

Convert images to WebP client-side before upload using the Canvas API or a library like `browser-image-compression`. This reduces storage costs and CDN bandwidth.

---

## Authentication Flow

### Complete Auth Journey

```
1. OWNER REGISTRATION
   ├── User signs up with email/password via Supabase Auth
   ├── DB trigger fires: creates barbershops row (slug derived from name, plan='trial')
   ├── DB trigger sets app_metadata: { role: 'owner', barbershop_id: <new_id> }
   └── Redirects to /onboarding/barbershop-setup

2. BARBERSHOP SETUP (onboarding wizard)
   ├── Step 1: Barbershop name, address, logo upload
   ├── Step 2: Services (at least one required)
   ├── Step 3: Working hours
   └── Completion unlocks full dashboard, redirects to /dashboard

3. INVITE BARBERS
   ├── Owner fills form: name + email
   ├── Edge Fn: create user with role='barber', barbershop_id=<owner's>
   │     OR: supabase.auth.admin.inviteUserByEmail with metadata
   ├── Invited barber gets email with magic link
   └── On first login: prompted to set password + complete profile

4. CLIENT SELF-REGISTRATION
   ├── Client visits /booking/[slug]
   ├── Can browse services without auth
   ├── Auth required to book: signup with email or phone (OTP)
   ├── On signup: DB trigger sets app_metadata: { role: 'client', barbershop_id: <slug_barbershop_id> }
   └── Booking completes, QR code shown/emailed

5. PLATFORM ADMIN
   ├── Internal users only — manually set role='platform_admin' in Supabase dashboard
   └── Access /app/(platform)/... routes — Next.js middleware checks this role
```

### Session Strategy in Next.js 15 App Router

Use `@supabase/ssr` package (not the deprecated `auth-helpers-nextjs`). Key pattern:

```
middleware.ts          → refresh session on every request, check route access
app/layout.tsx         → server component reads session for SSR
Client components      → use browser Supabase client for mutations
Server Actions         → use server Supabase client (from cookies)
```

The `app_metadata.role` and `app_metadata.barbershop_id` are read from the JWT in middleware — zero DB round-trips for auth checks on every request.

---

## Suggested Build Order

Dependencies flow downward. Build each layer before the one below it.

### Layer 0 — Infrastructure Baseline (build first, unlocks everything)

1. **Supabase project setup:** enable RLS on all tables, enable `pg_cron` and `pg_net` extensions
2. **Core DB schema:** `barbershops`, `barbers`, `services`, `appointments` with RLS policies
3. **Auth configuration:** email provider, invite settings, `app_metadata` DB trigger
4. **Next.js project scaffold:** App Router structure, `@supabase/ssr` middleware, route groups `(dashboard)` / `(booking)` / `(platform)`
5. **Storage buckets:** create `barbershop-assets` bucket, set RLS policies

**Why first:** Everything else depends on auth working and data being isolated correctly. Retrofitting RLS is a rewrite.

### Layer 1 — Owner Onboarding + Core Management (unlocks clients)

6. Owner signup + barbershop creation flow
7. Onboarding wizard (name, logo, services, hours)
8. Barber invite + barber profile management
9. Service management (CRUD)
10. Working hours configuration

**Why here:** Without a real barbershop configured, there's nothing to book. This is the landlord before the tenants.

### Layer 2 — Client Booking Portal (core product loop)

11. Public booking portal `/booking/[slug]` — SSR, white-label branding applied
12. Service + barber selection UI
13. Time slot availability algorithm (query working hours, existing appointments)
14. Booking confirmation + QR code display (client-side QR generation)
15. Client auth (signup/login within booking flow)

**Why here:** This is the core user-facing value. Validate the booking flow before building management features on top.

### Layer 3 — Real-Time Features (the differentiator)

16. Supabase Realtime channel setup per barbershop
17. QR Check-In endpoint + status update
18. Live dashboard component (present/waiting list, real-time updates)
19. Appointment status management (barber completes appointment)

**Why here:** Requires Layer 2 (appointments exist) and real-time only adds value once bookings are flowing.

### Layer 4 — Loyalty Program (retention loop)

20. Loyalty card data model + stamp issuance on COMPLETED
21. Client loyalty card UI (progress visualization)
22. Owner reward redemption flow

**Why here:** Depends on appointments completing (Layer 3). The loyalty loop only closes when check-in + completion is working.

### Layer 5 — Background Jobs + Notifications (growth multiplier)

23. WhatsApp API integration (Z-API) + Edge Function scaffold
24. Reminder cron job (pg_cron → Edge Function)
25. Re-engagement cron job
26. Notification settings UI (owner configures reminder timing)

**Why here:** High value but not blocking. Can operate without this — adds operational lift.

### Layer 6 — Billing + Tenant Lifecycle (monetization)

27. Asaas customer + subscription creation on onboarding completion
28. Asaas webhook handler + `webhook_events` table
29. Plan enforcement middleware (block dashboard if `plan='suspended'`)
30. Billing dashboard for owner (current plan, next payment)

**Why here:** De-risk by validating the product first. Billing bugs are costly to fix with real customer data.

### Layer 7 — Financial Reports + Admin (operational completeness)

31. Revenue dashboard (day/week/month)
32. Commission reports per barber
33. Appointment history with filters
34. CSV export
35. Platform admin panel (tenant list, health checks)

### Layer 8 — White Label + Custom Domains (expansion)

36. Custom domain routing (Next.js middleware: match host → barbershop slug)
37. Theme configuration (colors, fonts) stored per barbershop
38. Theme tokens applied in booking portal

**Why last:** Infrastructure-heavy (DNS, wildcard certs, middleware complexity). High value but blocks nothing in layers 0-7.

---

## Architecture Decision Log

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| Single schema + RLS, no schema-per-tenant | Supabase Auth doesn't support schema-per-tenant cleanly; cross-tenant queries needed for billing | HIGH |
| Roles in JWT `app_metadata`, not a separate `user_roles` table | Zero DB round-trips in middleware; can't be modified by client JWT | HIGH |
| Realtime Broadcast, not Postgres Changes | Cleaner event shape, less DB load, easier to authorize per barbershop | HIGH |
| pg_cron + pg_net for scheduled jobs, not Vercel Cron | Keeps background logic in Supabase layer; no Vercel function timeout risk | HIGH |
| Webhook events table (write-first, process-async) | Guarantees no lost events on provider retry; idempotent processing | HIGH |
| Client-side QR generation, no Storage for QR PNGs | Eliminates storage + regeneration lifecycle; QR token is the source of truth | HIGH |
| Z-API for WhatsApp MVP | Fastest integration path in Brazilian market; migrate to official API at scale | MEDIUM |
| `@supabase/ssr` not `auth-helpers-nextjs` | `auth-helpers` is deprecated as of Supabase docs 2024; `@supabase/ssr` is the current package | HIGH |

---

## Sources

- Supabase RLS documentation (supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- Supabase Realtime Broadcast docs (supabase.com/docs/guides/realtime/broadcast) — HIGH confidence
- Supabase Edge Functions + pg_cron patterns (supabase.com/docs/guides/functions/schedule-functions) — HIGH confidence
- Supabase SSR auth for Next.js App Router (supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence
- Asaas API reference (asaas.com/api) — MEDIUM confidence (API shape from training data; verify current webhook event names)
- WhatsApp Business API / Z-API integration patterns — MEDIUM confidence (Z-API specifics may have changed)
- Next.js 15 App Router + Middleware patterns (nextjs.org/docs/app/building-your-application/routing/middleware) — HIGH confidence
