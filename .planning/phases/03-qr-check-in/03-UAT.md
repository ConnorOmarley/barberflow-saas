---
phase: "03"
phase_name: "QR Check-In"
session_start: "2026-06-02"
status: passed
---

# UAT — Phase 3: QR Check-In

## Success Criteria

| # | Criteria | Status |
|---|----------|--------|
| SC-1 | Agendamento CONFIRMED tem QR acessível (sem Storage PNG) | ✅ PASSOU |
| SC-2 | Scan do QR dentro da janela → status muda para CHECKED_IN | ✅ PASSOU |
| SC-3 | Scan fora da janela ±30min → "Fora da janela de check-in" | ✅ PASSOU |
| SC-4 | QR já usado / cancelado → bloqueado por status check | ✅ PASSOU |

## Test Log

### SC-1 — QR disponível (2026-06-02)
- Modal "QR Check-In" aparece no card CONFIRMED com QR SVG
- URL gerada: `http://localhost:3000/qr/check-in?token=...` (sem Storage PNG)
- **Bug encontrado e corrigido:** `NEXT_PUBLIC_APP_URL` ausente → URL começava com `undefined`

### SC-3 — Janela de tempo (2026-06-02)
- Agendamento do dia anterior → "Fora da janela de check-in (±30 minutos do horário)"
- Validado antes de SC-2 por agendamento com horário passado

### SC-2 — Check-in realizado (2026-06-02)
- Agendamento criado para 20:00, acessado às 19:35 (dentro dos ±30min)
- Página mostrou "Check-in realizado! Bem-vindo, Zoberto." com badge roxo
- **Bug encontrado e corrigido:** `revalidatePath` chamado durante render de Server Component → removido

### SC-4 — QR revogado após uso (2026-06-02)
- Segunda tentativa com mesmo token → "Agendamento não confirmado (status: CHECKED_IN)"
- Status check bloqueia corretamente qualquer status ≠ CONFIRMED (CHECKED_IN, CANCELLED)

## Bugs encontrados e corrigidos durante UAT

| Bug | Fix |
|-----|-----|
| `undefined` na URL do QR | Adicionado `NEXT_PUBLIC_APP_URL=http://localhost:3000` ao `.env.local` |
| `revalidatePath` durante render | Removido de `processQrCheckIn` — Realtime + `router.refresh()` já atualiza o dashboard |
| Drawer sem botão "Novo agendamento" | Criado `NewAppointmentButton` e conectado à página |
| Select mostrando UUIDs | `SelectValue` do Base UI renderiza value — substituído por span com lookup manual |
| Serviço com metadata no trigger | `ItemText` vazava para trigger — metadados movidos para helper text abaixo do select |

## Verdict: PHASE 3 VERIFIED ✅
