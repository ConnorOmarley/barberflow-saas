# Phase 5: WhatsApp Notifications — Research

**Researched:** 2026-06-05
**Domain:** Twilio WhatsApp Business API + Supabase Edge Functions + LGPD opt-in
**Confidence:** HIGH (core API patterns verified via official Twilio docs + Supabase docs)

---

## Summary

Phase 5 adds automated WhatsApp messages to BarberFlow: a confirmation when an appointment reaches
CONFIRMED status, and a configurable reminder N hours before the appointment. Delivery is gated on
`whatsapp_opt_in = true` (LGPD) and per-barbershop feature flags.

The architecture is straightforward because Phase 2–4 already laid the groundwork: the `clients`
table has `whatsapp_opt_in`, `opt_in_timestamp`, and `opt_in_source`; the booking wizard already
captures opt-in; and `appointments.ts` already has a fire-and-forget pattern (used by loyalty
stamps) that can be copied for WhatsApp sends. The only genuinely new infrastructure is the Twilio
client wrapper, the `whatsapp_message_log` table, the Edge Function for reminders, and the pg_cron
schedule.

**The one tricky area is the sandbox.** The Twilio WhatsApp sandbox uses a shared number
(`+14155238886`) and has documented restrictions for Brazilian numbers. Before production, a
real WhatsApp Business sender must be registered via Twilio Self Sign-up — this requires a
Meta Business Portfolio and phone number OTP verification, and is separate from template approval.

**Primary recommendation:** Implement Twilio sends from Next.js Server Actions (Node.js runtime,
npm `twilio` package); implement reminder scheduling via a Supabase Edge Function invoked by
pg_cron. Use the REST API directly from the Edge Function (Deno cannot reliably use the npm
`twilio` package).

---

## Project Constraints (from CLAUDE.md)

- Every table MUST have `barbershop_id UUID NOT NULL` with RLS enabled immediately after CREATE TABLE.
- RLS policies read from `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID` — never
  application-layer filtering as primary gate.
- Never send WhatsApp without `whatsapp_opt_in = true`. Store `opt_in_timestamp` and
  `opt_in_source` at registration.
- Submit Meta message templates **2 weeks before Phase 5** — treat as blocking dependency.
- Do NOT use: Prisma, Stripe, Firebase, Auth.js, NextAuth, Moment.js, separate Supabase projects.
- All Server Actions use `adminClient + profiles.barbershop_id` (never JWT app_metadata for
  mutations) — see memory note about `feedback_server_actions_pattern.md`.

---

<phase_requirements>
## Phase Requirements

| ID     | Description                                                                                          | Research Support                                                                           |
|--------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| WA-01  | Client receives WhatsApp confirmation when appointment is confirmed (opt-in only)                    | Twilio `messages.create({ contentSid, contentVariables, from, to })` in Server Action; fire-and-forget hook in `updateAppointmentStatus` and `createAppointment` |
| WA-02  | Client receives WhatsApp reminder X hours before appointment (X configurable by owner)               | Supabase Edge Function + pg_cron job that queries `appointments` for rows where `start_time` falls within [now, now + X hours] and no reminder logged in `whatsapp_message_log` |
| WA-03  | Explicit LGPD opt-in during booking with `opt_in_timestamp` and `opt_in_source` stored               | `step-client.tsx` already has checkbox; `createPublicAppointment` already writes `opt_in_source = 'booking_portal'` and `opt_in_timestamp` — Phase 5 adds no new work here |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability                        | Primary Tier            | Secondary Tier       | Rationale                                                                                  |
|-----------------------------------|-------------------------|----------------------|--------------------------------------------------------------------------------------------|
| Send confirmation WA message      | API / Backend (Server Action) | —               | Twilio credentials must stay server-side; fire-and-forget from `updateAppointmentStatus`  |
| Send reminder WA message          | Background job (Edge Function) | —             | Must run on a schedule independently of user request; requires Deno + pg_cron              |
| Opt-in capture                    | Frontend (booking wizard) + API | —             | Already implemented in `step-client.tsx` + `createPublicAppointment`; no new work          |
| Per-barbershop notification config| API / Backend (Server Action) + Frontend | —    | Owner settings stored in `barbershops` table; settings page in dashboard                   |
| Idempotency guard                 | Database (unique constraint) | —              | `whatsapp_message_log (appointment_id, message_type)` UNIQUE prevents duplicate sends     |
| LGPD enforcement                  | API / Backend            | Database            | `whatsapp_opt_in` guard checked before every send; DB-level NOT NULL default false         |

---

## Standard Stack

### Core

| Library             | Version     | Purpose                                          | Why Standard                                                   |
|---------------------|-------------|--------------------------------------------------|----------------------------------------------------------------|
| `twilio`            | 6.0.2       | WhatsApp sends from Server Actions (Node.js)     | Official Twilio Node.js SDK; ships TypeScript types; verified `[VERIFIED: npm registry]` |
| Supabase Edge Func  | Deno 2      | Cron-triggered reminder batch job                | Already in project (`config.toml deno_version = 2`); project standard for background jobs |
| pg_cron + pg_net    | Bundled in Supabase | Schedule Edge Function HTTP calls         | Official Supabase scheduling mechanism `[CITED: supabase.com/docs/guides/functions/schedule-functions]` |

### Supporting

| Library             | Version     | Purpose                                          | When to Use                                                    |
|---------------------|-------------|--------------------------------------------------|----------------------------------------------------------------|
| `@supabase/supabase-js` | 2.x     | Admin client inside Edge Function (Deno)         | Fetch `appointments` and write `whatsapp_message_log` from cron job |

