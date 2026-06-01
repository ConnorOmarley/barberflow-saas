-- ============================================================
-- BarberFlow Phase 1 — Barber & Service Schema
-- Migration: 20260531000001_phase1_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================

-- ============================================================
-- SECTION A — BARBERS TABLE
-- ============================================================

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
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION B — SERVICES TABLE
-- ============================================================

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
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION C — BARBER_SERVICES TABLE (junction — no direct barbershop_id)
-- ============================================================

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

-- ============================================================
-- SECTION D — WORKING_HOURS TABLE (per barber, per day — no direct barbershop_id)
-- ============================================================

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

-- ============================================================
-- SECTION E — APPOINTMENTS TABLE
-- NOTE: No EXCLUDE/GIST constraint in Phase 1 (added in Phase 2).
--       App-layer conflict check only (see createAppointment Server Action).
-- ============================================================

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
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION F — TRIGGER: handle_invite_accepted
--
-- Fires AFTER UPDATE ON auth.users when a barber accepts an email
-- invite and sets their password for the first time.
-- Reads raw_user_meta_data.barber_id (passed via inviteUserByEmail options.data)
-- and sets public.barbers.profile_id = NEW.id.
--
-- SECURITY: SECURITY DEFINER + SET search_path = '' (Phase 0 pattern).
--           REVOKE EXECUTE from public/anon/authenticated at end of migration.
-- ============================================================

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

-- ============================================================
-- SECTION G — SECURITY HARDENING
-- Pin search_path and revoke direct EXECUTE access on trigger function.
-- ============================================================

ALTER FUNCTION public.handle_invite_accepted() SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.handle_invite_accepted()
  FROM public, anon, authenticated;

-- ============================================================
-- SECTION H — SUPABASE STORAGE: barber-photos bucket
-- Created in migration to ensure local dev and CI have the bucket.
-- public=false: uploads require authentication.
-- Per-tenant tightening deferred to Phase 8 (authenticated-only for Phase 1).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('barber-photos', 'barber-photos', false)
  ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload barber photos
CREATE POLICY "authenticated_insert_barber_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barber-photos');

-- Authenticated users can view barber photos
CREATE POLICY "authenticated_select_barber_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'barber-photos');
