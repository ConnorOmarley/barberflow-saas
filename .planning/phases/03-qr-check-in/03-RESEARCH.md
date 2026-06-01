# Phase 3: QR Check-In — Research

**Researched:** 2026-06-01
**Domain:** QR code generation, HMAC token signing, camera-based scanning, PostgreSQL single-use tokens
**Confidence:** HIGH

---

## Summary

Phase 3 implements a touchless check-in flow: a confirmed appointment gets a URL-encoded HMAC-signed token; the client scans it with their phone camera; the server validates the token, enforces the ±30-minute window, and atomically marks it consumed before setting the appointment status to `CHECKED_IN`.

No new auth mechanism is needed — the token itself carries all necessary claims. The entire verification happens inside a Server Action using the `adminClient` (service role), which already exists in `src/lib/supabase/admin.ts`. The dashboard owner view gets a Supabase Realtime broadcast subscription to show live arrivals.

**Primary recommendation:** Use `react-qr-code` (SVG, actively maintained) for generation and `jsQR` (pure JS, November 2025 update, no DOM dependencies) for scanning. Token signing uses Node.js native `crypto.createHmac` inside Server Actions (Node.js runtime, not Edge). Single-use enforcement uses PostgreSQL `INSERT ... ON CONFLICT DO NOTHING RETURNING id` — atomically safe at the DB layer.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token generation (HMAC sign) | API / Backend (Server Action) | — | Secret key must never reach client; signing happens server-side and returns a URL |
| QR code rendering (SVG) | Browser / Client | — | `react-qr-code` renders SVG from the URL string; no server round-trip needed |
| QR scan (camera) | Browser / Client | — | `getUserMedia` + `jsQR` loop runs in the browser on the client's device |
| Token verification | API / Backend (Server Action) | — | HMAC re-computation, time window check, single-use lookup — all server-side |
| Single-use enforcement | Database / Storage | API / Backend | UNIQUE constraint + `ON CONFLICT DO NOTHING` — DB enforces, server checks return value |
| Status update (CHECKED_IN) | API / Backend (Server Action) | Database / Storage | Server Action calls `adminClient.update` — bypasses RLS for public unauthenticated scan |
| Live arrival notification | Browser / Client | API / Backend | Supabase Realtime Broadcast channel; Server Action fires `realtime.send()` after update |

---

## Package Decisions

### QR Generation: `react-qr-code` v2.0.21

**Decision:** Use `react-qr-code`.

**Rationale:**
- Generates pure SVG — no Canvas, no DOM APIs at import time [VERIFIED: github.com/rosskhanas/react-qr-code]
- Last published **2026-04-29** — actively maintained [VERIFIED: npm registry]
- No hydration risk: used inside a `'use client'` component that renders after mount; the `value` prop is just a string (the check-in URL), so SSR and CSR output match deterministically
- API is a single React component: `<QRCode value={url} size={200} level="M" />`
- slopcheck: [OK]

**Rejected:** `qrcode.react` v4.2.0 (last publish December 2024 — still viable, but react-qr-code is more recent and SVG-only), `next-qrcode` (wrapper with unnecessary overhead).

### QR Scanner: `jsQR` v1.4.0

**Decision:** Use `jsQR` directly with a hand-rolled `useEffect` camera loop.

**Rationale:**
- Last published **2025-11-13** — the most recently maintained standalone QR decoder available [VERIFIED: npm registry]
- Pure JavaScript decoder — no native dependencies, no worker file to configure [VERIFIED: npm registry description]
- Works with any `ImageData` source; integrates with standard `getUserMedia` + `<canvas>` pattern
- No DOM manipulation at import time — safe to use in Next.js App Router client components with `'use client'`
- ~35 kB minified

**Rejected:**
- `html5-qrcode` v2.3.8 — last published **2023-04-15**, explicitly in "maintenance mode, author not merging PRs" [CITED: github.com/mebjas/html5-qrcode README]. Uses an internal DOM element (`div` injection) that causes issues with React reconciliation.
- `qr-scanner` v1.4.2 — last published **2022-11-23**, uses a WebWorker that requires copying `qr-scanner-worker.min.js` to `/public`, adds bundler configuration complexity.
- `@zxing/browser` v0.2.0 — designed for 1D barcodes + QR but heavier; no recent releases visible.

