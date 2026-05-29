# BarberFlow

## What This Is

BarberFlow é um SaaS multi-tenant de agendamento e gestão para barbearias. Donos de barbearia contratam o serviço e recebem um painel completo de gestão (agenda, barbeiros, serviços, comissões, financeiro) mais um portal de agendamento online para seus clientes. O diferencial central é o carimbo digital de fidelidade (ex: 10 cortes = 1 grátis) e o QR Check-In para presença automática.

## Core Value

Um cliente consegue agendar um corte online em qualquer barbearia cadastrada, aparecer lá, escanear o QR, ser atendido e acumular pontos — tudo sem papel e sem WhatsApp manual.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Autenticação e Multi-Tenancy**
- [ ] Dono cria conta e cadastra sua barbearia (onboarding guiado)
- [ ] Cada barbearia tem seu próprio espaço isolado (dados, configurações, domínio)
- [ ] Barbeiros têm login próprio com acesso restrito à sua agenda
- [ ] Clientes se cadastram por barbearia (ou global com vínculo por barbearia)

**Agendamento**
- [ ] Cliente escolhe serviço, barbeiro e horário disponível pelo portal
- [ ] Sistema bloqueia horários já ocupados em tempo real
- [ ] Dono/barbeiro cria agendamentos manualmente pelo painel
- [ ] Cancelamento e remarcação por clientes com prazo configurável
- [ ] Status de agendamento: PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED

**QR Check-In**
- [ ] Sistema gera QR único por agendamento confirmado
- [ ] Cliente escaneia QR na barbearia → status muda automaticamente para CHECKED_IN
- [ ] Dashboard ao vivo mostra: clientes presentes vs aguardando
- [ ] QR Check-In desbloqueia fila de espera, confirmação automática e programa de fidelidade

**Gestão de Barbeiros e Serviços**
- [ ] Dono cadastra barbeiros com foto, especialidades e horários de trabalho
- [ ] Dono cadastra serviços com nome, duração e preço
- [ ] Associação de serviços por barbeiro (quem faz o quê)
- [ ] Controle de comissões por barbeiro (percentual ou valor fixo por serviço)

**Programa de Fidelidade — Carimbo Digital**
- [ ] Cada barbearia configura sua própria regra (ex: 10 cortes = 1 grátis)
- [ ] Carimbo é registrado automaticamente ao concluir atendimento
- [ ] Cliente vê seu cartão digital no portal com progresso
- [ ] Dono resgata recompensa manualmente pelo painel (desconto, serviço gratuito)

**Pagamentos**
- [ ] Cliente paga online ao agendar via PIX ou cartão (gateway de pagamento)
- [ ] Opção "pagar na barbearia" — agendamento confirmado sem pagamento antecipado
- [ ] Asaas para cobrança de mensalidade das barbearias no SaaS

**WhatsApp Reminders**
- [ ] Envio automático de lembrete X dias antes do agendamento (X configurável pelo dono)
- [ ] Envio automático para clientes que não cortaram há Y dias (Y configurável pelo dono)
- [ ] Dono ativa/desativa cada tipo de notificação no painel

**Financeiro e Relatórios**
- [ ] Dashboard com faturamento do dia/semana/mês
- [ ] Relatório de comissões por barbeiro no período
- [ ] Histórico de agendamentos com filtros
- [ ] Exportação de relatório (CSV)

**App Mobile**
- [ ] Site responsivo funciona bem em celular (mobile-first)
- [ ] App nativo: versão do dono (agenda, faturamento, clientes, notificações)
- [ ] App nativo: versão do barbeiro (agenda própria, próximos clientes, concluir atendimento)

**White Label**
- [ ] Cada barbearia pode ter domínio customizado (ex: barba.nomedabarbearia.com.br)
- [ ] Logo, cores e nome da barbearia aplicados em todo o portal do cliente
- [ ] App mobile white label (configurável por tenant)

**IA Agenda**
- [ ] Sugestão inteligente de horários baseada em preferência e histórico do cliente
- [ ] Previsão de tempo ocioso para o dono otimizar a agenda

### Out of Scope

- Marketplace de busca de barbearias (plataforma tipo iFood) — complexidade separada, produto diferente
- Estoque e controle de produtos — fora do foco inicial de agendamento
- Integração com sistemas de ponto eletrônico — não solicitado

## Context

- Mercado brasileiro de barbearias — concorrentes existem (Booksy, sistemas genéricos brasileiros) mas sem diferencial de fidelidade + QR check-in integrados
- Cobrança SaaS via Asaas (plataforma de pagamentos brasileira focada em cobrança recorrente)
- WhatsApp é o principal canal de comunicação do público-alvo no Brasil — reminders via WhatsApp têm taxa de abertura muito superior a email
- QR Check-In cria um loop natural: agendar → aparecer → acumular fidelidade → agendar novamente

## Constraints

- **Tech Stack:** Next.js 15 + Supabase (Postgres, Auth, Storage, Edge Functions) — escolhido pelo usuário
- **Billing SaaS:** Asaas para cobrança de mensalidade dos tenants — integração obrigatória
- **Mobile:** Site deve ser mobile-first; app nativo é fase posterior
- **Brasil:** PIX como método de pagamento principal; WhatsApp Business API para reminders
- **Multi-tenancy:** Isolamento de dados por tenant desde o início — impossível retrofitar

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase como backend | Postgres gerenciado + Auth + Storage + Edge Functions — reduz infraestrutura | — Pending |
| Asaas para billing SaaS | Plataforma brasileira, suporta PIX, boleto e cobrança recorrente | — Pending |
| QR Check-In como diferencial de UX | Elimina confirmação manual e integra fidelidade naturalmente | — Pending |
| Carimbo digital como diferencial de retenção | Sem equivalente nos concorrentes identificados | — Pending |
| White label desde o início | Multi-tenancy com identidade própria = maior valor percebido pelo dono | — Pending |

## Evolution

Este documento evolui em transições de fase e marcos de milestone.

**Após cada transição de fase** (via `/gsd:transition`):
1. Requirements invalidados? → Mover para Out of Scope com motivo
2. Requirements validados? → Mover para Validated com referência de fase
3. Novos requirements surgiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se mudou

**Após cada milestone** (via `/gsd:complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value check — ainda é a prioridade certa?
3. Auditoria de Out of Scope — motivos ainda válidos?
4. Atualizar Context com estado atual

---
*Last updated: 2026-05-29 after initialization*
