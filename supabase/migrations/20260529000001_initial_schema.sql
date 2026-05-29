-- ============================================================
-- BarberFlow Phase 0 — Initial Schema
-- Migration: 20260529000001_initial_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================

-- ============================================================
-- SECTION A — BARBERSHOPS TABLE
-- ============================================================

CREATE TABLE public.barbershops (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- Owners can read/update/delete their own barbershop row.
-- Uses app_metadata (hook-written), never user_metadata.
CREATE POLICY "owner_own_barbershop" ON public.barbershops
  FOR ALL TO authenticated
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION B — PROFILES TABLE
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
  -- NOTE: Owner's barbershop_id is NULL until Phase 1 onboarding completes.
  -- Barber's barbershop_id is set by the on_auth_user_created trigger at invite acceptance.
  role          TEXT NOT NULL CHECK (role IN ('owner', 'barber')),
  full_name     TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Each user can manage their own profile row.
CREATE POLICY "own_profile_all" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Tenant members (same barbershop) can read each other's profiles
-- (e.g., owner sees barber list).
CREATE POLICY "tenant_profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- supabase_auth_admin must be able to read profiles so the
-- custom_access_token_hook can inject barbershop_id into JWT.
CREATE POLICY "auth_admin_read_profiles" ON public.profiles
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- ============================================================
-- SECTION C — CLIENTS TABLE
-- ============================================================

CREATE TABLE public.clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id     UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  whatsapp_number   TEXT NOT NULL,
  -- LGPD: consent must be explicit — stored at collection time.
  whatsapp_opt_in   BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_timestamp  TIMESTAMPTZ,
  opt_in_source     TEXT,  -- e.g. 'booking_form_v1'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Authenticated barbershop staff can read their tenant's clients.
CREATE POLICY "tenant_clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- Authenticated staff can insert clients for their own barbershop only.
CREATE POLICY "tenant_clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- Anonymous inserts for public booking portal (Phase 2).
-- Tightened with rate limiting / captcha in Phase 2.
CREATE POLICY "anon_client_insert" ON public.clients
  FOR INSERT TO anon
  WITH CHECK (true);

-- ============================================================
-- SECTION D — TRIGGER: handle_new_user_from_invite
--
-- When a new auth.users row is inserted (barber accepts invite),
-- this trigger reads raw_user_meta_data (populated by inviteUserByEmail
-- options.data) and creates the corresponding profiles row.
-- This ensures custom_access_token_hook can find barbershop_id
-- in profiles before the first JWT is issued.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_from_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create a profile if the user was created via an invite
  -- (invite flow passes barbershop_id in options.data → raw_user_meta_data).
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
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_from_invite();

-- ============================================================
-- SECTION E — custom_access_token_hook
--
-- Called by Supabase Auth on every token issuance.
-- Reads profiles.barbershop_id and profiles.role and injects
-- them into JWT app_metadata so RLS policies can use them.
--
-- SECURITY: Only supabase_auth_admin can execute this function.
--           Authenticated and anon roles are explicitly revoked.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims            JSONB;
  user_barbershop_id UUID;
  user_role          TEXT;
BEGIN
  -- Read barbershop_id and role from profiles table.
  -- Returns NULL for owner profiles where onboarding is incomplete.
  SELECT barbershop_id, role
    INTO user_barbershop_id, user_role
    FROM public.profiles
    WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';

  -- Ensure app_metadata object exists before setting keys.
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Only inject barbershop_id if it is not NULL.
  -- If NULL (owner pre-onboarding), omit the key entirely
  -- rather than setting it to the string "null", which would
  -- cause RLS cast errors.
  IF user_barbershop_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata,barbershop_id}',
      to_jsonb(user_barbershop_id::TEXT)
    );
  END IF;

  -- Always inject role if the profile row exists.
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata,role}',
      to_jsonb(user_role)
    );
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant supabase_auth_admin schema access.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Allow the hook to be called by supabase_auth_admin only.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Explicitly revoke from all other roles (defence in depth).
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- supabase_auth_admin must be able to read profiles to inject claims.
-- The SELECT RLS policy "auth_admin_read_profiles" (Section B) covers row access,
-- but table-level GRANT is also required for the admin role.
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;

-- Defence in depth: revoke direct table access from normal roles
-- (they access via RLS-enforced policies, not table grants).
REVOKE ALL ON TABLE public.profiles FROM authenticated, anon, public;
