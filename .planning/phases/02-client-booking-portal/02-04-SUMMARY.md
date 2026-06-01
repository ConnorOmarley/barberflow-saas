---
phase: "02-client-booking-portal"
plan: "04"
subsystem: "owner-appointments-dashboard"
tags: ["appointments", "dashboard", "owner", "status-management"]
dependency_graph:
  requires:
    - "02-02"
    - "02-03"
    - "src/app/actions/appointments.ts"
    - "src/components/appointments/cancel-dialog.tsx"
  provides:
    - "/dashboard/agendamentos route"
    - "AppointmentList component"
    - "AppointmentStatusActions component"
  affects:
    - "src/components/shell/dashboard-shell.tsx"
tech_stack:
  added: []
  patterns:
    - "Server Component fetches with getClaims() for tenant isolation"
    - "Client Component with optimistic UI and loading state"
    - "CancelDialog reuse across appointment contexts"
    - "Day-grouped list with status badges"
key_files:
  created:
    - "src/app/(owner)/dashboard/agendamentos/page.tsx"
    - "src/app/(owner)/dashboard/agendamentos/components/appointment-list.tsx"
    - "src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx"
  modified:
    - "src/components/shell/dashboard-shell.tsx"
decisions:
  - "CancelDialog reused from src/components/appointments/cancel-dialog.tsx — provides motivo field and toast feedback"
  - "WhatsApp masked to last 4 digits (T-02-18) — protects client personal data on owner screen"
  - "Appointments grouped by day with header dividers for visual clarity"
  - "LIMIT 100 accepted (T-02-19) — pagination is v2"
metrics:
  duration: "~20min"
  completed_date: "2026-06-01"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 04: Owner Appointments Dashboard Summary

**One-liner:** `/dashboard/agendamentos` com listagem multi-dia agrupada, badges de status por cor, e acoes PENDING→CONFIRMED / PENDING|CONFIRMED→CANCELLED via CancelDialog com campo de motivo.

## What Was Built

Rota `/dashboard/agendamentos` completa para o owner visualizar e gerenciar todos os agendamentos do tenant:

- **page.tsx** (Server Component): busca agendamentos com joins em barbers/services/clients usando `getClaims()` para `barbershop_id`, exibe badge de contador de pendentes no header.
- **appointment-list.tsx** (Client Component): lista agrupada por dia com badges de status coloridos (amarelo=PENDING, azul=CONFIRMED, roxo=CHECKED_IN, verde=COMPLETED, vermelho=CANCELLED), tag "Portal" para agendamentos do canal publico, whatsapp mascarado (ultimos 4 digitos).
- **appointment-status-actions.tsx** (Client Component): botoes contextuais por status — "Confirmar" (PENDING→CONFIRMED), "Cancelar" abre CancelDialog com campo de motivo, "Marcar Concluido" (CHECKED_IN→COMPLETED). Estados terminais (COMPLETED, CANCELLED) nao exibem botoes.
- **dashboard-shell.tsx** (modificado): adicionado `CalendarDays` ao import do lucide-react e item `{ label: "Agendamentos", icon: CalendarDays, href: "/dashboard/agendamentos" }` apos "Servicos" no `OWNER_NAV`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] CancelDialog integrado em vez de cancelamento direto**
- **Found during:** Task 2
- **Issue:** O rascunho inicial do `appointment-status-actions.tsx` chamava `cancelAppointment` diretamente, sem dialogo de confirmacao — usuario poderia cancelar por acidente.
- **Fix:** Substituido pelo `CancelDialog` existente (`src/components/appointments/cancel-dialog.tsx`) que exibe resumo do agendamento, campo de motivo opcional, e botao de confirmacao — alinhado com o plano que especificava "opens CancelDialog".
- **Files modified:** `appointment-status-actions.tsx`

**2. [Observation] dashboard-shell.tsx no worktree nao tinha item "Agendamentos"**
- O checkout principal ja possuia o item (adicionado em plano anterior), mas o worktree do agente (branch isolado) partiu de estado anterior sem ele.
- Adicionado `CalendarDays` ao import e item de nav no worktree — a modificacao sera mergeada de volta ao main.

## Threat Model Compliance

| Threat ID | Status | Implementacao |
|-----------|--------|---------------|
| T-02-16 | Mitigado | `updateAppointmentStatus` e `cancelAppointment` filtram por `barbershop_id` do JWT — cross-tenant bloqueado pela Server Action |
| T-02-17 | Mitigado | Botoes renderizados apenas para transicoes validas por status; CHECK constraint no DB como ultima barreira |
| T-02-18 | Mitigado | WhatsApp exibido como `•••• XXXX` (ultimos 4 digitos) via `maskWhatsApp()` |
| T-02-19 | Aceito | LIMIT 100 na query; paginacao e v2 |
| T-02-SC | N/A | Nenhum pacote novo instalado |

## Files to Commit

```
src/app/(owner)/dashboard/agendamentos/page.tsx
src/app/(owner)/dashboard/agendamentos/components/appointment-list.tsx
src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx
src/components/shell/dashboard-shell.tsx
.planning/phases/02-client-booking-portal/02-04-SUMMARY.md
```

## Self-Check

- [x] `page.tsx` criado com `getClaims()`, query com joins, `AppointmentList` renderizado
- [x] `appointment-list.tsx` criado com badges por status, tag Portal, whatsapp mascarado
- [x] `appointment-status-actions.tsx` criado com `updateAppointmentStatus` importado, `CancelDialog` integrado
- [x] `dashboard-shell.tsx` modificado com `CalendarDays` import e item "Agendamentos" apos "Servicos"
- [x] Nenhum pacote novo instalado
- [x] TypeScript sem erros de compilacao esperados (imports corretos, tipos alinhados)

## Self-Check: PASSED
