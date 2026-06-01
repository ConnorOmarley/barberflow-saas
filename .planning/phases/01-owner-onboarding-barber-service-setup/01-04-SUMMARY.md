---
phase: 01-owner-onboarding-barber-service-setup
plan: "04"
subsystem: auth-guards-nav-shell
tags: [middleware, onboarding, barber-invite, dashboard-nav, server-action]
dependency_graph:
  requires:
    - "01-02 — Migration aplicada + tipos TypeScript gerados (barbers table)"
  provides:
    - "Middleware Rule D: owner sem barbershop_id em /dashboard → redirect /onboarding"
    - "Middleware Rule E: owner com barbershop_id em /onboarding → redirect /dashboard"
    - "linkBarberProfile Server Action em src/app/actions/barbers.ts"
    - "aceitar-convite linka barbers.profile_id após updateUser"
    - "DashboardShell com hrefs de Equipe/Serviços/Agenda e active detection dinâmica"
  affects:
    - "Todos os planos Phase 1 que usam DashboardShell (01-05, 01-06, 01-07)"
    - "Fluxo de onboarding do owner (01-03)"
    - "Fluxo de aceitar convite do barbeiro"
tech_stack:
  added: []
  patterns:
    - "Onboarding guard no middleware via barbershop_id em JWT app_metadata"
    - "Server Action linkBarberProfile com UPDATE WHERE profile_id IS NULL (idempotente)"
    - "DashboardShell convertido para 'use client' com usePathname() para active detection dinâmica"
    - "Anti-loop: Rule D e Rule E com condições mutuamente exclusivas"
key_files:
  created:
    - src/app/actions/barbers.ts
  modified:
    - src/middleware.ts
    - src/app/(auth)/aceitar-convite/page.tsx
    - src/components/shell/dashboard-shell.tsx
    - src/types/database.types.ts
decisions:
  - "database.types.ts atualizado no worktree para incluir tipos Phase 1 (barbers, appointments, etc.) — o worktree foi criado antes do merge do 01-01/01-02"
  - "DashboardShell convertido para 'use client' (necessário para usePathname) — impacto mínimo pois já renderiza no browser"
  - "Rule D verifica barbershop_id ausente sem chamar getClaims() extra — reutiliza claims já carregado"
  - "isActive() usa exact match para /dashboard e startsWith para subrotas — evita /dashboard ativo em /dashboard/equipe"
metrics:
  duration: "~18 min"
  completed: "2026-05-31"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 1 Plan 04: Guards de Onboarding + Linkagem de Barbeiro + Nav Ativa

**One-liner:** Middleware com Rules D/E para onboarding guard anti-loop + Server Action linkBarberProfile como fallback para trigger Postgres + DashboardShell com hrefs e active detection dinâmica via usePathname.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Guards de onboarding no middleware (Rules D e E) | pending-merge | src/middleware.ts |
| 2 | linkBarberProfile + aceitar-convite linkage + DashboardShell hrefs | pending-merge | src/app/actions/barbers.ts, src/app/(auth)/aceitar-convite/page.tsx, src/components/shell/dashboard-shell.tsx, src/types/database.types.ts |

## What Was Built

### Middleware — Rules D e E (src/middleware.ts)

Dois novos guards adicionados após a Rule C existente:

**Rule D** — Owner autenticado sem `barbershop_id` tentando acessar qualquer rota `/dashboard/*` é redirecionado para `/onboarding`. Garante que o onboarding wizard seja completado antes de acessar o dashboard.

**Rule E** — Owner autenticado com `barbershop_id` tentando acessar `/onboarding` é redirecionado para `/dashboard`. Previne re-entrada no wizard após onboarding concluído.

**Anti-loop implementado:** Rule D só dispara quando `barbershop_id` está **ausente**. Rule E só dispara quando `barbershop_id` está **presente**. As condições são mutuamente exclusivas — elimina o loop de redirect documentado no RESEARCH.md Pitfall 7.

`barbershop_id` extraído de `claims?.app_metadata?.barbershop_id` — mesmo objeto `claims` já carregado por `getClaims()`, sem chamadas extras.

### Server Action linkBarberProfile (src/app/actions/barbers.ts)

Server Action `'use server'` que linka `barbers.profile_id` ao `auth.users.id` do barbeiro autenticado.

Proteções implementadas (Threat T-01-10):
- `UPDATE WHERE profile_id IS NULL` — idempotente, não sobrescreve profile_id já setado
- RLS da tabela `barbers` bloqueia automaticamente updates cross-tenant via JWT
- `getClaims()` no servidor extrai `userId` — nunca confia em input do cliente

### aceitar-convite — Linkagem de profile_id (src/app/(auth)/aceitar-convite/page.tsx)

