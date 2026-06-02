---
phase: "02"
phase_name: "Client Booking Portal"
session_start: "2026-06-01"
status: passed
---

# UAT — Phase 2: Client Booking Portal

## Success Criteria

| # | Criteria | Status |
|---|----------|--------|
| SC-1 | Client opens portal, selects service & barber, sees available slots, confirms booking | ✅ PASSED |
| SC-2 | Double-booking prevention: slot disappears after booked, DB constraint active | ✅ PASSED |
| SC-3 | Status lifecycle: PENDING → CONFIRMED + Cancelar dialog funcional | ✅ PASSED |
| SC-4 | Service duration respected: 50-min service at 09:00 blocks 09:30, next slot = 10:00 | ✅ PASSED |

## Test Log

### SC-1 — Portal público (2026-06-01)
- Landing page abriu sem login
- Wizard 4 steps navegou corretamente: serviço → barbeiro → data/hora → dados
- Agendamento criado com status PENDENTE
- **Bug encontrado e corrigido:** avatar do barbeiro mostrava nome completo ao invés da inicial — `photo_url` inválida exibia alt text. Fix: componente `BarberAvatar` com `onError` handler.

### SC-2 — Double-booking (2026-06-01)
- Slot das 09:00 agendado com sucesso
- Segunda tentativa de agendamento: slot das 09:00 desapareceu da lista
- `getAvailableSlots` filtra corretamente slots já ocupados
- Exclusion constraint GIST ativa como camada de proteção adicional

### SC-3 — Ciclo de vida de status (2026-06-01)
- PENDING com botões "Confirmar" + "Cancelar" visíveis ✅
- CONFIRMED com botão "Cancelar" ✅
- CHECKED_IN → COMPLETED: não testado (aguarda Fase 3 — QR Check-In)

### SC-4 — Duração do serviço (2026-06-01)
- Agendamento das 09:00 (Corte + Barba, 50 min) bloqueia corretamente o slot das 09:30
- Próximo slot disponível: 10:00 ✅

## Verdict: PHASE 2 VERIFIED ✅

**1 bug encontrado e corrigido durante UAT** (avatar duplicado — step-barber.tsx)
**0 blockers para Fase 3**
