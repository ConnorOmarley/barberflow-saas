-- Runtime cross-tenant RLS isolation test.
-- Run via: psql $DATABASE_URL -f tests/rls_isolation.sql
-- Proves that a JWT with barbershop_id=A cannot see rows belonging to barbershop_id=B.
-- Uses BEGIN...ROLLBACK so no test data persists.
--
-- Requirements: AUTH-06, AUTH-08
-- The SET LOCAL request.jwt.claims statement activates Supabase's RLS policy check.
-- RLS policies reference current_setting('request.jwt.claims', true) via auth.jwt().
-- The INSERT must happen before switching claims.
-- The ROLLBACK ensures no test data remains.

BEGIN;

-- Step 1: Verify RLS is enabled on all tables (schema check)
DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=false) = 0,
         'FAIL: Tables without RLS found';
  RAISE NOTICE 'PASS: All public tables have RLS enabled';
END $$;

-- Step 2: Verify barbershop_id columns exist on tenant tables (schema check)
DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='barbershop_id') = 1,
         'FAIL: barbershop_id missing from clients';
  ASSERT (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='barbershop_id') = 1,
         'FAIL: barbershop_id missing from profiles';
  RAISE NOTICE 'PASS: barbershop_id columns present on tenant tables';
END $$;

-- Step 3: Runtime cross-tenant isolation proof
-- Set JWT claims to barbershop A and insert a test row in profiles
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-aaaaaaaaaaaa", "app_metadata": {"barbershop_id": "00000000-0000-0000-0000-000000000001", "role": "owner"}}';

-- Insert a test profile row for barbershop A (using service role context before switching)
-- Note: INSERT uses a direct VALUES row; the RLS SELECT check below is what matters
INSERT INTO public.profiles (id, barbershop_id, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-aaaaaaaaaaaa'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'owner',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Now switch JWT claims to barbershop B and assert the row for barbershop A is invisible
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-bbbbbbbbbbbb", "app_metadata": {"barbershop_id": "00000000-0000-0000-0000-000000000002", "role": "owner"}}';

DO $$ DECLARE row_count INT; BEGIN
  SELECT COUNT(*) INTO row_count
  FROM public.profiles
  WHERE barbershop_id = '00000000-0000-0000-0000-000000000001'::uuid;

  ASSERT row_count = 0,
    'FAIL: Cross-tenant isolation breach — barbershop B JWT can see ' || row_count || ' rows belonging to barbershop A';
  RAISE NOTICE 'PASS: Cross-tenant isolation verified — barbershop B JWT sees 0 rows from barbershop A';
END $$;

ROLLBACK;
