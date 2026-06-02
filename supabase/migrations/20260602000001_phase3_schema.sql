-- ============================================================
-- BarberFlow Phase 3 — QR Check-In Schema
-- Migration: 20260602000001_phase3_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   used_qr_tokens não tem barbershop_id próprio — isolamento via FK
--   para appointments.barbershop_id. RLS usa subquery nessa coluna.
-- ============================================================

-- ============================================================
-- SECTION A — Tabela used_qr_tokens
--
-- Armazena hashes de tokens QR já consumidos para impedir
-- double-scan (race condition no nível de banco de dados).
--
-- Design decisions:
--   - token_hash armazena SHA-256 hex do token completo (64 chars).
--     Nunca o token raw — minimiza exposição do secret HMAC.
--   - issued_at/expires_at NÃO estão na tabela — esses dados já
--     estão encodados no próprio token. Schema mínimo.
--   - ON DELETE CASCADE: se o appointment for deletado, os tokens
--     consumidos associados são removidos automaticamente.
-- ============================================================

CREATE TABLE public.used_qr_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash     TEXT        NOT NULL,
  consumed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION B — Índices
--
-- UNIQUE em token_hash: guard atômico contra race conditions.
--   Dois requests simultâneos com o mesmo token vão tentar
--   INSERT simultaneamente — o segundo falha com unique violation,
--   garantindo que apenas um check-in seja processado.
--
-- INDEX em appointment_id: acelera FK lookups e consultas do tipo
--   "este appointment já foi usado?".
-- ============================================================

CREATE UNIQUE INDEX used_qr_tokens_token_hash_idx
  ON public.used_qr_tokens (token_hash);

CREATE INDEX used_qr_tokens_appointment_id_idx
  ON public.used_qr_tokens (appointment_id);

-- ============================================================
-- SECTION C — Row Level Security
--
-- Policy SELECT para authenticated: o owner/barber pode ver tokens
--   consumidos de appointments do próprio barbershop, usando
--   subquery via FK appointments.barbershop_id.
--
-- INSERT/UPDATE/DELETE: NENHUMA policy para anon ou authenticated.
--   Todo write vai via adminClient (service role) que bypassa RLS.
--   RLS sem policy = deny-by-default para anon e authenticated.
--   Isso é intencional — o check-in é uma operação privilegiada.
--
-- Writes via adminClient (service role) bypass RLS —
-- no anon/authenticated INSERT policy needed.
-- ============================================================

ALTER TABLE public.used_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_used_qr_tokens" ON public.used_qr_tokens
  FOR SELECT TO authenticated
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );
