# Phase 3: QR Check-In — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 7 (4 new + 3 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/YYYYMMDD_phase3_schema.sql` | migration | CRUD | `supabase/migrations/20260531000001_phase1_schema.sql` | exact |
| `src/app/actions/qr-checkin.ts` | service | request-response | `src/app/actions/public-booking.ts` | exact |
| `src/components/qr/appointment-qr-code.tsx` | component | request-response | `src/app/(public)/[slug]/booking/components/step-confirm.tsx` | role-match |
| `src/app/(public)/qr/check-in/page.tsx` | page (Server Component) | request-response | `src/app/(public)/[slug]/page.tsx` | exact |
| `src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx` (modify) | component | request-response | itself — extend existing file | exact |
| `src/app/(owner)/dashboard/agendamentos/page.tsx` (modify) | page (Server Component) | event-driven | itself — extend existing file | exact |
| `src/lib/hooks/use-check-in-notifications.ts` | hook | event-driven | `src/lib/supabase/client.ts` (browser client pattern) | partial |

---

## Pattern Assignments

### `supabase/migrations/YYYYMMDD_phase3_schema.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260531000001_phase1_schema.sql`

**File header pattern** (lines 1-9):
```sql
-- ============================================================
-- BarberFlow Phase 3 — QR Check-In Schema
-- Migration: 20260602000001_phase3_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies use barbershop_id join via appointments table.
-- ============================================================
```

**CREATE TABLE pattern** (phase1 lines 15-26):
```sql
CREATE TABLE public.used_qr_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL UNIQUE,        -- SHA-256 of HMAC token (never store raw)
  issued_at      TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  consumed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Note: no barbershop_id column — tenant isolation is via appointments FK.
-- RLS policy joins through appointments.barbershop_id.
```

**ENABLE RLS + policy pattern** (phase1 lines 28-37):
```sql
ALTER TABLE public.used_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only — tokens are consumed exclusively via adminClient in Server Actions.
-- No authenticated policy needed: dashboard reads appointment status, not token rows.
-- Anon INSERT policy needed so the check-in page Server Action (unauthenticated caller)
-- can mark tokens consumed via adminClient (service role bypasses this).
```

**Tenant RLS cast pattern** (phase1 lines 31-37):
```sql
CREATE POLICY "tenant_used_qr_tokens_all" ON public.used_qr_tokens
  FOR ALL TO authenticated
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );
```

**Index pattern** (phase2 analog — ADD CONSTRAINT section):
```sql
-- Index to speed up token_hash lookups during verification
CREATE INDEX IF NOT EXISTS used_qr_tokens_hash_idx
  ON public.used_qr_tokens (token_hash);

-- Index to speed up per-appointment consumed-token checks
CREATE INDEX IF NOT EXISTS used_qr_tokens_appointment_idx
  ON public.used_qr_tokens (appointment_id);
```

---

### `src/app/actions/qr-checkin.ts` (service, request-response)

**Analog:** `src/app/actions/public-booking.ts` + `src/app/actions/appointments.ts`

**File header + imports pattern** (public-booking.ts lines 1-5):
```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
```

**Return type discriminated union pattern** (public-booking.ts lines 112-115):
```typescript
// All Server Actions return a discriminated union — never throw to the client
type GenerateQrTokenResult =
  | { data: { token: string; expiresAt: string } }
  | { error: string }

type ProcessCheckInResult =
  | { success: true; appointmentId: string }
  | { error: string }
```

**Authenticated action pattern** (appointments.ts lines 19-24):
```typescript
// generateQrToken — requires owner auth (JWT claims)
export async function generateQrToken(
  appointmentId: string
): Promise<GenerateQrTokenResult> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }
```

**adminClient usage pattern** (public-booking.ts lines 286-305):
```typescript
  // Use adminClient for privileged writes — bypasses RLS
  const admin = createAdminClient()

  const { error: insertError } = await admin
    .from('used_qr_tokens')
    .insert({
      appointment_id: appointmentId,
      token_hash: hash,          // SHA-256 of raw HMAC token
      issued_at: issuedAt,
      expires_at: expiresAt,
    })

  if (insertError) return { error: insertError.message }
```

**Error handling + catch-all pattern** (public-booking.ts lines 358-361):
```typescript
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
```

**revalidatePath pattern** (appointments.ts lines 37-39):
```typescript
  revalidatePath('/dashboard/agendamentos')
  revalidatePath(`/dashboard`)
  return { success: true }
```

