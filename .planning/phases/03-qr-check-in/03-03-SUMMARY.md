---
phase: 03-qr-check-in
plan: "03"
subsystem: qr-checkin
tags: [qr, hmac, check-in, server-action, public-route, single-use, realtime]

requires:
  - phase: 03-qr-check-in
    plan: "01"
    provides: "Tabela used_qr_tokens com UNIQUE em token_hash — gate atômico anti race-condition"

provides:
  - "processQrCheckIn Server Action com 6 guards de segurança na ordem correta"
  - "Página pública /qr/check-in como Server Component — processa token sem JS no client"
  - "generateQrToken também disponível no mesmo arquivo (criado aqui pois 03-02 roda em paralelo)"

affects: [03-04, qr-checkin, appointments, used_qr_tokens]

tech-stack:
  added: []
  patterns:
    - "processQrCheckIn usa adminClient exclusivamente — sem JWT do caller (rota pública)"
    - "timingSafeEqual obrigatório para comparação HMAC — previne timing attacks (T-03-08)"
    - "Janela de tempo verificada com appointment.start_time do DB — não com payload do token (T-03-10)"
    - "INSERT atômico em used_qr_tokens com verificação de conflict code '23505' (T-03-11)"
    - "broadcastCheckIn fire-and-forget via REST API Realtime do Supabase"
    - "Página /qr/check-in é Server Component puro — sem 'use client', sem JS para processar token"

key-files:
  created:
    - src/app/actions/qr-checkin.ts
    - src/app/(public)/qr/check-in/page.tsx
  modified: []

key-decisions:
  - "Criado arquivo completo com generateQrToken + processQrCheckIn (03-02 roda em paralelo — arquivo não existia)"
  - "Status check ANTES da janela de tempo — appointment CANCELLED rejeita antes de qualquer check de tempo"
  - "token_hash = SHA-256(token completo) inserido em used_qr_tokens — nunca o token raw"
  - "Discriminated union 'success' in result para type narrowing limpo na página Server Component"
  - "broadcastCheckIn usa REST API do Supabase Realtime (não supabase.channel().send() do servidor)"

requirements-completed: [QR-02, QR-03, QR-04]

duration: 15min
completed: 2026-06-02
---

# Phase 3 Plan 03: Check-In Verification Summary

**processQrCheckIn Server Action com 6 guards HMAC + single-use atômico e página pública /qr/check-in como Server Component**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-02T00:00:00Z
- **Completed:** 2026-06-02T00:15:00Z
- **Tasks:** 2 de 2
- **Files modified:** 2

## Accomplishments

### Task 1: processQrCheckIn + generateQrToken em qr-checkin.ts

Arquivo `src/app/actions/qr-checkin.ts` criado com ambas as funções exportadas:

**generateQrToken:**
- Busca appointment via adminClient (sem JWT do caller)
- Payload: `${appointmentId}|${issuedAt}|${startUnix}`
- Token: `base64url(payload).hexSig` — formato single-param para QR menor

**processQrCheckIn — 6 guards na ordem obrigatória:**
1. Decode + parse (2 partes, 3 segmentos, appointmentId não vazio)
2. HMAC SHA-256 constant-time compare via `crypto.timingSafeEqual` — tamanho verificado antes
3. Busca appointment via adminClient (barbershop_id incluído para broadcast)
4. Status == 'CONFIRMED' verificado ANTES da janela de tempo
5. Janela ±30 minutos do `appointment.start_time` do DB (não do payload)
6. INSERT atômico em `used_qr_tokens` com verificação de `error.code === '23505'`
7. UPDATE `appointments.status = 'CHECKED_IN'`
8. broadcastCheckIn fire-and-forget + revalidatePath

### Task 2: Página pública /qr/check-in

`src/app/(public)/qr/check-in/page.tsx` criado como Server Component puro:
- `searchParams: Promise<{ token?: string }>` (Next.js 15 async searchParams)
- Token ausente → `{ error: 'QR Code inválido ou incompleto' }` sem chamar processQrCheckIn
- Discriminated union `'success' in result` para type narrowing limpo (sem cast)
- Layout público idêntico ao padrão de `(public)/[slug]/page.tsx`
- Estado success: ícone dourado CheckCircle + badge purple "Check-In Confirmado"
- Estado error: ícone vermelho XCircle + mensagem específica do guard que falhou

## Task Commits

