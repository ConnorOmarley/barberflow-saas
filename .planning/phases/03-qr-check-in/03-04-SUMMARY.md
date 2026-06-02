---
phase: 03-qr-check-in
plan: "04"
subsystem: qr-checkin
tags: [realtime, supabase, toast, dashboard, postgres_changes, check-in, webhook]

requires:
  - phase: 03-qr-check-in
    plan: "02"
    provides: "generateQrToken + AppointmentQRCode para exibição do QR"
  - phase: 03-qr-check-in
    plan: "03"
    provides: "processQrCheckIn Server Action que faz UPDATE status=CHECKED_IN"

provides:
  - "Hook useCheckInNotifications — assina postgres_changes na tabela appointments filtrado por barbershop_id"
  - "CheckInListener Client Component — toast 'Cliente chegou!' auto-dismiss 5s com cleanup correto"
  - "Integração na página /dashboard/agendamentos — owner vê chegada de clientes em tempo real"

affects: [dashboard, agendamentos, realtime, check-in]

tech-stack:
  added: []
  patterns:
    - "postgres_changes como estratégia Realtime primária (mais robusto que Broadcast puro)"
    - "useCallback para memoizar onCheckIn e evitar re-subscribe desnecessário"
    - "supabase.removeChannel() no cleanup do useEffect — sem memory leak"
    - "toast local via useState + setTimeout 5000ms para auto-dismiss"
    - "router.refresh() após check-in para revalidar lista server-side"

key-files:
  created:
    - src/lib/hooks/use-check-in-notifications.ts
    - src/components/dashboard/check-in-listener.tsx
  modified:
    - src/app/(owner)/dashboard/agendamentos/page.tsx

key-decisions:
  - "postgres_changes escolhido sobre Broadcast para maior robustez (funciona mesmo se broadcastCheckIn falhar)"
  - "Toast implementado como estado local (não shadcn/ui toast) — zero novas dependências"
  - "appointment-status-actions.tsx já tinha botão 'Marcar Concluido' para CHECKED_IN — nenhuma alteração necessária"
  - "CheckInListener posicionado dentro do DashboardShell mas ANTES do div de conteúdo (fixed-positioned, posicionamento DOM irrelevante para UI)"

requirements-completed: [QR-02]

duration: 10min
completed: 2026-06-02
---

# Phase 3 Plan 04: Dashboard Integration — Realtime + CHECKED_IN Summary

**Hook postgres_changes Realtime + toast 'Cliente chegou!' auto-dismiss com cleanup correto e integração na página de agendamentos**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-02T00:20:00Z
- **Completed:** 2026-06-02T00:30:00Z
- **Tasks:** 2 de 2
- **Files modified:** 3

## Accomplishments

### Task 1: Hook useCheckInNotifications + CheckInListener

**src/lib/hooks/use-check-in-notifications.ts** criado:
- `'use client'` no topo — importa createClient do browser client
- `useCallback` memoiza `onCheckIn` para estabilizar a referência no `useEffect`
- Canal Supabase: `checkin-${barbershopId}` com `postgres_changes` event='UPDATE', table='appointments', filter por barbershop_id
- Guard `payload.new.status === 'CHECKED_IN'` antes de chamar callback
- Cleanup: `supabase.removeChannel(channel)` no retorno do useEffect

**src/components/dashboard/check-in-listener.tsx** criado:
- `useState<CheckInToast[]>` para lista de toasts
- `handleCheckIn`: cria toast com `crypto.randomUUID()`, agenda `setTimeout` 5000ms para auto-dismiss
- `router.refresh()` para revalidar lista de agendamentos após check-in
- `useCheckInNotifications(barbershopId, handleCheckIn)` para assinatura do canal
- Retorna `null` quando `toasts.length === 0` (sem DOM desnecessário)
- Toast visual: ícone CheckCircle verde, texto "Cliente chegou!" + "Check-in registrado", botão X para dismiss manual

### Task 2: Integração na página + confirmação do botão CHECKED_IN → COMPLETED

**src/app/(owner)/dashboard/agendamentos/page.tsx** modificado:
- Import adicionado: `import { CheckInListener } from '@/components/dashboard/check-in-listener'`
- JSX: `<CheckInListener barbershopId={barbershop_id} />` dentro do DashboardShell, antes do div de conteúdo

**src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx** verificado:
- Botão "Marcar Concluido" para `status === 'CHECKED_IN'` já presente (linhas 104-114)
- `handleComplete` chama `updateAppointmentStatus(appointment.id, 'COMPLETED')` — correto
- Nenhuma alteração necessária

## Task Commits

1. **Task 1** — `e150fbd`: feat(phase-3): criar hook useCheckInNotifications + CheckInListener com toast Realtime
2. **Task 2** — `b4cfa5f`: feat(phase-3): integrar CheckInListener na página de agendamentos

## Files Created/Modified

- `src/lib/hooks/use-check-in-notifications.ts` — hook Realtime postgres_changes
- `src/components/dashboard/check-in-listener.tsx` — Client Component com toasts
- `src/app/(owner)/dashboard/agendamentos/page.tsx` — integração do CheckInListener

## Decisions Made

- **postgres_changes vs Broadcast:** postgres_changes escolhido como estratégia primária. Funciona mesmo que `broadcastCheckIn()` no Server Action falhe silenciosamente. Latência ligeiramente maior mas maior confiabilidade para MVP.
- **Toast local:** Implementado com `useState` e `setTimeout` sem dependências externas — consistente com o padrão do projeto.
- **appointment-status-actions.tsx sem alterações:** O botão já existia do plano 03-02. Confirmado presente e funcional.

## Deviations from Plan

Nenhuma — plano executado exatamente como especificado.

## Known Stubs

Nenhum — hook e componente completamente implementados. A integração está funcional.

## Threat Surface Scan

| Threat ID | Mitigação Verificada |
|-----------|---------------------|
| T-03-14 | Accept — canal expõe apenas appointmentId (UUID), sem PII; barbershopId é UUID v4 (122 bits) |
| T-03-15 | Accept — router.refresh() no pior caso causa refresh desnecessário; dados sempre vêm do DB server-side |
| T-03-16 | Accept — toasts auto-dismissed em 5s; state é local, não persiste |
| T-03-17 | Mitigado — RLS na tabela appointments garante que postgres_changes só entrega eventos do barbershop_id correto |
| T-03-SC | Accept — nenhum pacote instalado neste plano |

## Self-Check

- [x] `src/lib/hooks/use-check-in-notifications.ts` existe no worktree
- [x] `src/components/dashboard/check-in-listener.tsx` existe no worktree
- [x] `useCheckInNotifications` exportado do hook
- [x] `CheckInListener` exportado do componente
- [x] `'use client'` no topo de ambos os arquivos
- [x] `supabase.removeChannel(channel)` no cleanup do useEffect
- [x] `router.refresh()` no handleCheckIn
- [x] Auto-dismiss via `setTimeout(..., 5000)`
- [x] CheckInListener importado e renderizado em AgendamentosPage
- [x] `appointment-status-actions.tsx` tem botão "Marcar Concluido" para CHECKED_IN
- [x] TypeScript check: `npx tsc --noEmit` — 0 erros (verificado após cada task)
- [x] Commits: e150fbd + b4cfa5f existem no git log

## Self-Check: PASSED

---
*Phase: 03-qr-check-in*
*Completed: 2026-06-02*
