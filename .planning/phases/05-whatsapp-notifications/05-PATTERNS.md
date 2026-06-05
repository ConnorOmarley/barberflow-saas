# Phase 5: WhatsApp Notifications — Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/twilio.ts` | utility/client-singleton | request-response | `src/lib/supabase/admin.ts` | role-match |
| `src/app/actions/whatsapp.ts` | service | request-response | `src/app/actions/qr-checkin.ts` | exact |
| `src/app/actions/appointments.ts` (hook) | service | event-driven | `src/app/actions/appointments.ts` (createStampOnComplete) | exact |
| `supabase/functions/send-reminders/index.ts` | service | batch/cron | none (no Edge Functions exist) | no-analog |
| `supabase/migrations/20260605000001_phase5_schema.sql` | migration | — | `supabase/migrations/20260603000001_phase4_schema.sql` | exact |
| `src/app/(public)/[slug]/booking/components/step-client.tsx` (modify) | component | request-response | itself (already has opt-in checkbox) | exact |
| `src/app/(owner)/dashboard/configuracoes/page.tsx` (new page) | component/page | CRUD | `src/app/(owner)/dashboard/fidelidade/page.tsx` | exact |

---

## Pattern Assignments

### `src/lib/twilio.ts` (utility singleton)

**Analog:** `src/lib/supabase/admin.ts`

**Imports + singleton pattern** (`src/lib/supabase/admin.ts` lines 1–22):
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

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

**Pattern to copy:** factory function (not a module-level singleton) — called per-request inside Server Actions. Access env vars directly with `process.env.VAR!`. No caching needed because Next.js Server Actions are ephemeral.

**New file shape:**
```typescript
// src/lib/twilio.ts
// Use ONLY in Server Actions and Edge Functions, never in 'use client' files.
import twilio from 'twilio'

export function createTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

export const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM! // 'whatsapp:+14155238886'
```

**Env vars to add to `.env.local`** (pattern from `.env.local.example`):
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

### `src/app/actions/whatsapp.ts` (Server Action — send messages)

**Analog:** `src/app/actions/qr-checkin.ts`

**File header pattern** (`qr-checkin.ts` lines 1–6):
```typescript
'use server'

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
```

**adminClient-only pattern** (no JWT auth required — uses appointment ID as input, fetches all data server-side):
```typescript
// src/app/actions/qr-checkin.ts lines 133–140
const admin = createAdminClient()
const { data: appointment } = await admin
  .from('appointments')
  .select('id, status, start_time, barbershop_id, clients(full_name)')
  .eq('id', appointmentId)
  .single()

if (!appointment) return { error: 'Agendamento não encontrado' }
```

**Error handling pattern** (`qr-checkin.ts` lines 97–100 and 195–198):
```typescript
export async function processQrCheckIn(
  token: string
): Promise<{ success: true; clientName: string; appointmentId: string } | { error: string }> {
  try {
    // ...
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

**Return type convention** — all Server Actions return `{ success: true } | { error: string }` or `{ data: T } | { error: string }`.

**New file shape:**
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createTwilioClient, TWILIO_WHATSAPP_FROM } from '@/lib/twilio'

export async function sendWhatsAppConfirmation(
  appointmentId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    // 1. Fetch appointment + client + barbershop + service (single query with joins)
    // 2. Guard: whatsapp_opt_in must be true (LGPD)
    // 3. Guard: barbershop.whatsapp_notify_confirmation must be true
    // 4. Send via Twilio
    // 5. INSERT into whatsapp_message_log
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

---

### `src/app/actions/appointments.ts` — fire-and-forget hook at status → CONFIRMED

**Analog:** itself — `createStampOnComplete` call on status === 'COMPLETED' (lines 93–96)

**Exact fire-and-forget pattern** (`appointments.ts` lines 93–96):
```typescript
// Auto-stamp: fire-and-forget — falha nunca bloqueia status update
if (status === 'COMPLETED') {
  void createStampOnComplete(appointmentId, barbershop_id)
}
```

**Where to add the WhatsApp hook** — replicate this block at two callsites:
1. In `updateAppointmentStatus` when `status === 'CONFIRMED'` (line 94 area)
2. In `createAppointment` after the successful INSERT (line 243 area, since new appointments start as `'CONFIRMED'`)

**Pattern:**
```typescript
// Fire-and-forget — falha NUNCA bloqueia o status update
if (status === 'CONFIRMED') {
  void sendWhatsAppConfirmation(appointment.id)
}
```

**Import to add at top of `appointments.ts`:**
```typescript
import { sendWhatsAppConfirmation } from '@/app/actions/whatsapp'
```

**CRITICAL NOTE:** The file already has a comment at line 14:
> "Duplicado intencionalmente de loyalty.ts para evitar import circular entre Server Actions (Next.js não suporta imports circulares em 'use server')."

`whatsapp.ts` is a new file and `appointments.ts` imports FROM it (one-way), so there is no circular dependency. The import is safe.

---

### `supabase/functions/send-reminders/index.ts` (Deno Edge Function — cron)

**No direct analog** — no Edge Functions exist in this codebase yet.

**Project context from `supabase/config.toml`** — standard Supabase Edge Function scaffold. Must use Deno runtime.

**Pattern from RESEARCH + project conventions:**
```typescript
// supabase/functions/send-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')!

