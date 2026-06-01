# Phase 1: Owner Onboarding + Barber & Service Setup — Research

**Researched:** 2026-05-31
**Domain:** Next.js 15 App Router + Supabase Auth/DB/Storage + shadcn/ui v4 (multi-tenant CRUD)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding Wizard (AUTH-04)**
- D-01: 4-step wizard at `/onboarding` — Step 1 creates `barbershops` row + sets `profiles.barbershop_id`; Step 2 creates `working_hours` rows (shop-level); Step 3 creates first `barbers` row; Step 4 creates first `services` row. After step 4 → redirect `/dashboard`.
- D-02: Dashboard NOT blocked after onboarding. Setup checklist widget inside `/dashboard` shows remaining items.
- D-03: Wizard resumes from last completed step — each step commits to DB before advancing; duplicate `barbershops` rows must be prevented.
- D-04: Owner with `barbershop_id` already in JWT → middleware redirects `/onboarding` to `/dashboard`.
- D-05: JWT is refreshed after step 1 using `supabase.auth.refreshSession()` so `barbershop_id` is available in the token for steps 2–4.

**Database Schema — New Tables**
- D-06: `barbers` table with `profile_id UUID NULL` (set on invite acceptance). Separate from `profiles`.
- D-07: `services` table with `barbershop_id`, `name`, `duration_minutes`, `price`, `is_active`.
- D-08: `barber_services` junction — `(barber_id, service_id)` PK + `commission_type` CHECK + `commission_value`.
- D-09: `working_hours` per-barber, per-day, `TIME` columns; multiple rows per day for split shifts.
- D-10: `appointments` table — all status values: PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED. No exclusion constraint in Phase 1 (added Phase 2). App-layer conflict check only.

**Barber Management UI (BARB-01 to BARB-05)**
- D-11: Full CRUD at `/dashboard/equipe`. Drawer for create/edit. Actions: Editar, Convidar, Desativar.
- D-12: `specialties TEXT[]` is informal/marketing only — operational barber↔service relation is exclusively via `barber_services`.
- D-13: Barber invite: owner enters email → `supabase.auth.admin.inviteUserByEmail()` Server Action with `options.data = { barbershop_id, role: 'barber', barber_id }`. On invite acceptance at `/aceitar-convite`, set `barbers.profile_id`.

**Services Management UI (SVC-01 to SVC-03)**
- D-14: Full CRUD at `/dashboard/servicos`. Drawer for create/edit. Quick-fill templates: Corte (30min), Barba (20min), Corte+Barba (50min).
- D-15: Barber↔service assignment managed inside barber edit drawer (checklist + commission fields). Service edit drawer has assignment-only checklist (no commission fields).

**Manual Appointment (BOOK-03, BOOK-05)**
- D-16: "Novo agendamento" global drawer. Fields: Cliente combobox, Barbeiro, Serviço (filtered by barber), Data, Hora, Observações. Status on create = CONFIRMED.
- D-17: App-layer duplicate check before INSERT — query for overlapping appointments.
- D-18: Cancellation: inline DropdownMenu per row → confirm dialog → UPDATE with CANCELLED status + cancelled_at/cancelled_by/cancel_reason. Appointments NEVER deleted.
- D-19: Cancel action also in edit drawer as destructive secondary button.
- D-20: `/agenda` barber schedule — day and week tabs, filtered by logged-in barber's `barbers` row.

**Architecture**
- D-21: Only owner/barber roles for now. `barbers` table decoupled from `profiles`.
- D-22: All new tables have RLS enabled immediately. JWT claims pattern: `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID`.

### Claude's Discretion

None declared in CONTEXT.md — all major decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Convite com role MANAGER/RECEPTIONIST
- Multiplas unidades / barbearia por franquia
- Cancelamento/remarcação pelo cliente (BOOK-V2-01)
- Online payment na criação de agendamento (BOOK-V2-02)
- GIST exclusion constraint on appointments (Phase 2)
- WhatsApp opt-in UI (Phase 5)
- Loyalty stamps (Phase 4)
- SaaS billing creation on onboarding (Phase 6)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-04 | Dono completa onboarding da barbearia em até 4 passos após cadastro | D-01 to D-05 fully specify the wizard flow, JWT refresh pattern confirmed available |
| AUTH-05 | Dono convida barbeiro por email; barbeiro cria sua própria senha ao aceitar | `supabase.auth.admin.inviteUserByEmail()` verified available; `barber_id` passed via `options.data`; `/aceitar-convite` already built — needs `barbers.profile_id` update |
| BARB-01 | Dono pode cadastrar barbeiro com nome, foto e especialidades | Supabase Storage for photo, `barbers` table schema locked |
| BARB-02 | Dono pode definir horários de trabalho por barbeiro (dias da semana + horários) | `working_hours` table; TIME columns; split-shift support via multiple rows |
| BARB-03 | Dono pode definir comissão por barbeiro (percentual ou valor fixo) | `barber_services.commission_type + commission_value` |
| BARB-04 | Barbeiro pode visualizar sua própria agenda do dia/semana pelo painel | `/agenda` shell exists; needs real query by `barbers.profile_id = auth.uid()` |
| BARB-05 | Barbeiro pode marcar atendimento como COMPLETED pelo painel | Status UPDATE Server Action; optimistic UI on DropdownMenu |
| SVC-01 | Dono pode cadastrar serviço com nome, duração e preço | `services` table + CRUD Server Actions |
| SVC-02 | Dono pode associar quais serviços cada barbeiro oferece | `barber_services` junction table; managed in barber edit drawer |
| SVC-03 | Portal de agendamento exibe apenas serviços do barbeiro selecionado | Join `barber_services` filtering by `barber_id`; relevant for Phase 2 but the data model is built here |
| BOOK-03 | Dono ou barbeiro pode criar agendamento manualmente pelo painel (walk-in, telefone) | Global "Novo Agendamento" drawer; app-layer conflict check; inline client creation |
| BOOK-05 | Dono pode cancelar qualquer agendamento pelo painel com motivo opcional | Cancel dialog + UPDATE Server Action; `cancelled_at/cancelled_by/cancel_reason` columns |

