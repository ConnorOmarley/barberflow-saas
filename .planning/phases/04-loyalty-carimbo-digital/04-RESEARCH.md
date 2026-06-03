# Phase 4: Loyalty — Carimbo Digital — Research

**Researched:** 2026-06-02
**Domain:** Loyalty stamp system, PostgreSQL schema design, Server Action hooks, Next.js App Router dashboard UI
**Confidence:** HIGH

---

## Summary

Phase 4 implements a per-tenant loyalty ("carimbo digital") system where clients accumulate stamps as appointments are completed, and owners redeem completed cards for a reward.

The implementation is entirely native — no external loyalty packages. Three new tables (`loyalty_rules`, `loyalty_stamps`, `loyalty_redemptions`) hang off the existing `appointments` + `clients` schema. The critical architectural decision is **where to trigger stamp creation**: inside `updateAppointmentStatus` Server Action (application layer) vs. a PostgreSQL trigger (database layer). Given the project's established pattern of Server Actions with `adminClient` + explicit error handling, the **Server Action approach is recommended** — it avoids hidden database logic, keeps the "COMPLETED" business logic in one readable place, and allows returning a combined error if either the status update or stamp creation fails.

Stamp counting uses a JOIN query between `loyalty_stamps` and `loyalty_redemptions`: stamps issued after the last redemption (or all stamps if never redeemed) are the "active" count. This avoids soft-deleting rows or mutating historical records.

**Primary recommendation:** Server Action hook in `updateAppointmentStatus`, three new tables (loyalty_rules / loyalty_stamps / loyalty_redemptions), a new `/dashboard/fidelidade` route following the `equipe` page pattern (Server Component + Client list), and a single `redeemLoyaltyCard` Server Action.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loyalty rule configuration | API / Backend (Server Action) | Database / Storage | Owner submits form; SA validates + upserts `loyalty_rules` |
| Auto-stamp on COMPLETED | API / Backend (Server Action) | Database / Storage | Hooked inside existing `updateAppointmentStatus`; adminClient bypasses RLS for the insert |
| Stamp count computation | Database / Storage | API / Backend | COUNT query with left join on `loyalty_redemptions`; server computes before sending to client |
| Progress display (per client) | Browser / Client | — | Client component receives pre-computed `{ stamps, required, percent }` from Server Component |
| Card redemption | API / Backend (Server Action) | Database / Storage | `redeemLoyaltyCard` inserts into `loyalty_redemptions`; triggers recount |
| RLS tenant isolation | Database / Storage | — | All three tables carry `barbershop_id`; RLS policies follow Phase 0/1 pattern |

---

## Schema Design

### Table: `loyalty_rules`

One row per barbershop. Upserted (INSERT … ON CONFLICT UPDATE) when owner saves the configuration.

