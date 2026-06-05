# Phase 6: SaaS Billing (Asaas) — Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/asaas.ts` | utility/client | request-response | `src/lib/supabase/admin.ts` + `src/app/actions/qr-checkin.ts` (fetch) | role-match |
| `src/app/actions/billing.ts` | service/action | request-response | `src/app/actions/loyalty.ts` | exact |
| `src/app/api/webhooks/asaas/route.ts` | api-route | event-driven | `src/app/auth/confirm/route.ts` | role-match |
| `supabase/migrations/20260605000001_phase6_schema.sql` | migration | batch | `supabase/migrations/20260603000001_phase4_schema.sql` | exact |
| `src/app/(owner)/onboarding/page.tsx` (modify) | component | request-response | self — `handleStep4Complete` hook point | self |
| `src/middleware.ts` (modify) | middleware | request-response | self — existing Rules A–E structure | self |
| `src/app/(owner)/pagamento/page.tsx` | page/component | request-response | `src/app/(owner)/dashboard/fidelidade/page.tsx` | role-match |
| Dashboard alert in `src/app/(owner)/dashboard/page.tsx` (modify) | component | request-response | `src/components/shell/dashboard-shell.tsx` (Plan card block) | role-match |

---

## Pattern Assignments

### `src/lib/asaas.ts` (utility, request-response)

**Analog 1:** `src/lib/supabase/admin.ts` — client factory pattern

**Client factory pattern** (`src/lib/supabase/admin.ts` lines 11-22):
```typescript
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**Analog 2:** `src/app/actions/qr-checkin.ts` — raw fetch with env-based credentials and typed error handling

**Fetch + env pattern** (`src/app/actions/qr-checkin.ts` lines 55-78):
```typescript
async function broadcastCheckIn(barbershopId: string, appointmentId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ messages: [...] }),
  })
}
```

**New pattern for `src/lib/asaas.ts`:**
- Export named async functions: `createAsaasCustomer(data)`, `createAsaasSubscription(data)`
- Read `process.env.ASAAS_API_KEY!` and `process.env.ASAAS_BASE_URL!` (never `NEXT_PUBLIC_` — server-only)
- Each function: `fetch(ASAAS_BASE_URL + path, { method, headers: { access_token: ASAAS_API_KEY }, body })`
- Return `{ data: T } | { error: string }` — same discriminated union as all other project helpers
- No class, no shared instance — plain function exports matching `admin.ts` style

---

### `src/app/actions/billing.ts` (service, request-response)

**Analog:** `src/app/actions/loyalty.ts` — exact match (adminClient + getAuthContext + discriminated union returns)

**Imports pattern** (`src/app/actions/loyalty.ts` lines 1-5):
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
```

**getAuthContext helper pattern** (`src/app/actions/loyalty.ts` lines 21-48):
```typescript
async function getAuthContext(): Promise<
  { userId: string; barbershopId: string } | { error: string }
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return { error: 'Não autenticado' }

    const userId = data.claims.sub as string | undefined
    if (!userId) return { error: 'Usuário não encontrado' }

    // Read barbershop_id from profiles — source of truth, avoids JWT cache issues
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('barbershop_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.barbershop_id) {
      return { error: 'Barbearia não configurada' }
    }

    return { userId, barbershopId: profile.barbershop_id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro de autenticação' }
  }
}
```