</phase_requirements>

---

## Summary

Phase 1 builds the full operational backbone of BarberFlow: onboarding wizard, barber/service CRUD, commission configuration, manual appointment creation, and cancellation. The phase sits entirely within an established Next.js 15 + Supabase + shadcn/ui stack that was proved in Phase 0. No new libraries are required beyond additional shadcn components.

The most technically critical issue is the **JWT refresh after onboarding Step 1**. When the owner creates their `barbershops` row, `profiles.barbershop_id` is updated, but the currently active JWT still has `barbershop_id: undefined`. Steps 2–4 must run Server Actions that enforce the `barbershop_id` JWT claim for RLS to pass. The solution is to call `supabase.auth.refreshSession()` (confirmed available on the client-side Supabase client, v2.106.2) immediately after Step 1's Server Action returns, then proceed. This is a client component responsibility.

The second critical path is the **barber invite flow link to `barbers.profile_id`**. The existing `/aceitar-convite` page calls `supabase.auth.updateUser({ password })` but does NOT currently update `barbers.profile_id`. Phase 1 must extend the invite acceptance flow: when `raw_user_meta_data.barber_id` is present (passed via `inviteUserByEmail options.data`), update `barbers.profile_id = auth.uid()`. This can be a Postgres trigger on `auth.users` UPDATE (password set) OR a client-side Server Action called from `/aceitar-convite` after `updateUser` succeeds. The trigger approach is more reliable.

The third area requiring care is **Supabase Storage RLS for barber photos**. A `barber-photos` bucket must be created with an RLS policy that permits writes only for the owner of the barbershop (same `barbershop_id` in JWT). The upload itself happens from a `'use client'` component using the browser Supabase client.

**Primary recommendation:** Follow the exact Server Actions pattern from Phase 0 (`src/app/actions/auth.ts`) for all mutations. Use the established `getClaims()` pattern for auth checks in Server Components. Every new table follows the Phase 0 RLS template exactly. The admin client (service role key) is needed only for `inviteUserByEmail` — create `src/lib/supabase/admin.ts` using `SUPABASE_SERVICE_ROLE_KEY`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Onboarding wizard state (current step) | Frontend (React state) | Database (step detection on resume) | Step state is ephemeral mid-session; DB acts as resume checkpoint |
| JWT refresh after Step 1 | Browser client | — | `refreshSession()` is a browser Supabase client call — cannot be done server-side in Server Actions |
| Barbershop/barber/service CRUD mutations | API (Server Actions) | Database (RLS) | All writes go through `'use server'` functions; RLS enforces tenant isolation |
| Barber photo upload | Browser client | Supabase Storage | File upload from `<input type=file>` must happen client-side; signed URLs are server-issued |
| Invite email sending | API (Server Action, admin client) | — | Requires `SUPABASE_SERVICE_ROLE_KEY`; never expose in browser |
| `barbers.profile_id` linkage on invite accept | Database (trigger) | — | More reliable than client-side; runs atomically when `auth.users` password is set |
| App-layer double-booking check | API (Server Action) | — | Reads appointments table before INSERT; enforced server-side |
| Working hours / slot availability for appointment drawer | API (Server Action/data fetch) | Browser | Barber working hours queried to populate time slots in drawer |
| RLS policy enforcement | Database | — | All tenant isolation enforced at DB layer; application layer is secondary guard only |
| Barber schedule view (BARB-04) | Frontend Server (RSC) | Database | Page-level data fetch in Server Component; filtering by `barbers.profile_id = auth.uid()` |
| Optimistic UI for status updates (BARB-05) | Browser / Client | API (Server Action fallback) | Optimistic update on DropdownMenu click, revert on Server Action error |

---

## Standard Stack

### Core (all already installed — [VERIFIED: package.json])

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.5.18 | App Router framework | Locked in project |
| `@supabase/ssr` | 0.10.3 | Server-side Supabase client with cookie auth | Locked in Phase 0 |
| `@supabase/supabase-js` | 2.106.2 | Supabase JS client (browser + admin) | Locked in Phase 0 |
| `react-hook-form` | 7.76.1 | Form state management | Locked in Phase 0 |
| `zod` | 4.4.3 | Schema validation | Locked in Phase 0 |
| `@hookform/resolvers` | 5.4.0 | zod adapter for RHF | Locked in Phase 0 |
| `lucide-react` | 1.17.0 | Icons | Locked in Phase 0 |
| `tailwindcss` | 4.x | Styling | Locked in Phase 0 |

### New shadcn Components Required (add via CLI — [ASSUMED: shadcn official registry])

From UI-SPEC `01-UI-SPEC.md` registry safety section — all sourced from `shadcn official` registry only:

| Component | Purpose |
|-----------|---------|
| `sheet` | Side drawer for appointment, barber edit, service edit |
| `dialog` | Cancel appointment confirm dialog |
| `select` | Dropdowns for barber/service/duration/timezone |
| `textarea` | Notes, cancel reason, service description |
| `checkbox` | Service assignment checklist, invite checkbox |
| `switch` | Working hours open/closed per day toggle |
| `tabs` | Day/week view tabs on /agenda |
| `avatar` | Barber photo display in equipe cards |
| `scroll-area` | Drawer body scroll containment |
| `command` | Client search combobox (built on cmdk) |
| `popover` | Combobox anchor for client search |
| `tooltip` | Icon-only action button labels |
| `dropdown-menu` | Appointment inline action menu |
| `sonner` | Toast notifications for success/error |