Após `supabase.auth.updateUser({ password })` bem-sucedido:
1. `supabase.auth.getUser()` recupera o user com metadados
2. `user.user_metadata.barber_id` é lido (setado pelo admin via `inviteUserByEmail options.data`)
3. Se `barber_id` presente: chama `linkBarberProfile(barberId)` como fallback
4. `router.push('/agenda')` — redirect para a agenda do barbeiro

O trigger Postgres `handle_invite_accepted` é o mecanismo primário. Esta Server Action é o fallback per RESEARCH.md open question #1.

### DashboardShell — hrefs e Active Detection (src/components/shell/dashboard-shell.tsx)

Mudanças aplicadas:
1. `'use client'` adicionado no topo — necessário para `usePathname`
2. `import { usePathname } from 'next/navigation'` adicionado
3. `active?: boolean` removido do tipo `NavItem` — detecção agora é dinâmica
4. `const pathname = usePathname()` no corpo do componente
5. Função `isActive(item)` detecta item ativo:
   - `/dashboard`: exact match (`pathname === '/dashboard'`)
   - Outros: `pathname.startsWith(item.href)` — ativo em sub-rotas
6. Hrefs adicionados:
   - Agenda: `/dashboard/agenda`
   - Serviços: `/dashboard/servicos`
   - Equipe: `/dashboard/equipe`
7. `data-active="true"` aplicado dinamicamente via `isActive(item)` — sem hardcoded

### database.types.ts — Tipos Phase 1 (src/types/database.types.ts)

O worktree foi criado no commit `0e103ee` (anterior ao merge do 01-01/01-02). O arquivo foi atualizado para incluir os tipos das 5 tabelas Phase 1: `appointments`, `barber_services`, `barbers`, `services`, `working_hours`. Isso garante que `barbers.ts` compile sem erros TypeScript.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] database.types.ts desatualizado no worktree**
- **Found during:** Task 2 (ao criar barbers.ts que usa `.from('barbers')`)
- **Issue:** O worktree foi criado no commit `0e103ee`, antes do merge do Plan 01-01 (migration) e 01-02 (tipos). O `database.types.ts` do worktree não tinha `barbers`, `appointments`, etc.
- **Fix:** Copiado o conteúdo atualizado de `master:src/types/database.types.ts` (commit `21c683f`) para o worktree
- **Files modified:** `src/types/database.types.ts`
- **Commit:** included in pending-merge

### Environment Limitation (Non-blocking)

**git add/commit bloqueados pelo sandbox:** O ambiente de execução do agente bloqueia por segurança os subcomandos `git add`, `git commit`, `git stash`, `git tag` e outros que modificam estado do repositório. Os arquivos foram criados/modificados com sucesso no sistema de arquivos mas os commits pendentes devem ser gerados pelo merge do worktree.

Impacto: Nenhum — o orquestrador faz o merge do worktree no final, o que aplicará todas as mudanças ao branch master.

## Known Stubs

Nenhum — este plano não cria UI com dados. Os guards de middleware são determinísticos. O Server Action `linkBarberProfile` é funcional. O DashboardShell tem hrefs reais.

## Threat Flags

Nenhum — todas as superfícies estão dentro do threat_model documentado:
- T-01-09 (loop prevention): implementado via condições mutuamente exclusivas entre Rule D e Rule E
- T-01-10 (barber ownership): UPDATE WHERE profile_id IS NULL + RLS enforcement implementados
- T-01-11 (DashboardShell 'use client'): aceito conforme threat model — usePathname é read-only, sem dados sensíveis

## Self-Check: PASSED

- [x] src/middleware.ts contém "onboarding" em pelo menos 3 lugares (Rule D, Rule E, isOnboardingRoute)
- [x] src/middleware.ts tem exatamente 1 chamada getClaims()
- [x] src/middleware.ts extrai barbershop_id de claims?.app_metadata?.barbershop_id
- [x] src/app/actions/barbers.ts exporta linkBarberProfile com 'use server'
- [x] src/app/(auth)/aceitar-convite/page.tsx importa e chama linkBarberProfile (2 ocorrências)
- [x] src/app/(auth)/aceitar-convite/page.tsx usa user?.user_metadata?.barber_id
- [x] src/components/shell/dashboard-shell.tsx tem 'use client' na linha 1
- [x] src/components/shell/dashboard-shell.tsx importa usePathname
- [x] src/components/shell/dashboard-shell.tsx tem href "/dashboard/equipe"
- [x] src/components/shell/dashboard-shell.tsx tem href "/dashboard/servicos"
- [x] src/components/shell/dashboard-shell.tsx tem href "/dashboard/agenda"
- [x] src/types/database.types.ts contém tipos para tabela barbers
- [x] Todos os 5 arquivos estão presentes no filesystem do worktree
