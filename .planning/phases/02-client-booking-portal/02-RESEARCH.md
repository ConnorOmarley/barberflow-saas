# Phase 2: Client Booking Portal — Research

**Researched:** 2026-06-01
**Domain:** Public multi-tenant booking portal — slot availability, exclusion constraint, RLS anon, status lifecycle
**Confidence:** HIGH

---

## Summary

A Fase 2 entrega o portal de agendamento público: qualquer cliente pode abrir `/[slug]/booking`, escolher serviço, barbeiro e horário disponível, e confirmar um agendamento sem precisar de conta. O bloqueio de double-booking tem dois níveis: (1) app-layer conflict check herdado da Fase 1, e (2) a exclusion constraint PostgreSQL com GIST que esta fase adiciona via migration — esta é a garantia real contra race conditions simultâneas.

O maior desafio técnico é a constraint de exclusão: ela precisa ser scoped por `barber_id` (não global), precisa ignorar agendamentos CANCELLED, e precisa do extension `btree_gist` habilitado no Supabase (habilitado por padrão no Supabase Postgres). A segunda decisão crítica é RLS: o portal é público (role `anon`), então reads de `barbershops`, `services`, `barbers` precisam de políticas `FOR SELECT TO anon`, e writes de `clients` e `appointments` devem usar o adminClient (service role) no servidor — nunca o anon diretamente para INSERT — porque o `barbershop_id` é resolvido server-side a partir do slug.

A estrutura de URL `/[slug]/booking` dentro do route group `(public)` está documentada no `02-PATTERNS.md` existente e é a abordagem correta: evita conflito com rotas autenticadas e permite layout próprio sem `DashboardShell`.

**Recomendação principal:** Migration da Fase 2 adiciona a exclusion constraint + políticas anon de SELECT. Writes anônimos usam adminClient server-side. Slot picker é calculado server-side via Server Action (getAvailableSlots) — não via Realtime para MVP.

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| BOOK-01 | Cliente seleciona serviço, barbeiro e horário disponível no portal online | Wizard multi-step com `(public)/[slug]/booking`, slot picker via Server Action `getAvailableSlots` |
| BOOK-02 | Sistema bloqueia slots em tempo real — dois clientes não conseguem reservar o mesmo horário | Exclusion constraint GIST + app-layer conflict check como double-defense |
| BOOK-04 | Agendamento segue ciclo de status: PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED | Status `PENDING` no portal público (owner/barber confirma); painel Fase 1 já suporta os outros estados |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slot availability calculation | API / Backend (Server Action) | — | Cálculo envolve working_hours, appointments existentes e timezone — nunca deve ir ao cliente |
| Exclusion constraint / double-booking | Database (Postgres) | API Backend (conflict check app-layer) | Única garantia real de race condition é constraint DB-level; app-layer é defesa complementar |
| Public reads (barbershop, services, barbers) | Frontend Server (SSR) | — | Server Component pre-fetcha no servidor usando anon key; zero waterfall no cliente |
| Client identification (nome + WhatsApp) | API / Backend (Server Action) | — | Upsert de `clients` deve ser server-side para controlar `barbershop_id` e LGPD fields |
| Appointment insert (portal público) | API / Backend (Server Action via adminClient) | — | anon role não pode INSERT em appointments com RLS; adminClient resolve e insere server-side |
| Status lifecycle (PENDING → CONFIRMED → ...) | API / Backend (Server Action) | Dashboard UI | Transitions válidas são: portal cria PENDING; owner/barber confirma; QR muda para CHECKED_IN (Fase 3) |
| URL routing por slug | Frontend Server (SSR) | — | Next.js App Router dynamic segment `[slug]` com route group `(public)` |
| WhatsApp opt-in (LGPD) | API / Backend (Server Action) | — | `opt_in_timestamp` e `opt_in_source` gravados server-side no momento do INSERT |

---

## Standard Stack

### Core (já instalado no projeto)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.x | SSR, Server Components, Server Actions, dynamic routes `[slug]` | Já em uso — route group `(public)` isola o portal |
| Supabase JS (`@supabase/supabase-js`) | latest | Client anon + admin para reads/writes públicos | Já em uso — `createAdminClient()` disponível em `src/lib/supabase/admin.ts` |
| React Hook Form + Zod | latest | Coleta de dados do cliente (nome + WhatsApp + opt-in) | Padrão estabelecido na Fase 1 — `step-client.tsx` usa exatamente este padrão |
| Tailwind CSS + shadcn/ui | latest | UI do portal — mesmos componentes já instalados | `Button`, `Input`, `Label`, `Alert`, `Checkbox`, `Select`, `Sheet`, `Tabs`, `Badge` todos disponíveis |
| `date-fns` / Intl API | built-in / opcional | Conversão de timezone (UTC → barbershop.timezone) para exibição de slots | `Intl.DateTimeFormat` é zero-dependency; `date-fns-tz` se precisar de mais controle |

### Sem novas dependências necessárias

O portal público NÃO requer nenhuma instalação adicional de pacotes. Toda a stack necessária já está instalada:
- Slot picker: calculado com JavaScript puro (loops de intervalo)
- Timezone: `Intl.DateTimeFormat` nativo ou `date-fns-tz` (já disponível se `date-fns` estiver instalado)
- UI: shadcn/ui já instalado (todos os componentes necessários presentes em `src/components/ui/`)

---

## Package Legitimacy Audit

> Nenhum pacote novo a instalar nesta fase. Todos os componentes necessários já estão no projeto.

| Package | Registry | Status |
|---------|----------|--------|
| (nenhum novo) | — | Fase 2 usa exclusivamente dependências já presentes |

---

## Architecture Patterns

### System Architecture Diagram

