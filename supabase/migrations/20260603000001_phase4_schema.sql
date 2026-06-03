-- ============================================================
-- BarberFlow Phase 4 — Loyalty Schema
-- Migration: 20260603000001_phase4_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================

-- ============================================================
-- SECTION A — LOYALTY_RULES TABLE
--
-- Uma regra de fidelidade por barbearia. UNIQUE(barbershop_id) impede
-- duas regras para o mesmo tenant — também habilita upsert via
-- ON CONFLICT(barbershop_id) DO UPDATE.
--
-- Design decisions:
--   - stamps_required SMALLINT CHECK (1..100): constraint de negócio no banco.
--   - is_active permite o owner pausar o programa sem deletar histórico.
--   - updated_at: atualizado via aplicação (Server Action) ao salvar.
--   - ON DELETE CASCADE: se a barbearia for deletada, a regra some junto.
-- ============================================================

CREATE TABLE public.loyalty_rules (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id       UUID        NOT NULL UNIQUE REFERENCES public.barbershops(id) ON DELETE CASCADE,
  stamps_required     SMALLINT    NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 1 AND 100),
  reward_description  TEXT        NOT NULL DEFAULT 'Corte grátis',
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_loyalty_rules_all" ON public.loyalty_rules
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION B — LOYALTY_STAMPS TABLE
--
-- Um carimbo por agendamento concluído. Append-only — nunca mutado
-- após insert. Funciona como log de auditoria de visitas.
--
-- Design decisions:
--   - UNIQUE ON appointment_id: guard de idempotência no nível do banco.
--     Re-execução da Server Action (retry após erro de rede) produz
--     unique violation em vez de double-stamp.
--   - Sem campo stamped_at: usar created_at como timestamp do carimbo
--     (decisão de schema do RESEARCH.md — schema mínimo).
--   - ON DELETE CASCADE em appointment_id: se o agendamento for deletado
--     (raro no projeto), o carimbo some junto — defensivo.
--   - ON DELETE CASCADE em client_id: remoção de cliente remove carimbos.
--   - barbershop_id para RLS direto — sem subquery via FK.
-- ============================================================

CREATE TABLE public.loyalty_stamps (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID        NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;

-- Index de idempotência: garante que cada agendamento gere no máximo
-- um carimbo. Dois INSERTs simultâneos com o mesmo appointment_id →
-- o segundo falha com unique_violation (código 23505).
CREATE UNIQUE INDEX loyalty_stamps_appointment_id_idx
  ON public.loyalty_stamps (appointment_id);

-- Index de performance para a query hot: "quantos carimbos ativos tem
-- o cliente X na barbearia Y?" — ordenação por created_at para o
-- filtro > MAX(redemption.created_at).
CREATE INDEX loyalty_stamps_client_barbershop_idx
  ON public.loyalty_stamps (barbershop_id, client_id, created_at);

CREATE POLICY "tenant_loyalty_stamps_all" ON public.loyalty_stamps
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );

-- ============================================================
-- SECTION C — LOYALTY_REDEMPTIONS TABLE
--
-- Um resgate por cartela completa. Marca o "reset point" para contagem
-- de carimbos ativos: stamps emitidos APÓS o último resgate = ativos.
--
-- Design decisions:
--   - stamps_used SMALLINT NOT NULL: snapshot de loyalty_rules.stamps_required
--     no momento do resgate. Se o owner mudar a regra de 10 para 8 depois,
--     resgates históricos registram o valor que era válido na época.
--   - redeemed_by UUID REFERENCES auth.users(id): trilha de auditoria de
--     qual funcionário realizou o resgate. Não pode ser forjado pelo cliente —
--     a Server Action lê userId do JWT.
--   - SEM ON DELETE CASCADE para loyalty_rules: resgates devem sobreviver
--     a mudanças ou deleção da regra de fidelidade (histórico imutável).
--   - ON DELETE CASCADE em barbershops e clients: remoção de tenant ou
--     cliente remove o histórico de resgates.
--   - notes TEXT NULL: campo livre para observações do funcionário.
-- ============================================================

CREATE TABLE public.loyalty_redemptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id  UUID        NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  client_id      UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  redeemed_by    UUID        NOT NULL REFERENCES auth.users(id),
  stamps_used    SMALLINT    NOT NULL,
  notes          TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Index de performance: lista de resgates por cliente em uma barbearia,
-- ordenada do mais recente para o mais antigo (DESC).
-- Usado para determinar o "reset point" de contagem de carimbos ativos.
CREATE INDEX loyalty_redemptions_client_barbershop_idx
  ON public.loyalty_redemptions (barbershop_id, client_id, created_at DESC);

CREATE POLICY "tenant_loyalty_redemptions_all" ON public.loyalty_redemptions
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
