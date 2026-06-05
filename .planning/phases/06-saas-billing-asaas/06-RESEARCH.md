# Phase 6: SaaS Billing (Asaas) — Research

**Researched:** 2026-06-05
**Domain:** Asaas REST API, Next.js 15 middleware guards, Supabase schema migrations, webhook idempotency
**Confidence:** HIGH (API URLs and auth verified via official docs; payload structure verified; patterns derived from existing codebase analogs)

---

## Summary

Phase 6 wires BarberFlow's SaaS billing to Asaas, a Brazilian payment platform that supports PIX, Boleto, and credit cards with recurring subscription support. The integration has four moving parts: (1) a server-side Asaas client (`src/lib/asaas.ts`) that wraps raw `fetch` calls using the `access_token` header; (2) a `createBarbershopSubscription` Server Action that creates an Asaas customer + subscription at the end of onboarding; (3) a webhook route (`/api/webhooks/asaas`) that writes events idempotently to `webhook_events` and updates `subscription_status`; and (4) a middleware guard (Rule F in `src/middleware.ts`) that redirects `overdue` owners to `/pagamento`.

The most important constraint discovered during research: **Asaas requires both `name` AND `cpfCnpj` for customer creation** — there is no email-only path. [VERIFIED: docs.asaas.com/reference/criar-novo-cliente] For MVP, the recommended approach is to add a `cpf_cnpj TEXT` column to `barbershops` and collect it in the onboarding wizard (Step 1 or a new step). Without it, customer creation must be deferred until the owner provides their document, and `subscription_status` stays `'trial'` in the meantime.

Phase 6 introduces no new npm packages. All API calls go through native `fetch`. Zod and react-hook-form (already installed) cover the CPF/CNPJ input field.

**Primary recommendation:** Collect `cpfCnpj` during onboarding Step 1 (add optional field to existing `barbershops` table), call `createBarbershopSubscription` at Step 4 completion (non-blocking: billing failure does not block onboarding redirect), and handle all subscription state changes via webhooks with `webhook_events` idempotency.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 6 |
|-----------|------------------|
| Every table: `barbershop_id UUID NOT NULL` + RLS | `webhook_events` is an exception — it is a global events log with no `barbershop_id`; uses service-role-only writes (no authenticated INSERT policy) |
| Server Actions: `adminClient + profiles.barbershop_id` | `billing.ts` must use `getAuthContext()` pattern (getClaims → profiles lookup) |
| Asaas webhooks must be idempotent — write to `webhook_events` first, return 200, process async | Drives entire webhook route design |
| PIX QR codes expire in ~30 min — implement auto-cancel cron | Not relevant to subscription billing (subscription PIX is handled by Asaas auto-renewal) |
| Do NOT use Prisma, Stripe, Firebase, Auth.js, NextAuth, Moment.js | No risk — phase uses raw fetch + Supabase |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Asaas customer + subscription creation | API / Backend (Server Action) | — | Requires secret API key; must not touch browser |
| Webhook event ingestion + idempotency | API / Backend (Next.js Route Handler) | — | Receives POST from Asaas servers over HTTPS |
| Subscription status persistence | Database / Storage (Postgres) | — | `subscription_status` on `barbershops` row, RLS-protected |
| Access blocking on overdue | Frontend Server (Middleware) | — | Must run before page render; reads DB via user-scoped Supabase client |
| Dashboard overdue alert | Frontend Server (Server Component) | — | Reads `subscription_status` in Server Component, renders banner |
| Payment required page `/pagamento` | Frontend Server (Server Component) | — | Guarded: if status is `active`, redirect to `/dashboard` |
| CPF/CNPJ collection | Frontend Server (Server Component) + Browser | — | Onboarding wizard step (RHF + Zod field) |

---

## Standard Stack

Phase 6 introduces **zero new npm packages**. All capabilities are covered by:

### Existing Project Libraries (confirmed in `package.json`)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `next` | 15.5.18 | App Router, Server Actions, Route Handlers, Middleware | Already installed |
| `@supabase/ssr` | 0.10.3 | Supabase client for server/middleware | Already installed |
| `zod` | 4.4.3 | CPF/CNPJ field validation schema | Already installed |
| `react-hook-form` | 7.77.0 | CPF/CNPJ form input in onboarding wizard | Already installed |