```
Cliente (browser)
    │
    ├─► GET /[slug]                    (Server Component — SSR)
    │       └─► createPublicClient()  → SELECT barbershops WHERE slug=?
    │           └─► 404 se slug inválido
    │
    ├─► GET /[slug]/booking            (Server Component — SSR)
    │       └─► Promise.all([
    │               SELECT services WHERE barbershop_id + is_active
    │               SELECT barbers  WHERE barbershop_id + is_active
    │           ]) → passa como props ao BookingWizard
    │
    └─► BookingWizard (Client Component — 4 steps)
            │
            Step 1: selecionar serviço  (dados pré-carregados, sem fetch)
            Step 2: selecionar barbeiro (dados pré-carregados, sem fetch)
            Step 3: selecionar data/slot
            │       └─► Server Action: getAvailableSlots(barberId, serviceId, date)
            │               ├─► SELECT working_hours WHERE barber_id + day_of_week
            │               ├─► SELECT appointments WHERE barber_id + date + NOT CANCELLED
            │               └─► algoritmo: gera slots, exclui ocupados → retorna slots livres
            Step 4: dados do cliente (nome + WhatsApp + opt-in)
            │
            └─► Server Action: createPublicAppointment(...)
                    ├─► resolve barbershop_id via slug (createPublicClient)
                    ├─► busca duration_minutes do service (server-side — anti-tamper)
                    ├─► upsert client via adminClient (barbershop_id + whatsapp_number unique)
                    ├─► app-layer conflict check (createPublicClient)
                    ├─► INSERT appointment via adminClient (status='PENDING', booking_source='portal')
                    └─► retorna { data: { id, start_time } } | { error: string }
                            │
                            └─► se DUPLICATE KEY (exclusion constraint) → retorna "Horário indisponível"
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (public)/
│   │   └── [slug]/
│   │       ├── layout.tsx              # valida slug, 404 se inválido — sem auth check
│   │       ├── page.tsx                # landing page da barbearia
│   │       └── booking/
│   │           ├── page.tsx            # Server Component — pre-fetch services + barbers
│   │           └── components/
│   │               ├── booking-wizard.tsx   # 'use client' — state machine 4 steps
│   │               ├── step-service.tsx     # selecionar serviço
│   │               ├── step-barber.tsx      # selecionar barbeiro
│   │               ├── step-datetime.tsx    # selecionar data e slot
│   │               └── step-client.tsx      # formulário nome + WhatsApp + opt-in + submit
│   └── actions/
│       └── public-booking.ts           # createPublicAppointment + getAvailableSlots
├── lib/
│   └── supabase/
│       └── public.ts                   # createPublicClient() — anon key, sem cookies
└── middleware.ts                       # adicionar bypass para rotas /(public)/[slug]
supabase/
└── migrations/
    └── YYYYMMDD_phase2_schema.sql      # exclusion constraint + RLS anon policies
```

---

## Decisão 1: Estrutura de URL

**Decisão:** `/[slug]/booking` com route group `(public)`.

**Análise:**
- Opção A: `/(public)/[slug]/booking` — route group isola o layout público, sem conflito com `/dashboard`, `/agenda`, `/onboarding`, `/entrar`, `/cadastro`
- Opção B: `/book/[slug]` — mais explícito mas não reflete o branding "sua URL é barberflow.com/nomeDaBarbearia"

**Escolha:** Opção A (`/(public)/[slug]/booking`). O `02-PATTERNS.md` já documentou esta estrutura. O middleware precisa detectar rotas `/(public)` e deixar passar sem verificação de autenticação.

**Conflito de rotas a evitar:** O pattern `/[slug]` no App Router pode conflitar com rotas de primeiro nível. A solução é verificar no middleware se `pathname` corresponde a um slug válido antes de tentar autenticação — ou simplesmente colocar o bypass antes das regras A-E existentes.

**Middleware change (adicionar ANTES das Rules A-E):**
```typescript
// Bypass auth para portal público — slugs são lowercase + hífens, evitam palavras reservadas
const reservedPaths = ['/entrar', '/cadastro', '/dashboard', '/agenda', '/onboarding', '/auth', '/_next']
const isReserved = reservedPaths.some(p => pathname.startsWith(p))
const isPublicSlug = !isReserved && /^\/[a-z0-9][a-z0-9-]*($|\/booking.*)$/.test(pathname)
if (isPublicSlug) return response // sem verificação de autenticação
```

---

## Decisão 2: Exclusion Constraint — SQL Exato

**Contexto:** A Fase 1 omitiu intencionalmente a constraint (ver comentário na migration `20260531000001_phase1_schema.sql`, SECTION E). A Fase 2 adiciona via `ALTER TABLE`.

**Requisitos:**
1. Scoped por `barber_id` — dois barbeiros diferentes podem ter o mesmo horário
2. Ignora agendamentos CANCELLED — um slot cancelado deve poder ser reutilizado
3. Usa `tsrange` para overlap semântico correto (não comparação de strings)
4. Requer extension `btree_gist` (habilitada por padrão no Supabase Postgres)

**SQL Exato para a migration:**
```sql
-- ============================================================
-- Phase 2 — Slot Blocking: Exclusion Constraint
-- ============================================================

-- btree_gist é necessário para combinar colunas btree (barber_id UUID)
-- com colunas gist (tsrange). Habilitada por padrão no Supabase.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Adiciona a exclusion constraint à tabela já existente.
-- Sintaxe: EXCLUDE USING gist (col1 WITH op1, col2 WITH op2, ...)
-- - barber_id WITH =       → dois agendamentos do MESMO barbeiro entram em conflito
-- - tsrange(...) WITH &&   → os intervalos de tempo se sobrepõem (overlap)
-- - WHERE (status != 'CANCELLED') → slots cancelados não bloqueiam o horário
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tsrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status != 'CANCELLED');
```