**Core action pattern** (`src/app/actions/loyalty.ts` lines 101-120, upsert variant):
```typescript
export async function getLoyaltyRule(): Promise<
  { data: LoyaltyRule | null } | { error: string }
> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('loyalty_rules')
      .select('*')
      .eq('barbershop_id', ctx.barbershopId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

**For `createBarbershopSubscription`:**
1. Call `getAuthContext()` — bail if error
2. Call `admin.from('barbershops').select('asaas_customer_id, name').eq('id', ctx.barbershopId).single()` — check if already subscribed (idempotency)
3. If no `asaas_customer_id`: call `createAsaasCustomer(...)` from `src/lib/asaas.ts`, write result back via `admin.from('barbershops').update({ asaas_customer_id: ... })`
4. Call `createAsaasSubscription(...)`, write `asaas_subscription_id` + `subscription_status = 'active'` + `subscription_due_date`
5. Return `{ data: { subscription_id } } | { error: string }` — never throw

**For `getBillingStatus`:**
1. Call `getAuthContext()`
2. `admin.from('barbershops').select('subscription_status, subscription_due_date, asaas_customer_id').eq('id', ctx.barbershopId).single()`
3. Return the fields as `{ data: BillingStatus } | { error: string }`

---

### `src/app/api/webhooks/asaas/route.ts` (api-route, event-driven)

**Analog:** `src/app/auth/confirm/route.ts` — only existing Next.js API route; provides route handler structure

**Route handler pattern** (`src/app/auth/confirm/route.ts` lines 1-25):
```typescript
import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // ...read params...

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin

  // ...process...

  return NextResponse.redirect(new URL('/entrar?erro=link-invalido', siteUrl))
}
```

**New pattern for `route.ts` (POST handler):**
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // 1. Verify Asaas webhook signature (header: asaas-access-token)
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN!) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: AsaasWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3. Write to webhook_events FIRST — idempotent, return 200 immediately (CLAUDE.md rule)
  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from('webhook_events')
    .insert({
      provider: 'asaas',
      event_type: body.event,
      payload: body,
      idempotency_key: body.payment?.id ?? body.subscription?.id ?? null,
    })

  // Duplicate event — idempotency key conflict — still return 200 (CLAUDE.md rule)
  if (insertError?.code === '23505') {
    return NextResponse.json({ received: true })
  }
  if (insertError) {
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  // 4. Process async (fire-and-forget — same pattern as broadcastCheckIn)
  void processWebhookEvent(body, admin)

  return NextResponse.json({ received: true })
}
```

Key rules from CLAUDE.md:
- Write to `webhook_events` first, return 200, process async
- Idempotent: treat 23505 (unique_violation on `idempotency_key`) as success
- No `export const runtime = 'edge'` — same as `qr-checkin.ts` which also uses Node runtime

---

### Migration `20260605000001_phase6_schema.sql` (migration, batch)

**Analog:** `supabase/migrations/20260603000001_phase4_schema.sql` — most recent migration; exact naming and structure pattern

**File header pattern** (`20260603000001_phase4_schema.sql` lines 1-9):
```sql
-- ============================================================
-- BarberFlow Phase 4 — Loyalty Schema
-- Migration: 20260603000001_phase4_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================
```

**ALTER TABLE pattern** for adding columns to existing `barbershops`:
```sql
-- ── SECTION A — Add billing columns to barbershops ──────────────────────────
-- subscription_status already exists (initial_schema.sql) with DEFAULT 'trial'.
-- Add the three new Asaas tracking columns; keep NOT NULL with sensible defaults
-- so existing rows are valid after the migration.

ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS asaas_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_due_date   TIMESTAMPTZ;

-- Update subscription_status CHECK constraint to include all valid statuses
-- (initial_schema had only 'trial' as default — extend the allowed set)
ALTER TABLE public.barbershops
  DROP CONSTRAINT IF EXISTS barbershops_subscription_status_check;

ALTER TABLE public.barbershops
  ADD CONSTRAINT barbershops_subscription_status_check
    CHECK (subscription_status IN ('trial', 'active', 'overdue', 'cancelled'));
```

**New table + RLS pattern** (`20260603000001_phase4_schema.sql` lines 25-44):
```sql
CREATE TABLE public.loyalty_rules (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id       UUID        NOT NULL UNIQUE REFERENCES public.barbershops(id) ON DELETE CASCADE,
  -- ...columns...
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_loyalty_rules_all" ON public.loyalty_rules
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

**`webhook_events` table** — no barbershop_id (global events table), service-role-only writes:
```sql
-- Pattern from used_qr_tokens: adminClient-only writes, SELECT policy for authenticated
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

CREATE UNIQUE INDEX webhook_events_idempotency_key_idx
  ON public.webhook_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