Deno.serve(async (_req) => {
  // ...cron logic...
  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Env vars in Edge Functions:** Use `Deno.env.get('VAR')!` — NOT `process.env`. This is the Deno vs Node distinction.

**Cron config** goes in `supabase/config.toml`:
```toml
[functions.send-reminders]
schedule = "0 * * * *"  # every hour
```

---

### Migration `supabase/migrations/20260605000001_phase5_schema.sql`

**Analog:** `supabase/migrations/20260603000001_phase4_schema.sql`

**File header pattern** (phase4 lines 1–9):
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

**RLS policy pattern** (phase4 lines 36–44):
```sql
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

**Table pattern with barbershop_id FK** (phase4 lines 25–33):
```sql
CREATE TABLE public.loyalty_rules (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id       UUID        NOT NULL UNIQUE REFERENCES public.barbershops(id) ON DELETE CASCADE,
  -- ...other columns...
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**What this migration needs to do:**
1. `ALTER TABLE public.barbershops ADD COLUMN whatsapp_reminder_hours SMALLINT NOT NULL DEFAULT 24`
2. `ALTER TABLE public.barbershops ADD COLUMN whatsapp_notify_confirmation BOOLEAN NOT NULL DEFAULT true`
3. `ALTER TABLE public.barbershops ADD COLUMN whatsapp_notify_reminder BOOLEAN NOT NULL DEFAULT true`
4. `CREATE TABLE public.whatsapp_message_log` — with `barbershop_id`, `client_id`, `appointment_id`, `message_type` (TEXT CHECK IN ('confirmation','reminder')), `sent_at`, `status`, `error_message`
5. RLS on `whatsapp_message_log` — authenticated + anon read for own tenant

**Naming convention:** `YYYYMMDDHHMMSS_phase5_schema.sql` — use date `20260605000001`.

---

### `src/app/(public)/[slug]/booking/components/step-client.tsx` (modify — opt-in already exists)

**This file already has the opt-in checkbox.** No structural changes needed.

**Current opt-in implementation** (`step-client.tsx` lines 114–132):
```tsx
{/* Opt-in WhatsApp (LGPD — T-02-12) */}
<div className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
  <Checkbox
    id="whatsapp-optin"
    checked={optIn}
    onCheckedChange={(checked) => {
      const value = checked === true
      setOptIn(value)
      setValue('whatsapp_opt_in', value)
    }}
    className="mt-0.5"
  />
  <Label
    htmlFor="whatsapp-optin"
    className="cursor-pointer text-sm font-normal leading-snug text-[var(--text-secondary)]"
  >
    Aceito receber lembretes e confirmações pelo WhatsApp
  </Label>
</div>
```

**Schema** (`step-client.tsx` lines 16–23):
```typescript
const clientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  whatsapp_number: z
    .string()
    .min(10, 'Número inválido')
    .regex(/^\+?[\d\s\-()]+$/, 'Formato inválido'),
  whatsapp_opt_in: z.boolean().default(false),
})
```

**The `whatsapp_opt_in` field already flows to `createPublicAppointment`** via `booking-wizard.tsx` lines 102–105. The Server Action already writes `opt_in_source: 'booking_portal'` and `opt_in_timestamp` to the `clients` table.

**Only change needed (Phase 5):** Update the label text to mention specific notification types if desired. No structural changes.

---

### `src/app/(owner)/dashboard/configuracoes/page.tsx` (new settings page)

**Analog:** `src/app/(owner)/dashboard/fidelidade/page.tsx`

**Page structure pattern** (`fidelidade/page.tsx` lines 1–85):
```typescript
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { FidelidadeClient } from './components/fidelidade-client'
import type { Database } from '@/types/database.types'

export const metadata: Metadata = {
  title: 'Fidelidade — BarberFlow',
}

export default async function FidelidadePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) redirect('/onboarding')

  // ... fetch data for the page ...

  return (
    <DashboardShell displayName={displayName} email={email}>
      <FidelidadeClient ... />
    </DashboardShell>
  )
}
```

**Auth guard pattern** (same across all dashboard pages): `getClaims()` → check `barbershop_id` → `redirect('/onboarding')`.

**Settings form pattern** — use `LoyaltyConfigSheet` in `fidelidade/components/loyalty-config.tsx` as template for a `ConfiguracoesWhatsAppSheet`:
- Sheet with right-side panel
- React Hook Form + Zod
- `upsertLoyaltyRule` call pattern → replace with new `updateWhatsAppSettings` Server Action
- Error state: `const [errorMessage, setErrorMessage] = useState<string | null>(null)`

**Settings Server Action pattern** — use `upsertLoyaltyRule` in `src/app/actions/loyalty.ts` (lines 131–174) as template:
```typescript
export async function updateWhatsAppSettings(data: {
  whatsapp_reminder_hours: number
  whatsapp_notify_confirmation: boolean
  whatsapp_notify_reminder: boolean
}): Promise<{ data: { id: string } } | { error: string }> {
  try {
    const ctx = await getAuthContext()  // same helper as loyalty.ts lines 21–48
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from('barbershops')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', ctx.barbershopId)
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/dashboard/configuracoes')
    return { data: { id: updated.id } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

---

## Shared Patterns

### Auth Context Helper
**Source:** `src/app/actions/loyalty.ts` lines 21–48
**Apply to:** `src/app/actions/whatsapp.ts` (settings read), new barbershop settings action
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

### Fire-and-Forget Pattern
**Source:** `src/app/actions/appointments.ts` lines 93–96
**Apply to:** All callsites where WhatsApp send should not block the primary operation
```typescript
// Fire-and-forget — falha NUNCA bloqueia a operação principal
void sendWhatsAppConfirmation(appointmentId)
```
Note: use `void` (not `await`) — if WhatsApp fails, the appointment/status update must succeed.

### AdminClient-Only Server Action
**Source:** `src/app/actions/qr-checkin.ts` lines 1–4, 133–136
**Apply to:** `src/app/actions/whatsapp.ts` — no user JWT needed, appointment ID is the entry point
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// No createClient() call, no getClaims() — adminClient fetches all data
const admin = createAdminClient()
const { data: appointment } = await admin
  .from('appointments')
  .select('id, status, start_time, barbershop_id, clients(full_name, whatsapp_number, whatsapp_opt_in)')
  .eq('id', appointmentId)
  .single()
```

### LGPD Opt-In Guard
**Source:** `src/app/actions/public-booking.ts` lines 294–296 + CLAUDE.md constraint
**Apply to:** `src/app/actions/whatsapp.ts` (both functions)
```typescript
// Never send messages without whatsapp_opt_in = true (LGPD — CLAUDE.md)
if (!appointment.clients?.whatsapp_opt_in) {
  return { success: true } // silent no-op, not an error
}
```

### RLS Policy (Tenant Isolation)
**Source:** `supabase/migrations/20260603000001_phase4_schema.sql` lines 36–44
**Apply to:** `whatsapp_message_log` table in new migration
```sql
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_whatsapp_log_all" ON public.whatsapp_message_log
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

### Error Handling (try/catch wrapper)
**Source:** All Server Actions in `src/app/actions/` — universal pattern
**Apply to:** All new Server Actions
```typescript
try {
  // ... logic ...
  return { success: true }
} catch (err) {
  console.error('[whatsapp] functionName error:', err)
  return { error: err instanceof Error ? err.message : 'Erro inesperado' }
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/functions/send-reminders/index.ts` | service | batch/cron | No Supabase Edge Functions exist in this codebase yet — use Supabase docs pattern with `Deno.env.get()` and `Deno.serve()` |

---

## Key Observations for Planner

1. **`step-client.tsx` already has the opt-in checkbox** — `whatsapp_opt_in` is already in the Zod schema, already flows through `booking-wizard.tsx` → `createPublicAppointment` → upserted on `clients` table. Phase 5 needs zero structural changes here; only a label text update is optional.

2. **`whatsapp_opt_in` is already stored** in `clients` table from Phase 2. The column exists. No migration needed for the client table.

3. **`createAppointment` in `appointments.ts` always sets `status: 'CONFIRMED'`** (line 236) — so the WhatsApp confirmation hook must fire here too, not only in `updateAppointmentStatus`.

4. **No `/dashboard/configuracoes/` page exists yet** — the directory does not exist. Create full new page + components.

5. **Edge Function env vars** use `Deno.env.get()`, not `process.env` — different from all other files in this codebase.

6. **Migration file naming:** last migration is `20260603000001` — use `20260605000001` for Phase 5.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/lib/`, `src/app/(public)/[slug]/booking/`, `src/app/(owner)/dashboard/`, `supabase/migrations/`
**Files scanned:** 12
**Pattern extraction date:** 2026-06-05