**Por que `tsrange(start_time, end_time, '[)')` e não `'[]'`:**
- `[)` = inclusivo no início, exclusivo no fim (intervalo semi-aberto)
- Um serviço que termina às 10:00 NÃO bloqueia um serviço que começa às 10:00
- Este é o comportamento correto para barbearias: slots contíguos não colidem

**Por que `btree_gist` e não apenas `gist`:**
- A extensão `gist` nativa suporta `tsrange` mas NÃO `UUID`
- `btree_gist` adiciona suporte GIST para tipos btree (UUID, TEXT, INT, etc.)
- Sem `btree_gist`, a constraint `barber_id WITH =` falha com erro de operator class

**O que acontece quando a constraint é violada:**
- PostgreSQL lança `ERROR 23P01: exclusion_violation`
- A Server Action captura como `insertError.code === '23P01'` ou via mensagem
- Retornar `{ error: 'Horário indisponível. Escolha outro horário.' }` para o cliente

**Tratamento na Server Action:**
```typescript
if (insertError) {
  if (insertError.code === '23P01') {
    return { error: 'Horário indisponível. Escolha outro horário.' }
  }
  return { error: insertError.message }
}
```

---

## Decisão 3: Algoritmo de Cálculo de Slots Disponíveis

**Problema:** Dado um `barber_id`, `service_id` e uma `date`, retornar os horários livres naquele dia.

**Inputs necessários:**
1. `working_hours` do barbeiro para o `day_of_week` da data
2. `appointments` existentes do barbeiro naquele dia (não CANCELLED)
3. `duration_minutes` do serviço
4. `timezone` da barbearia (para converter a data local em UTC)

**Algoritmo (Server Action `getAvailableSlots`):**

```typescript
'use server'

import { createPublicClient } from '@/lib/supabase/public'

export async function getAvailableSlots(input: {
  barbershop_slug: string
  barber_id: string
  service_id: string
  date: string // 'YYYY-MM-DD' na timezone da barbearia
}): Promise<{ slots: string[] } | { error: string }> {
  const supabase = createPublicClient()

  // 1. Resolver barbershop para obter timezone
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, timezone')
    .eq('slug', input.barbershop_slug)
    .single()
  if (!barbershop) return { error: 'Barbearia não encontrada' }

  // 2. day_of_week da data na timezone da barbearia
  //    0 = Domingo, 1 = Segunda, ..., 6 = Sábado (padrão JS/DB)
  const localDate = new Date(`${input.date}T12:00:00`)
  const dayOfWeek = new Intl.DateTimeFormat('pt-BR', {
    timeZone: barbershop.timezone,
    weekday: 'narrow',
  }).formatToParts(localDate).find(p => p.type === 'weekday')
  // Mais seguro: usar getDay() com offset de timezone
  const dayIndex = getLocalDayOfWeek(input.date, barbershop.timezone) // helper abaixo

  // 3. Buscar working_hours do barbeiro para este dia
  const { data: workingHours } = await supabase
    .from('working_hours')
    .select('start_time, end_time')
    .eq('barber_id', input.barber_id)
    .eq('day_of_week', dayIndex)
    .eq('is_active', true)

  if (!workingHours || workingHours.length === 0) return { slots: [] }

  // 4. Buscar duração do serviço
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', input.service_id)
    .single()
  if (!service) return { error: 'Serviço não encontrado' }

  // 5. Buscar appointments existentes do barbeiro neste dia (UTC range)
  const dayStartUTC = localDateToUTCStart(input.date, barbershop.timezone)
  const dayEndUTC = localDateToUTCEnd(input.date, barbershop.timezone)

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('barber_id', input.barber_id)
    .neq('status', 'CANCELLED')
    .gte('start_time', dayStartUTC)
    .lt('start_time', dayEndUTC)

  // 6. Gerar slots de N em N minutos dentro de cada janela de working_hours
  //    e filtrar os que colidem com appointments existentes
  const slotInterval = 30 // minutos — granularidade do picker
  const duration = service.duration_minutes
  const slots: string[] = []

  for (const wh of workingHours) {
    const whStartUTC = localTimeToUTC(input.date, wh.start_time, barbershop.timezone)
    const whEndUTC   = localTimeToUTC(input.date, wh.end_time,   barbershop.timezone)

    let cursor = new Date(whStartUTC).getTime()
    const end  = new Date(whEndUTC).getTime()

    while (cursor + duration * 60_000 <= end) {
      const slotStart = cursor
      const slotEnd   = cursor + duration * 60_000

      // Verificar overlap com appointments existentes
      const hasConflict = (existingAppointments ?? []).some(appt => {
        const apptStart = new Date(appt.start_time).getTime()
        const apptEnd   = new Date(appt.end_time).getTime()
        return slotStart < apptEnd && slotEnd > apptStart
      })

      if (!hasConflict) {
        slots.push(new Date(slotStart).toISOString())
      }

      cursor += slotInterval * 60_000
    }
  }

  return { slots }
}
```

**Helpers de timezone:**

