# Stack Research — BarberFlow

**Project:** BarberFlow (Multi-tenant barbershop SaaS)
**Researched:** 2026-05-29
**Research method:** Training knowledge (cutoff Aug 2025) + PROJECT.md context
**Note on tooling:** WebSearch, Bash (Context7 CLI), and WebFetch were all unavailable in this environment. Findings are based on deep training knowledge of the documented technologies. Confidence levels reflect this honestly.

---

## Recommended Stack

### Core Layer (Already Decided — HIGH confidence)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Next.js | 15 (App Router) | Full-stack framework | Server Components + Server Actions reduce API boilerplate; middleware for tenant routing; built-in image optimization for barber photos |
| Supabase | Latest (hosted) | Postgres + Auth + Storage + Edge Functions | Managed Postgres with RLS is the canonical choice for multi-tenant SaaS; Auth handles JWT + sessions; Storage for logos/photos; Edge Functions for background jobs |
| TypeScript | 5.x | Type safety | Mandatory for a SaaS with complex domain model (appointments, tenants, roles) |
| Tailwind CSS | 4.x | Styling | CSS-in-JS overhead not worth it; Tailwind 4 with CSS variables is faster and matches ShadCN's component model |
| shadcn/ui | Latest | Component system | Not a package — copies components into your repo. Radix UI primitives underneath. Works natively with Next.js App Router and Tailwind. Best choice for admin dashboards. |

### Database / Backend Layer (HIGH confidence)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Supabase Postgres | 15+ | Primary data store | Row-level security is built into Postgres; no ORM needed for simple queries; use Supabase JS client for typed queries |
| Supabase Auth | Latest | Authentication | Handles email/password, magic link, OAuth. JWT with custom claims carries `tenant_id` and `role`. |
| Supabase Storage | Latest | File uploads | Barber photos, barbershop logos, white-label assets. Bucket-per-tenant or path-prefix-per-tenant. |
| Supabase Edge Functions | Latest | Background jobs | Deno-based. Use for: WhatsApp reminder cron, PIX webhook processing, loyalty point calculation triggers. |
| Supabase Realtime | Latest | Live dashboard | Appointment status changes (PENDING → CHECKED_IN) push to dashboard via Realtime channels. Scoped per tenant. |

### Frontend Libraries (HIGH confidence)

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| React Query (TanStack Query) | v5 | Server state management | Optimistic updates for appointment booking; cache invalidation on realtime events. Works alongside Server Components. |
| React Hook Form | v7 | Form management | Zero-dependency form library. Pairs with Zod for schema validation. Much lighter than Formik. |
| Zod | v3 | Schema validation | Shared types between frontend and Edge Functions. Validate appointment bookings, onboarding forms. |
| date-fns | v3 | Date manipulation | Tree-shakeable, immutable, no Moment.js legacy. Required for scheduling slot calculation, week/month views. |
| lucide-react | Latest | Icons | Already the default with shadcn/ui; consistent icon set. |

### Billing — Asaas (HIGH confidence, Brazilian-specific)

| Component | Details |
|-----------|---------|
| Package | `@asaas/sdk` does not have an official typed SDK — use raw REST via `fetch` or `axios` with typed wrappers |
| Integration point | Next.js Server Actions or Route Handlers (not client-side — API keys must stay server-side) |
| Key endpoints | `POST /subscriptions` (create tenant subscription), `POST /payments` (generate PIX cobrança), `GET /payments/{id}` (poll status), webhooks for payment confirmation |
| Webhook handling | Supabase Edge Function as webhook receiver; validates Asaas signature, updates tenant `subscription_status` in DB |
| PIX for end-customers | Asaas also handles PIX for appointment payments (same platform, two use cases: B2B SaaS billing + B2C appointment payment) |

### WhatsApp Integration (MEDIUM confidence — ecosystem evolving fast)

| Option | Recommendation | Rationale |
|--------|---------------|-----------|
| **WhatsApp Business Cloud API (Meta)** | **Recommended** | Official API. Free tier: 1,000 conversations/month per WABA. Template messages require pre-approval. No per-message cost for business-initiated messages after 24h window opens. Requires Facebook Business Manager account. |
| **Evolution API** | Strong alternative for early stage | Open-source, self-hostable WhatsApp unofficial API. No template pre-approval needed. Risk: Meta ToS violation, potential number ban. Good for MVP/development, not for production at scale. |
| **Z-API** | Paid unofficial bridge | Brazilian SaaS wrapper around unofficial API. Similar risks to Evolution API but managed. ~R$200/month. Easier setup than Evolution API. |
| **Twilio** | Avoid for Brazil | Expensive per-message pricing ($0.005/msg) multiplied across Brazilian WhatsApp volume is prohibitive. Overkill for this use case. |