### External Service (no npm package)

| Service | Access | Auth Header | Base URL |
|---------|--------|-------------|----------|
| Asaas REST API v3 | Raw `fetch` | `access_token: <key>` | See env vars below |

**Package Legitimacy Audit:** Phase 6 installs no new packages. No audit required.

---

## Asaas API Reference

### Base URLs [VERIFIED: docs.asaas.com/docs/authentication-2]

| Environment | Base URL |
|-------------|----------|
| **Sandbox** | `https://api-sandbox.asaas.com/v3` |
| **Production** | `https://api.asaas.com/v3` |

> Note: The sandbox URL `https://sandbox.asaas.com/api/v3` also appears in some docs but `https://api-sandbox.asaas.com/v3` is the current official form. Store in `ASAAS_BASE_URL` env var and never hardcode.

### Authentication [VERIFIED: docs.asaas.com/docs/authentication-2]

All requests must include:
```
access_token: $ASAAS_API_KEY
Content-Type: application/json
```

Sandbox keys are prefixed `$aact_hmlg_...`, production keys `$aact_prod_...`. They are not interchangeable between environments.

### Required Environment Variables (server-only — no `NEXT_PUBLIC_` prefix)

```
ASAAS_API_KEY         # e.g. $aact_hmlg_xxxxx (sandbox) or $aact_prod_xxxxx (prod)
ASAAS_BASE_URL        # https://api-sandbox.asaas.com/v3  OR  https://api.asaas.com/v3
ASAAS_WEBHOOK_TOKEN   # authToken set during webhook registration (32-255 chars, no spaces)
```

---

### Customer Creation [VERIFIED: docs.asaas.com/reference/criar-novo-cliente]

**Endpoint:** `POST /customers`

**Required fields:**
- `name` (string) — customer display name
- `cpfCnpj` (string) — Brazilian CPF (11 digits) or CNPJ (14 digits), no formatting

**Strongly recommended:**
- `externalReference` (string) — set to `barbershop_id` (UUID) for reconciliation and duplicate prevention

**CPF/CNPJ is mandatory — no workaround exists.** [VERIFIED: docs.asaas.com/reference/criar-novo-cliente + docs.asaas.com/docs/criando-um-cliente]

**Implication for MVP:** Add `cpf_cnpj TEXT` column to `barbershops` table. Collect in onboarding wizard. Gate `createBarbershopSubscription` on `cpf_cnpj` presence. If absent at Step 4, log warning and skip (subscription_status stays `'trial'`).

```typescript
// Source: docs.asaas.com/reference/criar-novo-cliente
type CreateCustomerPayload = {
  name: string
  cpfCnpj: string
  email?: string
  externalReference?: string
}

type AsaasCustomerResponse = {
  id: string          // e.g. "cus_0T1mdomVMi39"
  name: string
  cpfCnpj: string
  externalReference?: string
  // ...additional fields Asaas may add
}
```

### Subscription Creation [VERIFIED: docs.asaas.com/reference/criar-nova-assinatura]

**Endpoint:** `POST /subscriptions`

**Required fields:**
- `customer` (string) — Asaas customer ID (e.g. `cus_...`)
- `billingType` (enum) — `BOLETO` | `CREDIT_CARD` | `PIX` | `UNDEFINED`
- `value` (number) — amount in BRL (e.g. `49.90`)
- `nextDueDate` (string) — ISO date `YYYY-MM-DD` for first charge
- `cycle` (enum) — `MONTHLY` (use this for SaaS billing)

**`billingType` guidance:**
- `BOLETO` — generates a bank slip each month; customer pays manually. No card needed at signup. **Recommended for MVP** — lowest friction for Brazilian barbershop owners, no card registration required.
- `PIX` — generates a PIX QR each month; expires (typically ~24h for subscriptions, not 30min). Customer pays manually.
- `UNDEFINED` — customer chooses payment method at checkout. Best for self-service portals.
- `CREDIT_CARD` — requires card tokenization at subscription creation. More complex flow.

**For MVP: use `BOLETO`** — simplest to implement, familiar to Brazilian business owners.