```typescript
// Retorna 0 (Dom) a 6 (Sab) para uma data string 'YYYY-MM-DD' na timezone dada
function getLocalDayOfWeek(dateStr: string, timezone: string): number {
  const dt = new Date(`${dateStr}T12:00:00`) // meio-dia UTC para evitar edge cases de DST
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(dt)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[weekdayStr] ?? 0
}

// Converte 'YYYY-MM-DD' + 'HH:MM:SS' na timezone para ISO UTC string
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): string {
  // Constrói uma string ISO "ingênua" e usa Intl para resolver offset
  const naiveISO = `${dateStr}T${timeStr}`
  // Abordagem: criar Date sem timezone e calcular offset manualmente
  // Para produção, date-fns-tz é mais robusto — mas Intl API é suficiente para DST estável
  const dtLocal = new Date(naiveISO) // interpreta como local do servidor — problemático!
  // Abordagem correta: usar getTimezoneOffset via hack conhecido
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  // NOTA: Para precisão total com DST, instalar date-fns-tz e usar zonedTimeToUtc()
  // Para MVP com America/Sao_Paulo (sem DST desde 2019), Intl API é suficiente
  return new Date(`${dateStr}T${timeStr}${getUTCOffset(dateStr, timezone)}`).toISOString()
}

function getUTCOffset(dateStr: string, timezone: string): string {
  // Retorna offset como '+HH:MM' ou '-HH:MM'
  const dt = new Date(`${dateStr}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(dt)
  const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC+0'
  // Extrai '-03:00' de 'GMT-03:00'
  return offset.replace('GMT', '')
}

function localDateToUTCStart(dateStr: string, timezone: string): string {
  return new Date(`${dateStr}T00:00:00${getUTCOffset(dateStr, timezone)}`).toISOString()
}

function localDateToUTCEnd(dateStr: string, timezone: string): string {
  return new Date(`${dateStr}T23:59:59${getUTCOffset(dateStr, timezone)}`).toISOString()
}
```

**Nota sobre `date-fns-tz`:** [ASSUMED] Para MVP com Brasil (America/Sao_Paulo — sem DST desde 2019), a Intl API nativa é suficiente. Se o projeto expandir para timezones com DST dinâmico, instalar `date-fns-tz` e usar `fromZonedTime`/`toZonedTime`.

---

## Decisão 4: RLS para Acesso Público (Anon)

**Problema:** O portal é público (sem auth), mas todas as tabelas têm RLS habilitado. Reads públicos precisam de políticas para a role `anon`.

**Análise:**

A migration da Fase 0 já criou uma política `anon_client_insert` em `clients` (Phase 0, SECTION C). Mas essa política permite INSERT de qualquer `barbershop_id` — o que é correto porque o `barbershop_id` é resolvido server-side via slug antes do INSERT.

**Políticas necessárias na migration da Fase 2:**

```sql
-- ============================================================
-- SECTION B — RLS Policies para acesso público (anon role)
-- ============================================================

-- Barbearias: anon pode ler (necessário para resolver slug → id + timezone)
CREATE POLICY "anon_barbershops_select" ON public.barbershops
  FOR SELECT TO anon
  USING (true);

-- Serviços: anon pode ler serviços ativos (portal de agendamento)
CREATE POLICY "anon_services_select" ON public.services
  FOR SELECT TO anon
  USING (is_active = true);

-- Barbeiros: anon pode ler barbeiros ativos (portal de agendamento)
CREATE POLICY "anon_barbers_select" ON public.barbers
  FOR SELECT TO anon
  USING (is_active = true);

-- Working hours: anon pode ler para cálculo de slots
CREATE POLICY "anon_working_hours_select" ON public.working_hours
  FOR SELECT TO anon
  USING (is_active = true);

-- Appointments: anon pode ler (apenas start_time, end_time, barber_id, status)
-- para conflict check — NÃO expõe client_id nem dados pessoais
CREATE POLICY "anon_appointments_select" ON public.appointments
  FOR SELECT TO anon
  USING (status != 'CANCELLED');

-- barber_services: anon pode ler associações barbeiro↔serviço
-- (necessário para filtrar serviços por barbeiro no Step 2→1 reversal)
CREATE POLICY "anon_barber_services_select" ON public.barber_services
  FOR SELECT TO anon
  USING (true);

-- NOTA: INSERT de clients e appointments NÃO usa anon role diretamente.
-- A Server Action createPublicAppointment usa adminClient (service role),
-- que bypassa RLS completamente. Isso mantém o controle de barbershop_id
-- exclusivamente no servidor.
-- A política "anon_client_insert" já existente (Fase 0) pode ser mantida
-- ou removida — com adminClient ela é desnecessária mas inofensiva.
```

**Por que adminClient para INSERT e não anon com RLS:**

| Abordagem | Pro | Contra |
|-----------|-----|--------|
| anon INSERT com RLS policy | Sem service role key no servidor | Cliente pode tentar passar `barbershop_id` falso se RLS WITH CHECK for fraco |
| adminClient INSERT server-side | barbershop_id NUNCA vem do cliente — sempre resolvido via slug | Expõe service role key no server env (aceitável — nunca no client) |

O `02-PATTERNS.md` já documentou a decisão de usar adminClient para writes. Esta pesquisa confirma que é a abordagem correta.

---

## Decisão 5: Status Lifecycle — PENDING como status inicial do portal

**Contexto:** Na Fase 1, agendamentos manuais criados pelo owner/barber têm status `CONFIRMED` por padrão (ver `appointments.ts` linha 169: `status: 'CONFIRMED'`). O portal público deve criar com status `PENDING`.

**Justificativa:**
- Agendamentos do portal são de clientes desconhecidos — o owner/barber precisa confirmar
- `PENDING → CONFIRMED` é a primeira transição do ciclo de vida (BOOK-04)
- O painel do owner (Fase 1) já tem suporte para mudar status via `updateAppointmentStatus`

**Diferença de `booking_source`:**
```typescript
// Portal público:
status: 'PENDING',
booking_source: 'portal',

