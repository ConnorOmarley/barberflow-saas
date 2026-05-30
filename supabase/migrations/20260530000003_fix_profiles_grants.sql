-- ============================================================
-- FIX: profiles table grants broke RLS-based access
--
-- The initial migration did:
--   REVOKE ALL ON TABLE public.profiles FROM authenticated, anon, public;
--
-- This was intended as "defence in depth" but it is WRONG: PostgreSQL RLS
-- policies are a row filter applied ON TOP OF table-level privileges. With
-- no table GRANT, authenticated users get "permission denied for table
-- profiles" before RLS policies are ever evaluated — the own_profile_all
-- and tenant_profiles_select policies became unreachable.
--
-- Correct pattern: GRANT table privileges to authenticated, let RLS filter
-- which rows are visible. anon stays without profiles access (internal table).
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- supabase_auth_admin keeps full access (custom_access_token_hook reads here).
-- This was already granted in the initial migration; re-assert for safety.
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