**processQrCheckIn** — public caller, uses adminClient only:
```typescript
// processQrCheckIn — called from public check-in page (no JWT)
// Uses adminClient exclusively — no createClient() needed
export async function processQrCheckIn(
  rawToken: string
): Promise<ProcessCheckInResult> {
  try {
    const admin = createAdminClient()
    // 1. Parse + verify HMAC signature
    // 2. Check time window (±30 min from appointment.start_time)
    // 3. Check token not already consumed (SELECT used_qr_tokens WHERE token_hash = hash)
    // 4. UPDATE appointments SET status='CHECKED_IN'
    // 5. INSERT used_qr_tokens (single-use enforcement)
    // 6. revalidatePath('/dashboard/agendamentos')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

---

### `src/components/qr/appointment-qr-code.tsx` (component, request-response)

**Analog:** `src/app/(public)/[slug]/booking/components/step-confirm.tsx`

**'use client' + imports pattern** (step-confirm.tsx lines 1-3):
```typescript
'use client'

import { QRCodeSVG } from 'qrcode.react'  // or react-qr-code
import { Button } from '@/components/ui/button'
```

**Props interface pattern** (step-confirm.tsx lines 6-16):
```typescript
interface AppointmentQrCodeProps {
  appointmentId: string
  token: string           // raw HMAC token (URL-safe)
  expiresAt: string       // ISO UTC string
  serviceName: string
  barberName: string
  startTime: string       // ISO UTC string
  timezone: string
}
```

**Card + summary layout pattern** (step-confirm.tsx lines 80-105):
```typescript
// Dark card with border — mirrors step-confirm summary card
<div className="w-full rounded-xl border border-white/[0.07] bg-[#0b0f17] p-4">
  <dl className="flex flex-col gap-3 text-sm">
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--text-secondary)]">Serviço</dt>
      <dd className="font-medium text-foreground">{serviceName}</dd>
    </div>
    <div className="h-px bg-white/[0.06]" />
    {/* ... */}
  </dl>
</div>
```

**Timezone formatting pattern** (step-confirm.tsx lines 41-55):
```typescript
const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
  timeZone: timezone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(startTime))
```

**Status badge pattern** (step-confirm.tsx lines 75-78):
```typescript
// QR component uses purple for CHECKED_IN (mirrors appointment-list STATUS_CONFIG)
<div className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-purple-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-400">
  <span className="size-1.5 rounded-full bg-purple-400" />
  QR Check-In
</div>
```

---

### `src/app/(public)/qr/check-in/page.tsx` (page, request-response)

**Analog:** `src/app/(public)/[slug]/page.tsx`

**Server Component + notFound pattern** (slug/page.tsx lines 1-6):
```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
// No createClient() needed — processQrCheckIn uses adminClient internally
```

**searchParams pattern** (Next.js 15 async params — same as slug page):
```typescript
type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function QrCheckInPage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) notFound()
  // call processQrCheckIn(token) server-side
```

**Public page layout pattern** (slug/page.tsx lines 51-65):
```typescript
// Minimal public layout — no DashboardShell, no auth check
<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
  <div className="w-full max-w-[480px]">
    {/* Brand mark */}
    <div className="mb-8 flex items-center justify-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
        B
      </div>
      <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
        BARBERFLOW
      </span>
    </div>
    {/* Result card */}
  </div>
</div>
```

**Error / success split pattern** (step-confirm.tsx success icon):
```typescript
// Success state — mirrors step-confirm CheckCircle
import { CheckCircle, XCircle } from 'lucide-react'

// success:
<div className="flex size-16 items-center justify-center rounded-full bg-[#d4a574]/15">
  <CheckCircle className="size-9 text-[#d4a574]" />
</div>

// error:
<div className="flex size-16 items-center justify-center rounded-full bg-red-500/15">
  <XCircle className="size-9 text-red-400" />
</div>
```

---

### `src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx` (modify)

**Source file:** itself — read current state above (lines 1-119)

**Current CHECKED_IN block to be extended** (lines 82-91):
```typescript
// Already has CHECKED_IN → COMPLETED transition. Phase 3 adds QR button for CONFIRMED status.
{status === 'CHECKED_IN' && (
  <Button
    size="sm"
    disabled={isLoading}
    onClick={handleComplete}
    className="h-8 gap-1.5 bg-green-600 text-xs font-semibold text-white hover:bg-green-700"
  >
    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
    Marcar Concluido
  </Button>
)}
```

**New addition — QR button for CONFIRMED status** (copy Button pattern from lines 71-79):
```typescript
// Add after existing PENDING→CONFIRMED button
{status === 'CONFIRMED' && (
  <Button
    size="sm"
    disabled={isLoading}
    onClick={handleShowQr}            // opens QR dialog/sheet
    className="h-8 gap-1.5 bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700"
  >
    <QrCode className="h-3.5 w-3.5" />
    QR Check-In
  </Button>
)}
```

**Error display pattern** (lines 64-68 — reuse as-is):
```typescript
{error && (
  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
    {error}
  </p>
)}
```

**Async handler pattern** (lines 19-30 — copy for generateQrToken call):
```typescript
const handleShowQr = async () => {
  setIsLoading(true)
  setError(null)
  try {
    const result = await generateQrToken(appointment.id)
    if ('error' in result) {
      setError(result.error)
    } else {
      setQrData(result.data)   // { token, expiresAt }
      setQrOpen(true)
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro inesperado')
  } finally {
    setIsLoading(false)
  }
}
```

---

### `src/app/(owner)/dashboard/agendamentos/page.tsx` (modify)

**Source file:** itself — read current state above (lines 1-73)

**Current Server Component structure** (lines 23-45):
```typescript
export default async function AgendamentosPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) redirect('/entrar')

  const claims = claimsData.claims
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) redirect('/onboarding')
  // ... fetch + render