```typescript
// Source: docs.asaas.com/docs/creating-a-subscription
type CreateSubscriptionPayload = {
  customer: string
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED'
  value: number
  nextDueDate: string   // YYYY-MM-DD
  cycle: 'MONTHLY'
  externalReference?: string
  description?: string
}

type AsaasSubscriptionResponse = {
  id: string          // e.g. "sub_VXJBYgP2u0eO"
  status: string      // "ACTIVE"
  nextDueDate: string // "2026-07-05"
  value: number
  billingType: string
  cycle: string
  customer: string
}
```

---

## Webhook System

### Registration [VERIFIED: docs.asaas.com/docs/create-new-webhook-via-api]

Webhooks are registered via **Asaas Dashboard** (Settings → Integrations → Webhooks) OR via **API** (`POST /v3/webhooks`). For MVP, use Dashboard registration — no runtime registration needed.

**API registration payload:**
```json
{
  "name": "BarberFlow Production",
  "url": "https://barberflow.app/api/webhooks/asaas",
  "email": "admin@barberflow.app",
  "enabled": true,
  "authToken": "your-32-to-255-char-token-no-spaces",
  "sendType": "SEQUENTIALLY",
  "events": [
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED"
  ]
}
```

**Constraints on `authToken`:** 32–255 characters, no spaces, no pure numeric sequences, no repeated characters. [VERIFIED: docs.asaas.com/docs/create-new-webhook-via-api]
**Limit:** Up to 10 webhooks per account.

### Authentication / Verification [VERIFIED: docs.asaas.com/docs/webhooks-3]

Asaas sends the configured `authToken` in every webhook request as:
```
asaas-access-token: <your-authToken>
```

Verify this header in the route handler. Reject with 401 if it doesn't match `process.env.ASAAS_WEBHOOK_TOKEN`.

> Note: `ASAAS_WEBHOOK_TOKEN` is the value YOU set during webhook registration. It is NOT the same as `ASAAS_API_KEY`. Use distinct values.

### Payment Webhook Events [VERIFIED: docs.asaas.com/docs/payment-events]

| Event | Meaning | Action in Phase 6 |
|-------|---------|-------------------|
| `PAYMENT_CREATED` | New charge generated for subscription cycle | No action needed |
| `PAYMENT_CONFIRMED` | Payment made, funds not yet available | Optional: set `subscription_status = 'active'` |
| `PAYMENT_RECEIVED` | Funds available in Asaas account | Set `subscription_status = 'active'`, update `subscription_due_date` |
| `PAYMENT_OVERDUE` | Charge past due date | Set `subscription_status = 'overdue'` |
| `PAYMENT_DELETED` | Charge removed | No action (subscription handles overall status) |
| `PAYMENT_REFUNDED` | Refund processed | No action for MVP |

### Subscription Webhook Events [VERIFIED: docs.asaas.com/docs/subscription-events]

| Event | Meaning | Action in Phase 6 |
|-------|---------|-------------------|
| `SUBSCRIPTION_CREATED` | New subscription registered | No action (already written via API) |
| `SUBSCRIPTION_UPDATED` | Subscription changed | No action for MVP |
| `SUBSCRIPTION_INACTIVATED` | Subscription deactivated | Set `subscription_status = 'cancelled'` |
| `SUBSCRIPTION_DELETED` | Subscription removed | Set `subscription_status = 'cancelled'` |

### Payload Structure [VERIFIED: docs.asaas.com/docs/payment-events]

```typescript
// Payment event payload
type AsaasPaymentWebhookPayload = {
  event: string                    // e.g. "PAYMENT_OVERDUE"
  payment: {
    id: string                     // e.g. "pay_080225913252" — USE AS idempotency_key
    customer: string               // e.g. "cus_0T1mdomVMi39"
    subscription: string | null    // e.g. "sub_VXJBYgP2u0eO"
    status: string                 // "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | ...
    value: number
    billingType: string
    dueDate: string                // YYYY-MM-DD
    // ...Asaas may add new fields — never throw on unknown keys
  }
}

// Subscription event payload
type AsaasSubscriptionWebhookPayload = {
  event: string                    // e.g. "SUBSCRIPTION_INACTIVATED"
  subscription: {
    id: string                     // e.g. "sub_VXJBYgP2u0eO" — USE AS idempotency_key
    customer: string
    status: string
    value: number
    billingType: string
    nextDueDate: string
    cycle: string
  }
}
```