```sql
CREATE TABLE public.loyalty_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id    UUID        NOT NULL UNIQUE REFERENCES public.barbershops(id) ON DELETE CASCADE,
  stamps_required  SMALLINT    NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 1 AND 100),
  reward_description TEXT      NOT NULL DEFAULT 'Corte grátis',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

**Key design choices:**
- `UNIQUE` on `barbershop_id` — enforces one-rule-per-tenant at DB level; enables upsert.
- `is_active` allows owner to pause the program without deleting history.
- `stamps_required SMALLINT CHECK (BETWEEN 1 AND 100)` — business constraint in DB.

---

### Table: `loyalty_stamps`

One row per completed appointment (i.e., one stamp per visit). Never mutated after insert — append-only audit log.

```sql
CREATE TABLE public.loyalty_stamps (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id  UUID        NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  client_id      UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID        NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;

-- Index for the hot query: "how many stamps does client X have in shop Y?"
CREATE INDEX loyalty_stamps_client_barbershop_idx
  ON public.loyalty_stamps (barbershop_id, client_id, created_at);

-- Prevents double-stamping the same appointment
-- (UNIQUE on appointment_id is already implied; index makes it explicit)
CREATE UNIQUE INDEX loyalty_stamps_appointment_id_idx
  ON public.loyalty_stamps (appointment_id);

CREATE POLICY "tenant_loyalty_stamps_all" ON public.loyalty_stamps
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

**Key design choices:**
- `UNIQUE ON appointment_id` — idempotency guard: re-running the Server Action (e.g., retry after network error) produces a unique-violation instead of a double stamp.
- No `redeemed_at` field — redemption is modeled separately in `loyalty_redemptions`. Stamps remain historical records.
- `ON DELETE CASCADE` on `appointment_id` — if an appointment is hard-deleted (not the project policy, but defensive), the stamp disappears with it.

---

### Table: `loyalty_redemptions`

One row per card redemption. Marks the "reset point" for counting active stamps.

```sql
CREATE TABLE public.loyalty_redemptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id  UUID        NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  client_id      UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  redeemed_by    UUID        NOT NULL REFERENCES auth.users(id),
  stamps_used    SMALLINT    NOT NULL,    -- snapshot of stamps_required at time of redemption
  notes          TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX loyalty_redemptions_client_barbershop_idx
  ON public.loyalty_redemptions (barbershop_id, client_id, created_at DESC);

CREATE POLICY "tenant_loyalty_redemptions_all" ON public.loyalty_redemptions
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

**Key design choices:**
- `stamps_used` stores a snapshot of `loyalty_rules.stamps_required` at redemption time. If the owner later changes the rule from 10 to 8, historical redemptions remain accurate.
- `redeemed_by` references `auth.users(id)` — audit trail for which staff member redeemed.
- No `ON DELETE CASCADE` from `loyalty_rules` — redemptions must survive rule changes.

---

## Auto-stamp Approach

### Decision: Server Action hook (not Postgres trigger)

**Recommendation: hook inside `updateAppointmentStatus` Server Action.**

**Rationale:**

| Factor | Server Action | Postgres Trigger |
|--------|--------------|-----------------|
| Code discoverability | Explicit — visible in `appointments.ts` | Hidden — side effect of an UPDATE |
| Error handling | Can return combined error to caller | Silent failure (trigger errors abort the entire transaction but the UI won't see why) |
| Testability | Mockable in unit tests | Requires a running Postgres instance |
| Consistency with project | Matches Phase 1/2/3 pattern — all business logic in SA | New pattern, not used elsewhere |
| Idempotency | `UNIQUE ON appointment_id` handles retries at DB layer | Same UNIQUE constraint needed regardless |
| Transaction atomicity | Can use a single `rpc` call or sequential awaits; partial failure is visible | Trigger runs in same transaction — atomic, but error surface is less visible in SA |

**Implementation pattern:**

```typescript
// src/app/actions/appointments.ts

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  // Auto-stamp: when marking COMPLETED, register loyalty stamp
  if (status === 'COMPLETED') {
    await createStampOnComplete(appointmentId, barbershop_id)
    // Note: stamp failure is non-fatal — appointment is already COMPLETED.
    // Log error but do not roll back the status update.
    // See Pitfall 2 for reasoning.
  }

  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/fidelidade')
  return { success: true }
}
```

**`createStampOnComplete` helper (same file or `src/app/actions/loyalty.ts`):**

```typescript
async function createStampOnComplete(
  appointmentId: string,
  barbershopId: string
): Promise<void> {
  // Must use adminClient to bypass RLS — appointment row was just updated
  // by authenticated client; loyalty insert needs service role for clean error isolation
  const admin = createAdminClient()

  // Fetch client_id from the appointment
  const { data: appt } = await admin
    .from('appointments')
    .select('client_id')
    .eq('id', appointmentId)
    .single()

  if (!appt?.client_id) return // defensive: appointment without client — skip

  // UNIQUE ON appointment_id makes this idempotent — retry safe
  const { error } = await admin
    .from('loyalty_stamps')
    .insert({
      barbershop_id: barbershopId,
      client_id: appt.client_id,
      appointment_id: appointmentId,
    })
    // ON CONFLICT DO NOTHING — not an error, just a duplicate attempt
    .select()
    .maybeSingle()

  if (error && error.code !== '23505') {
    // 23505 = unique_violation (expected for retries)
    console.error('[loyalty] stamp insert failed:', error.message)
  }
}
```

**Why adminClient for stamp insert:**
The memory note `[Server Actions: adminClient + profiles]` confirms the project pattern: use `adminClient` for privileged writes. The authenticated Supabase client could also insert (given the RLS policy allows tenant staff), but `adminClient` avoids any dependency on the calling user's JWT having the correct `barbershop_id` — which is already validated before the status update.

---

## Stamp Counting Strategy

### Active stamp count = stamps issued after last redemption

```sql
-- Active stamps for a specific client in a specific barbershop
SELECT COUNT(*) AS active_stamps
FROM public.loyalty_stamps ls
WHERE ls.barbershop_id = $1
  AND ls.client_id      = $2
  AND ls.created_at > COALESCE(
    (
      SELECT MAX(created_at)
      FROM public.loyalty_redemptions
      WHERE barbershop_id = $1
        AND client_id      = $2
    ),
    '1970-01-01'::TIMESTAMPTZ  -- sentinel: never redeemed → count all stamps
  );