1. **Task 1+2: processQrCheckIn + página check-in** — a commitar via `git -C <worktree>`

## Files Created/Modified

- `src/app/actions/qr-checkin.ts` — Server Action com generateQrToken + processQrCheckIn + broadcastCheckIn
- `src/app/(public)/qr/check-in/page.tsx` — Server Component público que processa token e exibe resultado

## Decisions Made

- **Arquivo criado completo:** 03-02 e 03-03 rodam em paralelo; o arquivo não existia, então criamos com ambas as funções (generateQrToken + processQrCheckIn) em vez de depender do 03-02.
- **Status check antes do tempo:** Appointment CANCELLED falha no Step 4 antes do Step 5 — correto para o caso de agendamento cancelado.
- **timingSafeEqual com verificação de tamanho:** `providedBuf.length !== expectedBuf.length` verificado antes do `timingSafeEqual` — buffer de tamanho diferente causaria exceção.
- **Janela do DB, não do payload:** `startUnix` recalculado do `appointment.start_time` do DB (Step 5), não do payload — previne tampering do `expires_at` no token (T-03-10).
- **broadcastCheckIn via REST:** Usa `fetch` para o endpoint REST do Supabase Realtime em vez de `supabase.channel().send()` do servidor — consistente com a recomendação do RESEARCH.md.

## Deviations from Plan

**1. [Rule 2 - Completeness] Arquivo criado com ambas as funções (generateQrToken + processQrCheckIn)**
- **Found during:** Task 1
- **Issue:** O plano 03-03 instrui "ADICIONAR processQrCheckIn ao final de qr-checkin.ts". O arquivo ainda não existia porque 03-02 roda em paralelo.
- **Fix:** Criado arquivo completo com generateQrToken (de acordo com a spec do 03-02 no contexto) + processQrCheckIn + broadcastCheckIn.
- **Impact:** Se 03-02 também criar o arquivo, haverá conflito de merge; o merge deve manter ambas as funções. O plano 03-03 instrui explicitamente: "Se o arquivo ainda não existir quando você for modificá-lo, crie-o do zero com ambas as funções exportadas".

Fora isso — plano executado exatamente como especificado.

## Issues Encountered

Nenhum bloqueador técnico.

## Threat Surface Scan

Todos os mitigations do threat_model aplicados:

| Threat ID | Mitigação Aplicada |
|-----------|-------------------|
| T-03-08 | `crypto.timingSafeEqual(providedBuf, expectedBuf)` — constant-time compare |
| T-03-09 | HMAC cobre payload completo — qualquer modificação invalida assinatura |
| T-03-10 | Janela verificada com `appointment.start_time` do DB — não com valor do payload |
| T-03-11 | `INSERT ... ON CONFLICT` com verificação de `error.code === '23505'` — atômico |
| T-03-12 | Accept — token single-use após consumo; sem PII além de clientName na página |
| T-03-13 | Accept — UUID 122 bits + HMAC previne forjamento |
| T-03-SC | Nenhum pacote instalado neste plano |

Nenhuma superfície nova não planejada detectada.

## Known Stubs

Nenhum — a função processQrCheckIn está completamente implementada com todos os guards. A página /qr/check-in exibe dados reais do appointment.

## Self-Check

- [x] `src/app/actions/qr-checkin.ts` existe no worktree
- [x] `src/app/(public)/qr/check-in/page.tsx` existe no worktree
- [x] `processQrCheckIn` exportado de qr-checkin.ts
- [x] `generateQrToken` exportado de qr-checkin.ts
- [x] 6 guards implementados na ordem correta (status antes de tempo)
- [x] `crypto.timingSafeEqual` com verificação de tamanho de buffer
- [x] `error.code === '23505'` verificado para single-use
- [x] Nenhum `export const runtime = 'edge'`
- [x] Server Component puro — sem 'use client'
- [x] searchParams como Promise (Next.js 15)
- [ ] TypeScript check — requer Bash (indisponível neste agente; verificar manualmente)

## Next Phase Readiness

- Plano 03-04 pode prosseguir: `processQrCheckIn` + página `/qr/check-in` estão prontos
- Após merge do 03-02: verificar que `generateQrToken` não está duplicado (ou resolver merge conflict)
- Teste manual requerido: gerar token via 03-02, acessar `/qr/check-in?token=...`, confirmar CHECKED_IN

---
*Phase: 03-qr-check-in*
*Completed: 2026-06-02*