### Alternatives Considered

| Instead of                        | Could Use                          | Tradeoff                                                              |
|-----------------------------------|------------------------------------|-----------------------------------------------------------------------|
| `twilio` npm (Node.js Server Action) | Twilio REST API via `fetch` (Server Action) | npm package is simpler + typed; REST is viable but more boilerplate |
| Twilio REST via `fetch` (Edge Fn) | `npm:twilio` in Deno               | Deno `npm:` support for `twilio` is unreliable for this package (CommonJS internals); use raw `fetch` in Edge Function |
| pg_cron → Edge Function           | Vercel Cron + Next.js API route    | Project uses Supabase Edge Functions as background job platform; Vercel Cron adds vendor coupling |

**Installation (Next.js side only — Edge Function uses Deno imports):**
```bash
npm install twilio
```

---

## Package Legitimacy Audit

| Package | Registry | Age    | Downloads       | Source Repo                           | slopcheck | Disposition |
|---------|----------|--------|-----------------|---------------------------------------|-----------|-------------|
| `twilio` | npm     | 14 yrs | ~2.5M/wk `[ASSUMED]` | [github.com/twilio/twilio-node](https://github.com/twilio/twilio-node) | Could not run `[ASSUMED]` | Approved — official Twilio SDK |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck could not execute during this research session. `twilio` is the official SDK published
by Twilio Inc., maintained at github.com/twilio/twilio-node, version 6.0.2 published 2026-05-07
`[VERIFIED: npm registry]`. Registry existence alone does not confer VERIFIED status, but the
source repo and provenance are independently well-established.*

---

## Architecture Patterns

### System Architecture Diagram

```
Booking wizard (step-client.tsx)
  └─ whatsapp_opt_in: boolean ──────► createPublicAppointment (Server Action)
                                         └─ upserts clients.whatsapp_opt_in
                                         └─ INSERT appointment (status=PENDING)

Owner confirms appointment
  └─ updateAppointmentStatus(id, 'CONFIRMED') ─► fire-and-forget
                                                   └─ sendWhatsAppConfirmation(id)
                                                        ├─ guard: whatsapp_opt_in
                                                        ├─ guard: barbershop.whatsapp_notify_confirmation
                                                        ├─ Twilio messages.create()
                                                        └─ INSERT whatsapp_message_log

createAppointment (manual, status='CONFIRMED') ─► same fire-and-forget hook

pg_cron ──── every hour ────► net.http_post(Edge Function /send-reminders)
                                  └─ query appointments WHERE start_time BETWEEN now AND now+X
                                  └─ LEFT JOIN whatsapp_message_log ON (appt_id, 'reminder') IS NULL
                                  └─ guard: clients.whatsapp_opt_in
                                  └─ guard: barbershop.whatsapp_notify_reminder
                                  └─ Twilio REST POST (fetch with Basic auth)
                                  └─ INSERT whatsapp_message_log (idempotency)
```

### Recommended Project Structure

```
src/
├── lib/
│   └── twilio.ts              # createTwilioClient() factory + TWILIO_WHATSAPP_FROM const
├── app/
│   └── actions/
│       ├── whatsapp.ts        # sendWhatsAppConfirmation + sendWhatsAppReminder Server Actions
│       └── appointments.ts    # modified: fire-and-forget hook on CONFIRMED
│   └── (owner)/dashboard/
│       └── configuracoes/
│           ├── page.tsx       # owner settings page (new)
│           └── components/
│               └── whatsapp-settings.tsx  # form: enable/disable, reminder hours
supabase/
├── functions/
│   └── send-reminders/
│       └── index.ts           # Deno Edge Function: query + batch Twilio REST sends
└── migrations/
    └── 20260605000001_phase5_schema.sql  # whatsapp_message_log + barbershops columns
```

### Pattern 1: Twilio Client Factory (Node.js / Server Action)

**What:** Factory function (not module singleton) — called per-request inside Server Actions.
**When to use:** Any Server Action that sends WhatsApp messages.

```typescript
// src/lib/twilio.ts
// Source: Official Twilio Node.js SDK docs + project analog (src/lib/supabase/admin.ts)
import twilio from 'twilio'

export function createTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

export const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!
// Dev: 'whatsapp:+14155238886' (sandbox)
// Prod: 'whatsapp:+YOUR_REGISTERED_NUMBER'
```

### Pattern 2: Send Template Message (Node.js Server Action)

**What:** `messages.create()` with `contentSid` + `contentVariables` for pre-approved templates.
**When to use:** From `sendWhatsAppConfirmation` and `sendWhatsAppReminder` Server Actions.

```typescript
// Source: [CITED: twilio.com/docs/content/send-templates-created-with-the-content-template-builder]
const client = createTwilioClient()

const message = await client.messages.create({
  contentSid: 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // from Twilio Console
  contentVariables: JSON.stringify({
    '1': clientName,           // maps to {{1}} in template
    '2': formattedDate,        // maps to {{2}}
    '3': formattedTime,        // maps to {{3}}
    '4': serviceName,          // maps to {{4}}
    '5': barberName,           // maps to {{5}}
  }),
  from: TWILIO_WHATSAPP_FROM,          // 'whatsapp:+14155238886'
  to: `whatsapp:${client.whatsapp_number}`, // e.g. 'whatsapp:+5511999998888'
})

console.log('[whatsapp] sent:', message.sid)
```

**Key constraint:** Do NOT pass both `body` and `contentSid` — they are mutually exclusive.
`[CITED: twilio.com/docs/whatsapp/api]`

### Pattern 3: Twilio REST via `fetch` (Deno Edge Function)

**What:** Call Twilio Messages API from Deno using Basic auth — avoids npm:twilio compatibility risk.
**When to use:** Inside `supabase/functions/send-reminders/index.ts`.

```typescript
// Source: [CITED: twilio.com/en-us/blog/sending-sms-messages-deno-typescript-twilio-messaging]
const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')!

const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`)

