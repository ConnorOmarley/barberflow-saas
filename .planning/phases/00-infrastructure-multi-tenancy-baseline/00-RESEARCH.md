# Phase 0: Infrastructure & Multi-Tenancy Baseline - Research

**Researched:** 2026-05-29
**Domain:** Supabase Auth + RLS multi-tenancy, Next.js 15 App Router, JWT custom claims
**Confidence:** HIGH

---

## User Constraints (from CLAUDE.md)

### Locked Decisions

- **Framework:** Next.js 15 (App Router) — pin `next@15` explicitly; `next@latest` is now v16
- **Database + Auth:** Supabase (Postgres + RLS + Supabase Auth + custom JWT claims)
- **Styling:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Multi-tenancy:** Single Supabase schema + RLS (NOT schema-per-tenant, NOT separate Supabase projects per tenant)
- **RLS primary gate:** Policies read from JWT `app_metadata.barbershop_id` — application-layer filtering is SECONDARY only
- **Every table:** `barbershop_id UUID NOT NULL` with RLS enabled — no exceptions
- **Auth package:** `@supabase/ssr` — NOT `auth-helpers-nextjs` (deprecated)

### Do NOT Use

Prisma, Stripe, Firebase, Auth.js, NextAuth, Moment.js, separate Supabase projects per tenant.

### Claude's Discretion

- shadcn/ui component preset choice (New York style recommended by UI-SPEC)
- Tailwind 4 vs Tailwind 3 (Tailwind 4 is current; shadcn/ui supports it)
- Test framework selection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Owner can create account with email and password, receives verification email | Supabase signUp() with PKCE flow, /auth/confirm route handler, verifyOtp() |
| AUTH-02 | Owner can log in and session persists across browser refreshes | @supabase/ssr createServerClient + middleware session refresh via getClaims() |
| AUTH-03 | Owner can reset password via email link | resetPasswordForEmail() + /nova-senha callback route + updateUser() |
| AUTH-04 | Owner completes barbershop onboarding in ≤4 steps (schema only in Phase 0; flow in Phase 1) | barbershops table schema + profiles.role + RLS policies |
| AUTH-05 | Owner invites barber by email; barber creates own password on accept | auth.admin.inviteUserByEmail() with options.data for barbershop_id + /aceitar-convite route |
| AUTH-06 | Barber logs in and sees only their own agenda (role-scoped routing) | JWT role claim in app_metadata + middleware redirect logic + route groups |
| AUTH-07 | Client identifies by name + WhatsApp on booking (no account required) | clients table with whatsapp_opt_in fields — no auth row needed for v1 clients |
| AUTH-08 | Each barbershop has isolated data space — enforced by CI query | pg_tables WHERE rowsecurity = false must return empty; RLS on every table |
</phase_requirements>

---

## Summary

Phase 0 establishes the non-retrofittable foundation: every Supabase table in `public` has RLS enabled with policies reading `barbershop_id` from JWT `app_metadata`, plus the Next.js 15 App Router structure with route groups for owner/barber/client roles. This phase has no upstream dependencies — it is the bedrock all other phases build on.

The two open questions from STATE.md are now resolved: `custom_access_token_hook` is a real Supabase Auth feature available under Authentication > Hooks in the dashboard (and via `config.toml` for local dev), and `@supabase/ssr` v0.10.3 is confirmed as the current package (replacing the deprecated `@supabase/auth-helpers-nextjs`).

The most critical discovery for planning: `next@latest` is now Next.js 16 (which renames `middleware.ts` to `proxy.ts`). The project must pin `next@"^15.5.18"` explicitly during project init to stay on Next.js 15 where `middleware.ts` is correct. The Supabase SSR documentation and all current Supabase examples are written for Next.js 15; Next.js 16 compatibility with `@supabase/ssr` requires using `proxy.ts` instead.