**Install command (run once at start of phase):**
```bash
npx shadcn add sheet dialog select textarea checkbox switch tabs avatar scroll-area command popover tooltip dropdown-menu sonner
```

### No New npm Packages Required

All functionality is covered by the existing installed packages plus shadcn components (which add no npm deps beyond what is already installed — Radix UI primitives are brought in by the shadcn CLI).

---

## Package Legitimacy Audit

> No new npm packages are being added to `package.json` in Phase 1. All shadcn components are pulled from the official shadcn registry (ui.shadcn.com) by the `shadcn` CLI already installed at v4.8.3. The shadcn CLI fetches component source files — it does not install separate npm packages for each component. No additional legitimacy audit is required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React Client Components)
  │
  ├── Onboarding Wizard (multi-step state)
  │     └── Step 1 → Server Action: createBarbershop()
  │                   → refreshSession() [browser client]  ← JWT now has barbershop_id
  │     └── Steps 2-4 → Server Actions: upsertWorkingHours(), createBarber(), createService()
  │
  ├── /dashboard/equipe (Server Component fetch → Client CRUD)
  │     └── Barber Drawer → Server Actions: createBarber(), updateBarber(), inviteBarber()
  │           inviteBarber() uses admin client (service role) → supabase.auth.admin.inviteUserByEmail()
  │     └── Barber photo upload → browser Supabase client → Storage bucket 'barber-photos'
  │
  ├── /dashboard/servicos (Server Component fetch → Client CRUD)
  │     └── Service Drawer → Server Actions: createService(), updateService()
  │     └── Assignment sync → Server Action: syncBarberServices()
  │
  ├── Appointment Drawer (global, client component)
  │     └── Client search → Supabase query (debounced, browser client)
  │     └── Time slots → Server Action or Client fetch from working_hours
  │     └── Create → Server Action: createAppointment() [app-layer conflict check]
  │
  └── /agenda (barber role, Server Component)
        └── Fetch by barbers.profile_id = auth.uid()
        └── Mark COMPLETED → Server Action: updateAppointmentStatus()
        └── Cancel → Server Action: cancelAppointment()

Server Actions ('use server')
  │
  ├── createBarbershop(data)   → INSERT barbershops + UPDATE profiles SET barbershop_id
  ├── upsertWorkingHours(data) → DELETE + INSERT working_hours for barber
  ├── createBarber(data)       → INSERT barbers
  ├── updateBarber(data)       → UPDATE barbers
  ├── inviteBarber(email, barberId) → admin client.auth.admin.inviteUserByEmail()
  ├── createService(data)      → INSERT services
  ├── updateService(data)      → UPDATE services
  ├── syncBarberServices(barberId, assignments[]) → DELETE + INSERT barber_services
  ├── createAppointment(data)  → conflict check → INSERT appointments
  ├── cancelAppointment(id, reason) → UPDATE appointments SET status='CANCELLED'
  └── updateAppointmentStatus(id, status) → UPDATE appointments SET status=?

Database (Supabase Postgres + RLS)
  │
  ├── barbershops   → RLS: id = JWT barbershop_id
  ├── profiles      → RLS: own row + same tenant read
  ├── barbers       → RLS: barbershop_id = JWT barbershop_id
  ├── services      → RLS: barbershop_id = JWT barbershop_id
  ├── barber_services → RLS: via barber JOIN to barbershop_id
  ├── working_hours → RLS: via barber JOIN to barbershop_id
  ├── appointments  → RLS: barbershop_id = JWT barbershop_id
  └── clients       → RLS: barbershop_id = JWT barbershop_id (already exists)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (owner)/
│   │   ├── onboarding/
│   │   │   ├── page.tsx                    # Wizard page (client component)
│   │   │   └── components/
│   │   │       ├── wizard-steps.tsx        # Step content components
│   │   │       └── working-hours-grid.tsx  # Reusable hours grid (steps 2 + barber drawer)
│   │   └── dashboard/
│   │       ├── equipe/
│   │       │   ├── page.tsx               # Barber list (Server Component)
│   │       │   └── components/
│   │       │       ├── barber-card.tsx
│   │       │       └── barber-drawer.tsx  # Create/edit (client)
│   │       └── servicos/
│   │           ├── page.tsx               # Service list (Server Component)
│   │           └── components/
│   │               ├── service-row.tsx
│   │               └── service-drawer.tsx
│   ├── (barber)/
│   │   └── agenda/
│   │       └── page.tsx                   # Filled with real data (Server Component)
│   └── actions/
│       ├── auth.ts                        # Existing signOut (keep)
│       ├── barbershop.ts                  # createBarbershop, updateBarbershop
│       ├── barbers.ts                     # createBarber, updateBarber, inviteBarber
│       ├── services.ts                    # createService, updateService
│       ├── barber-services.ts             # syncBarberServices
│       ├── working-hours.ts               # upsertWorkingHours
│       └── appointments.ts               # createAppointment, cancelAppointment, updateAppointmentStatus
├── components/
│   ├── appointments/
│   │   ├── appointment-drawer.tsx         # Global "Novo Agendamento" sheet
│   │   ├── cancel-dialog.tsx             # Cancel confirm dialog
│   │   └── client-combobox.tsx           # Client search combobox
│   └── dashboard/
│       └── setup-checklist.tsx           # Setup checklist widget
└── lib/
    └── supabase/
        ├── server.ts                     # Existing (unchanged)
        ├── client.ts                     # Existing (unchanged)
        └── admin.ts                      # NEW: service-role client for admin actions