**The `idempotency_key` to store in `webhook_events`:**
- For `PAYMENT_*` events: `body.payment.id`
- For `SUBSCRIPTION_*` events: `body.subscription.id`
- Note: The same `payment.id` is reused across retries, making it a reliable dedup key.

---

## Schema Changes

### New Migration File: `20260605000001_phase6_schema.sql`

#### Section A — Add columns to `barbershops`

Current `barbershops` table (from `20260529000001_initial_schema.sql`) has:
- `subscription_status TEXT NOT NULL DEFAULT 'trial'` — **already exists**, no CHECK constraint defined
- Missing: `asaas_customer_id`, `asaas_subscription_id`, `subscription_due_date`, `trial_ends_at`, `cpf_cnpj`

```sql
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS cpf_cnpj               TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS subscription_due_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ;

-- Add CHECK constraint on subscription_status (was just TEXT DEFAULT 'trial' with no constraint)
ALTER TABLE public.barbershops
  ADD CONSTRAINT barbershops_subscription_status_check
    CHECK (subscription_status IN ('trial', 'active', 'overdue', 'cancelled'));

-- Backfill trial_ends_at for existing rows (30 days from created_at)
UPDATE public.barbershops
  SET trial_ends_at = created_at + INTERVAL '30 days'
  WHERE trial_ends_at IS NULL;
```

#### Section B — `webhook_events` table (new)

Global events log — no `barbershop_id`, service-role-only writes. Pattern from `used_qr_tokens` in Phase 3.

```sql
CREATE TABLE public.webhook_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT        NOT NULL DEFAULT 'asaas',
  event_type       TEXT        NOT NULL,
  payload          JSONB       NOT NULL,
  idempotency_key  TEXT,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Unique index for idempotency — non-null only
CREATE UNIQUE INDEX webhook_events_idempotency_key_idx
  ON public.webhook_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- No authenticated INSERT policy — all writes via adminClient (service role bypasses RLS)
-- No SELECT policy needed for MVP — owners access billing status via barbershops table
```

---

## Architecture Patterns

### System Architecture Diagram

```
Onboarding Step 4 complete
  │
  ▼
billing.ts Server Action
  ├── getAuthContext() → profiles → barbershop_id
  ├── check: asaas_customer_id already set? → skip (idempotent)
  ├── asaas.ts: POST /customers {name, cpfCnpj, externalReference}
  │     └── write asaas_customer_id → barbershops
  ├── asaas.ts: POST /subscriptions {customer, billingType: BOLETO, value, nextDueDate, cycle: MONTHLY}
  │     └── write asaas_subscription_id + subscription_status='active' → barbershops
  └── return { data: { subscription_id } } | { error }
        (error is non-blocking — onboarding proceeds regardless)

Asaas servers
  │  (monthly cycle fires, or payment event occurs)
  ▼
POST /api/webhooks/asaas
  ├── verify asaas-access-token header === ASAAS_WEBHOOK_TOKEN
  ├── INSERT webhook_events {idempotency_key: payment.id}
  │     └── UNIQUE violation (23505) → return 200 immediately (already processed)
  ├── return 200 immediately (CLAUDE.md contract)
  └── void processWebhookEvent(body, admin)
        ├── PAYMENT_RECEIVED/PAYMENT_CONFIRMED → barbershops: subscription_status='active'
        ├── PAYMENT_OVERDUE → barbershops: subscription_status='overdue'
        └── SUBSCRIPTION_INACTIVATED/DELETED → barbershops: subscription_status='cancelled'

Browser request to /dashboard/**
  │
  ▼
middleware.ts Rule F
  ├── isOwnerRoute + role='owner' + !isPaymentPage
  ├── supabase.from('barbershops').select('subscription_status').eq('id', barbershop_id)
  │     (user-scoped RLS client — single column SELECT, ~5-15ms overhead)
  └── status === 'overdue' → NextResponse.redirect('/pagamento')
        status === 'trial' (within trial_ends_at) → allow
        status === 'active' → allow
```

### Recommended Project Structure (new files only)