-- No authenticated INSERT policy — all writes via adminClient (service role)
```

---

### `src/app/(owner)/onboarding/page.tsx` — hook into Step 4 completion

**Self-analog:** `src/app/(owner)/onboarding/page.tsx` — modify `handleStep4Complete` (lines 155-164)

**Current Step 4 handler** (lines 155-164):
```typescript
const handleStep4Complete = async (data: {
  name: string
  duration_minutes: number
  price: number
}) => {
  const result = await createOnboardingService(data)
  if ('error' in result) throw new Error(result.error)

  router.push('/dashboard')
}
```

**Modified pattern — call `createBarbershopSubscription` after service creation:**
```typescript
const handleStep4Complete = async (data: {
  name: string
  duration_minutes: number
  price: number
}) => {
  const result = await createOnboardingService(data)
  if ('error' in result) throw new Error(result.error)

  // Fire billing subscription — non-blocking: billing failure should not
  // prevent onboarding completion. Log error, redirect regardless.
  const billingResult = await createBarbershopSubscription()
  if ('error' in billingResult) {
    console.error('[onboarding] billing subscription failed:', billingResult.error)
  }

  router.push('/dashboard')
}
```

**Import to add** (line 6 of onboarding page):
```typescript
import { createBarbershopSubscription } from '@/app/actions/billing'
```

---

### `src/middleware.ts` — add subscription status guard (Rule F)

**Self-analog:** `src/middleware.ts` — extend existing Rules A–E

**Existing rule structure pattern** (lines 44-64):
```typescript
// Rule A — Unauthenticated access to protected routes → redirect to /entrar
const isOwnerRoute = pathname.startsWith('/dashboard')
const isBarberRoute = pathname.startsWith('/agenda')

if ((isOwnerRoute || isBarberRoute) && (!claims || error)) {
  return NextResponse.redirect(new URL('/entrar', request.url))
}
```

**Rule F to append** (insert after Rule E, before `return response`):
```typescript
// Rule F — Owner with overdue subscription on /dashboard → redirect to /pagamento
// Bypass /pagamento itself to avoid infinite redirect.
// NOTE: subscription_status is NOT in JWT claims — this rule must do a DB lookup
// via supabase (user-scoped client, RLS-enforced) to avoid a service-role call
// in middleware. Keep it lightweight: select single column only.
const isPaymentPage = pathname.startsWith('/pagamento')
if (isOwnerRoute && !isPaymentPage && role === 'owner' && claims && !error && barbershop_id) {
  const { data: shop } = await supabase
    .from('barbershops')
    .select('subscription_status')
    .eq('id', barbershop_id)
    .single()

  if (shop?.subscription_status === 'overdue') {
    return NextResponse.redirect(new URL('/pagamento', request.url))
  }
}
```

**Matcher update** — add `/pagamento` to reservedPaths (line 13):
```typescript
const reservedPaths = ['/entrar', '/cadastro', '/dashboard', '/agenda', '/onboarding', '/auth', '/_next', '/api', '/pagamento']
```

---

### `src/app/(owner)/pagamento/page.tsx` (page, request-response)

**Analog:** `src/app/(owner)/dashboard/fidelidade/page.tsx` — Server Component page in owner group with auth check + DashboardShell

**Page structure pattern** (`fidelidade/page.tsx` lines 14-85):
```typescript
export default async function FidelidadePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) redirect('/onboarding')

  // Fetch page data via supabase (RLS-enforced)...

  // Derive displayName from profile or email handle
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', claims.sub as string)
    .maybeSingle()

  const displayName = profile?.full_name?.trim() || derived

  return (
    <DashboardShell displayName={displayName} email={email}>
      {/* page content */}
    </DashboardShell>
  )
}
```

**For `/pagamento/page.tsx`:** Same auth scaffolding; fetch `subscription_status` and `subscription_due_date` from `barbershops`; if status is `active`, redirect to `/dashboard` (guard against manual URL access). Render a "payment required" card inside `DashboardShell` — NOT a blank page — so navigation stays visible.

---

### Dashboard overdue alert in `src/app/(owner)/dashboard/page.tsx` (modify)

**Analog:** `src/components/shell/dashboard-shell.tsx` lines 124-141 — existing "Plan card" in sidebar already references plan state

**Plan card in sidebar** (`dashboard-shell.tsx` lines 124-141):
```typescript
{role === "owner" && (
  <div className="px-3 pb-3">
    <div className="rounded-xl border border-[#d4a574]/20 bg-gradient-to-b from-[#d4a574]/[0.08] to-transparent p-4 ...">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[#d4a574]" ... />
        <p className="text-[0.8125rem] font-semibold text-foreground">Plano Profissional</p>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-secondary)]">Seu plano atual</p>
      <p className="text-xs text-[var(--text-tertiary)]">Renova em 25 dias</p>
      <button ...>Gerenciar Plano</button>
    </div>
  </div>
)}
```

**Alert pattern** — add an overdue banner just above `<KpiRow />` in `dashboard/page.tsx`, passing `subscriptionStatus` and `subscriptionDueDate` as Server Component props:
```typescript
// Fetch in DashboardPage (server component, after claims check):
const { data: shopBilling } = await supabase
  .from('barbershops')
  .select('subscription_status, subscription_due_date')
  .eq('id', barbershopId)
  .maybeSingle()