```

### Pattern 1: Server Action with Supabase (established Phase 0 pattern)

```typescript
// src/app/actions/barbers.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBarber(formData: {
  name: string
  phone?: string
  photo_url?: string
  specialties?: string[]
}) {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { data, error } = await supabase
    .from('barbers')
    .insert({ ...formData, barbershop_id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/equipe')
  return { data }
}
```

### Pattern 2: Admin Client for inviteUserByEmail

```typescript
// src/lib/supabase/admin.ts
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

```typescript
// src/app/actions/barbers.ts (invite action)
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function inviteBarber(email: string, barberId: string) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const barbershop_id = claims?.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Não autorizado' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/aceitar-convite`,
    data: {
      barbershop_id,
      role: 'barber',
      barber_id: barberId,
    },
  })

  if (error) {
    if (error.message.includes('already been registered'))
      return { error: 'Este email já está cadastrado no sistema.' }
    return { error: error.message }
  }

  return { success: true }
}
```

### Pattern 3: JWT Refresh After Step 1 (client-side)

```typescript
// Called in the onboarding wizard (client component) after Step 1 Server Action succeeds
import { createClient } from '@/lib/supabase/client'

async function onStep1Complete() {
  const result = await createBarbershop(formData) // Server Action
  if (result.error) { /* show error */ return }

  // Force token refresh so barbershop_id is in JWT for steps 2-4 RLS
  const supabase = createClient()
  await supabase.auth.refreshSession()

  advanceToStep(2)
}
```

**Why this is required:** `custom_access_token_hook` injects `barbershop_id` into the JWT. But the current browser session still holds the old token (without `barbershop_id`). Steps 2–4 use Server Actions that call `supabase.auth.getClaims()` — which validates the JWT from the cookie. Without a refresh, `barbershop_id` is null in the claims and RLS will reject INSERTs into `working_hours`, `barbers`, `services`. [VERIFIED: supabase-js 2.106.2 — `refreshSession` confirmed on prototype chain]

### Pattern 4: Barbers.profile_id Update on Invite Acceptance (Postgres trigger)

The safest approach is a Postgres trigger that fires when an `auth.users` row is updated (specifically when the password hash changes from invite-pending to set). This is more reliable than a client-side call because `/aceitar-convite` is already a complex client component.

```sql
-- In Phase 1 migration
CREATE OR REPLACE FUNCTION public.handle_invite_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire when the encrypted_password is being set for the first time
  -- (invite acceptance: OLD.encrypted_password is empty/null, NEW is set)
  IF (OLD.encrypted_password IS NULL OR OLD.encrypted_password = '')
     AND NEW.encrypted_password IS NOT NULL
     AND NEW.encrypted_password != ''
     AND (NEW.raw_user_meta_data ? 'barber_id')
  THEN
    UPDATE public.barbers
    SET profile_id = NEW.id
    WHERE id = (NEW.raw_user_meta_data->>'barber_id')::UUID
      AND profile_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_invite_accepted
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_accepted();
```

**Alternative (simpler):** Call a Server Action from `/aceitar-convite` after `updateUser` succeeds. This is acceptable but has a failure mode if the user closes the tab before the call completes.

### Pattern 5: Working Hours Grid (reused in Onboarding Step 2 + Barber Drawer)

The `working-hours-grid.tsx` component is used in two places. It receives the barber_id (or null for shop-level hours during onboarding) and manages 7 rows (Dom–Sáb) with Switch (open/closed) + time inputs. On form submit, it produces `WorkingHourInput[]` that the Server Action passes to `upsertWorkingHours`.

```typescript
type WorkingHourInput = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
  is_active: boolean
}
```

**The upsert pattern:** DELETE all existing rows for the barber_id + day combination, then INSERT the new set. This avoids partial updates.

### Pattern 6: Supabase Storage for Barber Photos

```typescript
// In barber drawer (client component)
const supabase = createClient() // browser client

