---
phase: 01-owner-onboarding-barber-service-setup
plan: "01"
subsystem: database-foundation
tags: [migration, rls, shadcn, admin-client, supabase-storage]
dependency_graph:
  requires: [Phase 0 — Initial Schema (barbershops, profiles, clients tables)]
  provides:
    - "public.barbers table com RLS + profile_id NULL FK"
    - "public.services table com RLS"
    - "public.barber_services junction table com RLS via subquery"
    - "public.working_hours table com RLS via subquery"
    - "public.appointments table com RLS + status CHECK"
    - "Trigger handle_invite_accepted em auth.users AFTER UPDATE"
    - "barber-photos storage bucket (public=false) com políticas authenticated"
    - "createAdminClient() com service role key — somente Server Actions"
    - "14 shadcn components instalados em src/components/ui/"
  affects:
    - "Todos os planos Phase 1 subsequentes dependem destas tabelas"
    - "aceitar-convite page beneficia do trigger handle_invite_accepted"
    - "inviteBarber Server Action (Plan 01-04) usa createAdminClient()"
tech_stack:
  added:
    - "@radix-ui/* (Radix UI primitives via shadcn CLI — scroll-area, tabs, select, etc.)"
    - "cmdk (command palette — via shadcn command component)"
    - "sonner (toast notifications — via shadcn sonner component)"
  patterns:
    - "RLS via subquery em barber_services e working_hours (sem barbershop_id direto)"
    - "SECURITY DEFINER + SET search_path = '' para trigger handle_invite_accepted"
    - "createAdminClient() sem persistência de sessão (autoRefreshToken: false)"
    - "Storage bucket criado na migration via INSERT INTO storage.buckets"
key_files:
  created:
    - supabase/migrations/20260531000001_phase1_schema.sql
    - src/lib/supabase/admin.ts
    - src/components/ui/sheet.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/select.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/avatar.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/command.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/sonner.tsx
    - src/components/ui/input-group.tsx
  modified:
    - src/components/ui/input.tsx
    - package.json
    - package-lock.json
decisions:
  - "Trigger handle_invite_accepted usa AFTER UPDATE em auth.users para linkar barbers.profile_id atomicamente — mais confiável que client-side fallback"
  - "Storage bucket barber-photos criado na migration (não seed.sql) para garantir consistência entre dev e produção"
  - "Admin client usa @supabase/supabase-js diretamente (não @supabase/ssr) pois não precisa de cookie management"
  - "input-group.tsx incluído pelo registry shadcn como dependência implícita do select — mantido pois é útil"
metrics:
  duration: "~12 min"
  completed: "2026-05-31"
  tasks_completed: 3
  files_created: 17
  files_modified: 3
---

# Phase 1 Plan 01: Fundação de Schema e Admin Client Summary

**One-liner:** Migration SQL com 5 tabelas RLS-completas + trigger AFTER UPDATE para linkage de barbers.profile_id + admin client service-role + 14 shadcn components instalados.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Instalar shadcn components Phase 1 | bae9c63 | 15 novos em src/components/ui/ + input.tsx atualizado + package.json |
| 2 | Criar migration SQL Phase 1 | 55e1d3e | supabase/migrations/20260531000001_phase1_schema.sql |
| 3 | Criar src/lib/supabase/admin.ts | 2675373 | src/lib/supabase/admin.ts |

## What Was Built

### Migration SQL (20260531000001_phase1_schema.sql)

5 tabelas criadas com RLS ativo imediatamente após cada CREATE TABLE:

- **public.barbers** — entidade operacional do barbeiro (separada de `profiles`). `profile_id` NULL até aceitar convite.
- **public.services** — catálogo de serviços por barbearia.
- **public.barber_services** — junction table (barber_id, service_id) PK + commission_type CHECK ('percent','fixed') + commission_value.
- **public.working_hours** — horários por barbeiro por dia (split shifts suportados via múltiplas linhas).
- **public.appointments** — agendamentos com status CHECK (PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED). Sem EXCLUDE constraint (Phase 2 adiciona).

RLS patterns:
- Tabelas com `barbershop_id` direto (barbers, services, appointments): policy direta `= JWT barbershop_id`
- Tabelas sem `barbershop_id` (barber_services, working_hours): policy via subquery `barber_id IN (SELECT id FROM public.barbers WHERE barbershop_id = JWT barbershop_id)`

Trigger `handle_invite_accepted` — AFTER UPDATE ON auth.users, SECURITY DEFINER, SET search_path = ''. Detecta transição de `encrypted_password` vazio → preenchido e atualiza `barbers.profile_id = NEW.id` quando `raw_user_meta_data.barber_id` está presente.

Storage bucket `barber-photos` (public=false) com políticas authenticated-only INSERT/SELECT.

### Admin Client (src/lib/supabase/admin.ts)

`createAdminClient()` usa `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY`. Sem cookie management, sem persistência de sessão. JSDoc documenta restrição de uso somente em Server Actions.

### shadcn Components

14 components instalados via CLI (registry oficial, preset base-nova): sheet, dialog, select, textarea, checkbox, switch, tabs, avatar, scroll-area, command, popover, tooltip, dropdown-menu, sonner. Mais input-group.tsx (dependência implícita do select). input.tsx atualizado para versão mais recente.

## Deviations from Plan

### Auto-fixed Issues

None — plano executado exatamente como especificado.

### Extra Files

**[Informational] input-group.tsx criado pelo registry shadcn**
- **Found during:** Task 1
- **Reason:** O registry shadcn instalou `input-group.tsx` como dependência implícita do componente `select`. Não estava no plano mas é útil e inofensivo.
- **Action:** Commitado junto com os demais componentes.

## Known Stubs

None — este plano não cria UI com dados. A migration e o admin client não têm stubs.

## Threat Flags

None — superfície de segurança dentro do threat_model do plano:
- T-01-01 (handle_invite_accepted): SECURITY DEFINER + SET search_path = '' + REVOKE EXECUTE implementados.
- T-01-02 (admin.ts): JSDoc documenta restrição; sem 'use server' no arquivo (é utilitário, não Server Action).
- T-01-03 (RLS barber_services/working_hours): subquery via public.barbers com JWT claim implementado.
- T-01-SC (shadcn): componentes do registry oficial, nenhum npm package novo adicionado manualmente.

## Self-Check: PASSED

- [x] supabase/migrations/20260531000001_phase1_schema.sql existe
- [x] src/lib/supabase/admin.ts existe com createAdminClient() + SUPABASE_SERVICE_ROLE_KEY
- [x] 14 componentes shadcn existem em src/components/ui/
- [x] 5 CREATE TABLE no arquivo de migration
- [x] 5 ENABLE ROW LEVEL SECURITY (5 tabelas — comentário do header não conta como ALTER)
- [x] Trigger handle_invite_accepted criado com SECURITY DEFINER + REVOKE EXECUTE
- [x] EXCLUDE constraint ausente (Phase 2 adiciona)
- [x] barber-photos bucket criado na migration
- [x] TypeScript compila sem erros (npx tsc --noEmit)
- [x] Commits: bae9c63, 55e1d3e, 2675373
