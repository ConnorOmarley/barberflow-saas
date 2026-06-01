---
phase: "01"
plan: "06"
subsystem: services-crud
tags: [services, crud, server-actions, drawer, barber-assignment]
dependency_graph:
  requires:
    - "01-03"  # Phase 1 schema migration (services + barber_services tables)
    - "01-04"  # barber-services.ts syncBarberServices (extended here)
  provides:
    - services-crud-ui
    - syncServiceBarbers
  affects:
    - /dashboard/servicos
    - barber-services.ts
tech_stack:
  added: []
  patterns:
    - Server Component data fetch → client child components
    - Server Actions with getClaims() JWT auth guard
    - DELETE+upsert(ignoreDuplicates) sync pattern for junction table
    - RHF + Zod v4 form validation
    - Sheet drawer with quick-fill templates
key_files:
  created:
    - src/app/actions/services.ts
    - src/app/(owner)/dashboard/servicos/page.tsx
    - src/app/(owner)/dashboard/servicos/components/servicos-client.tsx
    - src/app/(owner)/dashboard/servicos/components/service-row.tsx
    - src/app/(owner)/dashboard/servicos/components/service-drawer.tsx
  modified:
    - src/app/actions/barber-services.ts  # added syncServiceBarbers export
decisions:
  - "syncServiceBarbers uses upsert(ignoreDuplicates=true) instead of raw INSERT + ON CONFLICT to preserve commission_type/commission_value set from barber drawer (D-15)"
  - "ServicosClient is a separate 'use client' component that receives serializable data from page.tsx Server Component"
  - "Deactivate action opens service drawer; owner clicks 'Desativar serviço' button inside drawer (not a separate route)"
metrics:
  duration_minutes: 35
  completed_date: "2026-05-31"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 01 Plan 06: Services CRUD — Summary

CRUD completo de serviços em /dashboard/servicos com list colorida, drawer de criação/edição com templates rápidos (Corte/Barba/Corte+Barba) e assignment de barbeiros via syncServiceBarbers sem campos de comissão (D-15).

## Tasks Completed

| Task | Name | Status | Key Output |
|------|------|--------|------------|
| 1 | Server Actions — createService, updateService, deactivateService + syncServiceBarbers | Done | services.ts + barber-services.ts extended |
| 2 | UI — page.tsx + ServiceRow + ServiceDrawer | Done | /dashboard/servicos functional |

## What Was Built

### Task 1: Server Actions

**`src/app/actions/services.ts`** (created):
- `createService` — barbershop_id always from JWT, never accepted as parameter (T-01-16)
- `updateService` — belt-and-suspenders WHERE id AND barbershop_id beyond RLS
- `deactivateService` — sets is_active=false, never deletes

**`src/app/actions/barber-services.ts`** (extended):
- Added `syncServiceBarbers(serviceId, barberIds[])` — syncs barber assignments from service drawer
- Uses `upsert` with `ignoreDuplicates: true` to avoid overwriting commission data set from barber drawer
- Removes unselected barbers with DELETE WHERE service_id = ? AND barber_id NOT IN (...)
- Commission fields left NULL per D-15

### Task 2: UI Components

**`page.tsx`** — Server Component:
- Fetches services with `barber_services(barber_id)` join for barber count
- Fetches active barbers for drawer assignment
- Derives displayName from profile or email handle
- Passes serializable data to `ServicosClient`

**`servicos-client.tsx`** — Client orchestrator:
- Manages drawer open state and editing service state
- Renders empty state or service list card
- Active services shown before inactive

**`service-row.tsx`** — Service list item:
- Color dot cycling through 6 hues (#d4a574, #10b981, #8b5cf6, #60a5fa, #f87171, #f59e0b)
- min-h-[56px] touch target compliance
- DropdownMenu: Editar / Desativar actions
- Tabular-nums for duration and price

**`service-drawer.tsx`** — Create/edit Sheet:
- Quick-fill templates (only on create): Corte 30min R$40, Barba 20min R$25, Corte+Barba 50min R$60
- Duration Select with options: 15, 20, 25, 30, 40, 45, 50, 60, 75, 90 min
- Price Input with R$ prefix
- Description Textarea (optional)
- Barbers section: Checkbox per active barber, no commission fields (D-15)
- Footer: Fechar ghost + Salvar serviço gold + Desativar serviço destructive (when editing active)
- RHF + Zod validation

## Deviations from Plan

### Auto-fixed Issues

None required.

### Implementation Notes

**Deviation: syncServiceBarbers uses upsert instead of manual DELETE+INSERT**

The plan described a DELETE rows NOT IN barberIds + INSERT missing entries with ON CONFLICT DO NOTHING approach. The implementation uses Supabase's `upsert` with `ignoreDuplicates: true` which achieves the same semantic (preserves existing rows without overwriting commission data) with a single DB call for the insert step instead of raw SQL. The DELETE step still runs separately to remove unselected barbers. This is functionally equivalent and cleaner.

**Deviation: barber-services.ts already existed from plan 01-05**

The plan assumed this file would be created as part of plan 01-06 (since 01-05 runs in parallel). In reality, plan 01-05 had already been executed and `barber-services.ts` existed with `syncBarberServices`. The `syncServiceBarbers` function was appended to the existing file without breaking the existing export.

**Deviation: Added servicos-client.tsx as separate client component**

The plan listed `page.tsx`, `service-row.tsx`, and `service-drawer.tsx` as the three files. A `servicos-client.tsx` orchestrator was added to properly separate Server Component data fetching (page.tsx) from client-side state management. This is the same pattern used in plan 01-05 for equipe/page.tsx.

## Security Review

### Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-01-15 | Mitigated | syncServiceBarbers: RLS via barber_services policy (subquery via barbers.barbershop_id) + app-layer getClaims() guard |
| T-01-16 | Mitigated | deactivateService: UPDATE WHERE id = ? AND barbershop_id = JWT value (belt-and-suspenders beyond RLS) |

### Security Properties
- barbershop_id never accepted as parameter in any action — always from getClaims()
- Cross-tenant service creation/update impossible via RLS + app-layer check
- syncServiceBarbers validates barbershop_id from JWT before any DB write

## Known Stubs

None. All data is fetched from real database tables created in plan 01-03.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes beyond what was planned.

## Self-Check

### Files Created/Modified
- [x] src/app/actions/services.ts — EXISTS
- [x] src/app/actions/barber-services.ts — EXISTS (extended)
- [x] src/app/(owner)/dashboard/servicos/page.tsx — EXISTS
- [x] src/app/(owner)/dashboard/servicos/components/servicos-client.tsx — EXISTS
- [x] src/app/(owner)/dashboard/servicos/components/service-row.tsx — EXISTS
- [x] src/app/(owner)/dashboard/servicos/components/service-drawer.tsx — EXISTS

### Acceptance Criteria
- [x] createService exported from services.ts
- [x] barbershop_id NOT in createService parameters (JWT only)
- [x] syncServiceBarbers exported from barber-services.ts
- [x] upsert/ignoreDuplicates pattern in syncServiceBarbers
- [x] syncServiceBarbers called in service-drawer.tsx
- [x] Quick-fill templates (Corte/Barba) in service-drawer.tsx
- [x] No commission fields in service-drawer.tsx (D-15)
- [x] min-h-[56px] in service-row.tsx
- [x] colorIndex prop in service-row.tsx

## Self-Check: PASSED