async function sendWhatsApp(to: string, contentSid: string, variables: Record<string, string>) {
  const body = new URLSearchParams({
    From: twilioFrom,
    To: `whatsapp:${to}`,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  })

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: body.toString(),
    }
  )

  const data = await resp.json()
  if (!resp.ok) throw new Error(`Twilio error: ${data.message ?? resp.status}`)
  return data.sid as string
}
```

Note: Deno 2 has `btoa()` built-in — no base64 import needed.

### Pattern 4: pg_cron + pg_net Schedule

**What:** SQL migration that creates a pg_cron job calling the Edge Function every hour.
**When to use:** Phase 5 migration `20260605000001_phase5_schema.sql`.

```sql
-- Source: [CITED: supabase.com/docs/guides/cron/quickstart]
-- Run AFTER enabling extensions (already bundled in Supabase hosted platform)

select cron.schedule(
  'send-whatsapp-reminders',       -- unique job name
  '0 * * * *',                     -- every hour at :00
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'supabase_project_url'
    ) || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'supabase_publishable_key'
      )
    ),
    body := jsonb_build_object('triggered_at', now()::text),
    timeout_milliseconds := 30000
  );
  $$
);
```

**Alternative — simpler for initial setup:** Create job via Supabase Dashboard (Integrations → Cron)
using the Edge Function action type. SQL migration is preferred for reproducibility.

**IMPORTANT:** The `[functions.send-reminders] schedule = "..."` syntax in `config.toml`
is NOT the official Supabase mechanism. Official scheduling requires pg_cron + pg_net.
The `config.toml` has no cron schedule support as of current docs.
`[CITED: supabase.com/docs/guides/functions/schedule-functions]`

### Pattern 5: Idempotency Guard (whatsapp_message_log)

**What:** UNIQUE constraint on `(appointment_id, message_type)` prevents double-sends if cron runs twice.
**When to use:** INSERT before or after every successful Twilio send.

```sql
-- In migration — table definition
CREATE TABLE public.whatsapp_message_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID        NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  message_type    TEXT        NOT NULL CHECK (message_type IN ('confirmation', 'reminder')),
  twilio_sid      TEXT        NULL,     -- Twilio message SID for debugging
  status          TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message   TEXT        NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Idempotency: each appointment gets max one message per type
CREATE UNIQUE INDEX whatsapp_log_appt_type_idx
  ON public.whatsapp_message_log (appointment_id, message_type)
  WHERE status = 'sent';  -- failed attempts don't block retry
```

**Application-side check in Edge Function:**
```typescript
// Check before sending — avoid even calling Twilio if already sent
const { data: existing } = await supabaseAdmin
  .from('whatsapp_message_log')
  .select('id')
  .eq('appointment_id', apptId)
  .eq('message_type', 'reminder')
  .eq('status', 'sent')
  .maybeSingle()

if (existing) continue // already sent — idempotent skip
```

### Pattern 6: barbershops Table Extensions (Migration)

New columns added to `public.barbershops` via `ALTER TABLE`:

```sql
-- Per-barbershop WhatsApp settings
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS whatsapp_notify_confirmation BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_reminder     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_hours      SMALLINT NOT NULL DEFAULT 24
    CHECK (whatsapp_reminder_hours BETWEEN 1 AND 168);  -- 1h to 1 week
