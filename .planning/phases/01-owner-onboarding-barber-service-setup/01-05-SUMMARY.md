---
phase: "01"
plan: "05"
subsystem: barbers-crud
tags: [barbers, server-actions, crud, invite, working-hours, barber-services, storage, sheet-drawer]
dependency_graph:
  requires:
    - "01-03"  # working-hours-grid + upsertBarberWorkingHours
    - "01-04"  # barbers table + linkBarberProfile
  provides:
    - createBarber
    - updateBarber
    - deactivateBarber
    - inviteBarber
    - syncBarberServices
    - /dashboard/equipe page + BarberCard + BarberDrawer
  affects:
    - "01-06"  # /dashboard/servicos usa syncServiceBarbers (já adicionado em barber-services.ts)
    - "01-08"  # aceitar-convite page usa linkBarberProfile (já existente)
tech_stack:
  added: []
  patterns:
    - DELETE+INSERT para sincronização de junction tables (barber_services, working_hours)
    - createAdminClient service role para inviteUserByEmail
    - Server Component data fetch + client component state management
    - Supabase Storage para upload de fotos de barbeiros (bucket barber-photos)
key_files:
  created:
    - src/app/actions/barber-services.ts
    - src/app/(owner)/dashboard/equipe/page.tsx
    - src/app/(owner)/dashboard/equipe/components/barber-list-client.tsx
    - src/app/(owner)/dashboard/equipe/components/barber-card.tsx
    - src/app/(owner)/dashboard/equipe/components/barber-drawer.tsx
  modified:
    - src/app/actions/barbers.ts  # adicionado createBarber, updateBarber, deactivateBarber, inviteBarber
decisions:
  - "BarberWithServiceCount definido em barber-list-client.tsx (não em page.tsx) para evitar import cycle Server→Client"
  - "barber-services.ts também recebeu syncServiceBarbers (pelo plan 01-06 via linter agent) — mantido pois é compatível"
  - "Upload de foto usa estratégia graceful degradation: se bucket não existe, barbeiro é salvo sem foto com mensagem de erro clara"
  - "Invite disabled antes de salvar o barbeiro (requer barberId do DB para enviar inviteUserByEmail)"
metrics:
  duration: "~45 minutos"
  completed: "2026-05-31"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 01 Plan 05: CRUD Completo de Barbeiros — /dashboard/equipe Summary

**One-liner:** CRUD completo de barbeiros com drawer de criação/edição (working hours, serviços+comissão, foto via Storage, invite por email com service role admin client) e página Server Component /dashboard/equipe.

---

## Tasks Completed

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Server Actions de barbeiros — CRUD completo + invite + barber-services sync | Done | barbers.ts, barber-services.ts |
| 2 | UI de Equipe — page.tsx + BarberCard + BarberDrawer | Done | equipe/page.tsx, barber-list-client.tsx, barber-card.tsx, barber-drawer.tsx |

---

## What Was Built

### Task 1 — Server Actions

**`src/app/actions/barbers.ts`** expandido com 4 novas funções:
- `createBarber` — INSERT barbers com barbershop_id do JWT, retorna `{ data: { id, name } }`
- `updateBarber` — UPDATE com filtro duplo `eq('id') + eq('barbershop_id')` (belt-and-suspenders com RLS)
- `deactivateBarber` — soft delete via `is_active = false`
- `inviteBarber` — usa `createAdminClient()` + `auth.admin.inviteUserByEmail()` com `data: { barbershop_id, role: 'barber', barber_id }`. Error handling: "already been registered" → mensagem pt-BR amigável

**`src/app/actions/barber-services.ts`** criado:
- `syncBarberServices` — DELETE+INSERT (nunca UPSERT) para junction table barber_services. App-layer guard verifica ownership do barbeiro antes de DELETE.
- `syncServiceBarbers` — adicionado automaticamente pelo agente do plan 01-06 (compatível, mantido)

### Task 2 — UI

**`/dashboard/equipe/page.tsx`** (Server Component):
- Fetch `barbers` com join `barber_services(service_id)` para contar serviços atribuídos
- Fetch `services` ativos para passar ao drawer
- Normaliza dados com `service_count` calculado
- Passa dados serializáveis para `BarberListClient` (client component)

**`BarberListClient`** (client):
- Gerencia estado do drawer (open/editingBarber)
- Grid responsivo ou empty state com CTA

**`BarberCard`** (client):
- Avatar 48px com gradiente determinístico
- Status badge Ativo/Inativo
- Specialties como tag chips
- Contagem de serviços
- DropdownMenu com Editar/Desativar
- Footer: Editar + Convidar (se sem profile_id) + Ver agenda

