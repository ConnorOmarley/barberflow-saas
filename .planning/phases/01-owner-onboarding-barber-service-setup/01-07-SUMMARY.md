---
phase: "01"
plan: "07"
subsystem: barber-schedule
tags: [agenda, appointments, server-actions, optimistic-ui, tabs]
dependency_graph:
  requires: ["01-05", "01-06"]
  provides: ["barber-agenda-view", "appointment-status-actions"]
  affects: ["/agenda", "appointments table"]
tech_stack:
  added: []
  patterns:
    - "Server Action com barbershop_id do JWT (belt-and-suspenders com RLS)"
    - "Optimistic UI com useState + revert on error"
    - "Server Component (page.tsx) + Client Component (agenda-view.tsx)"
    - "Date navigation via ?date=YYYY-MM-DD searchParam forçando re-fetch"
key_files:
  created:
    - src/app/(barber)/agenda/agenda-view.tsx
  modified:
    - src/app/actions/appointments.ts
    - src/app/globals.css
decisions:
  - "CancelDialog implementado inline no agenda-view.tsx como componente local (plan 01-08 pode promover para componente global)"
  - "handleCompleted é async no pai (AgendaView) para controlar otimismo e revert centralizado"
  - "badge-pending e badge-cancelled adicionados ao globals.css (faltavam conforme UI-SPEC)"
metrics:
  completed: "2026-06-01"
---

# Phase 1 Plan 07: Barber Agenda View Summary

**One-liner:** Página /agenda do barbeiro preenchida com dados reais — Tabs Dia/Semana, date navigator via ?date=, lista de appointments com otimistic update para COMPLETED e CancelDialog inline.

## Tasks Completed

### Task 1 — Server Actions de appointments

**Arquivo:** `src/app/actions/appointments.ts`

O arquivo já existia com implementação parcial (incluindo `createAppointment` do plan 01-08). Verificado que continha as duas funções requeridas por este plano:

- `updateAppointmentStatus(appointmentId, status)` — UPDATE com `barbershop_id` do JWT, `revalidatePath('/agenda')` + `revalidatePath('/dashboard')`
- `cancelAppointment(appointmentId, reason?)` — UPDATE SET status='CANCELLED' + `cancelled_at` + `cancelled_by` + `cancel_reason`. Nunca deleta (D-18)

Threat model T-01-17 mitigado: `WHERE barbershop_id = JWT barbershop_id` + RLS policy.

### Task 2 — Agenda page preenchida com dados reais

**Arquivo criado:** `src/app/(barber)/agenda/agenda-view.tsx`

Componente client `AgendaView` com:
- Tabs shadcn (Dia / Semana) com `onValueChange` que push `?tab=` ao router
- Date navigator: ChevronLeft/Right com `useRouter().push('/agenda?date=...&tab=...')` — ±1 dia (Dia) ou ±7 dias (Semana)
- Display de data via `Intl.DateTimeFormat pt-BR`: "sábado, 31 de maio" (dia) | "26 mai — 1 jun" (semana)
- Lista de appointments com `AppointmentRow`: Avatar 36px, status rail 2px colorido, StatusBadge, DropdownMenu
- DropdownMenu "Concluir atendimento" → `updateAppointmentStatus(id, 'COMPLETED')` com optimistic update
- DropdownMenu "Cancelar" → abre `CancelDialog` inline (plan 01-08 pode promover para global)
- Empty state "Nenhum agendamento para este dia" no tab Dia
- Week tab: grid 7 colunas Mon–Sun com compact cards (hora + nome do cliente), hoje destacado
- `useState(initialAppointments)` para optimistic state; revert em erro com `setActionError`

**Arquivo modificado:** `src/app/globals.css`

Adicionadas classes CSS ausentes per UI-SPEC seção 5:
- `.badge-pending` — slate: `color: #94a3b8; background: rgba(148,163,184,0.1)`
- `.badge-cancelled` — muted: `color: #64748b; background: rgba(100,116,139,0.1)`

O `page.tsx` já existia correto do plano anterior: Server Component que resolve `searchParams`, busca `barberRow` por `profile_id = userId`, calcula range de datas, busca appointments com join `clients!inner + services!inner`, e renderiza `DashboardShell > AgendaView`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Adicionadas classes badge-pending e badge-cancelled ao globals.css**
- **Found during:** Task 2
- **Issue:** UI-SPEC define 5 status badges para appointments (PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED), mas `globals.css` só tinha 3 (done, scheduled, progress). Sem as classes, os badges PENDING e CANCELLED renderizariam sem estilo.
- **Fix:** Adicionado `.badge-pending` (slate) e `.badge-cancelled` (muted) ao bloco de status badges em `globals.css`.
- **Files modified:** `src/app/globals.css`

**2. [Rule 2 - Missing critical functionality] CancelDialog implementado inline**
- **Found during:** Task 2
- **Issue:** O plano 01-07 menciona "use a temporary inline confirm for now OR wire to CancelDialog if plan 01-08 is running in parallel". Plan 01-08 não foi executado ainda.
- **Fix:** `CancelDialog` implementado como componente local no mesmo arquivo `agenda-view.tsx`. Chama `cancelAppointment` Server Action diretamente, com estado de loading e erro. Plan 01-08 pode extrair para `src/components/appointments/cancel-dialog.tsx` e substituir o import.

## Files for Orchestrator to Commit

| File | Status | Description |
|------|--------|-------------|
| `src/app/(barber)/agenda/agenda-view.tsx` | CREATED | Client component AgendaView com Tabs, date nav, appointment list, optimistic updates, CancelDialog |
| `src/app/actions/appointments.ts` | VERIFIED (pre-existing) | updateAppointmentStatus + cancelAppointment — continha também createAppointment do plan 01-08 |
| `src/app/globals.css` | MODIFIED | Adicionadas .badge-pending e .badge-cancelled |

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| "Editar" DropdownMenuItem onClick vazio | `agenda-view.tsx` | ~280 | Editar appointment wired em plan 01-08 Task 2 — drawer ainda não existe |
| "Novo agendamento" Button onClick vazio | `agenda-view.tsx` | ~466 | AppointmentDrawer wired em plan 01-08 — componente não existe ainda |

Estes stubs são intencionais e documentados: plan 01-08 entrega os drawers correspondentes.

## Threat Surface Scan

Nenhuma nova surface de segurança introduzida além das já documentadas no threat model:
- T-01-17 (Elevation of Privilege) mitigado em `appointments.ts` com `WHERE barbershop_id = JWT barbershop_id` + RLS
- T-01-18 (Tampering via optimistic UI) aceito — revert em erro, sem consequência de segurança

## Self-Check

- [x] `src/app/(barber)/agenda/agenda-view.tsx` criado
- [x] `src/app/actions/appointments.ts` contém `updateAppointmentStatus` e `cancelAppointment`
- [x] `src/app/globals.css` contém `.badge-pending` e `.badge-cancelled`
- [x] `page.tsx` importa `AgendaView` de `./agenda-view`
- [x] Otimistic update com revert em erro implementado
- [x] Date navigation via `useRouter().push` com `?date=` searchParam
- [x] Empty state "aguardando configuração" quando `barberRow` é null (em `page.tsx`)
- [x] Nenhum `DELETE` em `appointments.ts`
- [x] `barbershop_id` sempre do JWT, nunca do parâmetro