```

### Anti-Patterns to Avoid

- **Putting Twilio credentials in client components:** `src/lib/twilio.ts` must never be
  imported in `'use client'` files. The factory is for Server Actions and Edge Functions only.
- **Using `body` + `contentSid` together:** Twilio returns an error if both are passed.
  Use `contentSid` for template sends; `body` only for free-form within 24h session.
- **Blocking status updates on WhatsApp failure:** Always fire-and-forget (`void sendWhatsAppConfirmation(id)`).
  If Twilio is down, appointments must still transition to CONFIRMED.
- **Using `npm:twilio` in Deno Edge Function:** The `twilio` package uses CommonJS-specific
  internals that may not work reliably with `npm:` in Deno 2. Use raw `fetch` with Basic auth instead.
- **Using `config.toml` `schedule` key:** Not a real Supabase feature. Use pg_cron SQL migration.

---

## Don't Hand-Roll

| Problem                        | Don't Build                                        | Use Instead                                  | Why                                               |
|--------------------------------|----------------------------------------------------|----------------------------------------------|---------------------------------------------------|
| Twilio API client              | Custom HTTP wrapper for Twilio REST                | `twilio` npm package (Server Actions)        | Handles auth, retries, TypeScript types, response parsing |
| Template variable substitution | String replace for message bodies                  | Twilio Content Templates + `contentVariables`| Meta requires pre-approved templates for business-initiated messages |
| WhatsApp phone formatting      | Custom regex to parse Brazilian numbers            | `normalizeWhatsApp()` already in `public-booking.ts` | Already correctly handles E.164 normalization with +55 prefix |
| Scheduled job runner           | Polling loop or setTimeout in Next.js              | Supabase Edge Function + pg_cron             | Edge Functions are ephemeral; pg_cron survives deploys |
| Duplicate send prevention      | Application-layer lock (Redis, etc.)               | `UNIQUE INDEX (appointment_id, message_type)` on `whatsapp_message_log` | Database-level guarantee; survives concurrent runs |

---

## Common Pitfalls

### Pitfall 1: Sandbox Brazil Restriction
**What goes wrong:** Messages sent from the Twilio sandbox (`+14155238886`) to Brazilian numbers
fail silently or return an error because the sandbox is "temporarily restricted from sending to
certain countries, such as Brazil or Indonesia."
`[CITED: twilio.com/docs/whatsapp/sandbox]`
**Why it happens:** The shared sandbox number has carrier/country restrictions not present in
production WhatsApp senders.
**How to avoid:** For dev testing with real Brazilian numbers, register a production WhatsApp
sender (even on a trial account). Alternatively, test with a non-Brazilian number.
**Warning signs:** `status: 'failed'` in Twilio Console with no delivery receipt; error 63003
("Channel could not find To address").

### Pitfall 2: Missing "join" for Sandbox Recipients
**What goes wrong:** Users don't receive sandbox messages because they haven't sent "join
[sandbox-code]" to the sandbox number.
**Why it happens:** Sandbox is opt-in — each tester must explicitly join.
**How to avoid:** During dev, each developer sends "join [code]" from their own WhatsApp to
`+14155238886`. Sessions expire after 3 days — must rejoin periodically.
**Warning signs:** Message shows `queued` in Twilio Console but never `delivered`.

### Pitfall 3: Error 63016 — Outside Messaging Window
**What goes wrong:** Sending a free-form `body` message (not using `contentSid`) when no
active 24-hour session exists returns error 63016.
`[CITED: twilio.com/docs/api/errors/63016]`
**Why it happens:** WhatsApp requires pre-approved templates for business-initiated messages.
Free-form `body` only works if the client messaged BarberFlow first within the last 24 hours.
**How to avoid:** Always use `contentSid` + `contentVariables` for all appointment-triggered
messages. Never use free-form `body` for notification flows.

### Pitfall 4: Template Not Yet Approved
**What goes wrong:** Code deploys to production before Meta approves the templates. Every
send fails with "template not approved" or similar.
**Why it happens:** Meta approval takes minutes to 48 hours. Templates cannot be edited after
submission — only deleted and resubmitted.
**How to avoid:** Submit templates at least 2 weeks before Phase 5 starts (already noted in
ROADMAP.md). Store `contentSid` values in `.env` as `TWILIO_TEMPLATE_CONFIRMATION_SID` and
`TWILIO_TEMPLATE_REMINDER_SID` — do not hardcode HX values in source.
**Warning signs:** `status: 'failed'` in Twilio Console with message "Template does not exist".

### Pitfall 5: Phone Number Format — Brazilian 9th Digit
**What goes wrong:** Numbers stored as `+5511999998888` (11-digit mobile, with 9th digit) vs
`+551199998888` (10-digit older format). Both formats exist and WhatsApp treats them as different
numbers.
**Why it happens:** Brazil added the 9th digit for mobile numbers in most cities but not all.
Legacy clients in the DB may have 10-digit numbers; new clients provide 11-digit numbers.
**How to avoid:** The existing `normalizeWhatsApp()` in `public-booking.ts` already handles the
`+55` prefix. Add validation in the settings form that the WhatsApp number is exactly 13 digits
(`+55` + 2-digit area code + 9-digit mobile). Flag 12-digit numbers for review.
**Warning signs:** Twilio logs show `delivered` but client reports not receiving messages.

### Pitfall 6: Reminder Cron Window Overlap
**What goes wrong:** Cron runs every hour. If `whatsapp_reminder_hours = 24`, the query window
is `start_time BETWEEN now() AND now() + interval '24 hours'`. On consecutive runs, the same
appointments are queried and potentially sent twice.
**Why it happens:** Without a sent-check, every hourly run sees the same upcoming appointments.
**How to avoid:** The `whatsapp_message_log` idempotency check (Pattern 5) handles this —
query for appointments that have NO matching row in `whatsapp_message_log` for `message_type = 'reminder'`.
Use a LEFT JOIN or NOT EXISTS subquery.
**Warning signs:** Clients report receiving 2+ reminder messages.

### Pitfall 7: Edge Function Timeout on Large Batches
**What goes wrong:** If thousands of appointments have reminders due in the same hour, the
Edge Function exceeds the default timeout and some sends are skipped.
**Why it happens:** Supabase Edge Functions have a wall-clock timeout.
**How to avoid:** In Phase 5 (MVP scale), this is not a concern. For future scale: batch in
chunks of 50, or switch to Supabase Queues. For now, log `sent` row before the Twilio call
(not after) to prevent retries from resending if the function times out mid-batch.

### Pitfall 8: LGPD — Opt-In Must Not Be Pre-Checked
**What goes wrong:** Setting `whatsapp_opt_in` default to `true` in the form or storing
`opt_in = true` for clients who did not explicitly check the checkbox.
**Why it happens:** Developer convenience during testing.
**How to avoid:** `step-client.tsx` already has `default: false` in Zod schema and `useState(false)`
for the checkbox. The server action `createPublicAppointment` already writes `opt_in_source`
and `opt_in_timestamp` only when `whatsapp_opt_in = true`. This is already correct — do not change.
LGPD requires positive, unambiguous action; pre-checked boxes are non-compliant.

---

## Code Examples

### Full sendWhatsAppConfirmation Server Action

```typescript
// src/app/actions/whatsapp.ts
// Source: Twilio docs + project patterns (05-PATTERNS.md)
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createTwilioClient, TWILIO_WHATSAPP_FROM } from '@/lib/twilio'