```

**This query is run server-side** (Server Component or Server Action) and returns an integer. The UI receives `{ active_stamps: number, stamps_required: number }`.

### Dashboard list query (all clients with loyalty progress)

For the `/dashboard/fidelidade` page, fetch all clients who have at least one stamp, joined with their active count and the barbershop rule:

```typescript
// Pseudocode — implemented as two separate Supabase queries + JS merge
// (Supabase JS client does not support correlated subqueries in .select())

// 1. Fetch the loyalty rule for this barbershop
const { data: rule } = await supabase
  .from('loyalty_rules')
  .select('stamps_required, reward_description, is_active')
  .eq('barbershop_id', barbershop_id)
  .maybeSingle()

// 2. Fetch all stamps for this barbershop, grouped by client
//    (raw data — active count computed in JS after fetching redemptions)
const { data: stamps } = await supabase
  .from('loyalty_stamps')
  .select('client_id, created_at, clients(full_name, whatsapp_number)')
  .eq('barbershop_id', barbershop_id)
  .order('created_at', { ascending: true })

// 3. Fetch all redemptions for this barbershop
const { data: redemptions } = await supabase
  .from('loyalty_redemptions')
  .select('client_id, created_at')
  .eq('barbershop_id', barbershop_id)
  .order('created_at', { ascending: false })

// 4. Merge in JS: compute active_stamps per client
```

**Alternative:** use a Postgres function (RPC) for the grouped count. This is cleaner for large datasets but adds migration complexity. For Phase 4, the JS merge is acceptable — loyalty is not a high-volume operation. Document the RPC path as a future optimization.

---

## UI/UX Flow

### Route: `/dashboard/fidelidade`

Already referenced in `dashboard-shell.tsx` nav (the `Fidelidade` nav item with `Stamp` icon) but has no `href` yet. Phase 4 adds the href and creates the page.

**Structure follows `equipe/page.tsx` pattern:**

```
src/app/(owner)/dashboard/fidelidade/
  page.tsx                        ← Server Component (fetches rule + client cards)
  components/
    fidelidade-client.tsx         ← 'use client' — list + resgatar button
    loyalty-card.tsx              ← individual client card with progress bar
    rule-config-drawer.tsx        ← drawer to configure stamps_required + reward_description