```
src/
├── lib/
│   └── asaas.ts                           # Asaas API client (raw fetch, named functions)
├── app/
│   ├── actions/
│   │   └── billing.ts                     # Server Actions: createBarbershopSubscription, getBillingStatus
│   └── api/
│       └── webhooks/
│           └── asaas/
│               └── route.ts              # POST handler — idempotency + status updates
│   └── (owner)/
│       └── pagamento/
│           └── page.tsx                  # "Payment required" page
supabase/
└── migrations/
    └── 20260605000001_phase6_schema.sql  # barbershops columns + webhook_events table
```

Modified files:
- `src/app/(owner)/onboarding/page.tsx` — hook `createBarbershopSubscription` into Step 4
- `src/middleware.ts` — add Rule F (overdue guard)
- `src/app/(owner)/dashboard/page.tsx` — add overdue/upcoming-due alert banner

### Pattern: `src/lib/asaas.ts`

```typescript
// Source: codebase analog src/lib/supabase/admin.ts + src/app/actions/qr-checkin.ts
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL!
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!

async function asaasFetch<T>(
  path: string,
  options: RequestInit
): Promise<{ data: T } | { error: string }> {
  try {
    const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
      ...options,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      return { error: `Asaas ${res.status}: ${text}` }
    }
    const data = (await res.json()) as T
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Asaas request failed' }
  }
}

export async function createAsaasCustomer(payload: CreateCustomerPayload) {
  return asaasFetch<AsaasCustomerResponse>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createAsaasSubscription(payload: CreateSubscriptionPayload) {
  return asaasFetch<AsaasSubscriptionResponse>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
```

### Pattern: Webhook Route (`/api/webhooks/asaas/route.ts`)

```typescript
// Source: codebase analog src/app/auth/confirm/route.ts + CLAUDE.md Payments section
import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // Step 1: Verify Asaas webhook token
  const token = request.headers.get('asaas-access-token')
  if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN!) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: Parse body
  let body: AsaasWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Step 3: Write to webhook_events FIRST — idempotent insert
  const admin = createAdminClient()
  const idempotencyKey =
    (body as AsaasPaymentWebhookPayload).payment?.id ??
    (body as AsaasSubscriptionWebhookPayload).subscription?.id ??
    null

  const { error: insertError } = await admin
    .from('webhook_events')
    .insert({
      provider: 'asaas',
      event_type: body.event,
      payload: body,
      idempotency_key: idempotencyKey,
    })

  // Duplicate event — unique_violation on idempotency_key — return 200, no reprocessing
  if (insertError?.code === '23505') {
    return NextResponse.json({ received: true })
  }
  if (insertError) {
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  // Step 4: Process async (fire-and-forget)
  void processWebhookEvent(body, admin)

  // Step 5: Return 200 immediately (CLAUDE.md requirement)
  return NextResponse.json({ received: true })
}
```

### Pattern: Middleware Rule F (Subscription Guard)

```typescript
// Source: src/middleware.ts — extends existing Rules A–E
// Insert AFTER Rule E, BEFORE return response

// Rule F — Owner with overdue subscription on /dashboard → redirect to /pagamento
// Bypass /pagamento itself to avoid infinite redirect loop.
// WARNING: This adds ~5-15ms latency per dashboard request (single-column DB lookup).
// Acceptable for MVP. Future: cache subscription_status in a short-lived cookie.
const isPaymentPage = pathname.startsWith('/pagamento')
if (isOwnerRoute && !isPaymentPage && role === 'owner' && claims && !error && barbershop_id) {
  const { data: shop } = await supabase
    .from('barbershops')
    .select('subscription_status, trial_ends_at')
    .eq('id', barbershop_id)
    .maybeSingle()

  const status = shop?.subscription_status
  const trialEndsAt = shop?.trial_ends_at ? new Date(shop.trial_ends_at) : null
  const now = new Date()

  // Allow access if: active, OR trial period not yet expired
  const trialActive = status === 'trial' && trialEndsAt !== null && trialEndsAt > now
  if (status === 'overdue' && !trialActive) {
    return NextResponse.redirect(new URL('/pagamento', request.url))
  }
}
```

Also add `/pagamento` to `reservedPaths` array:
```typescript
const reservedPaths = ['/entrar', '/cadastro', '/dashboard', '/agenda', '/onboarding', '/auth', '/_next', '/api', '/pagamento']
```

### Anti-Patterns to Avoid