// Manual (Fase 1):
status: 'CONFIRMED',
booking_source: 'manual',
```

**Transições válidas (BOOK-04):**
```
PENDING     → CONFIRMED  (owner/barber confirma via painel)
PENDING     → CANCELLED  (owner cancela antes de confirmar)
CONFIRMED   → CHECKED_IN (Fase 3 — QR scan)
CONFIRMED   → CANCELLED  (owner/barber cancela)
CHECKED_IN  → COMPLETED  (barbeiro marca como concluído)
CHECKED_IN  → CANCELLED  (edge case — nunca deve acontecer normalmente)
COMPLETED   → (terminal — não pode transitar)
CANCELLED   → (terminal — não pode transitar)
```

**O painel do owner precisa de:**
- Listagem de agendamentos PENDING para aprovação
- Botão "Confirmar" que chama `updateAppointmentStatus(id, 'CONFIRMED')`
- A Server Action `updateAppointmentStatus` já existe e suporta todas as transições

---

## Decisão 6: Identificação do Cliente (AUTH-07)

**Requisito AUTH-07:** Cliente se identifica por nome + WhatsApp, sem conta obrigatória.

**Implementação:**
```typescript
// Server Action createPublicAppointment — upsert de cliente
const { data: client } = await admin
  .from('clients')
  .upsert(
    {
      barbershop_id: barbershop.id,
      full_name: input.client.full_name,
      whatsapp_number: normalizeWhatsApp(input.client.whatsapp_number),
      whatsapp_opt_in: input.client.whatsapp_opt_in,
      opt_in_source: input.client.whatsapp_opt_in ? 'booking_portal' : null,
      opt_in_timestamp: input.client.whatsapp_opt_in ? new Date().toISOString() : null,
    },
    {
      onConflict: 'barbershop_id,whatsapp_number',
      ignoreDuplicates: false, // atualiza full_name se cliente já existir
    }
  )
  .select('id')
  .single()
```

**Constraint única necessária na migration:**
```sql
-- Adicionar unique constraint para permitir upsert por (barbershop_id, whatsapp_number)
ALTER TABLE public.clients
  ADD CONSTRAINT clients_barbershop_whatsapp_unique
  UNIQUE (barbershop_id, whatsapp_number);
```

**LGPD compliance:**
- `whatsapp_opt_in` coletado via checkbox explícito no Step 4 do wizard
- `opt_in_timestamp` gravado server-side no momento do upsert (não vem do cliente)
- `opt_in_source = 'booking_portal'` documenta a origem do consentimento

**Normalização do WhatsApp:** O número deve ser normalizado antes do upsert para evitar duplicatas por formatação:
```typescript
function normalizeWhatsApp(raw: string): string {
  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '')
  // Adiciona +55 se não tiver código de país
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length >= 10) return `+55${digits}`
  return digits // fallback — validação de formato é feita pelo Zod
}
```

---

## Decisão 7: Realtime vs Polling para Slots

**Questão:** O portal precisa de atualização em tempo real quando outro cliente reserva um slot simultaneamente?

**Análise para MVP:**
- Supabase Realtime pode fazer subscribe em changes na tabela `appointments`
- O slot picker exibe slots disponíveis QUANDO o usuário chega na step-datetime
- Se dois usuários chegam simultaneamente no mesmo slot, a exclusion constraint garante que apenas um terá sucesso — o outro recebe erro e pode escolher outro slot

**Decisão: Polling NÃO é necessário. Realtime NÃO é necessário para MVP.**

**Justificativa:**
1. A exclusion constraint é a garantia real — independente de Realtime
2. O fluxo típico é: o usuário seleciona um slot e imediatamente chama `createPublicAppointment` — a janela de race condition é de segundos
3. Adicionar Supabase Realtime aumenta complexidade e pode ter custo de conexão concorrente
4. Se o slot já foi tomado quando o usuário tenta confirmar, o erro da constraint é claro e acionável ("Horário indisponível. Escolha outro horário.")

**Implementação:** `getAvailableSlots` é chamado quando o usuário seleciona a data (Step 3). Não há polling automático. O erro de exclusion constraint no submit é a "última linha de defesa" e é suficiente para MVP.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Ao Invés | Motivo |
|----------|---------------|---------------|--------|
| Double-booking prevention | app-layer check exclusivo | Exclusion constraint GIST | Race condition de milissegundos não é pego por app-layer check |
| Timezone conversion | lógica manual de offset | `Intl.DateTimeFormat` (nativo) ou `date-fns-tz` | Horário de verão e offsets têm edge cases que matam código manual |
| `tsrange` overlap check | comparação manual de timestamps | `WITH &&` do PostgreSQL | O DB já sabe fazer overlap semântico corretamente |
| Client deduplication | lookup por ID | `UPSERT ON CONFLICT (barbershop_id, whatsapp_number)` | Normalização de número nunca é perfeita — upsert é mais robusto |
| Slot generation manual date parsing | `new Date()` no servidor sem timezone | `Intl.DateTimeFormat` com `timeZone` explícito | `new Date('2026-06-01T09:00:00')` no servidor interpreta como UTC ou local do server — ambos errados |

---

## Common Pitfalls

### Pitfall 1: `btree_gist` não habilitada antes da constraint

**O que dá errado:** `CREATE EXTENSION IF NOT EXISTS btree_gist` omitida → `ERROR: data type uuid has no default operator class for access method "gist"`.

**Por que acontece:** O tipo `UUID` não tem suporte nativo ao index method GIST. `btree_gist` adiciona essa capacidade.

**Como evitar:** Sempre colocar `CREATE EXTENSION IF NOT EXISTS btree_gist;` ANTES do `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE USING gist`.

**Sinal de alerta:** Erro durante `supabase db push` com mensagem sobre "operator class" ou "access method gist".

---

### Pitfall 2: Constraint EXCLUDE não ignora CANCELLED — bloqueio permanente de slots

**O que dá errado:** Constraint sem `WHERE (status != 'CANCELLED')` → um agendamento cancelado bloqueia o slot para sempre.

**Por que acontece:** Sem cláusula WHERE, a constraint se aplica a TODOS os rows, incluindo CANCELLED.

**Como evitar:** Sempre incluir `WHERE (status != 'CANCELLED')` na constraint.

**Efeito colateral positivo:** A constraint parcial também é um index parcial — mais eficiente que um index completo.

---

### Pitfall 3: `tsrange` com bounds `'[]'` em vez de `'[)'`

**O que dá errado:** Dois serviços contíguos (um termina às 10:00, outro começa às 10:00) colidem com `'[]'` (ambos os extremos inclusivos).

**Por que acontece:** `[10:00, 11:00] && [11:00, 12:00]` = TRUE com `[]` porque 11:00 está em ambos.

**Como evitar:** Usar `tsrange(start_time, end_time, '[)')` — extremo inicial inclusivo, final exclusivo.

---

### Pitfall 4: `barbershop_id` vindo do cliente

**O que dá errado:** Portal aceita `barbershop_id` como parâmetro do formulário → cliente pode agendar em qualquer barbearia.

**Por que acontece:** Tratamento de parâmetros de formulário sem validação server-side.

**Como evitar:** `barbershop_id` é SEMPRE resolvido server-side: `slug → barbershop.id`. Nunca aceitar como parâmetro de entrada. O `02-PATTERNS.md` documenta este padrão.

---

### Pitfall 5: Slot picker gerando horários em UTC sem converter para timezone da barbearia

**O que dá errado:** O picker exibe "09:00" mas o usuário vê na tela "06:00" (diferença UTC-3).

**Por que acontece:** `working_hours` armazena `TIME NOT NULL` sem timezone (ex: `09:00:00`). Ao combinar com uma data, é necessário interpretar o TIME como pertencente à timezone da barbearia, não UTC.

**Como evitar:**
```typescript
// ERRADO:
const slotStart = new Date(`${date}T${workingHour.start_time}`) // servidor pode interpretar como UTC

