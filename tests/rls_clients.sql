-- Verifies AUTH-07: clients table exists with whatsapp_opt_in field, anon insert policy exists.
-- Run via: psql $DATABASE_URL -f tests/rls_clients.sql
--
-- This test checks:
--   1. clients table exists in public schema
--   2. whatsapp_opt_in column exists (LGPD requirement — never send without consent)
--   3. opt_in_timestamp column exists (LGPD audit trail)
--   4. anon_client_insert policy exists (allows unauthenticated booking portal inserts)

DO $$ BEGIN
  -- Verify clients table exists
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') = 1,
         'FAIL: clients table not found';

  -- Verify whatsapp_opt_in column exists (LGPD requirement)
  ASSERT (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='whatsapp_opt_in') = 1,
         'FAIL: whatsapp_opt_in column not found in clients';

  -- Verify opt_in_timestamp column exists
  ASSERT (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='opt_in_timestamp') = 1,
         'FAIL: opt_in_timestamp column not found in clients';

  -- Verify anon_client_insert policy exists
  ASSERT (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='anon_client_insert') = 1,
         'FAIL: anon_client_insert policy not found on clients';

  RAISE NOTICE 'PASS: clients table and LGPD fields verified';
END $$;