- **Creating adminClient in webhook route for the DB lookup to find barbershop_id from Asaas customer ID.** The webhook payload has `payment.customer` (Asaas customer ID string), not `barbershop_id`. Must query `barbershops WHERE asaas_customer_id = payment.customer`. This lookup is needed inside `processWebhookEvent` — use `adminClient` (service role, no RLS issue).
- **Setting `subscription_status` from the onboarding Server Action directly to `'active'` without waiting for `PAYMENT_RECEIVED` webhook.** The subscription is created but the first charge has not yet been paid. Correct default: keep status as whatever Asaas returns. For BOLETO, first payment may take days. Status should start as `'trial'` / `'active'` per Asaas `status` field, not assumed paid.
- **Using `NEXT_PUBLIC_ASAAS_API_KEY`.** The key would be exposed in the browser bundle. All Asaas env vars must be server-only (no `NEXT_PUBLIC_` prefix).
- **Throwing from Server Actions.** All Server Actions must catch internally and return `{ error: string }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPF/CNPJ validation | Custom regex or digit-sum algorithm | Zod + `z.string().regex(/^\d{11}$|^\d{14}$/)` | CPF/CNPJ check digits are complex; formatting-only validation is sufficient for Asaas (it validates the document on their end) |
| Webhook deduplication | In-memory map or custom table | `webhook_events` table + `UNIQUE INDEX` on `idempotency_key` | DB constraint is the only reliable approach across serverless restarts |
| Subscription status caching | Middleware cookie logic | Direct DB lookup for MVP | Premature optimization; latency is acceptable for now |
| Asaas retry logic | Custom exponential backoff | Asaas handles retries automatically | Asaas retries failed webhook deliveries automatically |

---

## Common Pitfalls

### Pitfall 1: Sandbox Payments Require Manual Confirmation
**What goes wrong:** You create a subscription in sandbox, get `PAYMENT_CREATED` webhook, but never receive `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` — so `subscription_status` stays `'trial'` forever.
**Why it happens:** Asaas sandbox does not auto-process payments. Each generated charge has a "Confirm Payment" button in the Asaas Sandbox Dashboard. [VERIFIED: docs.asaas.com/docs/how-to-test-features]
**How to avoid:** After creating a subscription in sandbox, log into `sandbox.asaas.com`, navigate to the charge, and click "Confirmar Pagamento". Only then will the `PAYMENT_RECEIVED` webhook fire.
**Warning signs:** `subscription_status` column stays `'trial'` indefinitely after test subscription creation.

### Pitfall 2: `cpfCnpj` Is Truly Required — No Email-Only Path
**What goes wrong:** You attempt `POST /customers` with only `name` and `email`, get 400 error from Asaas.
**Why it happens:** `cpfCnpj` is listed as required in Asaas API reference. [VERIFIED: docs.asaas.com/reference/criar-novo-cliente]
**How to avoid:** Collect CPF/CNPJ during onboarding. Gate customer creation on its presence. If not provided, skip subscription creation and log a warning — `subscription_status` remains `'trial'`.
**Warning signs:** Onboarding completes but `asaas_customer_id` is NULL in DB.

### Pitfall 3: Webhook URL Must Be HTTPS and Publicly Reachable
**What goes wrong:** Webhooks work in production but never arrive in local development.
**Why it happens:** Asaas cannot reach `localhost`. Also applies to Vercel Preview URLs — they work but are dynamic per-deploy.
**How to avoid:** Use ngrok or Vercel CLI tunnel for local webhook testing. Set a stable production URL for the registered webhook. For Vercel Preview, register a dedicated "staging" webhook URL if needed.
**Warning signs:** No rows in `webhook_events` table after sandbox payment confirmation.

### Pitfall 4: Middleware DB Query Adds Latency on Every Dashboard Request
**What goes wrong:** Rule F adds a Supabase SELECT on every `/dashboard/*` navigation, adding 5–50ms per request.
**Why it happens:** `subscription_status` is not in the JWT claims (the JWT is set at login, not updated on each billing event).
**How to avoid:** For MVP, accept the latency. Future mitigation: store `subscription_status` in a short-lived `HttpOnly` cookie refreshed by a Server Action, and check the cookie first before falling back to DB.
**Warning signs:** Noticeable dashboard navigation slowness (>200ms perceived).

### Pitfall 5: Asaas `PAYMENT_OVERDUE` Does Not Fire Immediately
**What goes wrong:** You expect `subscription_status` to flip to `'overdue'` at midnight on due date.
**Why it happens:** [ASSUMED] Asaas `PAYMENT_OVERDUE` fires on the due date but exact timing is not documented to the minute. Boleto charges may have a grace period before the event triggers.
**How to avoid:** Do not rely on instant status flip. Test in sandbox by creating a subscription with `nextDueDate` = yesterday to force overdue status.
**Warning signs:** Status stays `'active'` past due date during testing.

### Pitfall 6: `asaas-access-token` Webhook Header Is Your Auth Token, Not Your API Key
**What goes wrong:** You compare `request.headers.get('asaas-access-token')` to `ASAAS_API_KEY` — mismatch, all webhooks return 401.
**Why it happens:** `ASAAS_WEBHOOK_TOKEN` is the value you configure when registering the webhook, distinct from `ASAAS_API_KEY`. Asaas sends it in the header for verification.
**How to avoid:** Use a separate env var `ASAAS_WEBHOOK_TOKEN` (the value you pick when registering the webhook). Compare the header to `ASAAS_WEBHOOK_TOKEN`, not `ASAAS_API_KEY`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (assumed from project stack — confirm with `ls vitest.config.*`) |
| Config file | `vitest.config.ts` or `jest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Subscription created at onboarding completion | integration | Manual: check DB after onboarding flow | Wave 0 gap |
| BILL-02 | Access blocked when overdue | unit | Test middleware Rule F with mock Supabase | Wave 0 gap |
| BILL-03 | Banner shown ≤7 days to due / on overdue | unit | Test dashboard page with mock billing status | Wave 0 gap |
| BILL-04 | Duplicate webhook → 200 no side effect | unit | POST same payload twice to route handler | Wave 0 gap |

### Wave 0 Gaps
- [ ] `src/app/api/webhooks/asaas/__tests__/route.test.ts` — covers BILL-04 idempotency
- [ ] `src/middleware.test.ts` (or extend existing) — covers BILL-02 overdue guard
- [ ] `src/app/actions/__tests__/billing.test.ts` — covers BILL-01 subscription creation logic

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — billing uses server-only API key, not user auth |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Middleware Rule F — subscription status gate; `adminClient` bypasses RLS only server-side |
| V5 Input Validation | yes | Zod — CPF/CNPJ field validation in onboarding step |
| V6 Cryptography | no | No custom crypto — webhook auth uses pre-shared token over HTTPS |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed Asaas webhook (fake payment received) | Tampering | Verify `asaas-access-token` header against `ASAAS_WEBHOOK_TOKEN` env var |
| Replay attack (same webhook resent) | Repudiation | `UNIQUE INDEX` on `webhook_events.idempotency_key` — duplicate → 200, no reprocessing |
| API key exposure in browser bundle | Information Disclosure | All Asaas env vars: no `NEXT_PUBLIC_` prefix — server-only |
| Forced billing bypass via URL manipulation | Elevation of Privilege | Middleware Rule F checks DB, not just URL; `/pagamento` page redirects `active` owners back to `/dashboard` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Asaas sandbox URL `sandbox.asaas.com/api/v3` | `api-sandbox.asaas.com/v3` | 2024+ | Store in env var — don't hardcode either form |
| Manual webhook URL configuration only | API-based webhook registration (`POST /v3/webhooks`) | Recent | MVP can use Dashboard; production can use API registration at deploy time |

**No deprecated items** relevant to this phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PAYMENT_OVERDUE` webhook timing is ~0 days after due date (fires on due date) | Common Pitfalls #5 | Status might not flip on due date; workaround: also check `subscription_due_date < now` in middleware |
| A2 | For BOLETO subscription, `subscription_status` returned by Asaas on creation is `'ACTIVE'` (not `'PENDING'`) | Schema changes section | If `'PENDING'`, middleware Rule F would need to differentiate between awaiting first payment vs. overdue |
| A3 | Vercel Edge Middleware supports Supabase DB queries (project uses Node runtime middleware, not Edge) | Middleware Rule F | If Edge runtime were used, Supabase client may not work; confirmed not an issue — project uses default Node runtime |

---

## Open Questions

1. **What price should the BarberFlow subscription charge?**
   - What we know: `value` field in subscription creation, plus `nextDueDate`
   - What's unclear: Project has not defined the SaaS monthly price
   - Recommendation: Make it a `BILLING_PLAN_VALUE` env var (e.g., `49.90`) so it can be changed without a deploy

2. **Should CPF/CNPJ be collected in Step 1 of onboarding or as a separate step?**
   - What we know: Current Step 1 collects barbershop name and slug; Steps 2-4 collect barbers and services
   - What's unclear: User has not specified where in the wizard to add the CPF/CNPJ field
   - Recommendation: Add as optional field in Step 1 (barbershop details) — least friction, same context as other business info

3. **Exact `nextDueDate` for subscription creation**
   - What we know: Should be 30 days from `trial_ends_at` (or `created_at + 30 days`)
   - What's unclear: If trial is in effect, should the first charge be at trial end or at onboarding time?
   - Recommendation: `nextDueDate = trial_ends_at` (the day the trial expires = first billing date)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js Server Actions, middleware | Yes | Bundled with Next.js | — |
| Supabase project | DB schema migration, RLS | Yes | Connected (Phase 0+) | — |
| Asaas Sandbox account | Testing billing flow | Not verified | — | Must create at sandbox.asaas.com before execution |
| ngrok or Vercel CLI tunnel | Local webhook testing | Not verified | — | Skip local webhook test; test via deployed Vercel preview |

**Missing dependencies with no fallback:**
- Asaas Sandbox API key (`$aact_hmlg_...`) — must be obtained from sandbox.asaas.com before executing this phase

**Missing dependencies with fallback:**
- Local webhook tunnel — can be skipped if testing against Vercel preview deployment

---

## Sources

### Primary (HIGH confidence)
- [docs.asaas.com/docs/authentication-2](https://docs.asaas.com/docs/authentication-2) — base URLs, `access_token` header
- [docs.asaas.com/reference/criar-novo-cliente](https://docs.asaas.com/reference/criar-novo-cliente) — customer creation required fields
- [docs.asaas.com/reference/criar-nova-assinatura](https://docs.asaas.com/reference/criar-nova-assinatura) — subscription required fields, billingType options
- [docs.asaas.com/docs/payment-events](https://docs.asaas.com/docs/payment-events) — webhook event types, payload structure
- [docs.asaas.com/docs/subscription-events](https://docs.asaas.com/docs/subscription-events) — subscription webhook events
- [docs.asaas.com/docs/create-new-webhook-via-api](https://docs.asaas.com/docs/create-new-webhook-via-api) — webhook registration API, authToken constraints
- [docs.asaas.com/docs/webhooks-3](https://docs.asaas.com/docs/webhooks-3) — `asaas-access-token` header verification
- [docs.asaas.com/docs/how-to-test-features](https://docs.asaas.com/docs/how-to-test-features) — sandbox manual payment confirmation

### Secondary (MEDIUM confidence)
- Codebase `src/app/actions/loyalty.ts` — `getAuthContext()` and discriminated union pattern (direct file read)
- Codebase `src/middleware.ts` — existing Rules A–E structure (direct file read)
- Codebase `supabase/migrations/20260529000001_initial_schema.sql` — confirmed `subscription_status TEXT NOT NULL DEFAULT 'trial'` already exists
- Codebase `.planning/phases/06-saas-billing-asaas/06-PATTERNS.md` — pre-computed analogs for all 8 new/modified files

### Tertiary (LOW confidence / ASSUMED)
- PAYMENT_OVERDUE timing relative to due date (A1) — search result says `scheduleOffset: 0` but exact trigger timing unconfirmed
- Asaas subscription status at creation (`'ACTIVE'` vs `'PENDING'`) (A2) — inferred from subscription docs but not confirmed via API call

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — phase uses no new packages; Asaas API verified via official docs
- Architecture: HIGH — derived from existing codebase analogs in PATTERNS.md + official Asaas docs
- Pitfalls: HIGH (pitfalls 1-3, 5-6) / LOW (pitfall 4 latency) — sandbox behavior and webhook header verified; latency estimate based on Supabase hosted benchmark

**Research date:** 2026-06-05
**Valid until:** 2026-09-05 (Asaas API is stable; webhook payload structure may add fields per their stated policy)