// In JSX:
{shopBilling?.subscription_status === 'overdue' && (
  <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
    Sua assinatura está vencida.{' '}
    <Link href="/pagamento" className="underline">Regularize agora</Link>
  </div>
)}
```

---

## Shared Patterns

### Auth Context (apply to all Server Actions)
**Source:** `src/app/actions/loyalty.ts` lines 21-48 — `getAuthContext()` helper
```typescript
// Always: createClient() → getClaims() → admin.from('profiles').select('barbershop_id')
// Never accept barbershop_id as an action parameter
// Never read barbershop_id from JWT app_metadata for write operations (JWT cache lag)
```

### adminClient Usage
**Source:** `src/lib/supabase/admin.ts` lines 11-22
- Import: `import { createAdminClient } from '@/lib/supabase/admin'`
- Call `createAdminClient()` inside the function body, not at module level
- Use for all privileged DB operations (bypass RLS) and all webhook writes

### Error Handling Pattern (apply to all Server Actions and lib functions)
**Source:** `src/app/actions/loyalty.ts` — every exported function
```typescript
// Wrap entire body in try/catch
// Return { error: err instanceof Error ? err.message : 'Erro inesperado' }
// Never throw from a Server Action or lib helper
// Specific error codes (e.g., 23505) handled before generic fallthrough
```

### Supabase Unique Violation Detection
**Source:** `src/app/actions/loyalty.ts` lines 84-89, `src/app/actions/qr-checkin.ts` lines 173-176
```typescript
if (error?.code === '23505') {
  // Unique violation — treat as no-op for idempotency
  return
}
```

### Env Var Access Pattern
**Source:** `src/lib/supabase/admin.ts`, `src/app/actions/qr-checkin.ts`
- `NEXT_PUBLIC_*` — accessible in browser and server; use for Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` — server-only (no `NEXT_PUBLIC_` prefix)
- New vars for Phase 6 (server-only, no `NEXT_PUBLIC_` prefix):
  - `ASAAS_API_KEY` — Asaas access token
  - `ASAAS_BASE_URL` — `https://sandbox.asaas.com/api/v3` or `https://api.asaas.com/api/v3`
  - `ASAAS_WEBHOOK_TOKEN` — shared secret for webhook verification

### Middleware Route Guard Extension
**Source:** `src/middleware.ts` lines 44-82 — Rules A–E
- Each rule is labelled (`// Rule X —`), guarded with `if (...) { return NextResponse.redirect(...) }`
- No early returns without explicit labels — label Rule F for subscription check
- `supabase` client already initialized in middleware context — can do a DB query (user-scoped RLS) without creating adminClient

### Idempotency Contract (webhooks + billing)
**Source:** CLAUDE.md — Payments section; pattern mirrored in `qr-checkin.ts` single-use enforcement
```
1. Write event/token to DB first
2. Return 200 immediately
3. Process async (fire-and-forget)
4. Treat 23505 (unique_violation) as already-processed, return 200
```

### Server Component Page Structure
**Source:** `src/app/(owner)/dashboard/fidelidade/page.tsx` and `src/app/(owner)/dashboard/page.tsx`
```typescript
// 1. createClient() + getClaims() → redirect('/entrar') on failure
// 2. Extract barbershop_id from claims.app_metadata → redirect('/onboarding') if missing
// 3. Fetch page data via supabase (user-scoped, RLS) or adminClient as needed
// 4. Derive displayName from profiles.full_name or email handle
// 5. Return <DashboardShell displayName={displayName} email={email}>...</DashboardShell>
```

---

## No Analog Found

No files are completely without analog. The webhook route is the least-covered but `auth/confirm/route.ts` provides the structural skeleton.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/lib/`, `src/middleware.ts`, `src/app/api/`, `src/app/(owner)/`, `src/components/shell/`, `supabase/migrations/`
**Files scanned:** 18 source files + 5 migration files
**Pattern extraction date:** 2026-06-05
