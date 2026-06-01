---
phase: "02"
plan: "03"
subsystem: client-booking-portal
tags: [server-actions, booking-wizard, public-portal, multi-tenancy, lgpd]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [public-booking-actions, booking-wizard-complete]
  affects: [appointments, clients]
tech_stack:
  added: []
  patterns:
    - "getAvailableSlots: Server Action com timezone via Intl.DateTimeFormat nativo"
    - "createPublicAppointment: upsert client por (barbershop_id, whatsapp_number) + adminClient INSERT"
    - "Exclusion constraint 23P01 capturado e retornado como mensagem amigável"
    - "end_time calculado server-side a partir de services.duration_minutes (anti-tamper T-02-10)"
    - "barbershop_id nunca aceito do cliente — sempre resolvido via slug (T-02-09)"
    - "Wizard 4 steps com state machine React (selectedService, selectedBarber, selectedSlot)"
key_files:
  created:
    - src/app/actions/public-booking.ts
    - src/app/(public)/[slug]/booking/components/step-service.tsx
    - src/app/(public)/[slug]/booking/components/step-barber.tsx
    - src/app/(public)/[slug]/booking/components/step-datetime.tsx
    - src/app/(public)/[slug]/booking/components/step-client.tsx
    - src/app/(public)/[slug]/booking/components/step-confirm.tsx
  modified:
    - src/app/(public)/[slug]/booking/components/booking-wizard.tsx
decisions:
  - "Preço exibido como NUMERIC(10,2) em reais (sem dividir por 100) — schema Fase 1 usa valor real"
  - "Slots com granularidade de 30 minutos (slotInterval fixo)"
  - "Normalização E.164 do WhatsApp server-side antes do upsert (evita duplicatas por formatação)"
  - "opt_in_source='booking_portal' e opt_in_timestamp gravados server-side (LGPD T-02-12)"
  - "created_by: null para agendamentos do portal (cliente anônimo — Pitfall 6 do RESEARCH)"
metrics:
  completed: "2026-06-01"
---

# Phase 02 Plan 03: Booking Wizard Completo + Server Actions Summary

**One-liner:** Wizard público 4 steps (serviço → barbeiro → data/hora → dados do cliente) com Server Actions getAvailableSlots e createPublicAppointment, proteção anti-tamper server-side e deduplicação de cliente por WhatsApp.

---

## Tasks Completed

| Task | Name | Files | Status |
|------|------|-------|--------|
| 1 | Server Actions — getAvailableSlots + createPublicAppointment | src/app/actions/public-booking.ts | Done |
| 2 | Booking wizard completo — 5 componentes + booking-wizard | 6 componentes + booking-wizard.tsx | Done |

---

## Files Created / Modified

### Criados

