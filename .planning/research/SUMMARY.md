# Research Summary — BarberFlow

**Synthesized:** 2026-05-29
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH on core stack and architecture patterns; MEDIUM on WhatsApp/Asaas specifics (verify before building)

---

## Recommended Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Framework | Next.js (App Router) | 15 | Server Components reduzem bundle; middleware faz roteamento de tenant; image optimization nativo |
| Database + Auth + Storage | Supabase | Latest hosted | Postgres gerenciado com RLS é a escolha canônica para SaaS multi-tenant |
| Language | TypeScript | 5.x | Domínio complexo (agendamentos, tenants, roles) exige tipagem |
| Styling | Tailwind CSS + shadcn/ui | 4.x / latest | shadcn copia componentes no repo (sem lock de versão) |
| Server state | TanStack Query | v5 | Optimistic updates para booking; invalidação de cache em eventos realtime |
| Forms + validation | React Hook Form + Zod | v7 / v3 | Schemas Zod compartilhados entre frontend e Edge Functions |
| Dates | date-fns | v3 | Tree-shakeable, imutável; necessário para cálculo de slots |
| Email | Resend + React Email | Latest | Fluxos de auth (verificação, reset de senha) |
| Background jobs | Supabase Edge Functions + pg_cron + pg_net | Built-in | Dentro da infraestrutura Supabase; sem risco de timeout do Vercel |
| Realtime | Supabase Realtime (Broadcast channels) | Built-in | Status de agendamentos ao vivo no dashboard |
| Pagamentos + billing | Asaas | REST API | PIX, boleto, recorrência — cobre billing SaaS e pagamento de agendamentos |
| Notificações | WhatsApp Business Cloud API (Meta) | Graph API v19+ | 97% penetração de WhatsApp no Brasil |
| QR codes | qrcode (server) + react-qr-code (display) + html5-qrcode (scan) | Stable | Geração client-side do qr_token — sem Storage bucket necessário |
| Calendar admin | react-big-calendar | v1.x | Visões semana/dia para o painel do dono |
| Mobile (fase 1) | PWA via next-pwa | — | Zero codebase extra; instalável no Android |
| Mobile (fase 2) | Expo + React Native | SDK 51+ | Quando push/câmera nativa for necessária |

**Exclusões obrigatórias:** Prisma, Stripe, Firebase, Auth.js, Moment.js, Supabase projeto separado por tenant.

---

## Table Stakes Features

| Feature | Notas |
|---------|-------|
| Portal de agendamento online | Mobile-first; maioria dos agendamentos no celular no Brasil |
| Bloqueio de slot em tempo real | Sem double-booking — destrói confiança imediatamente |
| Catálogo de serviços (nome, duração, preço) | Duração guia cálculo de slots; preço guia relatórios |
| Perfis de barbeiros + especialidades | Clientes agendam com uma pessoa, não só um horário |
| Agenda por barbeiro + exceções | Sistema precisa saber quando cada barbeiro está disponível |
| Ciclo de status do agendamento | PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED |
| Agendamento manual pelo dono/barbeiro | Walk-ins e telefonemas ainda acontecem |
| Cancelamento + remarcação pelo cliente | Janela configurável (ex: cancelar até 2h antes) |
| Confirmação via WhatsApp | WhatsApp >> SMS >> email no Brasil |
| Lembrete antes da visita | Reduz no-shows diretamente |
| Dashboard da agenda de hoje | Dono abre o app e vê o que está acontecendo agora |
| Relatório de receita (dia/semana/mês) | Donos precisam de visão de fluxo de caixa |
| Suporte multi-barbeiro com filtro | Praticamente nenhuma barbearia tem um único barbeiro |
| Histórico de visitas do cliente | Crítico para personalização |
| Separação de roles dono/barbeiro | Barbeiros não devem ver financeiro ou configuração de comissão |

---

## Key Differentiators

| Feature | Gap competitivo |
|---------|----------------|
| QR Check-In (auto CHECKED_IN no scan) | Nenhum concorrente brasileiro faz isso nativamente |
| Carimbo digital de fidelidade | Concorrentes brasileiros geralmente não têm; Fresha's "Passes" é complexo demais |
| WhatsApp Business API | Booksy/Vagaro usam email/SMS; WhatsApp-nativo é vantagem específica do Brasil |
| Re-engajamento via WhatsApp ("30 dias sem corte") | Equivalentes de email existem; versão WhatsApp é diferenciada no Brasil |
| Portal white-label (logo, cores, domínio) | Booksy e Fresha sempre são a marca deles; clientes da barbearia pertencem a essas plataformas |
| PIX no agendamento | Ferramentas internacionais não suportam PIX |
| Gestão de comissões por barbeiro | Concorrentes brasileiros geralmente não têm |
| Dashboard "quem está aqui agora" | Alimentado por QR Check-In + Realtime; não é padrão em nenhum lugar |

**Anti-features (não construir):** Marketplace/discovery, gestão de estoque, hardware de PDV, controle de ponto, reviews/ratings, gestão de franquias multi-unidade.

---

## Architecture Decisions

**1. Schema único Supabase + RLS (não schema-por-tenant)**
Toda tabela com escopo de tenant tem `barbershop_id UUID NOT NULL`. RLS habilitado em toda tabela na criação. Políticas leem `auth.jwt() -> 'app_metadata' ->> 'barbershop_id'`.

**2. Roles e tenant ID no JWT app_metadata (não chamada DB por request)**
`app_metadata.role` e `app_metadata.barbershop_id` escritos por trigger de DB no signup. Zero round-trips de DB para checks de auth. Roles: `platform_admin`, `owner`, `barber`, `client`.