```

**Modification strategy — pass barbershop_id to client component:**
```typescript
// Page remains Server Component — does NOT add useEffect/Realtime
// Instead, passes barbershop_id as prop to a new 'use client' wrapper
// that mounts the Realtime subscription

// Existing JSX — add wrapper:
<AppointmentList
  appointments={(appointments ?? []) as AppointmentWithDetails[]}
  barbershopId={barbershop_id}   // NEW prop — enables Realtime in client
/>
```

---

### `src/lib/hooks/use-check-in-notifications.ts` (hook, event-driven)

**Analog:** `src/lib/supabase/client.ts` (browser client — Realtime requires browser client)

**Browser client import pattern** (client.ts lines 1-9):
```typescript
// hooks always import from browser client, never from server client
import { createClient } from '@/lib/supabase/client'
```

**Realtime channel pattern** (Supabase docs — no existing hook in codebase yet):
```typescript
'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCheckInNotifications(
  barbershopId: string,
  onCheckIn: (appointmentId: string) => void
) {
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`checkin-${barbershopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        (payload) => {
          if (payload.new.status === 'CHECKED_IN') {
            onCheckIn(payload.new.id as string)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [barbershopId, onCheckIn, supabase])
}
```

---

## Shared Patterns

### Server Action authentication (applies to `generateQrToken`)
**Source:** `src/app/actions/appointments.ts` lines 19-24
```typescript
const supabase = await createClient()
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
if (claimsError || !claimsData) return { error: 'Não autenticado' }

const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
if (!barbershop_id) return { error: 'Barbearia não configurada' }
```
**Apply to:** `generateQrToken` in `src/app/actions/qr-checkin.ts`

### adminClient privileged writes (applies to both actions)
**Source:** `src/lib/supabase/admin.ts` lines 1-22
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
// ...
const admin = createAdminClient()
const { data, error } = await admin.from('used_qr_tokens').insert({ ... })
```
**Apply to:** `generateQrToken` (record issued token) + `processQrCheckIn` (consume token + update appointment status)

### Double filter: id + barbershop_id (belt-and-suspenders)
**Source:** `src/app/actions/appointments.ts` lines 26-33
```typescript
const { error } = await supabase
  .from('appointments')
  .update({ status, updated_at: new Date().toISOString() })
  .eq('id', appointmentId)
  .eq('barbershop_id', barbershop_id)   // belt-and-suspenders with RLS
```
**Apply to:** All appointment UPDATE calls in `src/app/actions/qr-checkin.ts`

### RLS migration: JWT cast
**Source:** `supabase/migrations/20260531000001_phase1_schema.sql` lines 31-37
```sql
USING (
  barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
)
```
**Apply to:** Any `used_qr_tokens` authenticated RLS policy (via appointments join)

### Public page layout (no DashboardShell)
**Source:** `src/app/(public)/[slug]/page.tsx` lines 51-65
```typescript
<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
  <div className="w-full max-w-[480px]">
    {/* Brand mark + card */}
  </div>
</div>
```
**Apply to:** `src/app/(public)/qr/check-in/page.tsx`

### Status badge color system
**Source:** `src/app/(owner)/dashboard/agendamentos/components/appointment-list.tsx` lines 11-32
```typescript
CHECKED_IN: {
  label: 'Check-in',
  className: 'border-purple-500/30 bg-purple-500/15 text-purple-400',
},
```
**Apply to:** QR button (`bg-purple-600`) and check-in result badge — use purple consistently for CHECKED_IN state

### Catch-all error wrapper
**Source:** `src/app/actions/public-booking.ts` lines 358-361
```typescript
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
```
**Apply to:** Both Server Actions in `src/app/actions/qr-checkin.ts`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| HMAC token generation/verification logic | utility | transform | No cryptographic utilities exist yet — use Node.js `crypto.createHmac('sha256', secret)` per RESEARCH.md |
| `react-qr-code` / `qrcode.react` QR rendering | component | transform | No QR components exist yet — install `react-qr-code` and use `<QRCodeSVG value={url} size={200} />` |

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/app/(public)/`, `src/app/(owner)/dashboard/agendamentos/`, `src/lib/supabase/`, `supabase/migrations/`
**Files scanned:** 14
**Pattern extraction date:** 2026-06-01