**Recommended path:** Use Meta Cloud API from day one. The template approval process (1-3 business days) is the main friction. Build reminder templates: "Seu agendamento na [Barbearia] é amanhã às [Horário]. Responda CANCELAR para cancelar." Register templates in Portuguese. Use `axios` or `fetch` with Supabase Edge Functions as the sender.

Package pattern:
```
// No official npm package needed
// Supabase Edge Function (Deno) calls Meta Graph API directly:
// POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
// Header: Authorization: Bearer {WHATSAPP_TOKEN}
```

### QR Code (HIGH confidence)

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `qrcode` | v1.5.x | Server-side QR generation | Node.js library; generate QR as PNG/SVG/Data URL in Server Actions or Edge Functions. Each confirmed appointment gets a unique QR payload (appointment UUID). |
| `react-qr-code` | v2.x | Client-side QR display | SVG-based React component. Use in the confirmation screen and printable ticket. Lightweight (no canvas dependency). |
| `html5-qrcode` | v2.3.x | QR scanning on mobile browser | Camera access via browser API. No native app required for MVP. The barbershop staff uses this on their phone/tablet to scan customer QR. Works in mobile Chrome/Safari. |

**QR payload strategy:** The QR encodes a URL: `https://app.barberflow.com.br/checkin/{appointmentId}?token={hmacSignedToken}`. Scanning opens a page in the staff's browser that calls a Server Action to transition the appointment status. The HMAC token prevents forgery.

### Calendar / Scheduling UI (MEDIUM confidence)

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `react-big-calendar` | v1.x | Admin calendar view | Week/day view for barbershop owner dashboard. Mature, accessible. Requires `moment` or `date-fns` localizer. Use `date-fns` localizer. |
| `@schedule-x/react` | v1.x (2024) | Modern alternative | Newer, lighter, TypeScript-first. Has week view, day view, drag-and-drop. Less battle-tested than react-big-calendar but better DX. Worth evaluating. |
| Custom time-slot grid | — | Customer booking UI | For the customer-facing booking flow (pick time slot), a custom grid of available 30/60-min slots is better UX than a full calendar widget. Build with Tailwind + shadcn/ui buttons. |

**Recommendation:** Use `react-big-calendar` with date-fns localizer for the admin dashboard (proven, handles edge cases). Build a custom slot-picker for the customer booking flow (simpler UX, easier to style on-brand per tenant).

### Mobile Strategy (MEDIUM confidence)

| Option | Recommendation | Rationale |
|--------|---------------|-----------|
| **Phase 1: PWA** | Ship this first | Next.js + `next-pwa` (Workbox) gives offline support, installable on Android home screen, push notifications via Web Push API. Zero extra codebase. |
| **Phase 2: Expo (React Native)** | When native is required | Expo SDK 51+ with Expo Router (file-based routing matching Next.js mental model). Shares: Zod schemas, API types, business logic. Does NOT share UI components. Target: owner app + barber app. |
| **Avoid: React Native CLI** | Not recommended | Expo eliminates 80% of native tooling pain. No reason to use bare RN CLI for a new project in 2025. |
| **Avoid: Capacitor/Ionic** | Not recommended | Barbershop owners are Android-primary in Brazil. Capacitor webview apps feel slow; Expo/RN gives better native feel for camera (QR scanning) and push notifications. |

**Code sharing strategy with Expo:** Create a `/packages/shared` workspace (Turborepo or pnpm workspaces) containing: Zod schemas, TypeScript types, utility functions, API client (typed `fetch` wrappers). Next.js and Expo both import from `@barberflow/shared`. UI is NOT shared — each platform has its own components.

---

## Multi-Tenancy Strategy

### Tenancy Model: Shared Database, Schema-per-Tenant via RLS

**Do NOT use:** Separate databases per tenant (too expensive at early stage), separate Supabase projects per tenant (operational nightmare).

**Use:** Single Supabase project, single schema, with `tenant_id` on every table, enforced by RLS.

### Table Design Pattern

Every table that contains tenant data has a `tenant_id UUID NOT NULL REFERENCES tenants(id)` column. No exceptions.

```sql
-- Core tenant table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- used for subdomain routing
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All domain tables follow this pattern
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  barber_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  service_id UUID NOT NULL REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMPTZ NOT NULL,
  qr_token TEXT,                       -- HMAC-signed token for QR check-in
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### JWT Custom Claims for RLS

Add `tenant_id` and `role` to the Supabase JWT via an Auth Hook (Database Function trigger on `auth.users`):

```sql
-- Function called by Supabase Auth Hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  user_tenant_id UUID;
  user_role TEXT;
BEGIN
  SELECT tenant_id, role INTO user_tenant_id, user_role
  FROM public.profiles WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::TEXT));
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

