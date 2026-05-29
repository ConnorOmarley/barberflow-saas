-- CI RLS Assertion: Assert Zero Tables Without RLS
-- Source: Pattern 8 from 00-RESEARCH.md (Supabase RLS docs)
--
-- This query must return 0 rows.
-- Any row means a table in the public schema was created without RLS enabled.
-- Exit code 1 if any rows are returned.
--
-- Run via: psql $DATABASE_URL -f tests/ci_rls_check.sql
-- Or via: scripts/check-rls.sh (uses supabase db query)

-- Query 1: List any tables missing RLS (must return 0 rows)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Query 2: Count tables missing RLS (parsed by scripts/check-rls.sh — must return 0)
SELECT COUNT(*) AS tables_without_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