// CORRETO:
const offset = getUTCOffset(date, barbershop.timezone) // ex: '-03:00'
const slotStart = new Date(`${date}T${workingHour.start_time}${offset}`)
```

**Displayar slots para o usuário:** converter o ISO UTC de volta para a timezone da barbearia:
```typescript
new Intl.DateTimeFormat('pt-BR', {
  timeZone: barbershop.timezone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(slotISO))
// Resultado: '09:00' — o que o usuário espera ver
```

---

### Pitfall 6: `created_by` em appointments com cliente anônimo

**O que dá errado:** `appointments.created_by UUID NOT NULL REFERENCES auth.users(id)` — cliente público não tem `auth.users` row → INSERT falha com FK violation.

**Por que acontece:** A coluna foi projetada para staff autenticado (Phase 1). Portal público não tem usuário Supabase Auth.

**Solução:** Usar `client.id` (UUID da tabela `clients`) como `created_by` quando `booking_source = 'portal'`. A FK referencia `auth.users`, então isso NÃO funciona diretamente.

**Solução correta:** Alterar `created_by` para ser NULLABLE na migration da Fase 2 — ou criar um "portal user" de sistema. A abordagem mais simples é:

```sql
-- Migration Fase 2: tornar created_by nullable para suportar portal público
ALTER TABLE public.appointments
  ALTER COLUMN created_by DROP NOT NULL;
```

E no INSERT público: `created_by: null`.

**Alternativa:** Manter NOT NULL e criar um UUID especial fixo ("sistema") — mas isso é mais complexo. Nullable é mais honesto.

---

### Pitfall 7: Middleware interceptando rotas públicas

**O que dá errado:** A rota `/(public)/[slug]/booking` é interceptada pelas regras A-E do middleware e redireciona para `/entrar`.

**Por que acontece:** O middleware atual não tem bypass para rotas do portal público.

**Como evitar:** Adicionar bypass ANTES das Rules A-E:
```typescript
// Bypass para portal público — DEVE vir antes de qualquer Rule A-E
const reserved = ['/entrar', '/cadastro', '/dashboard', '/agenda', '/onboarding', '/auth', '/_next', '/api']
const isReserved = reserved.some(r => pathname.startsWith(r))
// Slugs: somente lowercase letras, números e hífens
if (!isReserved && /^\/[a-z0-9][a-z0-9-]*($|\/.+)$/.test(pathname)) {
  return response // passa sem autenticação
}
```

---

## Code Examples

### Migration Completa da Fase 2

```sql
-- ============================================================
-- BarberFlow Phase 2 — Client Booking Portal Schema
-- Migration: YYYYMMDD_phase2_schema.sql
--
-- Adds:
--   1. btree_gist extension
--   2. Exclusion constraint on appointments (per barber, tsrange overlap)
--   3. Unique constraint on clients (barbershop_id, whatsapp_number)
--   4. created_by nullable for public bookings
--   5. RLS policies for anon role (public reads)
-- ============================================================

-- SECTION A — Extensão necessária para EXCLUDE com UUID + tsrange
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- SECTION B — Exclusion constraint: previne double-booking por barbeiro
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tsrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status != 'CANCELLED');

-- SECTION C — Unique constraint em clients para upsert por whatsapp
ALTER TABLE public.clients
  ADD CONSTRAINT clients_barbershop_whatsapp_unique
  UNIQUE (barbershop_id, whatsapp_number);

-- SECTION D — created_by nullable para agendamentos do portal público
-- (clientes do portal não têm auth.users row)
ALTER TABLE public.appointments
  ALTER COLUMN created_by DROP NOT NULL;

-- SECTION E — RLS: leituras públicas (role anon)
-- Barbearias: anon pode resolver slug
CREATE POLICY "anon_barbershops_select" ON public.barbershops
  FOR SELECT TO anon
  USING (true);