Then in RLS policies, use `(auth.jwt() ->> 'tenant_id')::UUID`:

```sql
-- Appointments: users only see their tenant's data
CREATE POLICY "tenant_isolation" ON appointments
  FOR ALL USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  );

-- Barbers only see their own appointments
CREATE POLICY "barber_own_appointments" ON appointments
  FOR SELECT USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    AND (
      (auth.jwt() ->> 'user_role') = 'owner'
      OR barber_id = auth.uid()
    )
  );
```

### Subdomain Routing for White Label

Next.js middleware intercepts every request and extracts the tenant from the subdomain:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Skip for main app domain
  if (subdomain === 'app' || subdomain === 'www') {
    return NextResponse.next();
  }

  // Rewrite: /barbearia-silva/dashboard → /dashboard
  // with tenant slug available via request headers
  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}
```

Tenant config (logo, colors) is fetched once per layout and cached with Next.js `unstable_cache` keyed by tenant slug.

### Service Role for Admin Operations

For operations that need to bypass RLS (e.g., the SaaS owner's admin panel, webhook handlers):
- Use Supabase `service_role` key ONLY in Server Actions and Edge Functions
- NEVER expose `service_role` key to client
- Create a separate `admin` schema or use Supabase's built-in Management API for platform-level operations

---

## Key Library Decisions

### State Management
- **No Redux / Zustand for server state.** TanStack Query v5 handles all server state.
- **Zustand** for client-only UI state (modal open/close, wizard step, selected date in calendar). Keep it minimal.
- **React Context** only for theme/tenant branding passed from layout.

### Forms
- `react-hook-form` + `zod` — standard pairing, no alternatives worth considering at this scale.

### Tables / Data Grids
- `@tanstack/react-table` v8 — headless, pairs with shadcn/ui DataTable pattern. For the financial reports and appointment history tables.

### Email (transactional)
- **Resend** — modern email API with React Email templates. Used for: account verification, password reset, booking confirmation fallback. Not the primary notification channel (WhatsApp is), but required for auth flows.
- Package: `resend` + `@react-email/components`

### Scheduling Logic (backend)
- No external library needed. The availability algorithm is custom:
  1. Load barber's working hours for the day
  2. Load existing confirmed appointments
  3. Subtract blocked slots
  4. Return available start times at service-duration intervals
- This runs as a Next.js Server Action (or Route Handler) — pure Postgres query, not a separate service.

### QR Code Specifics
```
npm install qrcode @types/qrcode          # server-side generation
npm install react-qr-code                  # client-side display
npm install html5-qrcode                   # scanning on staff device
```

### PIX / Payments
Asaas handles both use cases:
1. **SaaS subscription billing** (tenant pays BarberFlow monthly) — `POST /subscriptions`
2. **Appointment pre-payment** (client pays barbershop via PIX) — `POST /payments` with `billingType: 'PIX'`

Key integration points:
- Webhook URL: Supabase Edge Function at `https://[project].supabase.co/functions/v1/asaas-webhook`
- Validate webhook using Asaas `asaas-access-token` header
- On payment confirmation: update `appointments.payment_status = 'PAID'`, send WhatsApp confirmation

### Loyalty / Stamp System
No external library. Custom implementation:
- Table `loyalty_cards (id, tenant_id, client_id, stamps_count, rule_id)`
- Table `loyalty_rules (id, tenant_id, stamps_required, reward_description)`
- Postgres trigger on `appointments.status = 'COMPLETED'` → increments `loyalty_cards.stamps_count`
- Supabase Edge Function checks if stamps_count reached threshold → marks reward as available

---

## What NOT to Use

| Technology | Category | Why Not |
|------------|----------|---------|
| Prisma ORM | Database | Adds migration complexity on top of Supabase's own migration system. Supabase JS client + raw SQL for complex queries is sufficient. If you want type-safe queries, use `supabase-js` with generated types (`supabase gen types typescript`). |
| Stripe | Payments | No native PIX support (PIX support via Stripe Brazil is limited and expensive). Asaas is purpose-built for the Brazilian market with PIX, boleto, and recorrência. |
| Firebase | Auth/DB | Would replace Supabase entirely — not a complement. The team chose Supabase for good reasons (Postgres, RLS, open source). Don't mix. |
| Next-Auth / Auth.js | Auth | Supabase Auth is already baked in with session management and JWT. Adding Auth.js creates two parallel auth systems. Use Supabase Auth exclusively. |
| Moment.js | Dates | Deprecated in its own documentation since 2020. Use date-fns v3. |
| FullCalendar | Scheduling UI | Heavy commercial library ($299+ for some features). react-big-calendar or @schedule-x/react are sufficient and free. |
| Twilio WhatsApp | Messaging | 3-5x more expensive per message than Meta Cloud API direct. No advantage for Brazil. |
| React Native CLI (bare) | Mobile | Expo SDK 51+ eliminates all the reasons to use bare RN. Use Expo. |
| Separate Supabase projects per tenant | Architecture | Would require per-tenant JWT configuration, multiplies infrastructure cost, makes cross-tenant analytics impossible. |
| Redis / external cache | Caching | Next.js unstable_cache + Supabase edge caching is sufficient for this scale. Add Redis only if profiling shows cache miss bottlenecks above ~10K MAU. |
| GraphQL | API layer | Overkill. Next.js Server Actions + typed Supabase client covers all data needs without a GraphQL layer. |
| Turborepo (initially) | Monorepo | Set up a simple `packages/shared` directory first. Add Turborepo when the mobile app phase begins and build orchestration becomes complex. |

