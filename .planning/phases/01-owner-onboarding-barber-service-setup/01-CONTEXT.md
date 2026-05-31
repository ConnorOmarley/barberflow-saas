# Phase 1: Owner Onboarding + Barber & Service Setup - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A new owner completes guided onboarding (4 steps, ≤5 minutes) and lands on a functional dashboard. From there, they can manage their entire shop: add barbers, define services, set working hours, configure commissions per barber per service, and create manual appointments. Barbers can log in, view their schedule, and mark appointments as COMPLETED.

**In scope:**
- AUTH-04: Guided onboarding wizard (4 steps)
- AUTH-05: Invite-sending UI for barbers from /dashboard/equipe
- BARB-01 to BARB-05: Barber CRUD, working hours, commissions, barber schedule view, mark COMPLETED
- SVC-01 to SVC-03: Service catalogue CRUD, barber↔service assignment
- BOOK-03: Manual appointment creation (drawer) by owner or barber
- BOOK-05: Owner cancels any appointment with optional reason

**Out of scope:**
- Public booking portal (Phase 2)
- Exclusion constraint GIST on appointments (Phase 2 adds this)
- WhatsApp opt-in (Phase 5)
- Loyalty stamps (Phase 4)
- SaaS billing creation on onboarding (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Onboarding Wizard (AUTH-04)

- **D-01:** 4-step wizard at `/onboarding`:
  - Step 1: Nome da barbearia + Timezone (creates `barbershops` row + sets `profiles.barbershop_id`)
  - Step 2: Horários gerais da barbearia — flexível por dia da semana (creates `working_hours` rows for the shop)
  - Step 3: Primeiro barbeiro — nome obrigatório, login/invite opcional na Fase 1 (creates `barbers` row)
  - Step 4: Primeiro serviço — nome, duração, preço + templates rápidos (Corte, Barba, Corte+Barba) (creates `services` row)
  - After step 4: redirect to `/dashboard`
- **D-02:** Dashboard is NOT blocked after onboarding. Show a setup checklist widget inside `/dashboard` indicating remaining items (e.g., "Adicione mais barbeiros", "Defina comissões").
- **D-03:** Wizard resumes from last completed step if owner closes browser mid-way. Each step commits to DB before advancing. On revisit to `/onboarding`, detect current onboarding progress and resume from the incomplete step. This avoids duplicate `barbershops` rows.
- **D-04:** If an authenticated owner (already has `barbershop_id` in JWT) tries to access `/onboarding` directly → redirect to `/dashboard`. Middleware handles this.
- **D-05:** JWT is refreshed after step 1 completes so `barbershop_id` is injected before steps 2–4. Use `supabase.auth.refreshSession()` or force a token refresh after the barbershop row is created.

### Database Schema — New Tables

- **D-06:** `barbers` table (separate from `profiles`):
  ```sql
  CREATE TABLE public.barbers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    profile_id    UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    phone         TEXT NULL,
    photo_url     TEXT NULL,
    specialties   TEXT[] DEFAULT '{}',  -- informal/marketing only
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
  `profile_id` is NULL until the barber accepts an email invite. Separates operational entity from authentication.

- **D-07:** `services` table:
  ```sql
  CREATE TABLE public.services (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbershop_id     UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    duration_minutes  INT NOT NULL,
    price             NUMERIC(10,2) NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- **D-08:** `barber_services` junction table (replaces `specialties` as operational concept):
  ```sql
  CREATE TABLE public.barber_services (
    barber_id         UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    service_id        UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    commission_type   TEXT NULL CHECK (commission_type IN ('percent', 'fixed')),
    commission_value  NUMERIC(10,2) NULL,
    PRIMARY KEY (barber_id, service_id)
  );
  ```
  Commission belongs to the barber↔service relationship. Fields NULL for barbershops without commission tracking.

- **D-09:** `working_hours` table (per barber, per day):
  ```sql
  CREATE TABLE public.working_hours (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id    UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
  Multiple rows per day supported (split shifts, e.g., SEG 09:00–12:00 + SEG 14:00–18:00). Phase 2 slot engine queries this table.

- **D-10:** `appointments` table (created in Phase 1, exclusion constraint added in Phase 2):
  ```sql
  CREATE TABLE public.appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbershop_id   UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    barber_id       UUID NOT NULL REFERENCES public.barbers(id),
    service_id      UUID NOT NULL REFERENCES public.services(id),
    client_id       UUID NOT NULL REFERENCES public.clients(id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'CONFIRMED'
                    CHECK (status IN ('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED')),
    notes           TEXT NULL,
    cancelled_at    TIMESTAMPTZ NULL,
    cancelled_by    UUID NULL REFERENCES auth.users(id),
    cancel_reason   TEXT NULL,
    created_by      UUID NOT NULL REFERENCES auth.users(id),
    booking_source  TEXT NULL,  -- 'manual', 'portal' (Phase 2)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
  Phase 1: app-layer validation to prevent same barber double-booking (ignore CANCELLED appointments). Phase 2: adds `EXCLUDE USING gist (tsrange(start_time, end_time) WITH &&) WHERE (status != 'CANCELLED')`.

### Barber Management UI (BARB-01 to BARB-05)

- **D-11:** Full CRUD at `/dashboard/equipe`. Barber card list with name, photo, status. Drawer for create/edit. Actions: Editar, Convidar (sends email invite → sets `profile_id` when accepted), Desativar.
- **D-12:** `specialties TEXT[]` kept as an optional informal/marketing field on `barbers`. NOT used for operational logic. Operational "what a barber offers" is exclusively via `barber_services`.
- **D-13:** Barber invite UI: owner enters barber email → calls `supabase.auth.admin.inviteUserByEmail()` (server action) with `options.data = { barbershop_id, role: 'barber', barber_id }`. When invite accepted via `/aceitar-convite`, the `barber_id` from metadata is used to set `barbers.profile_id`.

### Services Management UI (SVC-01 to SVC-03)

- **D-14:** Full CRUD at `/dashboard/servicos`. Service list with name, duration, price. Drawer for create/edit. Templates rápidos offered when creating first service: Corte (30min), Barba (20min), Corte+Barba (50min) — one-click prefill.
- **D-15:** Barber↔service assignment is managed inside the barber edit drawer (checklist of services + commission fields per service). Also accessible from service detail (list of barbers offering this service).

### Manual Appointment (BOOK-03, BOOK-05)

- **D-16:** "Novo agendamento" as a global action (button in dashboard header or QuickActions). Opens a side drawer. Fields: Cliente (combobox search → show existing matches; if no match, create inline with nome + whatsapp), Barbeiro (select), Serviço (select, filtered by barber), Data, Hora, Observações (optional). Status on create = CONFIRMED.
- **D-17:** App-layer duplicate check on manual appointment: before INSERT, query appointments WHERE barber_id = X AND status != 'CANCELLED' AND tsrange overlaps. Return error if conflict exists. No DB-level constraint yet.
- **D-18:** Cancellation: inline action menu per appointment row (Editar / Completar / Cancelar). "Cancelar" opens a small confirm dialog with optional `cancel_reason` field. On confirm: UPDATE appointments SET status='CANCELLED', cancelled_at=NOW(), cancelled_by=auth.uid(), cancel_reason=?. Appointments are NEVER deleted.
- **D-19:** Also expose cancel action inside the appointment edit drawer as a secondary destructive button.
- **D-20:** Barber schedule view (BARB-04): `/dashboard/agenda` already exists as a shell from Phase 0. Phase 1 fills it in: day-view and week-view tabs showing the barber's own appointments (filtered by barber_id = logged-in barber's barbers row).

### Architecture Notes

- **D-21:** Prepare architecture for future roles: OWNER, MANAGER, BARBER, RECEPTIONIST. The `profiles.role` CHECK currently only allows 'owner' | 'barber' — Phase 1 migration should NOT add new roles yet (leave for future) but the `barbers` table design already decouples auth identity from operational identity.
- **D-22:** All new tables have RLS enabled immediately. Policies follow Phase 0 pattern: read `barbershop_id` from `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Multi-Tenancy
- `.planning/REQUIREMENTS.md` — Full requirements list with IDs (BARB-01–05, SVC-01–03, BOOK-03, BOOK-05, AUTH-04–05)
- `supabase/migrations/20260529000001_initial_schema.sql` — Phase 0 schema pattern (RLS, JWT claims, trigger structure to follow)
- `supabase/migrations/20260530000004_security_hardening.sql` — Security hardening applied in Phase 0

### Architecture Constraints
- `CLAUDE.md` — Critical constraints: multi-tenancy (every table has barbershop_id + RLS), scheduling tsrange pattern, JWT claims pattern
- `.planning/ROADMAP.md` Phase 1 section — Success criteria and requirements list

### Existing Code Integration Points
- `src/lib/supabase/server.ts` — Server-side Supabase client (use for Server Actions and Server Components)
- `src/lib/supabase/client.ts` — Client-side Supabase client
- `src/middleware.ts` — Route protection pattern (extend for /onboarding guard)
- `src/components/shell/dashboard-shell.tsx` — Nav items "Equipe" and "Serviços" are placeholder buttons — Phase 1 adds hrefs
- `src/app/(owner)/layout.tsx` — Owner route group protection (model for onboarding guard)
- `src/app/actions/auth.ts` — Server Action pattern (signOut) — model for invite Server Action
- `src/components/ui/form.tsx` — Custom RHF form integration (shadcn v4, no @radix-ui/react-slot)
- `src/components/ui/` — Available shadcn components: button, card, input, label, badge, alert, separator

### Phase 0 Decisions (carry forward)
- `src/app/(auth)/aceitar-convite/page.tsx` — Invite acceptance page already built; Phase 1 must ensure `barbers.profile_id` is set when invite is accepted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardShell` (`src/components/shell/dashboard-shell.tsx`): sidebar, nav, avatar — add hrefs to Equipe (`/dashboard/equipe`) and Serviços (`/dashboard/servicos`) items
- `form.tsx` + `input.tsx` + `button.tsx` + `card.tsx`: all available for onboarding and CRUD forms
- `src/app/actions/auth.ts` (signOut Server Action): model for new Server Actions (invite, create appointment, cancel, etc.)
- `src/app/(owner)/layout.tsx`: owner JWT check pattern — model for onboarding layout guard

### Established Patterns
- **Server Actions for mutations**: use `'use server'` functions (not API routes) for all DB writes — consistent with Phase 0 pattern
- **Supabase server client for SSR**: `createClient()` from `@/lib/supabase/server` in Server Components and Actions
- **shadcn v4 forms**: React Hook Form + Zod validation, using the custom `form.tsx` (no @radix-ui/react-slot)
- **CSS variables + Tailwind**: all styling uses `var(--...)` tokens; follow dark theme patterns in `globals.css`
- **Role/barbershop_id from JWT**: `supabase.auth.getClaims()` → `data.claims.app_metadata?.barbershop_id` and `.role`

### Integration Points
- `middleware.ts`: extend to redirect `/onboarding` → `/dashboard` if barbershop_id exists in JWT; redirect `/dashboard/*` → `/onboarding` if owner and barbershop_id is NULL
- Dashboard nav: activate Equipe and Serviços links in `DashboardShell`
- `/aceitar-convite`: add logic to set `barbers.profile_id` when invite is accepted (pass `barber_id` in invite metadata)
- `profiles.barbershop_id`: set during onboarding Step 1 → triggers JWT refresh

</code_context>

<specifics>
## Specific Ideas

- **Onboarding step 4 templates:** When creating first service, offer one-click prefill buttons: "Corte (30min, R$40)", "Barba (20min, R$25)", "Corte + Barba (50min, R$60)" — owner can adjust values
- **Working hours multi-turn model:** `working_hours` table allows multiple rows per day (split shifts). Phase 1 onboarding step 2 collects simple per-day start/end; the CRUD in /dashboard/equipe allows split shifts
- **Architecture for future roles:** `barbers` table intentionally decoupled from `profiles`. Future: RECEPTIONIST, MANAGER can have barbers rows without needing custom JWT claims refactor
- **Status roadmap:** PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED defined now. NO_SHOW added in a future phase
- **Manual appointment form:** client search shows existing clients by name/WhatsApp; if no match, "Criar cliente" inline form (name + whatsapp, whatsapp_opt_in = false by default)

</specifics>

<deferred>
## Deferred Ideas

- **Convite com role MANAGER/RECEPTIONIST** — futuras roles além de owner/barber. Arquitetura preparada mas não implementada.
- **Múltiplas unidades / barbearia por franquia** — complexidade v3+, fora do escopo
- **Cancelamento/remarcação pelo cliente** — BOOK-V2-01, Phase 2+
- **Online payment na criação de agendamento** — BOOK-V2-02, Phase 2+

</deferred>

---

*Phase: 1-owner-onboarding-barber-service-setup*
*Context gathered: 2026-05-31*