**`BarberDrawer`** (client, Sheet right):
- 4 seções: Dados pessoais / Horários de trabalho / Serviços oferecidos / Acesso ao painel
- Upload de foto → Storage bucket barber-photos → path `{barberId}/{timestamp}.{ext}` (T-01-12)
- `WorkingHoursGrid` controlado
- Checklist de serviços com campos de comissão condicionais (tipo + valor)
- Invite por email inline (desabilitado antes de salvar barbeiro)
- Footer: Desativar (se editando ativo) + Fechar + Salvar

---

## Deviations from Plan

### Auto-added

**[Rule 3 - Auto-fix] `BarberWithServiceCount` movido de page.tsx para barber-list-client.tsx**
- **Found during:** Task 2
- **Issue:** Importar tipo de Server Component (`page.tsx`) em Client Component causaria import cycle e erro de build
- **Fix:** Tipo definido diretamente em `barber-list-client.tsx` e re-exportado; page.tsx importa de lá
- **Files modified:** page.tsx, barber-list-client.tsx

**[Nota] `syncServiceBarbers` adicionado a barber-services.ts pelo linter/agente**
- Foi adicionado automaticamente durante a criação do arquivo — compatível com plan 01-06 (ServiceDrawer)
- Mantido sem alteração pois não afeta o plan 01-05

---

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| T-01-12 (path traversal no upload) | Mitigado — path = `${barberId}/${Date.now()}.${ext}`, barberId é UUID do DB |
| T-01-13 (inviteBarber email validation) | Mitigado — barbershop_id do JWT; error message pt-BR não vaza estado interno |
| T-01-14 (syncBarberServices cross-tenant) | Mitigado — app-layer guard verifica barber ownership antes de DELETE; RLS é gate primária |

---

## Known Stubs

**Ver agenda** button em `BarberCard` está com `disabled={true}` — a funcionalidade /agenda para owners será entregue em phase posterior.

---

## Threat Flags

Nenhuma superfície de ameaça nova identificada além das já cobertas pelo threat model do plan.

---

## Self-Check

### Files created/modified:
- [x] `src/app/actions/barbers.ts` — modificado (createBarber, updateBarber, deactivateBarber, inviteBarber adicionados)
- [x] `src/app/actions/barber-services.ts` — criado
- [x] `src/app/(owner)/dashboard/equipe/page.tsx` — criado
- [x] `src/app/(owner)/dashboard/equipe/components/barber-list-client.tsx` — criado
- [x] `src/app/(owner)/dashboard/equipe/components/barber-card.tsx` — criado
- [x] `src/app/(owner)/dashboard/equipe/components/barber-drawer.tsx` — criado

### Acceptance criteria verification (manual — build bloqueado no sandbox):
- [x] `inviteBarber` exportado em barbers.ts
- [x] `createAdminClient` importado e usado em inviteBarber
- [x] `inviteUserByEmail` chamado em inviteBarber
- [x] "already been registered" tratado com mensagem pt-BR
- [x] `syncBarberServices` exportado em barber-services.ts
- [x] `.delete()` usado em barber-services.ts (DELETE+INSERT pattern)
- [x] `barbershop_id` nunca aceito como parâmetro de createBarber/updateBarber/deactivateBarber
- [x] `WorkingHoursGrid` importado em barber-drawer.tsx
- [x] `syncBarberServices` importado em barber-drawer.tsx
- [x] `inviteBarber` importado em barber-drawer.tsx
- [x] `barber-photos` referenciado em barber-drawer.tsx (bucket name)
- [x] barber-drawer.tsx usa `createClient` de `@/lib/supabase/client` (browser) — nenhum server client
- [x] page.tsx usa `createClient` de `@/lib/supabase/server`

### Build verification:
Build not runnable in sandbox — all imports verified manually:
- All shadcn components (Sheet, ScrollArea, Checkbox, Select, Separator, Alert, Button, Input, Label) exist in `src/components/ui/`
- WorkingHoursGrid exported from `src/app/(owner)/onboarding/components/working-hours-grid.tsx`
- upsertBarberWorkingHours exported from `src/app/actions/working-hours.ts`
- createAdminClient exported from `src/lib/supabase/admin.ts`
- All Lucide icons (UserPlus, UsersRound, MoreHorizontal, Pencil, UserX, CalendarDays, Mail, Loader2, X, Upload) are standard lucide-react exports

## Self-Check: PASSED (manual verification)