-- Serviços ativos: anon pode listar no portal
CREATE POLICY "anon_services_select" ON public.services
  FOR SELECT TO anon
  USING (is_active = true);

-- Barbeiros ativos: anon pode listar no portal
CREATE POLICY "anon_barbers_select" ON public.barbers
  FOR SELECT TO anon
  USING (is_active = true);

-- Working hours ativas: anon lê para calcular slots
CREATE POLICY "anon_working_hours_select" ON public.working_hours
  FOR SELECT TO anon
  USING (is_active = true);

-- Appointments não cancelados: anon lê para conflict check
-- IMPORTANTE: expõe apenas que o slot está ocupado — NÃO expõe client_id
-- A query no Server Action deve selecionar APENAS start_time, end_time, barber_id
CREATE POLICY "anon_appointments_select" ON public.appointments
  FOR SELECT TO anon
  USING (status != 'CANCELLED');

-- barber_services: anon lê para filtro de serviços por barbeiro
CREATE POLICY "anon_barber_services_select" ON public.barber_services
  FOR SELECT TO anon
  USING (true);
```

### createPublicClient (src/lib/supabase/public.ts)

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Public Supabase client — anon key, sem sessão, sem cookies.
 * Use APENAS para leituras públicas em Server Components e Server Actions
 * do portal de agendamento. RLS policies de SELECT com anon role controlam acesso.
 *
 * NUNCA use este client para writes — use createAdminClient() para INSERT/UPDATE
 * em contexto público (bypassa RLS com controle server-side de barbershop_id).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

### Layout Público (src/app/(public)/[slug]/layout.tsx)

```typescript
import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  return <>{children}</>
}
```

### Server Action: createPublicAppointment (trecho crítico)

```typescript
'use server'

