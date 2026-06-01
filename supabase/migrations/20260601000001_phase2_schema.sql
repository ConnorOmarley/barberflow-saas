-- ============================================================
-- BarberFlow Phase 2 — Client Booking Portal Schema
-- Migration: 20260601000001_phase2_schema.sql
--
-- Purpose: Adds the database infrastructure required for the
--   public booking portal. Phase 1 left the exclusion constraint
--   intentionally absent (see SECTION E of 20260531000001).
--   This migration adds it along with:
--     - DROP NOT NULL on appointments.created_by (anonymous clients)
--     - UNIQUE constraint on clients for WhatsApp upsert
--     - 6 RLS SELECT policies for the anon role (public reads)
--
-- MULTI-TENANCY CONTRACT:
--   Existing tenant RLS policies (authenticated role) are unchanged.
--   Anon policies expose only non-sensitive fields: barbershops,
--   active services, active barbers, working hours, and non-cancelled
--   appointment slots. Client identity (client_id) is never exposed.
-- ============================================================

-- ============================================================
-- SECTION A — btree_gist extension
--
-- Required BEFORE the exclusion constraint in SECTION B.
-- Without this extension the UUID data type has no GIST operator
-- class and the ADD CONSTRAINT statement fails with:
--   "data type uuid has no default operator class for access method gist"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- SECTION B — Exclusion constraint: appointments_no_overlap
--
-- Prevents double-booking at the database level using a GIST
-- index over (barber_id, tsrange).
--
-- Design decisions:
--   - Range type '[)' (closed-open / half-open): contiguous slots
--     where slot A ends exactly when slot B starts do NOT overlap.
--     Example: [09:00,10:00) and [10:00,11:00) — no conflict.
--   - Scoped per barber_id WITH =: two different barbers can have
--     the same time window without conflict.
--   - Partial constraint WHERE (status != 'CANCELLED'): cancelled
--     appointments free their slot immediately, allowing rebooking.
-- ============================================================

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tsrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status != 'CANCELLED');

-- ============================================================
-- SECTION C — UNIQUE constraint on clients for WhatsApp upsert
--
-- Enables the booking portal Server Action to use:
--   .upsert(..., { onConflict: 'barbershop_id,whatsapp_number' })
-- without creating duplicate client rows for repeat bookings.
-- Backward-compatible: existing rows already satisfy this constraint
-- because Phase 0 did not allow duplicates via application logic.
-- ============================================================

ALTER TABLE public.clients
  ADD CONSTRAINT clients_barbershop_whatsapp_unique
  UNIQUE (barbershop_id, whatsapp_number);

-- ============================================================
-- SECTION D — DROP NOT NULL on appointments.created_by
--
-- Public portal clients do not have an auth.users row, so
-- created_by cannot reference auth.users(id).
-- Backward-compatible: all Phase 1 appointments have created_by
-- populated. The portal explicitly sets created_by = NULL.
-- ============================================================

ALTER TABLE public.appointments
  ALTER COLUMN created_by DROP NOT NULL;

-- ============================================================
-- SECTION E — RLS SELECT policies for role anon (public reads)
--
-- The portal is fully public: visitors browse barbershops,
-- services, barbers and available time slots without logging in.
-- Writes (INSERT on clients and appointments) use the service role
-- via adminClient in Server Actions — no INSERT anon policy needed.
--
-- Security surface (T-02-02): Server Actions must SELECT only
--   start_time, end_time, barber_id, status from appointments —
--   never client_id or any PII column.
-- ============================================================

-- 1. Public can read all barbershops (needed to resolve slug → id)
CREATE POLICY "anon_barbershops_select" ON public.barbershops
  FOR SELECT TO anon
  USING (true);

-- 2. Public can read active services for a barbershop
CREATE POLICY "anon_services_select" ON public.services
  FOR SELECT TO anon
  USING (is_active = true);

-- 3. Public can read active barbers (name, photo, specialties)
CREATE POLICY "anon_barbers_select" ON public.barbers
  FOR SELECT TO anon
  USING (is_active = true);

-- 4. Public can read working hours for active barbers
--    (used to generate available slot ranges)
CREATE POLICY "anon_working_hours_select" ON public.working_hours
  FOR SELECT TO anon
  USING (is_active = true);

-- 5. Public can read non-cancelled appointments (slot availability)
--    Server Actions must project only: start_time, end_time, barber_id, status
CREATE POLICY "anon_appointments_select" ON public.appointments
  FOR SELECT TO anon
  USING (status != 'CANCELLED');

-- 6. Public can read barber_services to know which services a barber offers
CREATE POLICY "anon_barber_services_select" ON public.barber_services
  FOR SELECT TO anon
  USING (true);
