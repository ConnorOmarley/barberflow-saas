# 🪒 Barberflow

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square)
![shadcn/ui](https://img.shields.io/badge/shadcn_ui-000000?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square)
![Asaas](https://img.shields.io/badge/Asaas-Payments-14B8A6?style=flat-square)

SaaS multi-tenant de **agendamento e gestão para barbearias**. Donos gerenciam barbeiros, serviços, horários e financeiro; clientes fazem agendamento direto pelo portal público de cada barbearia.

> **Status:** desenvolvimento ativo por fases. **Fases 0 a 3 concluídas** (infraestrutura e multi-tenancy, onboarding do dono, portal de booking e check-in por QR); **fase 4 (fidelidade) em execução parcial**. As fases 5 a 8 — WhatsApp, billing via Asaas, relatórios financeiros e white label — **ainda não têm código**. O estado real está em [`.planning/STATE.md`](.planning/STATE.md) e o plano completo em [`.planning/ROADMAP.md`](.planning/ROADMAP.md); a seção [Limites conhecidos](#limites-conhecidos) diz o que isso significa na prática.

---

## ✨ Funcionalidades

### Por área

| Área | Funcionalidades | Estado |
| --- | --- | --- |
| **Dono** | Onboarding da barbearia, cadastro de barbeiros, serviços, horários de funcionamento e clientes | ✅ no Supabase |
| **Dono** | Dashboard com KPIs, agenda do dia e gráfico de receita | ⚠️ tela principal é scaffold com dados fixos |
| **Barbeiro** | Agenda própria com planejamento visual por dia | ✅ |
| **Público** | Página pública por slug da barbearia com booking para clientes | ✅ (confirmação manual) |
| **QR Code** | Check-in via QR com token HMAC assinado e expiração | ✅ |
| **Fidelidade** | Programa de carimbo digital | ⚠️ fase 4 parcial |
| **WhatsApp** | Notificações via Meta Cloud API | ❌ não iniciado |
| **Billing** | Assinatura SaaS via Asaas | ❌ não iniciado |

### Fluxo de autenticação

- Cadastro e login (dono e barbeiro)
- Recuperação e redefinição de senha
- Convite de barbeiros pelo dono (aceite via link)
- Confirmação de e-mail (Supabase)

---

## 🛠️ Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Banco | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + JWT (roles `owner` e `barber`) |
| QR Codes | `react-qr-code` (geração) + token HMAC assinado com `issued_at`/`expires_at` |
| Formulários | React Hook Form + Zod |
| Build | Turbopack |
| Billing | Asaas REST API — *planejado, sem código* |
| Notificações | WhatsApp Business Cloud API (Meta) — *planejado, sem código* |

### Multi-tenancy

- Cada barbearia cliente tem sua área isolada via **`barbershop_id`** em todas as tabelas + **Row Level Security (RLS)** no Supabase
- Middleware com regras de redirect baseadas no papel (role) do JWT
- O isolamento é testado no nível do banco, não da aplicação: `tests/rls_isolation.sql` troca o contexto do JWT dentro de uma transação com `SET LOCAL` e prova que um tenant não enxerga o outro. **Roda manualmente com `psql`, não por `npm test`.**

---

## 📁 Estrutura do projeto

```
barberflow-saas/
├── src/
│   ├── app/            # App Router (auth, owner, barber, public, actions)
│   ├── components/     # UI de dashboard, appointments, QR, shell
│   ├── lib/            # Hooks, clientes Supabase, utils
│   ├── types/          # Tipos gerados do banco (Supabase)
│   └── middleware.ts   # Auth + regras de redirect
├── supabase/
│   └── migrations/     # Migrations SQL do banco
├── tests/              # SQL de verificação de RLS (execução manual)
├── scripts/            # check-rls.sh
└── .planning/          # Roadmap, estado e plano por fase
```

`.planning/` é a fonte da verdade sobre o progresso: `STATE.md` guarda a fase atual, `ROADMAP.md` o plano de 9 fases, e `phases/` tem o plano e o resumo de cada fase já executada.

---

## 🚀 Como rodar

```bash
npm install
cp .env.local.example .env.local   # preencher com suas chaves
npm run dev
```

Servidor: `http://localhost:3000`

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de service role (server-side) |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site |

---

## 🗺️ Roadmap (por fases)

| Fase | Escopo | Estado |
| --- | --- | --- |
| 0 | Infraestrutura e baseline de multi-tenancy | ✅ concluída |
| 1 | Onboarding do dono, cadastro de barbeiro e serviço | ✅ concluída |
| 2 | Portal de booking do cliente | ✅ concluída |
| 3 | Check-in por QR | ✅ concluída |
| 4 | Fidelidade — carimbo digital | ⚠️ parcial |
| 5 | Notificações por WhatsApp | ❌ não iniciada |
| 6 | Billing SaaS (Asaas) | ❌ não iniciada |
| 7 | Relatórios financeiros e dashboard | ❌ não iniciada |
| 8 | White label | ❌ não iniciada |

> Bloqueio conhecido da Fase 5: os templates de mensagem do WhatsApp precisam de **pré-aprovação da Meta**, que leva até duas semanas. Submeter cedo evita travar a fase quando ela começar.

---

## 🔧 Rotas principais (App Router)

- `(auth)/` — `/entrar`, `/cadastro`, `/recuperar-senha`, `/nova-senha`, `/aceitar-convite`
- `(owner)/` — `/dashboard`, `/onboarding`, e as telas `/dashboard/agendamentos`, `/clientes`, `/equipe`, `/servicos`, `/fidelidade`
- `(barber)/` — `/agenda`
- `(public)/` — `/[slug]` (página pública da barbearia), `/[slug]/booking`, `/qr`, `/qr/check-in`
- `/auth/confirm` — confirmação de e-mail

---

## Limites conhecidos

- **Não existe `npm test` e não há um único teste automatizado.** `package.json` define apenas `dev`, `build`, `start` e `lint`. A pasta `tests/` tem três arquivos SQL (isolamento de RLS, cobertura de RLS e policies de `clients`) que exigem `psql` ou a CLI do Supabase rodando à mão — o `scripts/check-rls.sh` não está ligado a nenhum script npm.
- **A página principal do dashboard é um scaffold visual.** `src/lib/dashboard/sample-data.ts` se declara `PLACEHOLDER DASHBOARD DATA` e alimenta sete componentes com valores fixos (KPIs, receita da semana, clientes e agenda do dia). Só o `full_name` do perfil vem do Supabase. **As telas de agendamentos, clientes, equipe, serviços e fidelidade consultam o banco de verdade** — a fixture é só a vitrine.
- **O booking público termina em "PENDENTE".** `step-confirm.tsx` exibe "será confirmado em breve pela barbearia": o pedido é gravado, mas não há notificação nem confirmação automática para a barbearia.
- **Comissões e financeiro não existem ainda.** O roadmap menciona comissões na fase do dono e relatórios financeiros na fase 7, nenhuma das duas chegou a ser implementada.
- **Não há CI.** Não existe `.github/`, então lint, build e os testes de RLS só rodam se alguém rodar localmente.
- **Sem `LICENSE`.** Este repositório é privado / a combinar; os `.env.local.example` só têm placeholders e não há segredo no histórico.

---

## 📝 Licença

Privado / a combinar.