**Primary recommendation:** Pin `next@"^15.5.18"`. Use `@supabase/ssr@0.10.3` with `createServerClient` / `createBrowserClient`. Implement `custom_access_token_hook` as a Postgres function that reads `barbershop_id` and `role` from a `profiles` table and injects them into JWT `app_metadata`. All RLS policies read `(auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::uuid` directly — no subqueries needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User authentication (signup/login/reset) | Frontend Server (SSR) | Supabase Auth | Supabase Auth handles token issuance; SSR handles session cookie storage and refresh |
| Session persistence across refreshes | Frontend Server (middleware) | Browser (cookie) | middleware.ts calls getClaims() to refresh tokens; cookie stores session |
| JWT custom claims (role + barbershop_id) | Database (Supabase hook) | — | custom_access_token_hook runs in Postgres at token issuance time |
| Tenant isolation (RLS) | Database (Postgres) | — | RLS is enforced at DB layer; never at application layer as primary gate |
| Route protection (role-based redirect) | Frontend Server (middleware) | — | middleware.ts reads JWT claims and redirects; never trust client-side checks alone |
| Barber invite flow | API / Backend (Server Action) | Supabase Auth | inviteUserByEmail called server-side only (requires service role) |
| Client identification (no account) | Database (clients table) | — | clients row stores name + whatsapp, no auth.users row |
| CI RLS assertion | Database (pg_tables query) | — | SELECT against pg_tables.rowsecurity |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `^15.5.18` | Full-stack framework | App Router, Server Components, middleware — use 15.x not 16.x (middleware.ts → proxy.ts rename in 16) [VERIFIED: npm registry] |
| `@supabase/ssr` | `0.10.3` | Supabase client for SSR | Official replacement for deprecated auth-helpers-nextjs; createServerClient + createBrowserClient [VERIFIED: npm registry] |
| `@supabase/supabase-js` | `2.106.2` | Supabase JS client | Core client for all Supabase operations [VERIFIED: npm registry] |
| `react` | `^19.2.6` | UI runtime | Required by Next.js 15 [VERIFIED: npm registry] |
| `react-dom` | `^19.2.6` | DOM renderer | Required by Next.js 15 [VERIFIED: npm registry] |
| `typescript` | `^6.0.3` | Type safety | Mandatory for this domain [VERIFIED: npm registry] |
| `tailwindcss` | `^4.3.0` | Styling | Tailwind 4 with CSS variables; compatible with shadcn/ui [VERIFIED: npm registry] |
| `react-hook-form` | `^7.76.1` | Form state management | Locked decision from CLAUDE.md [VERIFIED: npm registry] |
| `zod` | `^4.4.3` | Schema validation | Locked decision from CLAUDE.md [VERIFIED: npm registry] |
| `@hookform/resolvers` | `^5.4.0` | Zod adapter for RHF | Bridges react-hook-form and zod [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase` (CLI) | `2.102.0` | Local dev + migrations | `supabase migration new`, `supabase db push`, `supabase start` — requires Docker [VERIFIED: npm registry] |
| `lucide-react` | `^1.17.0` | Icons | shadcn/ui default icon set; included with shadcn init [VERIFIED: npm registry] |
| `@types/node` | `^25.9.1` | Node.js types | TypeScript Node.js type definitions [VERIFIED: npm registry] |
| `@types/react` | `^19.2.15` | React types | TypeScript React type definitions [VERIFIED: npm registry] |

### shadcn/ui Components (Phase 0)

shadcn/ui is not an npm package — it copies components into `src/components/ui/`. Components required for Phase 0 (from UI-SPEC):

```
button input label form card separator alert badge
```

Install command after `npx shadcn@latest init`:
```bash
npx shadcn@latest add button input label form card separator alert badge
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Auth | NextAuth / Auth.js | CLAUDE.md prohibits these; Supabase Auth has JWT custom claims hook built-in |
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers-nextjs is deprecated; ssr is the official replacement |
| `next@"^15.5.18"` | `next@latest` (16.x) | Next.js 16 renames middleware.ts → proxy.ts; all Supabase SSR docs target 15.x |
| Tailwind 4 | Tailwind 3 | Tailwind 4 is current stable; shadcn/ui supports both |

**Installation (project init):**
```bash
npx create-next-app@"^15.5.18" barberflow-saas \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd barberflow-saas
npm install @supabase/ssr @supabase/supabase-js
npm install react-hook-form @hookform/resolvers zod
npm install lucide-react
npx shadcn@latest init
npx shadcn@latest add button input label form card separator alert badge
```

---

## Package Legitimacy Audit

> slopcheck ran against PyPI (wrong registry for Node.js packages — it flagged all npm packages as "SLOP" since they don't exist on PyPI). All packages below were verified directly via `npm view` against the npm registry and confirmed via official documentation or official GitHub repositories.

| Package | Registry | Age | Source Repo | Disposition |
|---------|----------|-----|-------------|-------------|
| `@supabase/ssr` | npm | Sep 2023 (1.7 yrs) | github.com/supabase/ssr | Approved — 498K downloads/wk, official Supabase package [VERIFIED: npm registry] |
| `@supabase/supabase-js` | npm | 2020 | github.com/supabase/supabase-js | Approved — official Supabase client [VERIFIED: npm registry] |
| `next` | npm | 2016 | github.com/vercel/next.js | Approved — Vercel official [VERIFIED: npm registry] |
| `react` | npm | 2013 | github.com/facebook/react | Approved — Meta official [VERIFIED: npm registry] |
| `react-dom` | npm | 2013 | github.com/facebook/react | Approved — Meta official [VERIFIED: npm registry] |
| `react-hook-form` | npm | 2019 | github.com/react-hook-form/react-hook-form | Approved — widely used forms library [VERIFIED: npm registry] |
| `zod` | npm | 2020 | github.com/colinhacks/zod | Approved — standard schema validation [VERIFIED: npm registry] |
| `@hookform/resolvers` | npm | 2020 | github.com/react-hook-form/resolvers | Approved — official react-hook-form companion [VERIFIED: npm registry] |
| `tailwindcss` | npm | 2017 | github.com/tailwindlabs/tailwindcss | Approved — official Tailwind [VERIFIED: npm registry] |
| `lucide-react` | npm | 2022 | github.com/lucide-icons/lucide | Approved — shadcn/ui default icons [VERIFIED: npm registry] |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran against wrong registry; all packages verified via npm view and official sources)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser Request
      |
      v
middleware.ts (Next.js 15)
  - createServerClient(@supabase/ssr)
  - await supabase.auth.getClaims()  ← refreshes token, writes new cookie
  - reads JWT app_metadata.role
  - redirects unauthenticated → /entrar
  - redirects role mismatch (barber → /(owner)/dashboard redirects → /(barber)/agenda)
      |
      v
App Router Route Groups
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │  (auth)      │  (owner)     │  (barber)    │  (public)    │
  │  /cadastro   │  /dashboard  │  /agenda     │  /[slug]/    │
  │  /entrar     │  /...        │  /...        │  booking/*   │
  │  /nova-senha │              │              │              │
  │  /aceitar-   │              │              │              │
  │   convite    │              │              │              │
  └──────────────┴──────────────┴──────────────┴──────────────┘
      |
      v
Server Components / Server Actions
  - createClient() from utils/supabase/server.ts
  - reads JWT claims for authorization
  - RLS enforced at DB layer (not here)
      |
      v
Supabase Postgres (RLS Layer)
  - Every query filtered by barbershop_id = auth.jwt()->'app_metadata'->>'barbershop_id'
  - No cross-tenant data possible
      |
      v
custom_access_token_hook (Postgres function)
  - Called on every token issuance/refresh
  - Reads profiles.role + profiles.barbershop_id
  - Injects into JWT app_metadata
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── cadastro/page.tsx          # AUTH-01: Owner signup
│   │   ├── entrar/page.tsx            # AUTH-02: Owner login
│   │   ├── recuperar-senha/page.tsx   # AUTH-03: Password reset request
│   │   ├── nova-senha/page.tsx        # AUTH-03: New password form
│   │   └── aceitar-convite/page.tsx   # AUTH-05: Barber invite acceptance
│   ├── (owner)/
│   │   ├── layout.tsx                 # Owner auth guard + shell
│   │   └── dashboard/page.tsx         # AUTH-02/AUTH-04: Owner shell
│   ├── (barber)/
│   │   ├── layout.tsx                 # Barber auth guard + shell
│   │   └── agenda/page.tsx            # AUTH-06: Barber shell
│   └── auth/
│       └── confirm/route.ts           # AUTH-01/AUTH-03: PKCE callback handler
├── components/
│   └── ui/                            # shadcn/ui components (button, input, etc.)
├── lib/
│   └── supabase/
│       ├── client.ts                  # createBrowserClient()
│       ├── server.ts                  # createClient() (server-side)
│       └── middleware.ts              # updateSession() helper
└── middleware.ts                      # Session refresh + role-based routing
```

```
supabase/
├── migrations/
│   └── 20260529000001_initial_schema.sql  # All tables + RLS + hook
└── config.toml                            # Local dev: enable custom_access_token_hook
```

### Pattern 1: `custom_access_token_hook` — JWT Custom Claims

**What:** Postgres function called by Supabase Auth on every token issuance. Reads `profiles` table to inject `role` and `barbershop_id` into JWT `app_metadata`.

**When to use:** Every JWT issuance — this is always running once configured.

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
-- Also: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims JSONB;
  user_barbershop_id UUID;
  user_role TEXT;
BEGIN
  -- Read from profiles table (created alongside auth.users)
  SELECT barbershop_id, role
    INTO user_barbershop_id, user_role
    FROM public.profiles
    WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';

  -- Ensure app_metadata object exists
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inject barbershop_id and role into app_metadata
  IF user_barbershop_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,barbershop_id}',
                        to_jsonb(user_barbershop_id::TEXT));
  END IF;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Required permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
REVOKE ALL ON TABLE public.profiles FROM authenticated, anon, public;
-- RLS policy so supabase_auth_admin can read profiles
CREATE POLICY "auth_admin_read_profiles" ON public.profiles
  FOR SELECT TO supabase_auth_admin USING (true);
```

**Local dev config.toml activation:**
```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

**Dashboard activation (production):** Authentication > Hooks > Custom Access Token — select the `public.custom_access_token_hook` function.

### Pattern 2: RLS Tenant Isolation Policy

**What:** Every table in `public` has an RLS policy that reads `barbershop_id` from the JWT `app_metadata`. No subqueries — the JWT claim is used directly for performance.

**When to use:** Every table that contains per-barbershop data.

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Pattern for all tenant-scoped tables

-- Enable RLS (always paired with CREATE TABLE)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: barbershop staff can only see their barbershop's data
CREATE POLICY "tenant_isolation_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

CREATE POLICY "tenant_isolation_insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

CREATE POLICY "tenant_isolation_update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

CREATE POLICY "tenant_isolation_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- Barber role restriction: barbers only see their own appointments
-- Add as additional SELECT policy (stacks with tenant_isolation_select via OR)
-- OR replace tenant_isolation_select with a combined policy:
CREATE POLICY "role_scoped_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
      OR barber_id = auth.uid()
    )
  );
```

**IMPORTANT — `user_metadata` vs `app_metadata`:**
- `user_metadata` = `auth.users.raw_user_meta_data` — user can update this themselves. NEVER use for RLS.
- `app_metadata` = `auth.users.raw_app_meta_data` — only server/hook can write. Safe for RLS.
- Access in policies: `auth.jwt() -> 'app_metadata' ->> 'barbershop_id'` (string) or `auth.jwt() -> 'app_metadata' -> 'barbershop_id'` (jsonb)

### Pattern 3: `@supabase/ssr` Client Setup

**What:** Three utility files and a middleware file. Uses the new `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env var (replaces legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`; both work until end of 2026).

```typescript
// src/lib/supabase/client.ts — for Client Components ('use client')
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts — for Server Components, Server Actions, Route Handlers
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // await required in Next.js 15

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cannot set cookies in Server Components — safe to ignore
          }
        },
      },
    }
  )
}
```

### Pattern 4: `middleware.ts` — Session Refresh + Role-Based Routing

**What:** Runs on every request (except static files). Refreshes the Supabase session (writing updated cookie) and redirects based on JWT role claims.

**Critical:** Use `getClaims()` NOT `getSession()` for server-side protection. `getSession()` does not validate the JWT signature.

```typescript
// src/middleware.ts (at project root or src/ root)
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            response.cookies.set(name, value)
          )
        },
      },
    }
  )

  // ALWAYS use getClaims(), NOT getSession() — validates JWT signature
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const role = claims?.app_metadata?.role as string | undefined
  const pathname = request.nextUrl.pathname

  // Redirect unauthenticated users trying to access protected routes
  const isOwnerRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/owner')
  const isBarberRoute = pathname.startsWith('/agenda') || pathname.startsWith('/barber')

  if ((isOwnerRoute || isBarberRoute) && (!claims || error)) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  // Redirect authenticated users away from auth pages
  const isAuthPage = ['/entrar', '/cadastro'].includes(pathname)
  if (isAuthPage && claims && !error) {
    const redirectTo = role === 'barber' ? '/agenda' : '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Role mismatch: barber accessing owner route → redirect to barber dashboard
  if (isOwnerRoute && role === 'barber') {
    return NextResponse.redirect(new URL('/agenda', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files, images, favicon
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

### Pattern 5: Auth Callback Route Handler (PKCE)

**What:** Exchanges the `token_hash` from email links (signup confirmation, password reset, invite) for a real session.

```typescript
// src/app/auth/confirm/route.ts
// Source: https://supabase.com/docs/guides/auth/passwords (verifyOtp pattern)
import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | 'recovery' | 'invite' | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // For invite type, redirect to the password-setting page
      if (type === 'invite') {
        return NextResponse.redirect(new URL('/aceitar-convite', request.url))
      }
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // On error, redirect to error page or login with error param
  return NextResponse.redirect(new URL('/entrar?erro=link-invalido', request.url))
}
```

**Email template configuration (Supabase Dashboard > Authentication > Email Templates):**

For "Confirm signup" template, change the confirmation URL to:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

For "Reset Password" template:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-senha
```

For "Invite User" template:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
```

### Pattern 6: Barber Invite Flow

**What:** Owner invites a barber by email. The `options.data` becomes `user_metadata` at invite time. The `custom_access_token_hook` reads from `profiles` (where `barbershop_id` is stored after the invite is accepted).

```typescript
// Server Action — runs server-side only (service role required)
// Source: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
import { createClient } from '@supabase/supabase-js'

// Service role client — NEVER expose to client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function inviteBarber(email: string, barbershopId: string, barbershopName: string) {
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=invite`,
    data: {
      // Stored in user_metadata — used by an on-signup trigger to create profiles row
      barbershop_id: barbershopId,
      role: 'barber',
      barbershop_name: barbershopName,
    },
  })
  return { data, error }
}
```

**Important:** `options.data` maps to `auth.users.raw_user_meta_data` (user_metadata), NOT app_metadata. The `custom_access_token_hook` reads from the `profiles` table. Therefore: when a barber accepts the invite and sets their password, a database trigger or the accept-invite Server Action must create a `profiles` row with the correct `barbershop_id` and `role = 'barber'` BEFORE the hook fires. One approach: an `after insert` trigger on `auth.users` that reads `raw_user_meta_data` and creates the `profiles` row.

### Pattern 7: Core Schema Design

```sql
-- Migration: 20260529000001_initial_schema.sql

-- === BARBERSHOPS ===
CREATE TABLE public.barbershops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,  -- for URL routing Phase 2+
  timezone        TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- Owners can read/update their own barbershop
CREATE POLICY "owner_own_barbershop" ON public.barbershops
  FOR ALL TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID)
  WITH CHECK (id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID);

-- === PROFILES ===
-- Links auth.users to barbershops with roles
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id   UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
  -- NOTE: Owner's profile is created at onboarding (Phase 1 creates the barbershop row)
  -- Phase 0: create the table; onboarding populates it
  role            TEXT NOT NULL CHECK (role IN ('owner', 'barber')),
  full_name       TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "own_profile_all" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Tenant members can read each other's profiles (for barber list display)
CREATE POLICY "tenant_profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- supabase_auth_admin can read profiles (for custom_access_token_hook)
CREATE POLICY "auth_admin_read_profiles" ON public.profiles
  FOR SELECT TO supabase_auth_admin USING (true);

-- === CLIENTS ===
-- Clients do NOT have auth.users accounts in v1 (AUTH-07)
-- They identify by name + WhatsApp at booking time
CREATE TABLE public.clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id         UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  whatsapp_number       TEXT NOT NULL,
  whatsapp_opt_in       BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_timestamp      TIMESTAMPTZ,
  opt_in_source         TEXT,  -- e.g., 'booking_form_v1'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Only authenticated users of the same barbershop can see clients
CREATE POLICY "tenant_clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

CREATE POLICY "tenant_clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- Allow anon inserts for public booking portal (Phase 2)
CREATE POLICY "anon_client_insert" ON public.clients
  FOR INSERT TO anon
  WITH CHECK (true);  -- Will be tightened in Phase 2

-- === TRIGGER: auto-create profile for invited barbers ===
CREATE OR REPLACE FUNCTION public.handle_new_user_from_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only create profile if user has invite metadata (barber flow)
  IF NEW.raw_user_meta_data ? 'barbershop_id' THEN
    INSERT INTO public.profiles (id, barbershop_id, role, full_name)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'barbershop_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'role', 'barber'),
      NEW.raw_user_meta_data->>'full_name'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_from_invite();
```

### Pattern 8: CI Guard — Assert Zero Tables Without RLS

```sql
-- CI assertion query (run in GitHub Actions via supabase db query or psql)
-- MUST return 0 rows — any result means a table was created without RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
```

**GitHub Actions step:**
```yaml
- name: Assert all tables have RLS enabled
  run: |
    COUNT=$(supabase db query \
      "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;" \
      --output plain | tail -1 | tr -d ' ')
    if [ "$COUNT" != "0" ]; then
      echo "FAIL: $COUNT tables in public schema have RLS disabled"
      exit 1
    fi
    echo "PASS: All public tables have RLS enabled"
```

### Anti-Patterns to Avoid

- **Using `getSession()` server-side:** Does not validate JWT signature. Use `getClaims()` instead. `getSession()` can return stale or spoofed sessions.
- **RLS policy using only `auth.uid()`:** Scopes to user, not tenant. Always include `barbershop_id` check.
- **Reading from `user_metadata` in RLS policies:** `user_metadata` can be modified by the authenticated user. Always read from `app_metadata` (written only by hooks/server).
- **Creating tables without RLS:** The CI guard catches this, but the convention is to always include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same migration as `CREATE TABLE`.
- **Service role key in `NEXT_PUBLIC_*` env vars:** NEVER. Service role bypasses all RLS. Only in server-side code.
- **Running `inviteUserByEmail` in a Client Component:** Requires service role key. Server Action or Route Handler only.
- **Skipping `await cookies()` in Next.js 15:** `cookies()` returns a Promise in Next.js 15. Must be awaited.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management | Custom cookie read/write | `@supabase/ssr` createServerClient | Edge cases: HttpOnly, SameSite, token refresh timing |
| JWT signature validation | Custom JWT parsing | `supabase.auth.getClaims()` | JWT rotation keys, expiry edge cases |
| Password reset flow | Custom token generation | Supabase `resetPasswordForEmail()` + verifyOtp() | PKCE security guarantees |
| Email invite flow | Custom invite token | `auth.admin.inviteUserByEmail()` | Token expiry, resend, revocation |
| RLS policy enforcement | Application-layer filtering | Postgres RLS | Any application bug exposes cross-tenant data; RLS is always on |
| Tenant ID extraction | Custom JWT parsing in policies | `auth.jwt() -> 'app_metadata'` | Built-in Postgres function; correct and fast |
| Schema migrations | Manual SQL scripts | `supabase migration new` + `supabase db push` | Version control, reproducibility, local dev parity |

**Key insight:** The most dangerous thing to hand-roll is tenant isolation logic. Any custom application-layer filtering that is the primary gate will fail when a developer adds a new endpoint and forgets to add the filter. Postgres RLS cannot be forgotten — it is enforced at the DB level regardless of which path calls the DB.

---

## Common Pitfalls

### Pitfall 1: JWT `app_metadata` Not Populated After Signup

**What goes wrong:** Owner signs up. The `custom_access_token_hook` reads from `profiles`. But the `profiles` row for the owner doesn't exist yet (created in Phase 1 onboarding flow). The JWT is issued without `barbershop_id`. All RLS policies return no rows. The owner sees an empty application and thinks it's a UI bug.

**Why it happens:** The hook fires immediately after signup, before the owner has completed onboarding that creates the barbershop + profile rows.

**How to avoid:** For the owner flow: the profile row is created AFTER onboarding (Phase 1). In Phase 0, the owner's JWT will not have `barbershop_id` until they complete onboarding. This is EXPECTED behavior in Phase 0. The owner dashboard shell (Phase 0) shows an empty state — this is correct. The `custom_access_token_hook` should handle `NULL` barbershop_id gracefully (don't set the claim if null, rather than setting to null string).

**Warning signs:** `barbershop_id` set to `"null"` string in JWT instead of missing key. RLS policies fail with cast errors.

### Pitfall 2: `middleware.ts` Runs on Static File Requests

**What goes wrong:** Without a proper `matcher`, the middleware runs on every `_next/static/` and `_next/image/` request. Each static file request triggers a Supabase `getClaims()` call. This dramatically slows down page loads (hundreds of extra Supabase requests per page).

**Why it happens:** Default Next.js behavior without matcher is to run on ALL routes.

**How to avoid:** Always include the negative matcher:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
```

### Pitfall 3: `next@latest` vs `next@"^15.5.18"`

**What goes wrong:** Running `npx create-next-app@latest` installs Next.js 16, where `middleware.ts` is deprecated in favor of `proxy.ts`. Supabase SSR documentation and all current examples use `middleware.ts`. Using `next@16` without migration causes confusion.

**Why it happens:** `npm view next dist-tags.latest` returns `16.2.6` as of 2026-05-29.

**How to avoid:** Always specify the version: `npx create-next-app@"^15.5.18"`. Pin `"next": "^15.5.18"` in `package.json`.

### Pitfall 4: `inviteUserByEmail` Stores in `user_metadata`, Not `app_metadata`

**What goes wrong:** Developer passes `barbershop_id` in `options.data` to `inviteUserByEmail()`. Expects to read it from `app_metadata` in RLS. But `options.data` maps to `user_metadata` (user-writable). The `custom_access_token_hook` reads from the `profiles` table — not from user_metadata. If the profiles row is not created, the barber's JWT has no `barbershop_id`.

**Why it happens:** Conflating where `options.data` ends up with how the JWT claim is populated.

**How to avoid:** Use a database trigger `AFTER INSERT ON auth.users` to read `raw_user_meta_data` and create the `profiles` row. The hook then finds the profile and injects the correct claim into JWT.

### Pitfall 5: `cookies()` Not Awaited in Next.js 15

**What goes wrong:** `const cookieStore = cookies()` (without await) was valid in Next.js 14. In Next.js 15, `cookies()` returns a Promise. Calling `.getAll()` on the Promise instead of the resolved value silently fails.

**Why it happens:** Most Supabase tutorials were written before Next.js 15.

**How to avoid:** Always: `const cookieStore = await cookies()`.

### Pitfall 6: RLS Policy Syntax — String vs UUID Cast

**What goes wrong:** `barbershop_id` column is `UUID`. `auth.jwt() -> 'app_metadata' ->> 'barbershop_id'` returns `TEXT`. The comparison `barbershop_id = auth.jwt() -> 'app_metadata' ->> 'barbershop_id'` fails with a type mismatch or silently returns false.

**Why it happens:** JSON operators return text values; UUID columns require a cast.

**How to avoid:** Always cast: `barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID`.

---

## Code Examples

### Verified patterns from official sources

### Signup with Email Verification
```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
const { data, error } = await supabase.auth.signUp({
  email: formData.email,
  password: formData.password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirm?type=email&next=/dashboard`,
  },
})
// On success: user receives email, redirect to /entrar?verificacao=pendente
```

### Password Reset Request
```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/nova-senha`,
})
```

### New Password (after clicking reset link)
```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
// Called from the /nova-senha page after the callback confirms the session
const { error } = await supabase.auth.updateUser({ password: newPassword })
```

### Protected Server Component Pattern
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data.claims) {
    redirect('/entrar')
  }

  const role = data.claims.app_metadata?.role
  if (role !== 'owner') {
    redirect('/agenda')
  }

  return <div>Dashboard shell</div>
}
```

### CI RLS Check (SQL)
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Run in CI — must return 0 rows
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023-09 | All new projects use `@supabase/ssr`; helpers are deprecated |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2024 (transition ongoing) | Both work until end of 2026; new projects should use publishable key |
| `supabase.auth.getSession()` (server) | `supabase.auth.getClaims()` | 2024 (security change) | `getClaims()` validates JWT signature; `getSession()` does not |
| `middleware.ts` (Next.js 15) | `proxy.ts` (Next.js 16) | 2026 (Next.js 16) | Project uses Next.js 15 — `middleware.ts` is correct; do NOT migrate |
| `await cookies()` not required (Next.js 14) | `await cookies()` required (Next.js 15) | 2024 | Must await `cookies()` in all server code |
| JWT claims in top-level payload | JWT claims in `app_metadata` nested object | Always the pattern | `auth.jwt()->'app_metadata'->>'field'` is correct syntax |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated, do not use. Replace with `@supabase/ssr`.
- `supabase.auth.getSession()` server-side: Security concern; replaced by `getClaims()`.
- `next@latest` for this project: Points to Next.js 16; pin to `^15.5.18`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `inviteUserByEmail` stores `options.data` in `raw_user_meta_data` (not `raw_app_meta_data`) | Pattern 6, Pitfall 4 | If stored in app_metadata, the trigger-based approach is unnecessary; low risk |
| A2 | The `AFTER INSERT ON auth.users` trigger approach for creating profiles from invite metadata is the recommended pattern | Pattern 7 (trigger) | Alternative: Server Action creates profile explicitly when barber accepts invite; both work |
| A3 | `supabase.auth.getClaims()` is available in `@supabase/ssr` v0.10.3 (not just in `@supabase/supabase-js`) | Pattern 4 | If only in supabase-js, the server.ts createClient() still returns it; getClaims() is on the auth instance |
| A4 | Docker is required for `supabase start` local dev | Environment section | Supabase CLI requires Docker for local stack; confirmed from docs |

**If this table is empty:** All other claims in this research were verified or cited.

---

## Open Questions

1. **Owner profile creation timing**
   - What we know: The `custom_access_token_hook` reads from `profiles`. For new owners, the profile is created during onboarding (Phase 1). Phase 0 only creates the table structure.
   - What's unclear: Should Phase 0 create a "stub" profile at signup (with null barbershop_id), or should the owner's dashboard shell handle the "no barbershop yet" state gracefully?
   - Recommendation: In Phase 0, after owner signup, create a `profiles` row with `barbershop_id = NULL` and `role = 'owner'`. The custom_access_token_hook checks for null and skips injecting barbershop_id. The owner dashboard shell checks for missing barbershop_id and shows the onboarding CTA (disabled in Phase 0, active in Phase 1).

2. **Supabase CLI Docker requirement**
   - What we know: Docker is not installed on this machine. Supabase CLI local dev requires Docker for `supabase start`.
   - What's unclear: Whether the developer plans to use Supabase local dev or just remote Supabase project.
   - Recommendation: Plan for two paths in tasks: (a) local dev with Docker, (b) remote Supabase project with `supabase db push`. For Phase 0, remote is sufficient; document Docker installation as a prerequisite for full local dev.

3. **`supabase.auth.getClaims()` availability**
   - What we know: Supabase docs say to use `getClaims()` instead of `getSession()`. It validates JWT signatures.
   - What's unclear: Whether `getClaims()` is available in the server client created via `@supabase/ssr` createServerClient, or only via `@supabase/supabase-js`.
   - Recommendation: `getClaims()` is on the `auth` object regardless of which client created it. Both `createServerClient` and `createBrowserClient` return a client with `.auth.getClaims()`. Treat as HIGH confidence.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, npm | Yes | v24.15.0 | — |
| npm | Package management | Yes | 11.12.1 | — |
| Docker | Supabase CLI local dev | No | — | Use remote Supabase project; install Docker separately |
| Supabase CLI | Migrations, local dev | No | — | Use Supabase Dashboard + `supabase db push` from remote |
| Python 3 | slopcheck | Yes | 3.11.9 | — |

**Missing dependencies with no fallback:**
- None that block Phase 0 execution on remote Supabase.

**Missing dependencies with fallback:**
- Docker / Supabase CLI: Cannot run `supabase start` for local Postgres. Fallback: use a remote Supabase project (create one at supabase.com). Run `supabase init` (no Docker needed) + `supabase link` + `supabase db push`. This is a fully supported workflow.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (greenfield project — no test infra yet) |
| Config file | none — Wave 0 must create |
| Quick run command | `npm test` (after Wave 0 setup) |
| Full suite command | `npm run test:ci` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup creates user + sends verification email | Integration (manual — requires Supabase email in loop) | manual-only | N/A |
| AUTH-02 | Login returns session, persists across refresh | Integration (browser test) | manual-only | N/A |
| AUTH-03 | Password reset email flow | Integration (manual) | manual-only | N/A |
| AUTH-05 | Invite barber stores metadata, barber can accept | Integration (manual) | manual-only | N/A |
| AUTH-06 | Barber sees only own tenant data | unit (RLS SQL test) | `psql -f tests/rls_isolation.sql` | Wave 0 |
| AUTH-07 | clients table allows anon insert | unit (RLS SQL test) | `psql -f tests/rls_clients.sql` | Wave 0 |
| AUTH-08 | Zero tables in public without RLS | unit (SQL assertion) | `psql -f tests/ci_rls_check.sql` | Wave 0 |

### Sampling Rate

- **Per task commit:** `psql -f tests/ci_rls_check.sql` (verifies RLS on all tables)
- **Per wave merge:** Full SQL test suite + manual browser smoke test
- **Phase gate:** All AUTH-* manually verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/ci_rls_check.sql` — covers AUTH-08 (zero tables without RLS)
- [ ] `tests/rls_isolation.sql` — covers AUTH-06 (cross-tenant isolation)
- [ ] `tests/rls_clients.sql` — covers AUTH-07 (anon client insert)
- [ ] No JavaScript test framework needed for Phase 0 (all testable behaviors are either SQL-level or manual browser flows)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email+password, verification, PKCE) |
| V3 Session Management | yes | `@supabase/ssr` cookie-based sessions; middleware refresh |
| V4 Access Control | yes | Postgres RLS + JWT role claims; middleware route protection |
| V5 Input Validation | yes | Zod schemas on all form inputs |
| V6 Cryptography | no | Supabase handles JWT signing; no custom crypto in Phase 0 |
| V7 Error Handling | yes | Explicit error states; no stack traces exposed to client |
| V14 Configuration | yes | SUPABASE_SERVICE_ROLE_KEY never in NEXT_PUBLIC_ vars |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access | Elevation of Privilege | RLS on every table; barbershop_id in JWT app_metadata |
| JWT forgery / tamper | Spoofing | `getClaims()` validates JWT signature; never trust `getSession()` server-side |
| Service role key exposure | Elevation of Privilege | Server Actions / Route Handlers only; never NEXT_PUBLIC_ |
| PKCE code replay | Elevation of Privilege | `verifyOtp()` codes expire in 5 min and can only be used once |
| Invite link reuse | Elevation of Privilege | Supabase invite tokens are single-use; verified in `verifyOtp()` |
| user_metadata used for auth decisions | Tampering | Never use user_metadata in RLS; always use app_metadata |
| Tables missing RLS | Information Disclosure | CI assertion query; fail build if any table has rowsecurity = false |

---

## Sources

### Primary (HIGH confidence)

- [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — createServerClient, createBrowserClient, middleware pattern, getClaims()
- [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — complete SQL function, grant/revoke pattern, config.toml setup
- [RBAC with custom claims](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — profiles table pattern, grant statements
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — auth.jwt() usage, app_metadata vs user_metadata
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords) — signUp, resetPasswordForEmail, verifyOtp, updateUser
- [Auth Hooks overview](https://supabase.com/docs/guides/auth/auth-hooks) — hook registration, config.toml, dashboard setup
- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — (owner), (barber) group conventions [VERIFIED: nextjs.org, lastUpdated 2026-05-28]
- [Next.js middleware/proxy reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — matcher config, cookies API [VERIFIED: nextjs.org, version 16.2.6]
- [Local development migrations](https://supabase.com/docs/guides/local-development/overview) — migration new, db push, db reset
- npm registry — all package versions verified via `npm view` commands

### Secondary (MEDIUM confidence)

- [inviteUserByEmail search](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — options.data maps to user_metadata (confirmed via multiple sources)
- [Next.js 16 proxy.ts migration](https://nextjs.org/docs/messages/middleware-to-proxy) — confirms middleware deprecated in 16; project uses 15
- Upcoming changes to Supabase API keys: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the new recommended env var name

### Tertiary (LOW confidence)

- Community discussions on `inviteUserByEmail` options.data behavior — confirmed by multiple StackOverflow/GitHub discussions but not from official docs code example

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry; official docs consulted
- Architecture patterns: HIGH — official Supabase docs + verified code examples
- Pitfalls: HIGH — documented behaviors in official sources + community-confirmed patterns
- Next.js version decision: HIGH — version list verified via npm registry; middleware rename confirmed via official Next.js docs

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (30 days — Supabase and Next.js both move quickly; re-verify @supabase/ssr API changes before execution if >30 days have passed)