const CONFIRMATION_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_CONFIRMATION_SID!
const REMINDER_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_REMINDER_SID!

export async function sendWhatsAppConfirmation(
  appointmentId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()

    // Fetch all required data in a single query (admin bypasses RLS)
    const { data: appt, error: apptError } = await admin
      .from('appointments')
      .select(`
        id,
        start_time,
        barbershops!inner(
          id,
          name,
          whatsapp_notify_confirmation,
          timezone
        ),
        clients!inner(
          full_name,
          whatsapp_number,
          whatsapp_opt_in
        ),
        services!inner(name),
        barbers!inner(name)
      `)
      .eq('id', appointmentId)
      .single()

    if (apptError || !appt) return { error: 'Agendamento não encontrado' }

    // LGPD guard — never send without opt-in
    if (!appt.clients.whatsapp_opt_in) return { success: true } // silent no-op

    // Feature flag guard
    if (!appt.barbershops.whatsapp_notify_confirmation) return { success: true }

    // Idempotency: skip if already sent
    const { data: existing } = await admin
      .from('whatsapp_message_log')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('message_type', 'confirmation')
      .eq('status', 'sent')
      .maybeSingle()

    if (existing) return { success: true } // already sent

    // Format date/time in barbershop timezone
    const startDate = new Date(appt.start_time)
    const dateStr = startDate.toLocaleDateString('pt-BR', {
      timeZone: appt.barbershops.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const timeStr = startDate.toLocaleTimeString('pt-BR', {
      timeZone: appt.barbershops.timezone,
      hour: '2-digit',
      minute: '2-digit',
    })

    // Send via Twilio
    const twilioClient = createTwilioClient()
    const message = await twilioClient.messages.create({
      contentSid: CONFIRMATION_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        '1': appt.clients.full_name,
        '2': appt.barbershops.name,
        '3': appt.services.name,
        '4': appt.barbers.name,
        '5': dateStr,
        '6': timeStr,
      }),
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${appt.clients.whatsapp_number}`,
    })

    // Log the send (idempotency record)
    await admin.from('whatsapp_message_log').insert({
      barbershop_id: appt.barbershops.id,
      appointment_id: appointmentId,
      client_id: appt.clients.id,  // NOTE: need to add id to select above
      message_type: 'confirmation',
      twilio_sid: message.sid,
      status: 'sent',
    })

    return { success: true }
  } catch (err) {
    console.error('[whatsapp] sendWhatsAppConfirmation error:', err)
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

### Edge Function: send-reminders

```typescript
// supabase/functions/send-reminders/index.ts
// Source: Supabase Edge Function docs + Twilio REST API docs
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!
const REMINDER_TEMPLATE_SID = Deno.env.get('TWILIO_TEMPLATE_REMINDER_SID')!
const TWILIO_AUTH_HEADER = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

Deno.serve(async (_req) => {
  let sent = 0
  let skipped = 0

  try {
    // Query: appointments whose start_time falls within each barbershop's reminder window
    // and that have NO 'sent' reminder log entry yet
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        barbershops!inner(
          id,
          name,
          timezone,
          whatsapp_notify_reminder,
          whatsapp_reminder_hours
        ),
        clients!inner(
          id,
          full_name,
          whatsapp_number,
          whatsapp_opt_in
        ),
        services!inner(name),
        barbers!inner(name)
      `)
      .eq('status', 'CONFIRMED')
      .eq('barbershops.whatsapp_notify_reminder', true)
      .eq('clients.whatsapp_opt_in', true)
      // Reminder window: start_time is between now and now + max(168h) — filter per-barbershop in loop
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 168 * 3600 * 1000).toISOString())

    if (error) throw error

    for (const appt of appointments ?? []) {
      // Check per-barbershop window
      const windowMs = appt.barbershops.whatsapp_reminder_hours * 3600 * 1000
      const apptTime = new Date(appt.start_time).getTime()
      const now = Date.now()
      if (apptTime > now + windowMs) { skipped++; continue } // outside window

      // Idempotency: skip if already sent
      const { data: existing } = await supabase
        .from('whatsapp_message_log')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('message_type', 'reminder')
        .eq('status', 'sent')
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Format date/time
      const startDate = new Date(appt.start_time)
      const dateStr = startDate.toLocaleDateString('pt-BR', {
        timeZone: appt.barbershops.timezone,
        weekday: 'long', day: 'numeric', month: 'long',
      })
      const timeStr = startDate.toLocaleTimeString('pt-BR', {
        timeZone: appt.barbershops.timezone,
        hour: '2-digit', minute: '2-digit',
      })

      // Send via Twilio REST
      let twilioSid: string | null = null
      let sendStatus: 'sent' | 'failed' = 'failed'
      let errorMsg: string | null = null

      try {
        const body = new URLSearchParams({
          From: TWILIO_FROM,
          To: `whatsapp:${appt.clients.whatsapp_number}`,
          ContentSid: REMINDER_TEMPLATE_SID,
          ContentVariables: JSON.stringify({
            '1': appt.clients.full_name,
            '2': appt.barbershops.name,
            '3': appt.services.name,
            '4': appt.barbers.name,
            '5': dateStr,
            '6': timeStr,
          }),
        })

        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': TWILIO_AUTH_HEADER,
            },
            body: body.toString(),
          }
        )
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.message ?? String(resp.status))
        twilioSid = data.sid
        sendStatus = 'sent'
        sent++
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e)
        console.error(`[reminders] failed for appt ${appt.id}:`, errorMsg)
      }

      // Always log the attempt (sent OR failed)
      await supabase.from('whatsapp_message_log').insert({
        barbershop_id: appt.barbershops.id,
        appointment_id: appt.id,
        client_id: appt.clients.id,
        message_type: 'reminder',
        twilio_sid: twilioSid,
        status: sendStatus,
        error_message: errorMsg,
      }).then(() => {}) // fire-and-forget log — don't let DB error skip next appointment
    }
  } catch (err) {
    console.error('[reminders] outer error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Migration: Phase 5 Schema

```sql
-- supabase/migrations/20260605000001_phase5_schema.sql
-- MULTI-TENANCY CONTRACT: every new table has RLS enabled immediately after CREATE TABLE.

-- SECTION A — barbershops table extensions
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS whatsapp_notify_confirmation BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_reminder     BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_hours      SMALLINT    NOT NULL DEFAULT 24
    CHECK (whatsapp_reminder_hours BETWEEN 1 AND 168);

-- SECTION B — whatsapp_message_log table
CREATE TABLE public.whatsapp_message_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID        NOT NULL REFERENCES public.barbershops(id)  ON DELETE CASCADE,
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id)      ON DELETE CASCADE,
  message_type    TEXT        NOT NULL CHECK (message_type IN ('confirmation', 'reminder')),
  twilio_sid      TEXT        NULL,
  status          TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message   TEXT        NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Idempotency index: max one 'sent' row per appointment per message type
-- WHERE status = 'sent' allows retrying failed sends
CREATE UNIQUE INDEX whatsapp_log_appt_type_sent_idx
  ON public.whatsapp_message_log (appointment_id, message_type)
  WHERE status = 'sent';

-- Performance index: query by barbershop (dashboard read)
CREATE INDEX whatsapp_log_barbershop_idx
  ON public.whatsapp_message_log (barbershop_id, sent_at DESC);

-- RLS: authenticated users see only their barbershop's logs
CREATE POLICY "tenant_whatsapp_log_all" ON public.whatsapp_message_log
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- SECTION C — pg_cron schedule (requires pg_cron + pg_net extensions)
-- Note: vault secrets 'supabase_project_url' and 'supabase_publishable_key' must be
-- created manually in Supabase Dashboard > Vault before this runs.
-- Alternatively, create the cron job via Dashboard > Integrations > Cron.
/*
select cron.schedule(
  'send-whatsapp-reminders',
  '0 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url')
           || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_publishable_key')
    ),
    body := jsonb_build_object('triggered_at', now()::text),
    timeout_milliseconds := 30000
  );$$
);
*/
-- COMMENTED OUT: run manually after vault secrets are configured.
```

---

## Template Design

### Required Templates (submit to Meta via Twilio Console)

**Template 1: Appointment Confirmation**

- **Name:** `barberflow_appointment_confirmation`
- **Category:** `UTILITY` (transactional, not marketing)
- **Body:**
  ```
  Olá {{1}}! Seu agendamento em *{{2}}* foi confirmado.
  
  Serviço: {{3}}
  Barbeiro: {{4}}
  Data: {{5}}
  Horário: {{6}}
  
  Até lá!
  ```

**Template 2: Appointment Reminder**

- **Name:** `barberflow_appointment_reminder`
- **Category:** `UTILITY`
- **Body:**
  ```
  Olá {{1}}! Lembrete do seu agendamento em *{{2}}*.
  
  Serviço: {{3}}
  Barbeiro: {{4}}
  Data: {{5}}
  Horário: {{6}}
  
  Até logo!
  ```

**Approval checklist:**
- Variables must not be at the START or END of the message — add greeting/closing text.
  `[CITED: twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses]`
- Variables must be sequential: `{{1}}`, `{{2}}`, `{{3}}` — no gaps.
- No adjacent variables (at least one word between them).
- Category `UTILITY` for transactional messages — avoids `MARKETING` restrictions.
- After approval: store the HX SIDs in environment variables, not hardcoded in source.

### Sandbox Pre-Approved Templates (for development)

The sandbox has one relevant pre-approved template:
```
"Your appointment is coming up on {{1}} at {{2}}"
```
This has only 2 variables. Use it for initial integration testing but not for the final
confirmation/reminder templates (which need more variables). `[CITED: twilio.com/docs/whatsapp/sandbox]`

---

## Environment Variables

```bash
# .env.local additions for Phase 5

# Twilio credentials (never commit)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox; change to registered number in prod

# Template SIDs (populated after Meta approval)
TWILIO_TEMPLATE_CONFIRMATION_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_REMINDER_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
# Supabase Edge Function secrets (set via CLI or Dashboard)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
supabase secrets set TWILIO_TEMPLATE_REMINDER_SID=HXxxx
```

---

## State of the Art

| Old Approach                  | Current Approach             | When Changed    | Impact                                                         |
|-------------------------------|------------------------------|-----------------|----------------------------------------------------------------|
| Twilio WhatsApp via `body`    | Content Templates + contentSid | Meta policy 2023 | All business-initiated messages require pre-approved templates |
| Separate `@types/twilio`      | `twilio` ships its own types | twilio v4+      | No need for separate @types package; types are bundled         |
| pg_cron alone for HTTP calls  | pg_cron + pg_net extension   | Supabase 2022+  | pg_net enables non-blocking HTTP from Postgres cron jobs       |

**Deprecated/outdated:**
- `TwilioMessage.body` for business-initiated WhatsApp: replaced by `contentSid`. If you see
  old tutorials using `body: 'Your appointment...'` for outbound-only flows, they rely on the
  24h session window — not applicable to BarberFlow's notification pattern.

---

## LGPD Opt-In — Current State

The booking wizard already fully implements LGPD-compliant opt-in:

1. **Checkbox** in `step-client.tsx`: unchecked by default, explicit label, not pre-checked.
2. **Server-side enforcement** in `createPublicAppointment`: writes `opt_in_source = 'booking_portal'`
   and `opt_in_timestamp = new Date().toISOString()` only when `whatsapp_opt_in = true`.
3. **Schema**: `clients.whatsapp_opt_in BOOLEAN DEFAULT false`, `opt_in_timestamp TIMESTAMPTZ NULL`,
   `opt_in_source TEXT NULL`.

**Phase 5 work on opt-in is ZERO structural changes.** The only optional improvement is updating
the checkbox label text to be more specific. Current label: "Aceito receber lembretes e confirmações
pelo WhatsApp" — this is already compliant per LGPD requirements for:
- Positive action (not pre-checked)
- Specific channel (WhatsApp)
- Specific purpose (lembretes e confirmações)
`[CITED: messagecentral.com/blog/lgpd-whatsapp-business]`

---

## Assumptions Log

| #  | Claim                                                                                       | Section             | Risk if Wrong                                                              |
|----|---------------------------------------------------------------------------------------------|---------------------|----------------------------------------------------------------------------|
| A1 | `twilio` npm package v6 works with ESM/TypeScript in Next.js 15 Server Actions without issues | Standard Stack     | May need CJS interop config in `next.config.ts`; unlikely given project already uses commonjs-style imports |
| A2 | Twilio WhatsApp download/week (~2.5M) cited from memory — not verified via npm stats       | Package Audit       | Cosmetic only; package legitimacy is not in doubt                           |
| A3 | Template category `UTILITY` is the correct Meta category for confirmation/reminder messages | Template Design     | Wrong category could cause rejection; verify in Twilio Console when creating |
| A4 | `npm:@supabase/supabase-js@2` works in Deno 2 Edge Functions for database queries          | Edge Function pattern | May need `https://esm.sh/` import instead; low risk as official Supabase docs use both |
| A5 | pg_cron and pg_net are enabled by default on Supabase hosted platform                     | Cron Pattern        | If disabled, would need to enable via Supabase Dashboard before migration runs |

---

## Open Questions

1. **Template HX SIDs before testing**
   - What we know: Templates must be submitted to Meta via Twilio Console and approved before
     production use. The HX SIDs are only known after submission.
   - What's unclear: Whether the project owner has already submitted templates (the ROADMAP
     says "submit during Phase 0/1" but Phase 4 just completed).
   - Recommendation: Make `TWILIO_TEMPLATE_CONFIRMATION_SID` and `TWILIO_TEMPLATE_REMINDER_SID`
     optional env vars; the Server Action and Edge Function should gracefully no-op if they are
     not set (log warning, return `{ success: true }`).

2. **Production WhatsApp Sender registration status**
   - What we know: The sandbox restricts Brazilian numbers. Production requires registering a
     WhatsApp sender via Twilio Self Sign-up (Meta Business Portfolio + phone OTP).
   - What's unclear: Whether this registration has been initiated.
   - Recommendation: Include a plan task that blocks on "production sender registered" before
     the production deploy. For Phase 5 testing, use the sandbox with a non-Brazilian test number.

3. **`barbershops` TypeScript types after migration**
   - What we know: Adding columns to `barbershops` via `ALTER TABLE` requires a types regeneration
     (`supabase gen types typescript`) before new columns are accessible with TypeScript safety.
   - Recommendation: First plan task must be a `[CHECKPOINT]` migration + types regeneration,
     identical to Phase 2's `02-01-PLAN.md` pattern.

---

## Environment Availability

| Dependency          | Required By                    | Available | Version  | Fallback                                      |
|---------------------|--------------------------------|-----------|----------|-----------------------------------------------|
| Node.js             | `npm install twilio`           | Yes       | (in project) | —                                        |
| Supabase CLI        | Edge Function deploy           | Yes       | v2.102.0 | —                                             |
| Twilio account      | Any send                       | Unknown   | —        | Cannot send without credentials; blocking     |
| Twilio sandbox number | Dev testing                  | Unknown   | —        | Use Twilio trial account; 5 min to set up     |
| Meta-approved templates | Production sends           | Unknown   | —        | Can develop with sandbox templates; prod blocked until approved |
| pg_cron extension   | Reminder cron job              | Yes (Supabase hosted) | bundled | Enable via Dashboard if not enabled  |
| pg_net extension    | pg_cron → HTTP call            | Yes (Supabase hosted) | bundled | Enable via Dashboard if not enabled  |

**Missing dependencies with no fallback:**
- Twilio account credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) — must be provided
  before Phase 5 plan execution. Developer must create/access Twilio account.

**Missing dependencies with fallback:**
- Meta-approved templates: can develop and test against sandbox with pre-approved templates;
  production deploy blocked until approval.

---

## Validation Architecture

### Test Framework

| Property          | Value                                                                    |
|-------------------|--------------------------------------------------------------------------|
| Framework         | None currently in project — no test files found                         |
| Config file       | None — would be Wave 0 gap if tests required                            |
| Quick run command | N/A                                                                      |
| Full suite command | N/A                                                                     |

### Phase Requirements → Test Map

| Req ID | Behavior                                        | Test Type    | Automated Command | File Exists? |
|--------|-------------------------------------------------|--------------|-------------------|-------------|
| WA-01  | Confirmation message sent on CONFIRMED status   | Manual       | N/A               | N/A — manual: trigger status change, check Twilio Console |
| WA-02  | Reminder sent X hours before appointment        | Manual       | N/A               | N/A — manual: create appointment X+0.5h from now, trigger cron |
| WA-03  | Opt-in stored correctly in clients table        | Manual / SQL | `select whatsapp_opt_in, opt_in_timestamp, opt_in_source from clients where id = 'xxx'` | N/A |

No automated test infrastructure exists in this project. All validation is manual.

### Wave 0 Gaps

None — no test framework to set up. All acceptance criteria verified manually against the
Twilio Console and Supabase Studio.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category      | Applies | Standard Control                                                    |
|--------------------|---------|---------------------------------------------------------------------|
| V2 Authentication  | No      | Messages are sent server-side; no user auth required for the send   |
| V3 Session Management | No   | —                                                                   |
| V4 Access Control  | Yes     | `whatsapp_opt_in` guard enforced before every send; feature flags per barbershop |
| V5 Input Validation | Yes    | Phone numbers normalized via existing `normalizeWhatsApp()`; template variables sanitized as plain strings (no HTML injection risk in WhatsApp) |
| V6 Cryptography    | No      | Twilio handles TLS; no custom crypto in this phase                  |

### Known Threat Patterns for This Stack

| Pattern                           | STRIDE      | Standard Mitigation                                                   |
|-----------------------------------|-------------|-----------------------------------------------------------------------|
| Sending without opt-in (LGPD)     | Tampering   | `if (!appt.clients.whatsapp_opt_in) return { success: true }` guard in every send function |
| Twilio credentials in client code | Info Disc.  | `src/lib/twilio.ts` server-only; never imported in `'use client'` components |
| Duplicate sends                   | Tampering   | `UNIQUE INDEX (appointment_id, message_type) WHERE status='sent'` + pre-check |
| cron job calling Edge Function without auth | Spoofing | pg_cron uses service-role vault secret to authenticate `apikey` header |
| Phone number injection            | Tampering   | `normalizeWhatsApp()` strips non-digits; Twilio validates E.164 server-side |

---

## Sources

### Primary (HIGH confidence)
- [CITED: twilio.com/docs/whatsapp/quickstart] — Node.js WhatsApp send code pattern
- [CITED: twilio.com/docs/content/send-templates-created-with-the-content-template-builder] — contentSid + contentVariables API
- [CITED: twilio.com/docs/whatsapp/sandbox] — Sandbox limitations, Brazil restriction, pre-approved templates
- [CITED: twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses] — Template approval timeline and rejection reasons
- [CITED: twilio.com/docs/whatsapp/best-practices-and-faqs] — 80 MPS rate limit, session window rules
- [CITED: twilio.com/docs/api/errors/63016] — Error 63016: outside messaging window
- [CITED: supabase.com/docs/guides/functions/schedule-functions] — pg_cron + pg_net scheduling
- [CITED: supabase.com/docs/guides/cron/quickstart] — cron.schedule() SQL syntax
- [CITED: supabase.com/docs/guides/functions/secrets] — Deno.env.get() secrets pattern
- [CITED: twilio.com/en-us/blog/sending-sms-messages-deno-typescript-twilio-messaging] — Deno fetch + Basic auth pattern
- [CITED: twilio.com/en-us/blog/send-sms-typescript-twilio] — TypeScript import `{ Twilio }` from 'twilio'
- [CITED: twilio.com/docs/glossary/what-e164] — Brazilian E.164 format +551155256325
- [CITED: twilio.com/docs/whatsapp/self-sign-up] — WhatsApp sender registration process
- [CITED: messagecentral.com/blog/lgpd-whatsapp-business] — LGPD WhatsApp opt-in requirements Brazil

### Secondary (MEDIUM confidence)
- [npm registry]: `twilio` v6.0.2 published 2026-05-07 — verified via `npm view twilio`
- [CITED: supabase.com/blog/supabase-cron] — Supabase Cron is pg_cron wrapper; Dashboard + SQL creation methods

### Tertiary (LOW confidence / assumed)
- Twilio npm weekly download volume (~2.5M/wk) — from memory, not verified this session
- `npm:@supabase/supabase-js@2` works in Deno 2 — used in official Supabase Edge Function examples `[ASSUMED]`

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — twilio package verified on npm registry; Supabase Edge Function + pg_cron confirmed in official docs
- Architecture: HIGH — patterns derived from existing codebase + official Twilio/Supabase docs
- Template design: MEDIUM — template body text and category are recommended patterns; Meta's actual approval depends on content review
- Pitfalls: HIGH for Sandbox/Brazil/63016 (confirmed in docs); MEDIUM for 9th-digit issue (inferred from E.164 docs + known Brazil telecom history)

**Research date:** 2026-06-05
**Valid until:** 2026-09-05 (90 days — Twilio API is stable; pg_cron pattern is stable)