```

### Sub-flows

**1. Owner configures the loyalty rule**

- Page loads: if `loyalty_rules` row exists, show current config; else show "Configurar programa" CTA.
- Clicking "Configurar" opens `rule-config-drawer.tsx`.
- Drawer fields: `stamps_required` (number input, 1–100) + `reward_description` (text input).
- Submit calls `saveLoyaltyRule` Server Action → upserts `loyalty_rules`.
- On success: close drawer, revalidate page.

**2. Owner views client loyalty progress**

- List of clients who have at least 1 stamp, sorted by `active_stamps DESC` (most complete cards first).
- Each card shows: client name, whatsapp number, progress bar (`active_stamps / stamps_required`), stamp count badge ("7/10 carimbos").
- Clients with `active_stamps >= stamps_required` are highlighted (card full — ready to redeem).

**3. Owner redeems a completed card**

- "Resgatar recompensa" button visible only when `active_stamps >= stamps_required`.
- Clicking opens a confirmation dialog: "Resgatar [reward_description] para [client_name]?"
- Confirming calls `redeemLoyaltyCard(clientId, barbershopId)` Server Action.
- Action inserts into `loyalty_redemptions`, revalidates `/dashboard/fidelidade`.
- Active stamp count resets to 0 (stamps remain in DB; count restarts from new redemption point).

### Nav: add `href` to Fidelidade

```typescript
// dashboard-shell.tsx — change:
{ label: "Fidelidade", icon: Stamp },
// to:
{ label: "Fidelidade", icon: Stamp, href: "/dashboard/fidelidade" },
```

---

## Server Actions to Implement

### `saveLoyaltyRule`
```typescript
// src/app/actions/loyalty.ts
export async function saveLoyaltyRule(input: {
  stamps_required: number
  reward_description: string
  is_active: boolean
}): Promise<{ success: true } | { error: string }>
```
- Reads `barbershop_id` from JWT (never from input).
- Upserts `loyalty_rules` with `{ onConflict: 'barbershop_id' }`.
- Validates: `stamps_required` between 1–100, `reward_description` non-empty (max 200 chars).

### `redeemLoyaltyCard`
```typescript
export async function redeemLoyaltyCard(
  clientId: string
): Promise<{ success: true; stampsUsed: number } | { error: string }>
```
- Reads `barbershop_id` + `userId` from JWT.
- Fetches current active stamp count — confirms >= stamps_required (server-side guard).
- Fetches `stamps_required` from `loyalty_rules` (snapshot for `loyalty_redemptions.stamps_used`).
- Inserts into `loyalty_redemptions`.
- Uses `adminClient` for the insert (consistent with Phase 3 pattern).
- Revalidates `/dashboard/fidelidade`.

### `createStampOnComplete` (internal, not exported)
- Called only from `updateAppointmentStatus` — not a public Server Action.
- Uses `adminClient` for clean service-role insert.

---

## Pitfalls

### Pitfall 1: Double-stamping on retry
**What goes wrong:** Network error causes the COMPLETED status update to appear to fail client-side, user clicks "Marcar Concluído" again, a second stamp is inserted.
**Why it happens:** The first status update succeeded silently; the stamp insert also ran. The retry inserts a second stamp row with a new UUID.
**How to avoid:** `UNIQUE ON appointment_id` in `loyalty_stamps` is the primary guard. The `createStampOnComplete` helper handles `error.code === '23505'` (unique_violation) as a no-op — not an error.
**Warning signs:** Client shows N+1 stamps unexpectedly. Check `loyalty_stamps` for duplicate `appointment_id`.

### Pitfall 2: Stamp failure should not roll back COMPLETED status
**What goes wrong:** The stamp insert fails (e.g., `loyalty_rules.is_active = false` or transient DB error). If the code treats stamp failure as fatal and returns `{ error }`, the appointment remains COMPLETED in DB but the UI doesn't know — the barbeiro re-clicks and gets a conflict error.
**How to avoid:** Stamp creation is non-fatal. Log the error, but always return `{ success: true }` from `updateAppointmentStatus` if the status UPDATE itself succeeded. A missed stamp is recoverable (manual insert by admin); a stuck appointment status is not.

### Pitfall 3: Counting from wrong baseline after multiple redemptions
**What goes wrong:** Client has 15 stamps, redeemed once at stamp 10. Active count should be 5 (stamps 11–15). If code counts all stamps and subtracts `stamps_used` from `loyalty_redemptions`, multiple redemptions stack incorrectly.
**How to avoid:** Count stamps with `created_at > MAX(redemption.created_at)` — not `total_stamps - total_redeemed`. The "last redemption timestamp as reset point" approach handles any number of redemptions correctly.

### Pitfall 4: Race condition on redemption
**What goes wrong:** Two staff members simultaneously click "Resgatar" for the same client. Both read `active_stamps >= stamps_required` and both insert into `loyalty_redemptions`.
**How to avoid:** Add a check in `redeemLoyaltyCard` that re-reads the active stamp count **inside a transaction** (or with a row-level lock) before inserting. Simpler: add a `UNIQUE` constraint on `(barbershop_id, client_id, stamps_used)` — this won't fully prevent the race but reduces the window. For Phase 4 (low volume), documenting the risk and adding a server-side re-check before INSERT is sufficient. A full serializable transaction can be added if the problem surfaces.

### Pitfall 5: Supabase JS client `.select()` after `.insert()` returns wrong row type
**What goes wrong:** Using `supabase.from('loyalty_stamps').insert(...).select().single()` on a conflict — Supabase returns `null` data with no error when `ON CONFLICT DO NOTHING` swallows the row. Use `.maybeSingle()` not `.single()` when insert may be a no-op.
**How to avoid:** Use `admin.from('loyalty_stamps').insert({...})` without `.select()` for the stamp creation path (we don't need the returned row). Or use `.maybeSingle()` if the return value is needed.

### Pitfall 6: RLS policy blocks `adminClient` — misunderstanding
**What goes wrong:** Developer assumes `adminClient` (service role) is subject to RLS policies and adds extra `eq('barbershop_id', ...)` filters "just to be safe", then removes the `adminClient` import and switches to the authenticated client for unrelated reasons — now RLS blocks the insert because the barbeiro's JWT `barbershop_id` may differ from the appointment's.
**How to avoid:** `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely. The `barbershop_id` filter on stamp inserts is for data correctness, not security. Keep `adminClient` for all loyalty writes; never expose it to the client bundle.

