# 🪒 Barberflow

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square)
![shadcn/ui](https://img.shields.io/badge/shadcn_ui-000000?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square)
![Asaas](https://img.shields.io/badge/Asaas-Payments-14B8A6?style=flat-square)

SaaS multi-tenant de **agendamento e gestão para barbearias**. Donos gerenciam barbeiros, serviços, horários e financeiro; clientes fazem agendamento direto pelo portal público de cada barbearia.

> Status: **em desenvolvimento ativo** — atualmente na Fase 6 (billing SaaS via Asaas), desenvolvimento baseado em fases (roadmap até White Label).

---

## ✨ Funcionalidades

### Por área

| Área | Funcionalidades |
| --- | --- |
| **Dono** | Dashboard, onboarding da barbearia, gestão de barbeiros, serviços, horários de funcionamento e comissões |
| **Barbeiro** | Agenda própria (planejamento visual por dia) |
| **Público** | Página pública por slug da barbearia com booking para clientes |
| **Fidelidade** | Programa de fidelidade (carimbo digital) |
| **QR Code** | Check-in via QR code |
| **Notificações** | WhatsApp (via Meta Cloud API) |

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
| Billing | Asaas REST API |
| Notificações | WhatsApp Business Cloud API (Meta) |
| QR Codes | react-qr-code + html5-qrcode |
| Formulários | React Hook Form + Zod |
| Build | Turbopack |

### Multi-tenancy

- Cada barbeiro/barbearia clente tem sua área isolada via **`barbershop_id`** em todas as tabelas + **Row Level Security (RLS)** no Supabase
- Middleware com regras de redirect (A–E) baseadas no papel (role) do JWT

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
├── tests/
└── scripts/
```

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

| Fase | Escopo |
| --- | --- |
| 0 | Infraestrutura do projeto |
| 1–5 | Núcleo (auth, tenant, agenda, dashboard, fidelidade, QR) |
| 6 | Billing SaaS (Asaas) — *atual* |
| 7 | Notificações WhatsApp |
| 8 | White Label |

---

## 🔧 Rotas principais (App Router)

- `(auth)/` — `/entrar`, `/cadastro`, `/recuperar-senha`, `/nova-senha`, `/aceitar-convite`
- `(owner)/` — `/dashboard`, `/onboarding`
- `(barber)/` — `/agenda`
- `(public)/` — `/`[slug] (página pública da barbearia), `/qr`
- `/auth/confirm` — confirmação de e-mail

---

## 📝 Licença

Privado / a combinar.