**slopcheck results:** react-qr-code [OK], html5-qrcode [OK], qr-scanner [OK], jsqr [OK] — all passed.

### HMAC: Node.js native `crypto` (no new package)

**Decision:** Use `crypto.createHmac('sha256', secret)` from Node.js built-in module.

**Rationale:**
- Server Actions run on the **Node.js runtime** (not Edge) by default in Next.js 15 App Router [CITED: nextjs.org/docs/app/api-reference/edge]
- `crypto` is available and verified working on Node.js v24.15.0 (current environment) [VERIFIED: local runtime]
- Zero new dependencies

**Important caveat:** `crypto.createHmac` is NOT available in Edge Runtime (middleware). Since the check-in route `/qr/[token]` is a public slug route (matches the `isPublicSlug` bypass in `middleware.ts`), middleware never runs HMAC logic — safe.

**Installation:**
```bash
npm install react-qr-code jsqr
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Last Publish | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| react-qr-code | npm | ~6 yrs | 2026-04-29 | [OK] | Approved |
| jsqr | npm | ~8 yrs | 2025-11-13 | [OK] | Approved |
| html5-qrcode | npm | ~6 yrs | 2023-04-15 | [OK] | REJECTED (unmaintained) |
| qr-scanner | npm | ~7 yrs | 2022-11-23 | [OK] | REJECTED (unmaintained) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## HMAC Token Design

### Payload Format

```
{appointment_id}|{issued_at_unix}|{expires_at_unix}
```

Example:
```
550e8400-e29b-41d4-a716-446655440000|1748822400|1748826000
```

- `issued_at_unix`: Unix timestamp (seconds) at generation time
- `expires_at_unix`: `appointment_start_time_unix` — should NOT be `issued_at + window`; instead it is derived from the appointment's `start_time` at generation, so the window is anchored to the appointment, not when the QR was displayed

### Signing Algorithm

```typescript
// Source: Node.js built-in crypto — verified working in Node v24.15.0
import crypto from 'crypto'

