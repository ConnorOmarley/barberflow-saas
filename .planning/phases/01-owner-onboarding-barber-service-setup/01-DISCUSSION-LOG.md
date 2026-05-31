# Phase 1: Owner Onboarding + Barber & Service Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 1-owner-onboarding-barber-service-setup
**Areas discussed:** Wizard de onboarding, Modelo de barbeiro, Horários de trabalho, Agendamento manual

---

## Wizard de Onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard direto (Recomendado) | Wizard cria o barbershop e redireciona para /dashboard. O dono pode completar equipe/serviços de dentro do dashboard depois. | ✓ |
| Dashboard travado até completar equipe | Wizard exige pelo menos 1 barbeiro e 1 serviço antes de liberar o dashboard. | |
| Tela de confirmação/bem-vindo | Wizard termina com uma tela 'Setup completo!' que resume o que foi configurado, depois redireciona. | |

**User's choice:** Dashboard direto

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 passos: Nome+fuso → Horários da barbearia → Pronto | Passo 1: nome da barbearia + timezone. Passo 2: horários gerais de funcionamento. Passo 3: confirmação/redirect. Barbeiros e serviços adicionados depois no dashboard. | |
| 4 passos: Nome → Horários → Primeiro barbeiro → Primeiro serviço | Guia o dono do zero até ter algo funcional antes de entrar no dashboard. | ✓ |
| 2 passos: Nome+fuso → Confirmação | Mínimo absoluto. Apenas cria o registro da barbearia e libera o dashboard. | |

**User's choice:** 4 passos com detalhe completo:
- Passo 1: Nome da barbearia + Timezone
- Passo 2: Horários gerais da barbearia (flexível por dia da semana)
- Passo 3: Criar primeiro barbeiro (nome obrigatório, login opcional na Fase 1)
- Passo 4: Criar primeiro serviço (nome, duração, preço, templates rápidos)
- Não bloquear dashboard. Mostrar checklist de setup restante dentro do dashboard.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, retoma do último passo salvo (Recomendado) | Cada passo grava no banco antes de avançar. Se o dono voltar ao /onboarding, começa do passo que não foi concluído. Evita barbearia duplicada. | ✓ |
| Começa do zero (simples) | Se o dono saiu sem concluir, refaz tudo. Mais simples de implementar, menor risco de estado inconsistente. | |

**User's choice:** Retoma do último passo salvo.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Redireciona para /dashboard (Recomendado) | Middleware detecta barbershop_id no JWT e bloqueia o acesso ao wizard. Simples e à prova de bugs. | ✓ |
| Mostra a página de setup com dados pré-preenchidos | Permite reconfigurar barbearia pelo mesmo wizard. Mais flexível mas aumenta complexidade. | |

**User's choice:** Redireciona para /dashboard.

---

## Modelo de Barbeiro

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela barbers separada + link opcional para auth user (Recomendado) | barbers(id, barbershop_id, profile_id UUID NULL, name, photo_url, ...). profile_id preenchido quando barbeiro aceita o convite. | ✓ |
| Apenas profiles (sem tabela barbers) | Todo barbeiro DEVE ter conta auth. Dono convida primeiro, depois configura. | |

**User's choice:** Tabela barbers separada com profile_id NULL. Schema detalhado:
```
barbers: id, barbershop_id, profile_id NULL FK, name, phone, photo_url, is_active, created_at, updated_at
```
Separar entidade operacional (barber) da autenticação (profile). Preparar para futuras roles: OWNER, MANAGER, BARBER, RECEPTIONIST.

---

| Option | Description | Selected |
|--------|-------------|----------|
| CRUD completo em /dashboard/equipe (Recomendado) | Listagem com cards, drawer/modal para criar/editar. | ✓ |
| Inline na página do dashboard | Gestão de equipe embarcada dentro do dashboard principal como widget. | |

**User's choice:** CRUD completo em /dashboard/equipe.

---

| Option | Description | Selected |
|--------|-------------|----------|
| TEXT[] (array Postgres) — tags livres (Recomendado) | specialties TEXT[] DEFAULT '{}'. Dono digita tags livres. Simples, flexível. | |
| Tabela specialties normalizada | ENUM ou tabela de lookup com especialidades pré-definidas. | |
| Outro (freeform) | — | ✓ |