---

## Confidence Levels

| Area | Confidence | Basis | Notes |
|------|------------|-------|-------|
| Next.js 15 App Router patterns | HIGH | Well-documented, stable since late 2024, training knowledge current | Server Components, Server Actions, middleware are stable APIs |
| Supabase RLS multi-tenancy | HIGH | Official Supabase docs well-covered in training, patterns are standard | JWT custom claims hook is v2 Supabase Auth feature, verify hook name in current docs |
| Supabase Auth Hooks (custom JWT claims) | MEDIUM | Feature exists and is documented; exact configuration UI/YAML may have changed | Verify hook setup in current Supabase dashboard — this feature was in beta in 2024 |
| Asaas API | MEDIUM | Brazilian platform with stable REST API; no official typed SDK in npm | Verify current endpoint structure at developers.asaas.com.br before building; API may have v3 updates |
| WhatsApp Business Cloud API (Meta) | MEDIUM | Meta Graph API is stable; template approval process well-known; rate limits accurate as of 2024 | Pricing model for business-initiated conversations changed in mid-2023; re-verify free tier limits at current date |
| Evolution API / Z-API | LOW | Third-party unofficial bridges; compliance risk is real | Terms of Service risk acknowledged; Meta actively bans numbers using unofficial APIs |
| QR code libraries (`qrcode`, `react-qr-code`, `html5-qrcode`) | HIGH | All mature, stable, widely used packages | Versions pinned to known-stable; verify latest before installing |
| react-big-calendar | HIGH | Mature, widely used, stable API | Works with date-fns localizer confirmed |
| @schedule-x/react | MEDIUM | Newer library (2024); good DX claims but less battle-tested | Review GitHub issues for edge cases before committing |
| TanStack Query v5 | HIGH | Stable release since late 2023; breaking changes from v4 are known and documented | |
| Expo / React Native mobile strategy | HIGH | Expo SDK 51 (2024) is mature; Expo Router v3 is stable | Confirm Expo SDK version at time of mobile phase start |
| shadcn/ui | HIGH | Actively maintained; App Router compatible; copy-in model avoids version lock | |
| Resend + React Email | HIGH | Widely adopted in Next.js ecosystem as of 2024 | |
| Subdomain routing via Next.js middleware | HIGH | Standard pattern, well-documented in Next.js multi-tenant examples | |
| Loyalty stamp — custom Postgres trigger | HIGH | Standard Postgres trigger pattern; no library needed | |
| PIX QR generation (Asaas handles it) | HIGH | Asaas generates the PIX QR/payload server-side; you display it | You do NOT generate PIX QR yourself — Asaas returns `pixQrCode` in the payment response |

---

## Open Questions (Verify Before Building)

1. **Supabase Auth Hooks exact configuration** — The `custom_access_token_hook` pattern requires a specific setup in Supabase dashboard under "Auth > Hooks". Verify the current setup flow at supabase.com/docs before Phase 1.

2. **Asaas PIX webhook reliability** — Asaas has had historical latency issues with PIX webhooks. Build polling fallback: if webhook not received within 30s, poll `GET /payments/{id}` from a Supabase Edge Function cron every 10s for 5 minutes.

3. **WhatsApp template pre-approval timeline** — Register reminder templates (appointment reminder, re-engagement, loyalty reward) in the Meta Business Manager during Phase 1 setup, not when the feature is coded. Approval can take 1-7 days.

4. **Multi-tenant subdomain DNS** — The white-label custom subdomain feature (`barba.nomedabarbearia.com.br`) requires Vercel's wildcard domain feature or a custom Nginx proxy. Verify Vercel's wildcard domain support on the chosen pricing plan.

5. **Supabase Realtime with RLS** — As of 2024, Supabase Realtime channels can be scoped with RLS, but the channel authorization model (Broadcast vs Postgres Changes) has nuances. Verify that `postgres_changes` events respect RLS policies in the current Supabase version before building the live dashboard.