function signToken(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
```

### Token Structure in URL

The check-in URL encodes `payload` and `signature` as separate base64url query parameters for debuggability:

```
/qr/check-in?t=<base64url(payload)>&s=<hex_signature>
```

Where:
- `t` = `Buffer.from(payload).toString('base64url')` — base64url-encoded payload (URL-safe, no `+`/`/`/`=`)
- `s` = hex HMAC signature (64 hex chars)

Alternatively, combine into a single opaque token:
```
/qr/check-in?token=<base64url(payload)>.<hex_sig>
```

**Recommendation:** Use the single `?token=` param with `.` separator — simpler QR string = smaller QR code = easier to scan.

```typescript
// Encode
const payload = `${appointmentId}|${issuedAt}|${expiresAt}`
const sig = signToken(payload, process.env.QR_HMAC_SECRET!)
const token = `${Buffer.from(payload).toString('base64url')}.${sig}`
const url = `${process.env.NEXT_PUBLIC_APP_URL}/qr/check-in?token=${token}`

// Decode
const [encodedPayload, signature] = token.split('.')
const rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8')
const [appointmentId, issuedAtStr, expiresAtStr] = rawPayload.split('|')
```

### Secret Management

- Secret stored as `QR_HMAC_SECRET` environment variable
- Minimum 32 bytes (256-bit) random secret
- Never exposed to client: only used in Server Actions and server-side route handlers
- Add to `.env.local` and Supabase Edge Function secrets (if needed later)

### Time Window Verification

```typescript
const now = Math.floor(Date.now() / 1000)
const WINDOW_SECONDS = 30 * 60  // 30 minutes

// appointment_start_time comes from DB lookup (not from token — prevents tampering)
const appointmentStartUnix = Math.floor(new Date(appointment.start_time).getTime() / 1000)

const windowStart = appointmentStartUnix - WINDOW_SECONDS
const windowEnd   = appointmentStartUnix + WINDOW_SECONDS

if (now < windowStart || now > windowEnd) {
  return { error: 'QR inválido fora do horário permitido' }
}
```

**Critical:** `expires_at` in the payload is used only for HMAC integrity — the actual time check uses `appointment.start_time` fetched fresh from the DB at verification time, preventing clock-drift attacks where a client manipulates `expires_at`.

---

## QR Code Flow (End-to-End)

```
[Server Action: generateQrToken]
  └─ Input: appointmentId (authenticated user's appointment)
  └─ Fetch appointment.start_time from DB (verify ownership)
  └─ Compute: issuedAt = now, expiresAt = start_time (anchor)
  └─ Payload: "{appointmentId}|{issuedAt}|{expiresAt}"
  └─ Sig: HMAC-SHA256(payload, QR_HMAC_SECRET)
  └─ Token: base64url(payload) + "." + hexSig
  └─ Returns: checkInUrl = "/qr/check-in?token={token}"

[Client Component: AppointmentQRCode]
  └─ Receives checkInUrl as prop
  └─ Renders: <QRCode value={checkInUrl} size={200} level="M" />
  └─ Client scans QR with phone camera → phone camera app opens URL

[Next.js Route: /qr/check-in?token=...]
  └─ Server Component fetches token from searchParams
  └─ Passes token to QrCheckInProcessor (client component with camera UI)
  OR
  └─ Auto-processes token server-side and shows result page (simpler)

[Server Action: processQrCheckIn]
  └─ Input: token string (from URL query param)
  └─ 1. Decode: split on ".", decode base64url payload
  └─ 2. Re-compute HMAC → compare with provided sig (constant-time compare)
  └─ 3. Fetch appointment from DB by appointmentId
  └─ 4. Check status == 'CONFIRMED' (not already CHECKED_IN, COMPLETED, CANCELLED)
  └─ 5. Check time window: now within [start_time - 30min, start_time + 30min]
  └─ 6. Atomic INSERT into used_qr_tokens (token_hash, appointment_id)
         ON CONFLICT (token_hash) DO NOTHING RETURNING id
         → If 0 rows returned: token already used → reject
  └─ 7. UPDATE appointment SET status='CHECKED_IN', updated_at=NOW()
  └─ 8. Broadcast via Supabase Realtime to barbershop channel
  └─ Returns: { success: true, appointment: {...} } | { error: string }
```

### QR Revocation on Cancel/Reschedule

When `cancelAppointment` is called (existing `src/app/actions/appointments.ts`), add:

```typescript
// After setting status = 'CANCELLED':
// No DELETE needed — used_qr_tokens has FK to appointments.
// A CANCELLED appointment fails the status check in step 4 above.
// For extra defense, insert a tombstone row to prevent future use:
await adminClient
  .from('used_qr_tokens')
  .insert({ appointment_id: appointmentId, token_hash: 'REVOKED', used_at: new Date().toISOString() })
  .onConflict('appointment_id') // needs UNIQUE(appointment_id) to make this work
```

**Simpler approach (recommended):** Do NOT insert a tombstone. The status check in step 4 (`status == 'CONFIRMED'`) already blocks CANCELLED appointments. If an appointment is CANCELLED, `processQrCheckIn` returns an error at step 4 before even reaching the single-use check. This means:
- No extra DB write on cancel
- The revocation is implicit: a CANCELLED appointment can never become CHECKED_IN

---

## Database Schema

### New Table: `used_qr_tokens`

```sql
-- Migration: 20260601000002_phase3_schema.sql (or next available timestamp)

CREATE TABLE public.used_qr_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,   -- SHA-256 hex of the full token string (64 chars)
  used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE on token_hash enables atomic INSERT ... ON CONFLICT DO NOTHING
-- This is the race-condition guard: only one scan per token succeeds
CREATE UNIQUE INDEX used_qr_tokens_token_hash_idx ON public.used_qr_tokens (token_hash);

-- Index on appointment_id for FK lookups and potential future queries
CREATE INDEX used_qr_tokens_appointment_id_idx ON public.used_qr_tokens (appointment_id);

ALTER TABLE public.used_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only (adminClient) — no authenticated or anon access
-- All check-in writes go through Server Action with adminClient
CREATE POLICY "service_role_only_used_qr_tokens" ON public.used_qr_tokens
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- Grant to service role (implicit since service role bypasses RLS)
-- No anon policy needed
```

### `token_hash` Field Note

Store `SHA-256(fullToken)` as the hash, not the raw token. This way:
- The `used_qr_tokens` table never stores the actual token (minimal attack surface)
- Hash is deterministic for the same input (idempotent lookup)
- 64-char hex string — compact and indexed efficiently

```typescript
const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
```

### Database Types Update

After migration, run `supabase gen types typescript` to update `src/types/database.types.ts`.

---

## Scanner Implementation

### Architecture

The scanner lives at route `/qr/scanner` — a dedicated page the barbershop puts on a tablet/fixed screen, OR the client can use their phone's native camera (which auto-follows the URL). For this v1 implementation, the check-in URL is scanned by the client's own camera (not a scanner at the shop).

**No scanner page needed for client flow:** The client scans the QR with their phone's native camera app → phone opens `/qr/check-in?token=...` → Server Component processes the token. No custom scanner UI required for the client.

**Optional (for owner dashboard):** A scanner page at `/dashboard/scanner` where staff can scan client QRs with the device's camera.

### jsQR Camera Loop Pattern

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// jsQR imports document-independent — but needs dynamic import to avoid
// SSR issues since it uses ArrayBuffer operations not available at SSR time
// Source: [ASSUMED based on jsQR README + Next.js dynamic import pattern]

export function QrScanner({ onScan }: { onScan: (result: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    let jsQR: typeof import('jsqr') | null = null

    async function start() {
      // Dynamic import inside useEffect — avoids SSR
      const jsQRMod = await import('jsqr')
      jsQR = jsQRMod.default

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // rear camera on mobile
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        tick()
      }
    }

    function tick() {
      if (!videoRef.current || !canvasRef.current || !jsQR) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        onScan(code.data)
        return // stop after first scan
      }
      animRef.current = requestAnimationFrame(tick)
    }

    start().catch(console.error)

    return () => {
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onScan])

  return (
    <div className="relative">
      <video ref={videoRef} playsInline muted className="w-full rounded-lg" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
```

### Next.js Dynamic Import (for owner scanner page only)

```typescript
// For the optional /dashboard/scanner page
import dynamic from 'next/dynamic'

const QrScanner = dynamic(() => import('@/components/qr/qr-scanner'), {
  ssr: false,
  loading: () => <p>Carregando câmera...</p>,
})
```

### Client Check-In Flow (no custom scanner)

For the primary client flow, no scanner component is needed:

1. Client is on `/(public)/[slug]/booking` confirmation page (`StepConfirm`)
2. `StepConfirm` calls a Server Action to get the check-in URL
3. `<QRCode value={checkInUrl} />` is rendered
4. Client scans with phone camera → phone opens the URL
5. `/qr/check-in` page runs the Server Action and shows result

---

## UI/UX Design

### Where the Client Sees the QR

**Option A (recommended):** Add a QR section to the existing `StepConfirm` component.
- After "Agendamento confirmado!", display a collapsible "Seu QR Code de Check-In" section
- `<QRCode value={checkInUrl} size={180} level="M" />` with label
- A copy-link button as fallback
- The URL is fetched once by the Server Action on confirm and passed as a prop

**Option B:** A separate route `/(public)/[slug]/agendamento/[appointmentId]` that shows the QR. This is necessary if the client wants to re-view the QR later (e.g., they close the tab and come back).

**Recommendation:** Implement both — Option A for immediate display, Option B as a permalink. The same Server Action generates the token either way.

### Owner/Barber Live Notification

**Supabase Realtime Broadcast channel per barbershop:**

```typescript
// Channel naming: `checkin:${barbershop_id}`
// After successful CHECKED_IN status update in Server Action:
await adminClient.rpc('realtime_send', {
  // OR use the REST broadcast API
})
```

Using Supabase Realtime Broadcast (`realtime.send()` SQL function or REST API):

```typescript
// In Server Action after status update:
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  },
  body: JSON.stringify({
    messages: [{
      topic: `checkin:${barbershopId}`,
      event: 'new_checkin',
      payload: { appointmentId, clientName, startTime },
    }],
  }),
})
```

**Owner dashboard subscription (Client Component):**

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

export function useCheckInNotifications(barbershopId: string, onArrival: (data: unknown) => void) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`checkin:${barbershopId}`)
      .on('broadcast', { event: 'new_checkin' }, ({ payload }) => onArrival(payload))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [barbershopId, onArrival])
}
```

---

## Pitfalls

### Pitfall 1: crypto.createHmac in Edge Runtime
**What goes wrong:** If ANY file that imports `crypto` from Node.js is accidentally included in a route segment that has `export const runtime = 'edge'`, the build throws "The edge runtime does not support Node.js 'crypto' module."
**Why it happens:** Next.js middleware runs on Edge Runtime; Server Actions run on Node.js runtime by default.
**How to avoid:** Keep the `src/app/actions/qr-checkin.ts` file in the standard Server Actions directory (not in middleware). The `/qr/check-in` route must NOT have `export const runtime = 'edge'`.
**Warning signs:** Build error "does not support Node.js 'crypto'". Fix: use `crypto.subtle` (Web Crypto API) as fallback.

### Pitfall 2: QR Display Timing — Appointment Status is PENDING, not CONFIRMED
**What goes wrong:** Phase 2 `StepConfirm` currently shows "PENDENTE" status. The QR token is only valid for CONFIRMED appointments. If the barbershop hasn't confirmed yet, the QR is premature.
**Why it happens:** Phase 2 booking sets status = 'CONFIRMED' directly (in `createPublicAppointment` via adminClient). Checking the current code: `status: 'CONFIRMED'` is hardcoded in `public-booking.ts`. So appointments ARE confirmed immediately — the "PENDENTE" badge in `StepConfirm` is a UI label mismatch, not a real status issue.
**How to avoid:** Verify actual DB status: if `createPublicAppointment` sets `status: 'CONFIRMED'`, the QR can be generated immediately on the confirmation page. If a manual "confirm by owner" step is added later, revisit this.
**Warning signs:** `processQrCheckIn` returning "Agendamento não confirmado" for newly booked appointments.

### Pitfall 3: Hydration Mismatch with react-qr-code
**What goes wrong:** `<QRCode value={url} />` renders SVG on server and client; if `url` contains a timestamp or nonce that differs between SSR and CSR, React throws a hydration error.
**Why it happens:** The token is generated server-side in a Server Action — it's deterministic for a given appointment. The `value` prop passed to `<QRCode>` is a static string after the action resolves.
**How to avoid:** Generate the token once in a Server Action, pass as a prop to the `'use client'` `StepConfirm`. Do NOT generate tokens client-side or use `Date.now()` in the rendering path.
**Warning signs:** React DevTools hydration mismatch warnings; QR value flickering on first render.

### Pitfall 4: Race Condition — Two Simultaneous Scans
**What goes wrong:** Two clients (or double-tap) scan the same QR simultaneously. Without DB-level enforcement, both Server Actions could pass the "already used?" check and both update status to CHECKED_IN.
**Why it happens:** A `SELECT then INSERT` pattern has a race window.
**How to avoid:** Use `INSERT INTO used_qr_tokens ... ON CONFLICT (token_hash) DO NOTHING RETURNING id`. If `RETURNING id` returns 0 rows, the token was already consumed — reject. The UNIQUE index makes this atomic at the DB level. [CITED: PostgreSQL ON CONFLICT documentation]
**Warning signs:** `used_qr_tokens` having duplicate `appointment_id` entries (impossible with this pattern, but monitor).

### Pitfall 5: Camera Permission Denied — No Fallback
**What goes wrong:** Mobile browser denies camera access (user dismissed or HTTPS not enforced). The scanner silently fails.
**Why it happens:** `getUserMedia` requires HTTPS in production (localhost is exempt). Camera permission can be denied.
**How to avoid:** Wrap `getUserMedia` call in try/catch. Show a clear error: "Câmera não disponível. Certifique-se de usar HTTPS e conceder permissão." Provide a manual fallback: allow entering a short verification code from the QR label.
**Warning signs:** `navigator.mediaDevices` is `undefined` (HTTP context) or `getUserMedia` throws `NotAllowedError`.

### Pitfall 6: Token in URL History / Referrer Leak
**What goes wrong:** The token in `?token=...` gets stored in browser history and potentially leaked in the `Referer` header if the page has third-party scripts.
**Why it happens:** Query parameters are part of the URL.
**How to avoid:** After successful check-in, use `router.replace('/qr/check-in/success')` to remove the token from the URL. The `/qr/check-in` page processes the token on the server side and redirects/replaces. Single-use enforcement means a leaked token is harmless after use.
**Warning signs:** Token appears in browser history after check-in.

### Pitfall 7: `appointment.start_time` Timezone
**What goes wrong:** Time window check fails for appointments in non-UTC barbershops.
**Why it happens:** `start_time` is stored as `TIMESTAMPTZ` (UTC) in Postgres. If the Server Action compares `Date.now()` (UTC) against `start_time` (also UTC after JS parse), the comparison is correct.
**How to avoid:** Always compare Unix timestamps (seconds since epoch) — both `Date.now() / 1000` and `new Date(appointment.start_time).getTime() / 1000` are UTC-normalized. Never compare formatted time strings.
**Warning signs:** Check-in rejected at correct time; check `new Date(start_time).toISOString()` to confirm UTC storage.

### Pitfall 8: `jsQR` - setInterval vs requestAnimationFrame
**What goes wrong:** Using `requestAnimationFrame` for the decode loop pauses when the tab goes to background (user switches apps).
**Why it happens:** Browsers throttle rAF when tab is not visible.
**How to avoid:** For a scanner that should keep running, use `setInterval(tick, 100)` (10fps is sufficient for QR). The barbershop scanner kiosk should use `setInterval`. For the client-side one-time scan, rAF is fine (client is actively looking at the screen).
**Warning signs:** Scanner stops working when phone screen dims briefly.

---

## Implementation Plan Hints

### Plan 03-01: Migration — `used_qr_tokens` table
- Create migration file `20260601000002_phase3_schema.sql` (or with appropriate timestamp)
- Add `used_qr_tokens` table with UNIQUE index on `token_hash`
- Add RLS policies (service role only)
- Run `supabase gen types typescript` to update `database.types.ts`
- Add `QR_HMAC_SECRET` env var to `.env.local`

### Plan 03-02: Token Generation + QR Display on Confirmation Page
- Create `src/app/actions/qr-checkin.ts` with `generateQrToken(appointmentId)` Server Action
- Modify `StepConfirm` to call the Server Action and display `<QRCode>` component
- Install `react-qr-code`
- Create `src/components/qr/appointment-qr-code.tsx` (`'use client'`)
- Add permalink route `/(public)/[slug]/check-in/[appointmentId]` for re-viewing QR

### Plan 03-03: Token Verification + Check-In Server Action
- Add `processQrCheckIn(token: string)` to `src/app/actions/qr-checkin.ts`
- Create route `/qr/check-in/page.tsx` — reads `?token=` from `searchParams`
  - Server Component: calls `processQrCheckIn` and renders result
  - On success: show "Check-in realizado! Bem-vindo." with appointment details
  - On error: show specific error (expired, already used, outside window, cancelled)
- Ensure middleware bypasses `/qr/check-in` (add to public slug pattern or reserved paths)
- Add `QR_HMAC_SECRET` to `.env.local` docs

### Plan 03-04: Revocation + Dashboard Integration
- Update `cancelAppointment` to ensure revocation is implicit (status check in processQrCheckIn blocks CANCELLED)
- Add Supabase Realtime Broadcast call in `processQrCheckIn` after successful check-in
- Add `useCheckInNotifications` hook to `src/lib/dashboard/`
- Update `/dashboard/agendamentos` appointment list to:
  - Show CHECKED_IN badge with distinct color
  - Subscribe to Realtime and show toast "Cliente chegou!" on new check-in

---

## Code Examples

### Token Generation (Server Action)

```typescript
// src/app/actions/qr-checkin.ts
'use server'

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET!