**User's choice (freeform):** Não usar specialties TEXT[] como conceito principal. Modelar especialidades através da relação barber_services. Schema:
```
services: id, barbershop_id, name, duration_minutes, price
barber_services: barber_id FK, service_id FK
```
Manter specialties TEXT[] apenas como campo informal/marketing, não como lógica operacional.

---

## Horários de Trabalho

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela working_hours por barbeiro por dia (Recomendado) | working_hours(barber_id, day_of_week 0-6, start_time TIME, end_time TIME, is_active BOOL). | ✓ |
| JSON embutido no barbeiro | Campo JSONB no barbers. Difícil de consultar. | |

**User's choice:** Tabela working_hours com suporte a múltiplas linhas por dia (múltiplos turnos):
```
working_hours: id, barber_id, day_of_week SMALLINT, start_time TIME, end_time TIME, is_active, created_at, updated_at
```
Exemplo: SEG 09:00–12:00 + SEG 14:00–18:00.

---

| Option | Description | Selected |
|--------|-------------|----------|
| commission_type + commission_value em barber_services (Recomendado) | barber_services(barber_id, service_id, commission_type, commission_value). | ✓ |
| Tabela commissions separada | Mais normalizada mas redundante com barber_services. | |

**User's choice:** Comissão na junção barber_services:
```
barber_services: barber_id FK, service_id FK, commission_type TEXT NULL CHECK('percent','fixed'), commission_value NUMERIC(10,2) NULL
```
Campos NULL para barbearias sem comissão. Evitar tabela separada.

---

## Agendamento Manual

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/drawer no dashboard com formulário simples (Recomendado) | Campos: Cliente, Barbeiro, Serviço, Data/hora. Status inicial = CONFIRMED. Validação simples na Phase 1. | ✓ |
| Página dedicada /dashboard/novo-agendamento | Rota própria. Mais espaço, mais navegação. | |
| Mesma UI do portal do cliente | Reutiliza componente Phase 2. Mas Phase 2 não existe ainda. | |

**User's choice:** Drawer lateral "Novo agendamento" (ação global). Campos: Cliente (search + create inline), Barbeiro, Serviço, Data, Hora, Observações. Status = CONFIRMED. Fazer validação simples (impedir mesmo barbeiro no mesmo horário) já na Phase 1. Arquitetura deve permitir reutilização futura.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Botão Cancelar inline na listagem com confirm dialog (Recomendado) | Botão '...' ou 'Cancelar' por row. Dialog com motivo opcional. Status = CANCELLED. | ✓ |
| Editar agendamento abre drawer com botão Cancelar dentro | Cancelamento como ação dentro do drawer de edição. | |

**User's choice:** Botão inline (menu de ações: Editar / Cancelar / Completar) + confirm dialog. Campos: motivo opcional. UPDATE: status=CANCELLED, cancelled_at, cancelled_by, cancel_reason. Não deletar agendamentos. Também disponível dentro do drawer como ação secundária. Enum de status: PENDING, CONFIRMED, COMPLETED, CANCELLED (NO_SHOW futuro).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Criar appointments na Phase 1 (sem exclusion constraint ainda) | BOOK-03 e BOOK-05 exigem persistência. Validação app-layer. | ✓ |
| Criar na Phase 2 com tudo junto | Phase 1 sem agendamentos no DB. Conflita com requisitos BOOK-03/05. | |

**User's choice:** Criar appointments na Phase 1. Schema completo com start_time, end_time, status, cancelled_at, cancelled_by, cancel_reason, created_by, booking_source. Phase 2 adiciona exclusion constraint GIST.

---

## Claude's Discretion

- JWT refresh strategy after onboarding step 1 (use `supabase.auth.refreshSession()`)
- Exact UI component for day-view vs week-view in barber agenda (tabs recommended)
- Specific RLS policy wording for new tables (follow Phase 0 pattern exactly)
- Whether /dashboard/equipe uses a sheet/drawer or a page-embedded form

## Deferred Ideas

- **Roles MANAGER/RECEPTIONIST**: arquitetura preparada, não implementada na Phase 1
- **Múltiplas unidades/franquia**: v3+
- **Cancelamento pelo cliente** (BOOK-V2-01): Phase 2+
- **Pré-pagamento online** (BOOK-V2-02): Phase 2+
- **NO_SHOW status**: futuro