---

## Implementation Plan Hints

Split into 3 plans:

### Plan 04-01: Migration + Core Logic
- Migration `20260603000001_phase4_schema.sql`: create `loyalty_rules`, `loyalty_stamps`, `loyalty_redemptions` with RLS and indexes.
- `src/app/actions/loyalty.ts`: `saveLoyaltyRule`, `redeemLoyaltyCard`, `createStampOnComplete`.
- Modify `updateAppointmentStatus` in `src/app/actions/appointments.ts` to call `createStampOnComplete` when `status === 'COMPLETED'`.
- Update `src/types/database.types.ts` (or regenerate from Supabase).

### Plan 04-02: Dashboard Page `/dashboard/fidelidade`
- `src/app/(owner)/dashboard/fidelidade/page.tsx` (Server Component).
- `src/app/(owner)/dashboard/fidelidade/components/fidelidade-client.tsx` (Client Component — list).
- `src/app/(owner)/dashboard/fidelidade/components/loyalty-card.tsx` (progress card).
- `src/app/(owner)/dashboard/fidelidade/components/rule-config-drawer.tsx` (configuration drawer).
- Wire `Fidelidade` nav item href in `dashboard-shell.tsx`.

### Plan 04-03: Tests + Verification
- Unit tests for `createStampOnComplete` — double-stamp idempotency, missing client_id.
- Unit tests for stamp counting query — zero stamps, stamps with one redemption, stamps with multiple redemptions.
- Integration smoke test: full flow `CONFIRMED → COMPLETED → stamp created → count = 1`.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 4 |
|-----------|-------------------|
| Every table has `barbershop_id UUID NOT NULL` with RLS enabled | All three new tables carry `barbershop_id`; RLS policies follow Phase 0 pattern |
| RLS policies read from JWT `app_metadata.barbershop_id` | Policies cast `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID` |
| Do NOT use Prisma, Stripe, Firebase, Auth.js, NextAuth | No external loyalty packages; native Postgres + Next.js |
| Server Actions: use adminClient for privileged writes | `createStampOnComplete` and `redeemLoyaltyCard` use `createAdminClient()` |
| Memory note: adminClient + profiles pattern | `barbershop_id` read from JWT in SA, not from function parameters |
| No external loyalty SaaS | Entire system is native to this codebase |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from Next.js 15 + project patterns) [ASSUMED] |
| Config file | `vitest.config.ts` (to be created in Wave 0 if absent) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| R4-1 | `saveLoyaltyRule` upserts correctly | unit | `vitest run tests/loyalty/saveLoyaltyRule.test.ts` |
| R4-2 | `createStampOnComplete` inserts stamp on COMPLETED | unit | `vitest run tests/loyalty/createStamp.test.ts` |
| R4-3 | Double-stamp on same appointment_id is no-op (unique violation handled) | unit | `vitest run tests/loyalty/createStamp.test.ts` |
| R4-4 | Active stamp count resets correctly after redemption | unit | `vitest run tests/loyalty/stampCount.test.ts` |
| R4-5 | `redeemLoyaltyCard` blocks if active_stamps < stamps_required | unit | `vitest run tests/loyalty/redeemLoyaltyCard.test.ts` |
| R4-6 | RLS: tenant cannot read another tenant's loyalty data | manual | Supabase Studio policy check |