export async function generateQrToken(
  appointmentId: string
): Promise<{ url: string } | { error: string }> {
  // Verify caller has access to this appointment
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  // For public bookings, use adminClient since no session exists
  const adminClient = createAdminClient()

  const { data: appointment, error } = await adminClient
    .from('appointments')
    .select('id, start_time, status, barbershop_id')
    .eq('id', appointmentId)
    .single()

  if (error || !appointment) return { error: 'Agendamento não encontrado' }
  if (appointment.status === 'CANCELLED') return { error: 'Agendamento cancelado' }

  const issuedAt = Math.floor(Date.now() / 1000)
  const startUnix = Math.floor(new Date(appointment.start_time).getTime() / 1000)

  const payload = `${appointmentId}|${issuedAt}|${startUnix}`
  const sig = crypto.createHmac('sha256', QR_HMAC_SECRET).update(payload).digest('hex')
  const token = `${Buffer.from(payload).toString('base64url')}.${sig}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  return { url: `${appUrl}/qr/check-in?token=${encodeURIComponent(token)}` }
}
```

### Token Verification (Server Action)

```typescript
export async function processQrCheckIn(
  token: string
): Promise<{ success: true; clientName: string } | { error: string }> {
  // 1. Decode
  const parts = token.split('.')
  if (parts.length !== 2) return { error: 'Token malformado' }
  const [encodedPayload, providedSig] = parts

  let rawPayload: string
  try {
    rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8')
  } catch {
    return { error: 'Token inválido' }
  }

  const [appointmentId, , startUnixStr] = rawPayload.split('|')
  if (!appointmentId || !startUnixStr) return { error: 'Token inválido' }

  // 2. Verify HMAC (constant-time comparison)
  const expectedSig = crypto.createHmac('sha256', QR_HMAC_SECRET).update(rawPayload).digest('hex')
  const sigValid = crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  )
  if (!sigValid) return { error: 'Assinatura inválida' }

  const adminClient = createAdminClient()

  // 3. Fetch appointment
  const { data: appointment } = await adminClient
    .from('appointments')
    .select('id, status, start_time, barbershop_id, clients(full_name)')
    .eq('id', appointmentId)
    .single()

  if (!appointment) return { error: 'Agendamento não encontrado' }
  if (appointment.status !== 'CONFIRMED') {
    return { error: `Agendamento não pode ser confirmado (status: ${appointment.status})` }
  }

  // 4. Time window check (±30 min from appointment start)
  const now = Math.floor(Date.now() / 1000)
  const startUnix = Math.floor(new Date(appointment.start_time).getTime() / 1000)
  const WINDOW = 30 * 60
  if (now < startUnix - WINDOW || now > startUnix + WINDOW) {
    return { error: 'Fora da janela de check-in (±30 minutos do horário)' }
  }

  // 5. Atomic single-use enforcement
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const { data: inserted } = await adminClient
    .from('used_qr_tokens')
    .insert({ appointment_id: appointmentId, token_hash: tokenHash })
    .select('id')

  // If INSERT returned nothing (ON CONFLICT), token already used
  if (!inserted || inserted.length === 0) {
    return { error: 'QR Code já utilizado' }
  }

  // 6. Update status
  await adminClient
    .from('appointments')
    .update({ status: 'CHECKED_IN', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  // 7. Broadcast (fire-and-forget)
  broadcastCheckIn(appointment.barbershop_id, appointmentId).catch(() => {})

  const clientName = (appointment.clients as { full_name: string } | null)?.full_name ?? 'Cliente'
  return { success: true, clientName }
}
```

### QR Display Component

```typescript
// src/components/qr/appointment-qr-code.tsx
'use client'

import QRCode from 'react-qr-code'

interface AppointmentQRCodeProps {
  checkInUrl: string
  appointmentId: string
}

export function AppointmentQRCode({ checkInUrl }: AppointmentQRCodeProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-4">
        <QRCode
          value={checkInUrl}
          size={180}
          level="M"  // Medium error correction — good balance for URLs
          style={{ display: 'block' }}
        />
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Mostre este QR na barbearia para fazer check-in
      </p>
    </div>
  )
}
```

---

## Middleware Route Handling

The check-in route `/qr/check-in` must NOT require authentication. The current `middleware.ts` uses this bypass logic:

```typescript
const isPublicSlug = !isReserved && /^\/[a-z0-9][a-z0-9-]*($|\/.*)$/.test(_pubPathname)
```

`/qr` starts with a letter and matches this pattern (not in `reservedPaths`). This means `/qr/check-in` is already treated as a public slug route and bypasses middleware auth checks. **No middleware changes needed.**

However, to be explicit and prevent future confusion, add `/qr` to the reserved paths list as a public-but-not-slug route. Better: create a dedicated `(public)` route group entry: `src/app/(public)/qr/check-in/page.tsx`. This keeps routing explicit.

---

## Supabase Realtime Broadcast (Server-to-Client)

```typescript
// In processQrCheckIn, after status update:
async function broadcastCheckIn(barbershopId: string, appointmentId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({
      messages: [{
        topic: `checkin:${barbershopId}`,
        event: 'arrival',
        payload: { appointmentId },
      }],
    }),
  })
}
// Source: [CITED: supabase.com/docs/guides/realtime/broadcast]
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createPublicAppointment` in Phase 2 sets `status: 'CONFIRMED'` immediately (not 'PENDING') | Pitfall 2 | QR generated before confirmation; processQrCheckIn would reject with status != CONFIRMED |
| A2 | `jsQR` dynamic import inside `useEffect` avoids SSR issues without needing `ssr: false` wrapper | Scanner Implementation | Hydration error or build error on server; fix by wrapping component with `dynamic(..., {ssr: false})` |
| A3 | Supabase Realtime Broadcast REST endpoint `POST /realtime/v1/api/broadcast` works with service role key in current Supabase project version | Realtime section | Broadcast fails silently; check Supabase dashboard for correct endpoint format |
| A4 | `ON CONFLICT DO NOTHING RETURNING id` returns empty array (not null) in Supabase JS client when conflict occurs | Race condition handling | Race condition not properly detected; verify with integration test |

---

## Open Questions

1. **Should the QR be generated at booking confirmation time or on-demand?**
   - What we know: Token includes `issued_at` but window is anchored to `appointment.start_time` (DB value), so a token generated at booking time is valid indefinitely until 30 min after the appointment
   - What's unclear: Should tokens expire if the appointment changes? (Currently: status check blocks cancelled/rescheduled)
   - Recommendation: Generate at booking confirmation time; revocation via status check is sufficient for v1

2. **Does Phase 2 `public-booking.ts` set status = 'CONFIRMED' or 'PENDING'?**
   - What we know: `createAppointment` (owner manual) sets `status: 'CONFIRMED'`
   - What's unclear: `createPublicAppointment` behavior — needs verification before 03-02
   - Recommendation: Read `src/app/actions/public-booking.ts` at plan execution time to confirm

3. **Is the Supabase Realtime Broadcast API endpoint path correct for this project's Supabase version?**
   - What we know: `POST /realtime/v1/api/broadcast` is documented [CITED: supabase.com/docs/guides/realtime/broadcast]
   - What's unclear: Some Supabase versions use different paths
   - Recommendation: Test in integration during 03-04 execution; fallback to `supabase.channel().send()` from server if REST fails

---

## Sources

### Primary (HIGH confidence)
- `github.com/rosskhanas/react-qr-code` — version 2.0.21, SVG-only, last commit 2026-04-29
- npm registry `npm view react-qr-code` — confirmed version and publish date
- npm registry `npm view jsqr` — version 1.4.0, last published 2025-11-13
- `nodejs.org/api/crypto.html` — createHmac, createHash, timingSafeEqual APIs
- `supabase.com/docs/guides/realtime/broadcast` — Broadcast channel API and REST endpoint
- Local runtime: Node.js v24.15.0 — crypto.createHmac verified working
- Local runtime: Buffer.from().toString('base64url') — verified working

### Secondary (MEDIUM confidence)
- nextjs.org/docs/app/api-reference/edge — Edge Runtime limitations (crypto not available)
- `github.com/mebjas/html5-qrcode` README — confirmed maintenance mode, no new releases since 2023
- PostgreSQL ON CONFLICT DO NOTHING RETURNING pattern — multiple authoritative sources

### Tertiary (LOW confidence / ASSUMED)
- jsQR dynamic import SSR behavior in Next.js 15 App Router — pattern inferred from general Next.js dynamic import docs, not tested
- Supabase Realtime Broadcast REST endpoint exact path — verified against docs but not tested in this project

---

## Metadata

**Confidence breakdown:**
- Package choices: HIGH — verified versions on npm registry, slopcheck passed
- HMAC/crypto design: HIGH — verified working in local Node.js runtime
- Database schema: HIGH — follows established project patterns
- Scanner implementation: MEDIUM — jsQR + useEffect pattern is standard but not tested in this project's specific bundler config
- Realtime broadcast: MEDIUM — API shape verified from docs, endpoint not tested

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable ecosystem; jsQR, react-qr-code are not fast-moving)
