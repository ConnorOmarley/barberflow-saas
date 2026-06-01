---
phase: 02-client-booking-portal
plan: "02"
subsystem: public-portal-routing
tags: [supabase, public-client, middleware, next-app-router, server-component]
dependency_graph:
  requires:
    - 01-06 (services CRUD — tabela services + barbers existem)
    - 02-01 (migration da fase 2 — RLS anon policies + exclusion constraint)
  provides:
    - createPublicClient() para leituras anon em Server Components
    - Route group (public) com validacao de slug
    - Landing page publica da barbearia
    - Booking page com pre-fetch de dados + BookingWizard stub
  affects:
    - src/middleware.ts (bypass de auth para slugs publicos)
tech_stack:
  added: []
  patterns:
    - createPublicClient anon key sem cookies/sessao
    - Promise.all para pre-fetch paralelo em Server Component
    - Bypass de middleware antes da inicializacao do Supabase client
    - notFound() para slug invalido em layout
key_files:
  created:
    - src/lib/supabase/public.ts
    - src/app/(public)/[slug]/layout.tsx
    - src/app/(public)/[slug]/page.tsx
    - src/app/(public)/[slug]/booking/page.tsx
    - src/app/(public)/[slug]/booking/components/booking-wizard.tsx
  modified:
    - src/middleware.ts
decisions:
  - Bypass no middleware usa lista explicita de reservedPaths + regex lowercase para nao interferir com rotas de sistema (T-02-05)
  - createPublicClient usa NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon key) — mesma estrutura do adminClient mas sem service role
  - barbershop_id nunca aceito como parametro de URL — sempre resolvido via slug server-side
  - BookingWizard criado como stub tipado para TypeScript compilar; substituido em 02-03
  - Promise.all em booking/page.tsx para services + barbers em paralelo (sem waterfall)
metrics:
  duration: "~20 min"
  completed: "2026-06-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 02: Public Portal Routing — Summary

**One-liner:** Cliente Supabase anon sem sessao + route group (public) com validacao de slug + landing page + booking page com Promise.all pre-fetch e BookingWizard stub tipado.

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | createPublicClient + middleware bypass | src/lib/supabase/public.ts, src/middleware.ts |
| 2 | Route group (public) — layout + landing page + booking page | src/app/(public)/[slug]/layout.tsx, page.tsx, booking/page.tsx, booking/components/booking-wizard.tsx |

## Files Created / Modified

### Criados

- **`src/lib/supabase/public.ts`** — `createPublicClient()` com anon key, `autoRefreshToken: false`, `persistSession: false`. Padrao identico ao `admin.ts` mas usando NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.

- **`src/app/(public)/[slug]/layout.tsx`** — Server Component. Valida slug via `createPublicClient()` SELECT em `barbershops`. Chama `notFound()` se slug nao existe. Sem getClaims(), sem redirect — completamente publico.

- **`src/app/(public)/[slug]/page.tsx`** — Landing page da barbearia. Exibe nome, lista de servicos ativos com preco/duracao e botao "Agendar agora" linkando para `/[slug]/booking`. Usa tokens de design do projeto (bg-[#151922], text-[#d4a574]).

- **`src/app/(public)/[slug]/booking/page.tsx`** — Server Component. Busca barbershop pelo slug, faz `Promise.all` para services + barbers em paralelo, passa como props ao `BookingWizard`. `barbershop_id` nunca vem da URL — sempre resolvido via slug.

- **`src/app/(public)/[slug]/booking/components/booking-wizard.tsx`** — Stub temporario com interface de props completa para compilacao TypeScript. Substituido pela implementacao real no plano 02-03.

### Modificados

- **`src/middleware.ts`** — Adicionado bypass para slugs publicos ANTES da inicializacao do `createServerClient()`. Usa lista `reservedPaths` explicita + regex `^\/[a-z0-9][a-z0-9-]*($|\/.*)$`. Retorna `NextResponse.next()` sem verificacao de auth para slugs validos. Rules A-E originais permanecem intactas.

## Deviations from Plan

### Auto-fixed Issues

Nenhum. Plano executado exatamente conforme especificado.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| BookingWizard placeholder | `src/app/(public)/[slug]/booking/components/booking-wizard.tsx` | Componente real sera implementado no plano 02-03. Interface de props definida corretamente para TypeScript compilar. |

## Threat Flags

Nenhuma superficie de seguranca nova alem do documentado no threat model do plano.

## Self-Check

### Files exist:
- [x] src/lib/supabase/public.ts — FOUND
- [x] src/app/(public)/[slug]/layout.tsx — FOUND
- [x] src/app/(public)/[slug]/page.tsx — FOUND
- [x] src/app/(public)/[slug]/booking/page.tsx — FOUND
- [x] src/app/(public)/[slug]/booking/components/booking-wizard.tsx — FOUND
- [x] src/middleware.ts (modificado) — FOUND

### Content checks:
- [x] public.ts contém createPublicClient, persistSession: false, autoRefreshToken: false
- [x] middleware.ts contém isPublicSlug ANTES de createServerClient (char 830 vs 979)
- [x] layout.tsx contém notFound() e createPublicClient
- [x] booking/page.tsx contém Promise.all e BookingWizard
- [x] barbershop_id nunca aceito como parametro — sempre resolvido via slug

## Self-Check: PASSED
