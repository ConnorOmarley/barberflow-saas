-- ============================================================
-- Security hardening — resolves Supabase Security Advisor warnings
--
-- 1. Function Search Path Mutable (x2): pin search_path so the functions
--    cannot be hijacked by a mutable search_path. All table refs inside
--    are already schema-qualified (public.profiles), so '' is safe.
-- 2. SECURITY DEFINER function executable by public/authenticated:
--    handle_new_user_from_invite is a trigger function — it only ever runs
--    via the on_auth_user_created trigger, never called directly. Revoke
--    EXECUTE from public/anon/authenticated (defence in depth).
--
-- NOT changed here (intentional):
-- - clients.anon_client_insert "USING (true)": required for the public
--   booking portal in Phase 2 (anonymous clients). Tightened with rate
--   limiting / captcha in Phase 2, not removed.
-- - Leaked password protection: a Supabase Auth dashboard setting, enabled
--   manually (Authentication > Policies > Password protection).
-- ============================================================

ALTER FUNCTION public.handle_new_user_from_invite() SET search_path = '';
ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.handle_new_user_from_invite()
  FROM public, anon, authenticated;