async function uploadBarberPhoto(file: File, barberId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${barberId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('barber-photos')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from('barber-photos')
    .getPublicUrl(path)

  return data.publicUrl
}
```

**Storage RLS:** The `barber-photos` bucket must have an INSERT policy that restricts to authenticated users whose JWT `barbershop_id` matches the barber's `barbershop_id`. However, bucket-level RLS for storage uses a different policy language. The simplest Phase 1 approach: authenticated users can INSERT/UPDATE — further tightening deferred to a later phase. [ASSUMED: bucket-level RLS details — verify in Supabase Storage docs before implementing]

### Pattern 7: Client Search Combobox (shadcn Command + Popover)

```typescript
// client-combobox.tsx — 'use client'
// Debounced search using browser Supabase client
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

// Search function (called on input change with 300ms debounce)
async function searchClients(query: string, barbershopId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, whatsapp_number')
    .eq('barbershop_id', barbershopId)
    .or(`full_name.ilike.%${query}%,whatsapp_number.ilike.%${query}%`)
    .limit(8)
  return data ?? []
}
```

**Key consideration:** The browser client uses the anon key + RLS. For the search to work, the client needs `barbershop_id` from the JWT. Since the owner already has `barbershop_id` in JWT after onboarding step 1, this works. The combobox must handle the `barbershop_id` coming from a `data-` attribute or context prop (read from a parent Server Component).

### Pattern 8: App-Layer Double-Booking Check

```typescript
// In createAppointment Server Action — BEFORE INSERT
async function checkConflict(
  supabase: SupabaseClient,
  barberId: string,
  startTime: string, // ISO string
  endTime: string
): Promise<boolean> {
  const { data } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', barberId)
    .neq('status', 'CANCELLED')
    .lt('start_time', endTime)    // existing start < new end
    .gt('end_time', startTime)    // existing end > new start
    .limit(1)

  return (data?.length ?? 0) > 0
}
```

### Anti-Patterns to Avoid

- **Never use `.from('barbershops').update()` to set `profiles.barbershop_id`** — these are separate tables. The onboarding Step 1 action must UPDATE `profiles` directly AND INSERT `barbershops`.
- **Never pass JWT claims from client to Server Action as parameters** — always re-read from `supabase.auth.getClaims()` inside the Server Action.
- **Never use `supabase.auth.admin` with the anon key** — `auth.admin` methods require the service role key. Always use `createAdminClient()` from `src/lib/supabase/admin.ts`.
- **Never block onboarding completion behind payment** — SaaS billing is Phase 6. No Asaas calls in Phase 1.
- **Never delete appointments** — mark as CANCELLED only.
- **Never use `specialties` as the source of truth for what a barber offers** — only `barber_services` junction is authoritative.
- **Avoid full-page navigation between wizard steps** — use React state for current step. Only the DB is the checkpoint for resume; the URL stays at `/onboarding`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation logic | React Hook Form + Zod (already installed) | Edge cases in async validation, touch state, error focus |
| Drawer/sheet UI | Custom slide-in panel | shadcn `sheet` | Focus trap, backdrop, animation, ARIA handled |
| Combobox with search | Custom dropdown + input | shadcn `command` + `popover` | Keyboard navigation, ARIA, virtual list |
| Confirmation dialogs | Browser `confirm()` | shadcn `dialog` | Styling, focus management, form input support |
| Toast notifications | Custom notification stack | shadcn `sonner` | Queue management, auto-dismiss, ARIA live regions |
| Dropdown menus | Custom positioned menu | shadcn `dropdown-menu` | Focus trap, keyboard navigation, position collision |
| Time slot generation | Custom loop | Derive from `working_hours` rows | Edge cases in split shifts, timezone awareness |
| Avatar initials | Custom hash | Existing `Avatar` component in `src/components/dashboard/primitives.tsx` | Already built with deterministic gradient |
| Status badge | Custom pill | Existing `StatusBadge` from `src/components/dashboard/primitives.tsx` | Already has phase 0 status colors (extend for new statuses) |

**Key insight:** The Phase 0 dashboard already built `Avatar`, `StatusBadge`, `Panel`, and `PanelHeader` — reuse them before building anything new.

---

## Common Pitfalls

### Pitfall 1: JWT Not Refreshed Before Step 2

**What goes wrong:** Steps 2–4 Server Actions read `app_metadata.barbershop_id` from `getClaims()`. If the browser hasn't refreshed the token after Step 1, the claim is `undefined`. RLS policies on `working_hours`, `barbers`, `services` all reject INSERTs. The user sees a generic error.

**Why it happens:** `custom_access_token_hook` injects claims on token issuance. The existing token persists until it expires or is explicitly refreshed. A Server Action that calls `supabase.auth.getClaims()` reads the cookie-stored token as-is.

**How to avoid:** In the wizard (client component), call `await supabase.auth.refreshSession()` using the browser client after the Step 1 Server Action returns successfully.

**Warning signs:** Step 2 fails with "RLS policy violation" or "new row violates row-level security policy" on `working_hours` table.

---

### Pitfall 2: Duplicate `barbershops` Row on Wizard Refresh

**What goes wrong:** If the user submits Step 1, closes the browser, then reopens `/onboarding`, the wizard creates a second `barbershops` row for the same owner.

**Why it happens:** Step 1 does an INSERT. On resume, if the detection logic is wrong, it re-runs Step 1.

**How to avoid:** On wizard load, query `profiles.barbershop_id` for the current user. If it is set, the barbershop already exists — skip to the appropriate step. Use `ON CONFLICT DO NOTHING` on the profiles UPDATE. The `profiles.barbershop_id` being non-null is the canonical signal that Step 1 is complete.

**Warning signs:** Multiple `barbershops` rows with the same owner profile.

---

### Pitfall 3: `barbers.profile_id` Never Set

**What goes wrong:** Owner invites barber via email. Barber accepts and sets password at `/aceitar-convite`. But `barbers.profile_id` stays NULL, so the barber's login works but `/agenda` shows nothing (can't join `appointments` through `barbers`).

**Why it happens:** The existing `/aceitar-convite` page only calls `supabase.auth.updateUser({ password })`. It does not update `barbers.profile_id`.

**How to avoid:** Add a Postgres trigger on `auth.users` AFTER UPDATE that sets `barbers.profile_id = NEW.id` when `raw_user_meta_data->>'barber_id'` is present and `encrypted_password` transitions from empty to set. Alternatively, call a Server Action from `/aceitar-convite` after `updateUser` succeeds — but this is less reliable if the tab is closed.

**Warning signs:** Barber can log in, layout guard passes, but `/agenda` query for their appointments returns empty because the join `barbers.profile_id = auth.uid()` finds no matching row.

---

### Pitfall 4: RLS on `barber_services` and `working_hours` (No Direct `barbershop_id`)

**What goes wrong:** `barber_services` and `working_hours` do not have a `barbershop_id` column (they reference `barbers.id`). A naive RLS policy of `barbershop_id = JWT value` fails because the column doesn't exist.

**Why it happens:** Normalized schema — foreign key to `barbers`, not directly to `barbershops`.

**How to avoid:** Use a subquery or join in the RLS policy:

```sql
-- working_hours RLS
CREATE POLICY "tenant_working_hours_all" ON public.working_hours
  FOR ALL TO authenticated
  USING (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  )
  WITH CHECK (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );

-- Same pattern for barber_services
```

**Warning signs:** RLS error on INSERT into `working_hours` or `barber_services` even when `barbershop_id` is correctly set in JWT.

---

### Pitfall 5: Zod 4 / react-hook-form Compatibility

**What goes wrong:** `@hookform/resolvers` v5.4.0 uses `zodResolver` — this version must be compatible with `zod` v4.4.3. Zod 4 has a different API from Zod 3 (`.string().min()` semantics changed slightly; `z.coerce` behavior differs).

**Why it happens:** Project uses Zod 4 (v4.4.3) — a major version released in 2025. Many online examples use Zod 3.

**How to avoid:** Use `zod` v4 API. `@hookform/resolvers` v5.x supports Zod 4. `zodResolver` import path is unchanged. The existing `form.tsx` uses `Controller` directly and does not use `@radix-ui/react-slot` — keep this pattern.

**Warning signs:** TypeScript errors on `.refine()` or `.transform()` methods if copied from Zod 3 examples.

---

### Pitfall 6: Storage Bucket Not Created Before Upload

**What goes wrong:** The barber photo upload calls `supabase.storage.from('barber-photos').upload()` but the bucket doesn't exist in the local Supabase instance or in production.

**Why it happens:** Supabase Storage buckets must be explicitly created — they are not auto-created on first upload.

**How to avoid:** Create the `barber-photos` bucket in the Phase 1 migration using the `supabase_storage` API, or create it via a seed/setup step. For local dev: `supabase storage create-bucket barber-photos`. For production: create via Supabase dashboard or via `supabase/seed.sql`.

**Warning signs:** `Bucket not found` error from Supabase Storage SDK.

---

### Pitfall 7: Onboarding Route Guard Ordering in Middleware

**What goes wrong:** If middleware is extended to redirect `/onboarding → /dashboard` when `barbershop_id` exists, but also redirect `/dashboard → /onboarding` when owner has no `barbershop_id`, an infinite loop can occur if the token state is stale.

**Why it happens:** After Step 1, the old token still lacks `barbershop_id`. The browser hits `/dashboard` but the middleware reads the stale JWT and redirects back to `/onboarding`.

**How to avoid:** The `/onboarding` page should not redirect to `/dashboard` via middleware until AFTER the JWT is refreshed client-side. The middleware redirect should be: if `barbershop_id` IS present → redirect to `/dashboard`. The inverse (redirect to `/onboarding` when missing) should NOT be in middleware — let the onboarding page handle its own load state. Only add the forward direction guard.

---

### Pitfall 8: `profiles` Table Has REVOKE on `authenticated`

**What goes wrong:** In Phase 0, `REVOKE ALL ON TABLE public.profiles FROM authenticated, anon, public` was applied. Direct table access from `authenticated` role goes through RLS only. Server Actions that update `profiles.barbershop_id` must use the server Supabase client (not admin) — but the client must have access via the existing RLS policy `"own_profile_all"` which allows `id = auth.uid()`.

**How to avoid:** The onboarding Step 1 Server Action updates `profiles` using the server client (not admin). RLS policy `"own_profile_all"` allows the owner to update their own row. This works correctly — just ensure the server client is used and not the admin client for this operation.

---

## Code Examples

### Migration: Phase 1 Tables with RLS

```sql
-- src/supabase/migrations/20260531000001_phase1_schema.sql

-- barbers
CREATE TABLE public.barbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  profile_id    UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  phone         TEXT NULL,
  photo_url     TEXT NULL,
  specialties   TEXT[] DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_barbers_all" ON public.barbers
  FOR ALL TO authenticated
  USING (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID)
  WITH CHECK (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID);

-- services
CREATE TABLE public.services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id    UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_services_all" ON public.services
  FOR ALL TO authenticated
  USING (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID)
  WITH CHECK (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID);

-- barber_services (no barbershop_id column — RLS via subquery)
CREATE TABLE public.barber_services (
  barber_id        UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  commission_type  TEXT NULL CHECK (commission_type IN ('percent', 'fixed')),
  commission_value NUMERIC(10,2) NULL,
  PRIMARY KEY (barber_id, service_id)
);
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_barber_services_all" ON public.barber_services
  FOR ALL TO authenticated
  USING (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  )
  WITH CHECK (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );

-- working_hours (no barbershop_id column — RLS via subquery)
CREATE TABLE public.working_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_working_hours_all" ON public.working_hours
  FOR ALL TO authenticated
  USING (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  )
  WITH CHECK (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );

-- appointments
CREATE TABLE public.appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id     UUID NOT NULL REFERENCES public.barbers(id),
  service_id    UUID NOT NULL REFERENCES public.services(id),
  client_id     UUID NOT NULL REFERENCES public.clients(id),
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'CONFIRMED'
                CHECK (status IN ('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED')),
  notes         TEXT NULL,
  cancelled_at  TIMESTAMPTZ NULL,
  cancelled_by  UUID NULL REFERENCES auth.users(id),
  cancel_reason TEXT NULL,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  booking_source TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_appointments_all" ON public.appointments
  FOR ALL TO authenticated
  USING (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID)
  WITH CHECK (barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID);
```

### Onboarding Step 1 — createBarbershop Server Action

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBarbershop(data: {
  name: string
  timezone: string
}) {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) return { error: 'Não autenticado' }

  const userId = claimsData.claims.sub as string
  const existingBarbershopId = claimsData.claims.app_metadata?.barbershop_id as string | undefined

  // Idempotency: if barbershop already exists, return its ID
  if (existingBarbershopId) {
    return { data: { barbershop_id: existingBarbershopId, already_existed: true } }
  }

  // Generate slug from name
  const slug = data.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 7)

  const { data: barbershop, error: insertError } = await supabase
    .from('barbershops')
    .insert({ name: data.name, slug, timezone: data.timezone })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  // Link profile to barbershop
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ barbershop_id: barbershop.id })
    .eq('id', userId)

  if (profileError) return { error: profileError.message }

  revalidatePath('/onboarding')
  return { data: { barbershop_id: barbershop.id } }
}
```

### Barber Schedule Query (BARB-04)

```typescript
// In /agenda page.tsx (Server Component)
// Get the barber's barbers row via profile_id
const { data: barberRow } = await supabase
  .from('barbers')
  .select('id')
  .eq('profile_id', userId)
  .maybeSingle()

if (!barberRow) {
  // Barber profile not linked yet — show "aguardando configuração" state
}

// Get today's appointments for this barber
const today = new Date()
const dayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()
const dayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString()

const { data: appointments } = await supabase
  .from('appointments')
  .select(`
    id, start_time, end_time, status, notes,
    clients!inner(full_name, whatsapp_number),
    services!inner(name, duration_minutes)
  `)
  .eq('barber_id', barberRow.id)
  .neq('status', 'CANCELLED')
  .gte('start_time', dayStart)
  .lte('start_time', dayEnd)
  .order('start_time')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `.string().optional()` | Zod v4 — same API mostly, but `z.coerce` improved | 2025 | Online examples may use v3 patterns; use `zod@4` docs |
| `@hookform/resolvers` v3 | v5 (Zod 4 compatible) | 2025 | Import unchanged: `zodResolver` from `@hookform/resolvers/zod` |
| Supabase JS `getClaims()` (custom on base-nova) | Available on `@supabase/ssr` 0.10.3 | 2025 | Confirmed in Phase 0 — use consistently |
| `createServerComponentClient` (old SSR API) | `createServerClient` via `@supabase/ssr` | 2024 | Phase 0 already uses correct API |

**Deprecated/outdated:**
- `supabase.auth.getSession()`: returns potentially stale token. Use `getClaims()` (validates signature) for security-sensitive server paths. [VERIFIED: confirmed in existing Phase 0 code — all server-side code uses getClaims()]
- `@radix-ui/react-slot` in form.tsx: Phase 0 custom `form.tsx` does NOT use this — keep the custom FormControl implementation (it uses a `div` wrapper instead of Slot). [VERIFIED: src/components/ui/form.tsx line 104]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn components (sheet, dialog, select, etc.) are available from `shadcn official` registry and compatible with base-nova preset and Tailwind 4 | Standard Stack | Low — shadcn 4.8.3 is installed and Phase 0 already installed 8 components successfully from the same registry |
| A2 | Supabase Storage bucket-level RLS policies for `barber-photos` — the exact SQL syntax for storage policies may differ from table policies | Code Examples / Pattern 6 | Medium — wrong syntax causes silent upload failures; verify in Supabase Storage docs before writing the migration |
| A3 | The `on_invite_accepted` trigger approach (detecting `encrypted_password` transition) reliably fires on invite acceptance in Supabase's hosted auth flow | Code Examples / Pattern 4 | Medium — if Supabase's invite flow does not trigger AFTER UPDATE on `auth.users` in the expected way, the trigger never fires. The client-side fallback (Server Action called from `/aceitar-convite`) should be prepared as a backup. |
| A4 | `barber-services` and `working_hours` RLS policies using subqueries to `barbers` will not cause performance issues at Phase 1 data scale | Architecture Patterns / Pattern | Low — at Phase 1 scale (small barbershop, <20 barbers), subquery RLS is fine. Phase 2+ may need index optimization. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. [Table is NOT empty — 4 items require attention, especially A2 and A3.]

---

## Open Questions (RESOLVED)

1. **`barbers.profile_id` trigger vs. client-side Server Action**
   - **RESOLVED** — Postgres AFTER UPDATE trigger on `auth.users` confirmed viable (matches Phase 0 AFTER INSERT pattern). The `handle_invite_accepted` trigger is planned in Plan 01-01 Task 2 using the same `SECURITY DEFINER SET search_path = ''` pattern. Client-side Server Action fallback remains as backup in `/aceitar-convite` if the trigger does not fire in the hosted Supabase environment.
   - What we know: The trigger approach is more reliable but requires access to `auth.users` AFTER UPDATE, which is a private schema. Supabase does support triggers on `auth.users` (demonstrated by Phase 0's `on_auth_user_created` trigger on `auth.users` INSERT).
   - What was unclear: Does Supabase allow AFTER UPDATE triggers on `auth.users` in the same way as AFTER INSERT? The `SECURITY DEFINER` function needs `SET search_path = ''` (Phase 0 security pattern).
   - Resolution: Implement the trigger (Plan 01-01 Task 2). If it fails in local testing, call a Server Action from `/aceitar-convite` after `updateUser` succeeds as backup.

2. **Storage RLS policy syntax**
   - **RESOLVED** — For MVP use authenticated-only bucket policy (no per-tenant restriction). The `barber-photos` bucket is created in Plan 01-01 Task 2 with `public: false` and an authenticated-only INSERT policy. Per-tenant tightening is deferred to Phase 8 or when Storage is revisited as a security hardening item.
   - What we know: Supabase Storage uses a `storage.objects` table. Bucket RLS policies are written against `storage.objects.bucket_id` and `auth.uid()`.
   - What was unclear: The exact policy syntax for restricting uploads to a specific barbershop's JWT claim.
   - Resolution: Authenticated INSERT only for Phase 1. Acceptable for MVP.

3. **`database.types.ts` needs updating for new tables**
   - **RESOLVED** — Addressed in Plan 01-01 Task 2 via the `supabase gen types typescript --local > src/types/database.types.ts` command run after the Phase 1 migration is applied. Full type safety for all new tables is available before any UI plan executes.
   - What we know: `src/types/database.types.ts` only contains `barbershops`, `clients`, `profiles` from Phase 0.
   - What was unclear: Whether the plan should include regenerating types after the Phase 1 migration runs.
   - Resolution: Yes — included in Plan 01-01 Task 2. Types regenerated before downstream plans build against new tables.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | Confirmed | 20.x [ASSUMED] | — |
| `supabase` CLI | Migration execution, type gen | Confirmed in devDeps | 2.102.0 | — |
| `shadcn` CLI | New component installation | Confirmed in deps | 4.8.3 | — |
| Supabase local stack | DB migration testing | Confirmed in config.toml | local (port 54321) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | `inviteUserByEmail` Server Action | In `.env.local.example` — [ASSUMED present in `.env.local`] | — | Cannot invite without it |
| `NEXT_PUBLIC_SITE_URL` | Invite redirect URL | In `.env.local.example` — [ASSUMED present in `.env.local`] | — | Invite redirects to wrong URL |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — required for `inviteBarber` Server Action. Confirm it is set before running invite tests.

**Missing dependencies with fallback:**
- None identified.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (Phase 0 did not add testing infrastructure) |
| Config file | None |
| Quick run command | `npm run build` (type-check via TypeScript) |
| Full suite command | `npm run build && npm run lint` |

**Note:** No test runner (Jest, Vitest, Playwright) is installed. Phase 1 validation is via:
1. TypeScript compilation (`npm run build --turbopack`) — catches type errors
2. ESLint (`npm run lint`) — catches code quality issues
3. Manual testing of each success criterion

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| AUTH-04 | Owner completes 4-step wizard, lands on /dashboard | manual | — | Visual + functional flow |
| AUTH-04 | Wizard resumes from last step on browser reopen | manual | — | Requires DB state verification |
| AUTH-05 | Owner sends invite, barber receives email | manual | — | Check inbucket (port 54324) |
| AUTH-05 | Barber accepts invite, `profile_id` is set in `barbers` | manual + SQL check | `supabase db query "SELECT profile_id FROM barbers WHERE ..."` | Verify trigger |
| BARB-01 | Barber created with name/photo/specialties | manual | — | |
| BARB-02 | Working hours saved correctly | manual + SQL check | `supabase db query "SELECT * FROM working_hours WHERE barber_id = ..."` | |
| BARB-03 | Commission saved in `barber_services` | manual + SQL check | `supabase db query "SELECT * FROM barber_services WHERE ..."` | |
| BARB-04 | Barber sees only their own appointments | manual | — | Login as barber, verify filter |
| BARB-05 | Barber marks appointment COMPLETED | manual | — | Verify status in DB |
| SVC-01 | Service CRUD works | manual | — | |
| SVC-02 | Barber↔service assignment | manual + SQL check | `supabase db query "SELECT * FROM barber_services"` | |
| SVC-03 | Service filtered by barber in appointment drawer | manual | — | |
| BOOK-03 | Manual appointment created, conflict check works | manual | — | Test overlap scenario |
| BOOK-05 | Appointment cancelled with reason | manual | — | Verify `cancelled_at` set |

### Sampling Rate

- **Per task commit:** `npm run build` (TypeScript type check)
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full build green + all 6 success criteria manually verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No test runner installed — builds serve as the primary automated quality gate
- [ ] `src/types/database.types.ts` needs regeneration after Phase 1 migration (via `supabase gen types typescript --local > src/types/database.types.ts`)

*(Manual testing via Supabase local studio (port 54323) and inbucket email viewer (port 54324) covers the gaps.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth — barber invite flow, JWT validation |
| V3 Session Management | yes | `refreshSession()` after onboarding step 1; `getClaims()` for server-side validation |
| V4 Access Control | yes — critical | RLS policies on all 5 new tables; admin client used only server-side |
| V5 Input Validation | yes | Zod schemas on all Server Actions; RHF validation on all forms |
| V6 Cryptography | no | No new crypto; HMAC QR tokens are Phase 3 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leakage | Information Disclosure | RLS policies with `barbershop_id = JWT claim` on every new table; subquery pattern for `barber_services` and `working_hours` |
| Privilege escalation via invite | Elevation of Privilege | `inviteUserByEmail` uses server-only admin client; `barber_id` from invite metadata is validated against the barbershop before setting `profile_id` |
| Service role key exposure | Information Disclosure | `SUPABASE_SERVICE_ROLE_KEY` used only in Server Actions via `createAdminClient()`; never in `'use client'` components or passed to browser |
| Photo upload path traversal | Tampering | Storage path uses `${barberId}/${Date.now()}.${ext}` — `barberId` is a UUID from DB, not user input |
| Appointment data injection | Tampering | All appointment fields validated with Zod before INSERT; `barbershop_id` always sourced from JWT, never from request body |
| Double-booking race condition | Denial of Service | App-layer check only (Phase 1); two concurrent requests within milliseconds could bypass. Phase 2 adds DB-level exclusion constraint. Document this known limitation. |

---

## Sources

### Primary (HIGH confidence)
- `src/` codebase — all existing patterns directly verified from source files
- `package.json` — all dependency versions verified
- `supabase/migrations/20260529000001_initial_schema.sql` — Phase 0 RLS pattern to follow
- `src/app/(owner)/layout.tsx`, `src/middleware.ts` — getClaims pattern
- `node_modules/@supabase/supabase-js` — `refreshSession`, `auth.admin.inviteUserByEmail` confirmed via runtime introspection
- `supabase/config.toml` — storage enabled, local ports confirmed
- `.env.local.example` — confirms `SUPABASE_SERVICE_ROLE_KEY` is expected env var

### Secondary (MEDIUM confidence)
- `.planning/phases/01-owner-onboarding-barber-service-setup/01-CONTEXT.md` — locked decisions (D-01 to D-22)
- `.planning/phases/01-owner-onboarding-barber-service-setup/01-UI-SPEC.md` — component list, route structure, interaction contracts

### Tertiary (LOW confidence / ASSUMED)
- Supabase AFTER UPDATE trigger on `auth.users` for `handle_invite_accepted` — pattern inferred from Phase 0 AFTER INSERT trigger; not independently verified against Supabase hosted environment behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json and node_modules
- Architecture: HIGH — patterns derived from existing Phase 0 codebase
- RLS patterns: HIGH — directly modeled on Phase 0 migration SQL
- Pitfalls: HIGH — JWT refresh and profile_id linkage identified from code analysis
- Storage RLS: MEDIUM — exact syntax not verified against Supabase docs
- Trigger on auth.users UPDATE: MEDIUM — inferred from AFTER INSERT pattern

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable stack, 30-day validity)