**3. Route groups Next.js para separação de portais**
- `/(platform)/...` — admin interno BarberFlow
- `/(dashboard)/...` — portal dono + barbeiro
- `/(booking)/[slug]/...` — portal de agendamento white-labeled

**4. Supabase Realtime Broadcast (não postgres_changes)**
Canal: `barbershop:{barbershop_id}`. Eventos tipados: `appointment:created`, `appointment:checkin`, `appointment:completed`, `appointment:cancelled`.

**5. pg_cron + pg_net → Edge Functions para jobs em background**
Lembretes WhatsApp, crons de re-engajamento, limpeza de PIX expirado. Nunca usar Vercel Cron para lógica de background.

**6. Tabela de webhook_events (escrever primeiro, processar async)**
Webhooks do Asaas e WhatsApp retornam 200 imediatamente, escrevem em `webhook_events` com chave de idempotência.

**7. Geração de QR client-side (sem Storage bucket para PNGs)**
QR renderizado no browser a partir do `qr_token` na linha do agendamento.

---

## Critical Pitfalls

**1. RLS não habilitado em todas as tabelas — CRÍTICO**
Tabelas sem RLS ficam abertas a todos os usuários autenticados — violação de LGPD. Prevenção: check de CI que `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false` retorna vazio.

**2. Race condition de double-booking — CRÍTICO**
Dois clientes reservando o mesmo slot simultaneamente, ambos inserem com sucesso. Prevenção: exclusion constraint PostgreSQL com índice GIST em `(barber_id, tsrange(start_time, end_time, '[)'))`. Check e insert em função RPC serializable.

**3. Processamento duplicado de webhook — ALTO**
Asaas retenta em timeout. Sem idempotência: duplas mensagens WhatsApp, duplos carimbos de fidelidade. Prevenção: tabela de chave de idempotência com `ON CONFLICT DO NOTHING`.

**4. Template WhatsApp não pré-aprovado no launch — ALTO**
Meta exige pré-aprovação para todas as mensagens outbound. Aprovação leva 1-7 dias, pode ser rejeitada. Prevenção: submeter todos os templates pelo menos 2 semanas antes do lançamento da feature.

**5. Opt-in LGPD não capturado — ALTO (legal)**
Enviar lembretes WhatsApp sem consentimento explícito documentado viola LGPD. Prevenção: capturar `whatsapp_opt_in`, `opt_in_timestamp`, `opt_in_source` no cadastro do cliente.

**6. Duração do serviço ignorada no bloqueio de slot — ALTO**
Um serviço de 75 min que bloqueia apenas o slot inicial de 30 min permite double-booking. Prevenção: slot availability calcula `end_time = start_time + service_duration`.

**7. QR estático reutilizável / replay attack — MÉDIO**
URL QR com apenas o appointment ID pode ser screenshotted e reutilizado. Prevenção: token HMAC assinado com `appointment_id + issued_at + expires_at`; uso único; revogar no cancelamento.

---

## Phase Ordering Constraints

| Fase | Entrega | Pitfalls a endereçar |
|------|---------|---------------------|
| 0 — Infrastructure Baseline | Auth, RLS, isolamento de tenant, route groups | CP-1, CP-2, MT-1 |
| 1 — Owner Onboarding | Link de agendamento em menos de 5 minutos (máx 4 passos) | ON-1 |
| 2 — Client Booking Portal | Loop de agendamento core; PIX opcional | CP-4, SL-1, SL-2 |
| 3 — Real-Time + QR Check-In | Dashboard ao vivo, auto CHECKED_IN | QR-1, QR-2, QR-3 |
| 4 — Loyalty Program | Carimbo digital, resgate de recompensa | Carimbo só no COMPLETED |
| 5 — WhatsApp Notifications | Lembretes, confirmações, re-engajamento | Templates submetidos na Fase 1, LGPD opt-in |
| 6 — Billing + Tenant Lifecycle | Asaas subscriptions, enforcement de plano | Idempotência, PIX expiry, downgrade |
| 7 — Financial Reports | Receita, comissão, exportação CSV | — |
| 8 — White Label + Custom Domains | Configuração de tema, DNS/TLS | TLS automation complexity |

**Regra crítica de ordenação:** Layer 0 (RLS + schema) é inegociável primeiro — não existe path de retrofit.

---

## Open Questions

**Antes da Fase 0:**
- Confirmar configuração do Supabase Auth Hook (`custom_access_token_hook`) para JWT custom claims
- Confirmar que `@supabase/ssr` é o pacote atual (não `auth-helpers-nextjs`)

**Antes da Fase 2:**
- Estratégia de slot-hold para PIX: hold otimista por 15 min com countdown + auto-cancel via pg_cron
- Fallback de polling Asaas: se webhook não recebido em 30s, poll a cada 10s por até 5 minutos

**Antes da Fase 3:**
- Verificar comportamento atual de RLS no Supabase Realtime — usar Broadcast channels, não postgres_changes

**Antes da Fase 5:**
- Decisão de provider WhatsApp: Z-API (MVP rápido) vs Meta Cloud API (oficial, sem risco de ToS)
- Número WhatsApp compartilhado entre todos os tenants vs WABA por tenant

**Antes da Fase 6:**
- Verificar versão atual da API Asaas (v3) e nomes de eventos de webhook em developers.asaas.com.br

**Antes da Fase 8:**
- Estratégia de TLS automation para domínios customizados: Caddy + ACME vs Vercel wildcard