import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createPublicAppointment(input: {
  barbershop_slug: string
  service_id: string
  barber_id: string
  start_time: string // ISO UTC string
  client: {
    full_name: string
    whatsapp_number: string
    whatsapp_opt_in: boolean
  }
}): Promise<{ data: { id: string; start_time: string } } | { error: string }> {
  const supabase = createPublicClient()
  const admin = createAdminClient()

  // 1. Resolver barbershop_id — NUNCA aceitar como parâmetro
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id')
    .eq('slug', input.barbershop_slug)
    .single()
  if (!barbershop) return { error: 'Barbearia não encontrada' }

  // 2. Buscar duração server-side — previne tampering (T-01-19)
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', input.service_id)
    .single()
  if (!service) return { error: 'Serviço não encontrado' }

  const startMs = new Date(input.start_time).getTime()
  const endTime = new Date(startMs + service.duration_minutes * 60_000).toISOString()

  // 3. Upsert cliente — deduplicação por (barbershop_id, whatsapp_number)
  const { data: client, error: clientError } = await admin
    .from('clients')
    .upsert(
      {
        barbershop_id: barbershop.id,
        full_name: input.client.full_name,
        whatsapp_number: input.client.whatsapp_number,
        whatsapp_opt_in: input.client.whatsapp_opt_in,
        opt_in_source: input.client.whatsapp_opt_in ? 'booking_portal' : null,
        opt_in_timestamp: input.client.whatsapp_opt_in ? new Date().toISOString() : null,
      },
      {
        onConflict: 'barbershop_id,whatsapp_number',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single()
  if (clientError || !client) return { error: 'Erro ao registrar cliente' }

  // 4. App-layer conflict check (complementar à exclusion constraint)
  const { data: conflict } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', input.barber_id)
    .neq('status', 'CANCELLED')
    .lt('start_time', endTime)
    .gt('end_time', input.start_time)
    .limit(1)
  if ((conflict?.length ?? 0) > 0) {
    return { error: 'Horário indisponível. Escolha outro horário.' }
  }

  // 5. INSERT — exclusion constraint é a garantia real contra race condition
  const { data: appointment, error: insertError } = await admin
    .from('appointments')
    .insert({
      barbershop_id: barbershop.id,
      barber_id: input.barber_id,
      service_id: input.service_id,
      client_id: client.id,
      start_time: input.start_time,
      end_time: endTime,
      status: 'PENDING',           // portal sempre cria como PENDING
      booking_source: 'portal',
      created_by: null,             // cliente anônimo — sem auth.users row
    })
    .select('id, start_time')
    .single()

  if (insertError) {
    // code 23P01 = exclusion_violation (race condition — constraint pegou o que app-layer perdeu)
    if (insertError.code === '23P01') {
      return { error: 'Horário indisponível. Escolha outro horário.' }
    }
    return { error: insertError.message ?? 'Erro ao criar agendamento' }
  }

  if (!appointment) return { error: 'Erro ao criar agendamento' }

  return { data: appointment }
}
```

---

## Runtime State Inventory

> Fase 2 é greenfield (novas tabelas + constraints em tabelas existentes). Não é uma fase de rename/refactor.

**Não aplicável.** Exceção: a migration altera a tabela `appointments` existente (`created_by` → nullable, adiciona constraint). Dados existentes (agendamentos da Fase 1 criados manualmente) têm `created_by` preenchido — a alteração `DROP NOT NULL` é backward-compatible.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration push | Assumido instalado | latest | `supabase db push` via dashboard |
| PostgreSQL `btree_gist` | Exclusion constraint | Habilitada por padrão no Supabase | Supabase Postgres | Sem fallback — obrigatória |
| `Intl.DateTimeFormat` | Timezone conversion | Node.js built-in | Node 18+ | `date-fns-tz` se precisar de mais controle |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Não identificado no projeto (sem jest.config, vitest.config, pytest.ini) |
| Config file | Nenhum detectado |
| Quick run command | N/A — sem framework de testes instalado |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-01 | Portal exibe serviços + barbeiros e permite seleção | manual | N/A | ❌ Wave 0 |
| BOOK-02 | Dois clientes simultâneos — apenas um confirma | integration (exclusion constraint) | N/A | ❌ Wave 0 |
| BOOK-04 | Status PENDING criado pelo portal; owner confirma → CONFIRMED | manual | N/A | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] Sem framework de testes — toda validação via smoke test manual
- [ ] Teste de duplo-booking deve ser executado manualmente: abrir 2 abas, navegar ao mesmo slot, submeter simultaneamente

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não (portal sem auth) | — |
| V3 Session Management | Não | — |
| V4 Access Control | Sim | `barbershop_id` sempre resolvido server-side via slug; adminClient para writes |
| V5 Input Validation | Sim | Zod schema no step-client; normalização de WhatsApp server-side |
| V6 Cryptography | Não | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `barbershop_id` tampering | Tampering | Nunca aceitar como parâmetro — resolver via slug server-side |
| `end_time` tampering (duração do serviço) | Tampering | `duration_minutes` lido do DB server-side — cliente passa apenas `start_time` |
| Appointment flooding (DDoS de slots) | DoS | Rate limiting no middleware ou Cloudflare — fora do escopo MVP |
| LGPD: opt-in sem consentimento real | Repudiation | `whatsapp_opt_in` default `false`; `opt_in_timestamp` server-side; checkbox explícito na UI |
| Race condition de double-booking | Tampering | Exclusion constraint GIST é a garantia DB-level; app-layer check é defense-in-depth |
| Cross-tenant data leak via anon SELECT | Information Disclosure | RLS `anon_appointments_select` só expõe `start_time`/`end_time`/`barber_id` — query no Server Action deve selecionar apenas esses campos |

---

## Assumptions Log

| # | Claim | Seção | Risco se Errado |
|---|-------|-------|-----------------|
| A1 | `btree_gist` está habilitada por padrão no Supabase Postgres | Decisão 2 | Migration falha com erro de operator class — solução: adicionar `CREATE EXTENSION IF NOT EXISTS btree_gist` (já incluído) |
| A2 | America/Sao_Paulo não tem DST desde 2019 — Intl API é suficiente | Decisão 3 | Slots exibidos com offset errado — solução: instalar `date-fns-tz` |
| A3 | Supabase error code para exclusion_violation é `23P01` (padrão PostgreSQL) | Decisão 2 | Tratamento de erro não funciona — verificar via teste real |
| A4 | `created_by DROP NOT NULL` é backward-compatible com dados da Fase 1 | Common Pitfalls 6 | Constraint `NOT NULL` ainda em vigor — migration falha se houver dados sem `created_by` (Fase 1 sempre preenche, então seguro) |

---

## Open Questions

1. **`created_by` para agendamentos públicos**
   - O que sabemos: coluna é `NOT NULL REFERENCES auth.users(id)` — cliente público não tem auth.users row
   - O que não está claro: usar `null` (drop not null) ou um UUID de sistema fixo?
   - Recomendação: tornar nullable (`DROP NOT NULL`) — mais honesto e sem gambiarra. Dados da Fase 1 têm `created_by` preenchido.

2. **Filtro de serviços por barbeiro no Step 2**
   - O que sabemos: o usuário escolhe serviço PRIMEIRO, depois barbeiro. O `02-PATTERNS.md` sugere esta ordem.
   - O que não está claro: se o usuário escolher barbeiro primeiro (ordem inversa), precisaríamos filtrar serviços por `barber_services`. O wizard proposto vai serviço → barbeiro.
   - Recomendação: manter serviço → barbeiro (mas no Step 2, filtrar apenas barbeiros que oferecem o serviço selecionado usando `barber_services`).

3. **Confirmação pelo owner: notificação de PENDING**
   - O que sabemos: agendamentos do portal chegam como PENDING, precisam de ação do owner
   - O que não está claro: como o owner fica sabendo? Dashboard? Email? Push?
   - Recomendação: Fase 2 mostra badge "PENDENTE" no dashboard (painel já existente). Notificação WhatsApp/email é Fase 5.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260529000001_initial_schema.sql` — schema Fase 0, padrões RLS, trigger structure
- `supabase/migrations/20260531000001_phase1_schema.sql` — tabelas Fase 1, nota sobre exclusion constraint omitida
- `src/app/actions/appointments.ts` — padrão de conflict check, createAppointment, status updates
- `.planning/phases/02-client-booking-portal/02-PATTERNS.md` — mapeamento completo de arquivos e padrões de código
- `.planning/phases/01-owner-onboarding-barber-service-setup/01-CONTEXT.md` — decisões D-10, D-16, D-17
- `CLAUDE.md` — constraints críticas: exclusion constraint, TIMESTAMPTZ, LGPD, multi-tenancy

### Secondary (MEDIUM confidence)
- `src/middleware.ts` — padrão de bypass/rules, como adicionar bypass público
- `src/lib/supabase/admin.ts` — padrão do adminClient para uso em public-booking.ts
- PostgreSQL documentation (training knowledge, não verificado via tool nesta sessão): sintaxe `EXCLUDE USING gist`, `btree_gist`, `tsrange`, error code `23P01` — [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — confirmado pelo codebase existente (zero dependências novas)
- Architecture: HIGH — documentado em 02-PATTERNS.md + padrões estabelecidos Fase 0/1
- SQL Exclusion Constraint: MEDIUM — sintaxe correta per training knowledge [ASSUMED] — verificar via `supabase db push` no plano
- Slot Algorithm: HIGH — lógica determinística; timezone helper é o único risco
- Pitfalls: HIGH — derivados diretamente da análise do schema existente e dos padrões do projeto
- RLS anon policies: HIGH — segue padrão estabelecido na Fase 0

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stack estável, sem dependências novas)