---

## Open Questions (RESOLVED)

1. **Should stamp creation failure be surfaced to the barber?** — RESOLVED: Log silently (`console.error`) em Phase 4. Fire-and-forget não fatal. Toast deferido para fase futura.

2. **Should the loyalty program apply to ALL services or only specific ones?** — RESOLVED: Todos os serviços em Phase 4. `loyalty_rules` sem coluna `service_id`. Filtro por serviço é enhancement futuro.

3. **Does the Fidelidade page need Realtime updates?** — RESOLVED: Não. `revalidatePath('/dashboard/fidelidade')` na Server Action é suficiente para Phase 4.

---

## Sources

### Primary (HIGH confidence — code verified)
- `src/app/actions/appointments.ts` — `updateAppointmentStatus` pattern (where to hook stamp)
- `supabase/migrations/20260529000001_initial_schema.sql` — RLS policy pattern, JWT cast syntax
- `supabase/migrations/20260531000001_phase1_schema.sql` — Table + RLS pattern for multi-tenant tables
- `supabase/migrations/20260602000001_phase3_schema.sql` — `adminClient` + UNIQUE index idempotency pattern
- `src/lib/supabase/admin.ts` — `createAdminClient()` usage
- `src/components/shell/dashboard-shell.tsx` — Fidelidade nav item exists (no href yet)
- `src/app/(owner)/dashboard/equipe/page.tsx` — Server Component + Client Component split pattern

### Secondary (ASSUMED — training knowledge, not verified this session)
| Claim | Risk if Wrong |
|-------|---------------|
| Vitest is the test framework | Test commands may differ; check `package.json` scripts before Plan 04-03 |
| Supabase JS `maybeSingle()` behavior on `ON CONFLICT DO NOTHING` | Could return error instead of null — verify against Supabase JS v2 docs |

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — based on direct code inspection of existing migrations
- Auto-stamp approach: HIGH — based on direct reading of `updateAppointmentStatus` and established project patterns
- Stamp counting: HIGH — deterministic SQL, no external dependencies
- UI/UX: HIGH — follows established equipe/servicos page pattern exactly
- Test framework: LOW — not verified against `package.json`

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable stack — no fast-moving dependencies)
