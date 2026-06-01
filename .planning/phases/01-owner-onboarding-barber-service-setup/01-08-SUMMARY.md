---
phase: "01"
plan: "08"
subsystem: appointments
tags: [appointments, drawer, cancel-dialog, client-combobox, setup-checklist, dashboard]
dependency_graph:
  requires:
    - "01-05"  # barbers CRUD + barber_services
    - "01-06"  # services CRUD
  provides:
    - createAppointment Server Action com conflict check
    - AppointmentDrawer — "Novo Agendamento" global sheet
    - CancelDialog — confirmação de cancelamento com motivo
    - ClientCombobox — busca de clientes com debounce + inline create
    - AppointmentEditDrawer — resumo + cancelamento via D-19
    - SetupChecklist — widget de progresso de configuração no dashboard
  affects:
    - src/app/(owner)/dashboard/page.tsx
    - src/app/layout.tsx (Toaster adicionado)
tech_stack:
  added: []
  patterns:
    - Server Action com conflict check app-layer (D-17)
    - end_time computado server-side de services.duration_minutes (T-01-19)
    - new_client.whatsapp_opt_in sempre false (T-01-22)
    - DashboardClientLayer como wrapper 'use client' para Server Component dashboard
    - Debounce 300ms em ClientCombobox via useRef + setTimeout
    - Time slot generation a partir de working_hours por day_of_week
key_files:
  created:
    - src/app/actions/appointments.ts  # createAppointment adicionado
    - src/components/appointments/cancel-dialog.tsx
    - src/components/appointments/client-combobox.tsx
    - src/components/appointments/appointment-drawer.tsx
    - src/components/appointments/appointment-edit-drawer.tsx
    - src/components/dashboard/setup-checklist.tsx
    - src/components/dashboard/dashboard-client-layer.tsx
  modified:
    - src/app/(owner)/dashboard/page.tsx  # DashboardClientLayer + barbershopId
    - src/app/layout.tsx  # Toaster adicionado
decisions:
  - "DashboardClientLayer como thin wrapper 'use client' para manter dashboard/page.tsx como Server Component"
  - "Time slots gerados a partir de working_hours por day_of_week (30min intervals)"
  - "ClientCombobox usa browser Supabase client — RLS enforces barbershop_id automaticamente via JWT"
  - "Toaster (sonner) adicionado ao layout raiz para suportar toast.success/error em toda a aplicação"
metrics:
  duration: "~45min"
  completed_date: "2026-06-01"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
---

# Phase 1 Plan 08: Appointment Drawer + Setup Checklist Summary

**One-liner:** Drawer de agendamento manual com ClientCombobox (debounce 300ms + inline create), conflict check server-side, AppointmentEditDrawer com CancelDialog integrado (D-19), e SetupChecklist widget no dashboard.

---

## Tasks Completed

### Task 1: Server Action createAppointment

Adicionado `createAppointment` ao arquivo `src/app/actions/appointments.ts` (que já tinha `updateAppointmentStatus` e `cancelAppointment` do plan 01-07).

**Características:**
- `end_time` sempre computado server-side de `services.duration_minutes` — cliente nunca pode passar `end_time` (T-01-19)
- `new_client.whatsapp_opt_in = false` hardcoded no servidor (T-01-22)
- Conflict check app-layer: `.neq('status', 'CANCELLED').lt('start_time', endTime).gt('end_time', startTime)` (D-17)
- `booking_source: 'manual'`, `created_by: userId` do JWT
- `revalidatePath('/dashboard')` + `revalidatePath('/agenda')` após sucesso
- Race condition (T-01-20) documentada como known limitation — Phase 2 adiciona GIST exclusion constraint

### Task 2: Componentes de Agendamento

**ClientCombobox** (`src/components/appointments/client-combobox.tsx`):
- Debounce 300ms via `useRef + setTimeout`
- Busca `OR full_name.ilike / whatsapp_number.ilike` com mínimo 2 chars
- "Criar novo cliente" aparece em CommandEmpty e no rodapé dos resultados
- Formulário inline com nome + WhatsApp + nota sobre opt-in Phase 5
- RLS enforces barbershop_id automaticamente — browser client apenas

**AppointmentDrawer** (`src/components/appointments/appointment-drawer.tsx`):
- Barbers carregados ao abrir; Services filtrados por `barber_services` ao selecionar barbeiro
- Time slots gerados de `working_hours.start_time → end_time` por `day_of_week` (intervalos de 30min)
- Slots ocupados filtrados via query `appointments` para o barber+date
- Error Alert `border-red-900/50 bg-red-950/30 text-red-400` acima do footer
- Toast de sucesso com nome do cliente, data e hora ao confirmar