| Arquivo | Papel |
|---------|-------|
| `src/app/actions/public-booking.ts` | Server Actions: `getAvailableSlots` + `createPublicAppointment` + helpers de timezone |
| `src/app/(public)/[slug]/booking/components/step-service.tsx` | Step 1: Radio cards de serviços com nome, duração e preço |
| `src/app/(public)/[slug]/booking/components/step-barber.tsx` | Step 2: Cards de barbeiros com avatar (foto ou inicial) |
| `src/app/(public)/[slug]/booking/components/step-datetime.tsx` | Step 3: Date picker + grid 3 colunas de slots via getAvailableSlots |
| `src/app/(public)/[slug]/booking/components/step-client.tsx` | Step 4: Formulário RHF+Zod com nome, WhatsApp e opt-in |
| `src/app/(public)/[slug]/booking/components/step-confirm.tsx` | Step 5: Tela de sucesso com resumo e status PENDENTE |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/app/(public)/[slug]/booking/components/booking-wizard.tsx` | Substituído stub por implementação completa da state machine 4 steps |

---

## Server Action: getAvailableSlots

**Localização:** `src/app/actions/public-booking.ts`

**Input:** `{ barbershop_slug, barber_id, service_id, date: 'YYYY-MM-DD' }`
**Output:** `{ slots: string[] }` (ISO UTC strings) ou `{ error: string }`

**Algoritmo:**
1. Resolver `barbershop.timezone` via slug
2. Calcular `day_of_week` na timezone da barbearia com `Intl.DateTimeFormat`
3. Buscar `working_hours` do barbeiro para o dia (is_active=true)
4. Se vazio → `{ slots: [] }`
5. Buscar `duration_minutes` do serviço
6. Buscar appointments existentes no dia (UTC range, não CANCELLED) — SELECT apenas `start_time, end_time` (T-02-14)
7. Loop por cada janela de working_hours: gerar slots de 30 em 30 min, filtrar os com overlap

**Helpers de timezone (não exportados):**
- `getUTCOffset(dateStr, timezone)` — retorna '-03:00' via Intl.DateTimeFormat longOffset
- `getLocalDayOfWeek(dateStr, timezone)` — retorna 0-6 (Dom-Sáb) via Intl en-US short
- `localTimeToUTC(dateStr, timeStr, timezone)` — combina com offset
- `localDateToUTCStart/End` — início/fim do dia em UTC

---

## Server Action: createPublicAppointment

**Localização:** `src/app/actions/public-booking.ts`

**Input:** `{ barbershop_slug, service_id, barber_id, start_time, client: { full_name, whatsapp_number, whatsapp_opt_in } }`
**Output:** `{ data: { id, start_time } }` ou `{ error: string }`

**Passos de segurança:**
1. Resolver `barbershop.id` via slug — NUNCA aceita `barbershop_id` como parâmetro (T-02-09)
2. Buscar `duration_minutes` server-side — previne tampering de duração (T-02-10)
3. Calcular `end_time` server-side
4. Normalizar WhatsApp E.164 (`normalizeWhatsApp` helper)
5. Upsert `clients` via `adminClient` com `onConflict: 'barbershop_id,whatsapp_number'`
6. App-layer conflict check (defesa complementar)
7. INSERT `appointments` via `adminClient`: `status='PENDING'`, `booking_source='portal'`, `created_by=null`
8. Captura `23P01` (exclusion_violation) → `{ error: 'Horário indisponível. Escolha outro horário.' }`

**LGPD:**
- `whatsapp_opt_in=false` por padrão (checkbox no Step 4)
- `opt_in_source='booking_portal'` e `opt_in_timestamp=new Date().toISOString()` gravados server-side quando `opt_in=true`
- `whatsapp_opt_in=false` → `opt_in_source=null`, `opt_in_timestamp=null`

---

## Wizard: booking-wizard.tsx

**State machine:**
```
step=1: StepService → handleStep1Complete → selectedService + step=2
step=2: StepBarber  → handleStep2Complete → selectedBarber  + step=3
step=3: StepDatetime → handleStep3Complete → selectedSlot   + step=4
step=4: StepClient  → handleStep4Complete → createPublicAppointment → confirmedAppointment + step=5
step=5: StepConfirm → exibe resumo + botão "Fazer novo agendamento"
```

**Design tokens (idêntico ao onboarding):**
- `bg-background` — fundo da página
- `bg-[#151922]` — card background
- `border-white/[0.07]` — borda do card
- `#d4a574` — accent dourado (botões, progress bar, slots selecionados)
- `var(--text-secondary)` — texto secundário
- Dots de progresso: `w-4` no step ativo, `w-2` nos completados/futuros
- Barra de progresso: `h-1` com `linear-gradient(90deg, #e8c89a, #d4a574)`

---

## Deviations from Plan

**Nenhum desvio.** O plano foi executado exatamente como especificado.

Notas de implementação (dentro do escopo do plano):
- `StepService` exporta o tipo `Service` diretamente para evitar importação circular com `booking-wizard.tsx`
- `StepBarber` exporta o tipo `Barber` pelo mesmo motivo
- `StepClient` exporta o tipo `ClientFormData`
- `step-service.tsx` exporta `StepServiceBackButton` como componente auxiliar (não utilizado — Step 1 não tem botão Voltar)
- Preço em `step-service.tsx` usa `Number(service.price).toLocaleString(...)` sem divisão por 100 conforme instrução do plano (schema Fase 1 usa NUMERIC(10,2) em reais)

---

## Verification

### Automated (Node script)

```bash
node -e "
const fs=require('fs');
const files=['booking-wizard','step-service','step-barber','step-datetime','step-client','step-confirm']
  .map(f=>'src/app/(public)/[slug]/booking/components/'+f+'.tsx');
files.forEach(f=>{if(!fs.existsSync(f))throw new Error('Missing: '+f)});
const wiz=fs.readFileSync(files[0],'utf8');
if(!wiz.includes('createPublicAppointment'))throw new Error('wizard missing action');
console.log('all exist')
"
```

Resultado: `all exist` — PASSOU.

### Manual (smoke test)

Passos para verificar manualmente:
1. `npm run dev` → acessar `http://localhost:3000/[slug-da-barbearia]/booking`
2. Step 1: Selecionar serviço → deve avançar para step 2
3. Step 2: Selecionar barbeiro → deve avançar para step 3
4. Step 3: Selecionar data → `getAvailableSlots` chamado, slots exibidos; selecionar slot → avançar
5. Step 4: Preencher nome + WhatsApp → "Confirmar agendamento" → `createPublicAppointment` chamado
6. Step 5: "Agendamento confirmado!" + resumo + status PENDENTE
7. Verificar no Supabase Dashboard: `appointments` com `status='PENDING'`, `booking_source='portal'`, `created_by=null`

---

## Threat Surface Scan

Nenhuma superfície nova além das documentadas no `<threat_model>` do plano.

Mitigações implementadas conforme especificado:
- **T-02-09**: `barbershop_id` resolvido exclusivamente via slug — interface de entrada sem `barbershop_id`
- **T-02-10**: `end_time` calculado server-side de `services.duration_minutes`
- **T-02-12**: `opt_in_timestamp` server-side, `opt_in_source='booking_portal'`, checkbox default `false`
- **T-02-13**: Slots são apenas sugestões de UI; `createPublicAppointment` valida independentemente
- **T-02-14**: `getAvailableSlots` seleciona apenas `start_time, end_time` — sem `client_id` ou dados pessoais
- **T-02-15**: App-layer conflict check + captura de `23P01` (exclusion_violation)

---

## Known Stubs

Nenhum stub. Todos os componentes têm implementação completa.

---

## Self-Check

| Item | Status |
|------|--------|
| `src/app/actions/public-booking.ts` existe | FOUND |
| `booking-wizard.tsx` completo (não stub) | FOUND |
| `step-service.tsx` existe | FOUND |
| `step-barber.tsx` existe | FOUND |
| `step-datetime.tsx` existe | FOUND |
| `step-client.tsx` existe | FOUND |
| `step-confirm.tsx` existe | FOUND |
| `getAvailableSlots` em public-booking.ts | FOUND |
| `createPublicAppointment` em public-booking.ts | FOUND |
| Código `23P01` capturado | FOUND |
| `booking_portal` como opt_in_source | FOUND |
| `created_by: null` no INSERT | FOUND |
| `status: 'PENDING'` no INSERT | FOUND |
| `createPublicAppointment` importado no wizard | FOUND |
| `getAvailableSlots` importado no step-datetime | FOUND |
| `useForm` em step-client | FOUND |
| Mensagem PENDENTE em step-confirm | FOUND |

## Self-Check: PASSED