**CancelDialog** (`src/components/appointments/cancel-dialog.tsx`):
- Props: `appointment: { id, clientName, serviceName, startTime, barberName } | null`
- Resumo em `bg-[var(--surface-raised)]` acima do Textarea de motivo
- Loading state: Loader2 + "Cancelando..."
- Chama `cancelAppointment(id, reason)` e toast de sucesso

**AppointmentEditDrawer** (`src/components/appointments/appointment-edit-drawer.tsx`):
- Exibe resumo do appointment (nome, serviço, barbeiro, data/hora, status badge)
- Botão destrutivo "Cancelar agendamento" abre CancelDialog interno (D-19)
- CancelDialog renderizado dentro do EditDrawer para evitar portal issues

**SetupChecklist** (`src/components/dashboard/setup-checklist.tsx`):
- 4 itens: working_hours > 0, barbers > 0, services > 0, barber_services com commission > 0
- Barra de progresso gradiente amber `linear-gradient(90deg, #e8c89a, #d4a574)`
- Dismiss via X button → `localStorage.setItem('setup_checklist_dismissed', 'true')`
- Auto-oculta quando todos 4 itens completos OU quando dispensado

**Dashboard updates** (`src/app/(owner)/dashboard/page.tsx`):
- `barbershopId` extraído de `claims.app_metadata.barbershop_id`
- `DashboardClientLayer` renderizado entre KpiRow e o grid principal
- Mantém page.tsx como Server Component puro

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Toaster não incluído no layout raiz**
- **Found during:** Task 2 — verificação pós-criação dos componentes
- **Issue:** `toast.success()` e `toast.error()` do sonner não renderizam sem o `<Toaster />` no layout
- **Fix:** Adicionado `import { Toaster } from "@/components/ui/sonner"` e `<Toaster richColors />` ao `src/app/layout.tsx`
- **Files modified:** `src/app/layout.tsx`

**2. [Rule 2 - Missing Critical Functionality] `DashboardClientLayer` criado como wrapper intermediário**
- **Found during:** Task 2 — análise de `dashboard/page.tsx` como Server Component
- **Issue:** O plano especificou criar um thin 'use client' wrapper para manter page.tsx como Server Component. Este arquivo não estava listado explicitamente nos artifacts do plano.
- **Fix:** Criado `src/components/dashboard/dashboard-client-layer.tsx` como 'use client' wrapper que gerencia `appointmentDrawerOpen` state e renderiza `AppointmentDrawer` + `SetupChecklist`.
- **Files modified:** `src/components/dashboard/dashboard-client-layer.tsx` (novo)

---

## Known Stubs

Nenhum. Todos os componentes têm dados reais conectados via Supabase.

---

## Threat Surface Scan

Nenhuma superfície nova além do que foi especificado no `<threat_model>` do plano.

---

## Files for Orchestrator to Commit

| File | Status | Notes |
|------|--------|-------|
| `src/app/actions/appointments.ts` | modified | createAppointment adicionado |
| `src/components/appointments/cancel-dialog.tsx` | created | CancelDialog com motivo |
| `src/components/appointments/client-combobox.tsx` | created | Debounce 300ms + inline create |
| `src/components/appointments/appointment-drawer.tsx` | created | Drawer completo end-to-end |
| `src/components/appointments/appointment-edit-drawer.tsx` | created | EditDrawer com CancelDialog integrado (D-19) |
| `src/components/dashboard/setup-checklist.tsx` | created | Widget de progresso no dashboard |
| `src/components/dashboard/dashboard-client-layer.tsx` | created | Wrapper client para Server Component |
| `src/app/(owner)/dashboard/page.tsx` | modified | DashboardClientLayer + barbershopId |
| `src/app/layout.tsx` | modified | Toaster adicionado (Rule 2 auto-fix) |
| `.planning/phases/01-owner-onboarding-barber-service-setup/01-08-SUMMARY.md` | created | Este arquivo |

---

## Self-Check

- [x] `src/app/actions/appointments.ts` — `createAppointment` exportada (3 funções no total)
- [x] `src/components/appointments/cancel-dialog.tsx` — `cancelAppointment` importado, `cancel_reason` usado
- [x] `src/components/appointments/client-combobox.tsx` — debounce 300ms via setTimeout, "Criar novo cliente" inline
- [x] `src/components/appointments/appointment-drawer.tsx` — `createAppointment`, `working_hours`, time slots
- [x] `src/components/appointments/appointment-edit-drawer.tsx` — `AppointmentEditDrawer` exportado, `CancelDialog` renderizado dentro, "Cancelar agendamento" destrutivo
- [x] `src/components/dashboard/setup-checklist.tsx` — 4 itens, dismiss localStorage
- [x] `src/app/(owner)/dashboard/page.tsx` — `SetupChecklist` via `DashboardClientLayer`, `AppointmentDrawer` via `DashboardClientLayer`

## Self-Check: PASSED
