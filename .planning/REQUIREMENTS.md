# Requirements: BarberFlow

**Defined:** 2026-05-29
**Core Value:** Um cliente consegue agendar um corte online, aparecer na barbearia, escanear o QR, ser atendido e acumular pontos — tudo sem papel e sem WhatsApp manual.

## v1 Requirements

### Authentication & Multi-Tenancy

- [x] **AUTH-01**: Dono pode criar conta com email e senha e recebe email de verificação
- [x] **AUTH-02**: Dono pode fazer login e a sessão persiste entre atualizações do navegador
- [x] **AUTH-03**: Dono pode redefinir senha via link de email
- [~] **AUTH-04**: Dono completa onboarding da barbearia em até 4 passos após cadastro (schema na Fase 0; fluxo na Fase 1)
- [~] **AUTH-05**: Dono convida barbeiro por email; barbeiro cria sua própria senha ao aceitar (schema + /aceitar-convite na Fase 0; UI de envio na Fase 1)
- [x] **AUTH-06**: Barbeiro pode fazer login com suas credenciais e ver apenas sua própria agenda
- [x] **AUTH-07**: Cliente pode se identificar pelo nome e WhatsApp ao agendar (sem conta obrigatória no v1)
- [x] **AUTH-08**: Cada barbearia tem seu espaço isolado — dados de uma barbearia nunca são visíveis a outra

### Booking & Scheduling

- [ ] **BOOK-01**: Cliente pode selecionar serviço, barbeiro e horário disponível no portal online
- [ ] **BOOK-02**: Sistema bloqueia slots em tempo real — dois clientes não conseguem reservar o mesmo horário
- [ ] **BOOK-03**: Dono ou barbeiro pode criar agendamento manualmente pelo painel (walk-in, telefone)
- [ ] **BOOK-04**: Agendamento segue ciclo de status: PENDING → CONFIRMED → CHECKED_IN → COMPLETED → CANCELLED
- [ ] **BOOK-05**: Dono pode cancelar qualquer agendamento pelo painel com motivo opcional

### Barber Management

- [ ] **BARB-01**: Dono pode cadastrar barbeiro com nome, foto e especialidades
- [ ] **BARB-02**: Dono pode definir horários de trabalho por barbeiro (dias da semana + horários)
- [ ] **BARB-03**: Dono pode definir comissão por barbeiro (percentual ou valor fixo)
- [ ] **BARB-04**: Barbeiro pode visualizar sua própria agenda do dia/semana pelo painel
- [ ] **BARB-05**: Barbeiro pode marcar atendimento como COMPLETED pelo painel

### Services

- [ ] **SVC-01**: Dono pode cadastrar serviço com nome, duração e preço
- [ ] **SVC-02**: Dono pode associar quais serviços cada barbeiro oferece
- [ ] **SVC-03**: Portal de agendamento exibe apenas serviços do barbeiro selecionado

### QR Check-In

- [ ] **QR-01**: Sistema gera QR code único e assinado para cada agendamento confirmado
- [ ] **QR-02**: Cliente escaneia QR com câmera do celular e status muda automaticamente para CHECKED_IN
- [ ] **QR-03**: QR é válido apenas na janela de ±30 minutos do horário agendado (prevenção de replay)
- [ ] **QR-04**: QR é revogado automaticamente em cancelamento ou remarcação

### Loyalty — Carimbo Digital

- [ ] **LOY-01**: Dono configura regra de fidelidade por barbearia (ex: 10 cortes = 1 grátis)
- [ ] **LOY-02**: Carimbo é registrado automaticamente quando atendimento é marcado COMPLETED
- [ ] **LOY-03**: Dono pode resgatar recompensa manualmente pelo painel (desconto ou serviço gratuito)

### WhatsApp Notifications

- [ ] **WA-01**: Cliente recebe mensagem WhatsApp de confirmação quando agendamento é confirmado
- [ ] **WA-02**: Cliente recebe lembrete WhatsApp X horas antes do horário (X configurável pelo dono)
- [ ] **WA-03**: Cliente é cadastrado com opt-in explícito para WhatsApp (LGPD) com `opt_in_timestamp` armazenado

### Financial & Reports

- [ ] **FIN-01**: Dashboard exibe faturamento total do dia, semana e mês
- [ ] **FIN-02**: Dono pode ver histórico de agendamentos com filtros por data, barbeiro, cliente e status
- [ ] **FIN-03**: Relatório de comissões por barbeiro no período selecionado

### White Label — Básico

- [ ] **WL-01**: Dono pode configurar logo e cores da barbearia no painel
- [ ] **WL-02**: Portal de agendamento do cliente exibe logo e cores da barbearia (não da BarberFlow)

### SaaS Billing

- [ ] **BILL-01**: Sistema cria assinatura mensal via Asaas quando barbearia conclui onboarding
- [ ] **BILL-02**: Acesso à plataforma é bloqueado quando assinatura está inadimplente
- [ ] **BILL-03**: Dono recebe notificação antes do vencimento e ao ter pagamento recusado
- [ ] **BILL-04**: Webhooks do Asaas são processados de forma idempotente (sem duplicatas)

---

## v2 Requirements

### Booking Enhancements

- **BOOK-V2-01**: Cliente pode cancelar e remarcar agendamento com janela configurável (ex: até 2h antes)
- **BOOK-V2-02**: Cliente pode pagar via PIX ao confirmar agendamento online (pré-pagamento)
- **BOOK-V2-03**: Serviços combos — múltiplos serviços num único agendamento (ex: corte + barba)
- **BOOK-V2-04**: Fila de espera para horários lotados

### QR Check-In Enhancements

- **QR-V2-01**: Dashboard ao vivo: tela com clientes presentes vs aguardando em tempo real
- **QR-V2-02**: QR Check-In desbloqueia automaticamente próximo na fila de espera

### Loyalty Enhancements

- **LOY-V2-01**: Cliente pode ver seu cartão digital de fidelidade com progresso no portal
- **LOY-V2-02**: Cliente recebe mensagem WhatsApp ao completar o cartão (milestone)

### WhatsApp Enhancements

- **WA-V2-01**: Re-engajamento automático: mensagem para clientes que não cortaram há Y dias (Y configurável)
- **WA-V2-02**: Notificação de cancelamento enviada ao cliente via WhatsApp

### Financial Enhancements

- **FIN-V2-01**: Exportação de relatórios em CSV

### Authentication Enhancements

- **AUTH-V2-01**: Login com Google para donos e clientes
- **AUTH-V2-02**: Cadastro com conta própria para clientes no portal (histórico de visitas pessoal)

### White Label Avançado

- **WL-V2-01**: Cada barbearia com subdomínio próprio (ex: barbearia.barberflow.com.br)
- **WL-V2-02**: Suporte a domínio customizado (ex: seusite.com.br) com TLS automático
- **WL-V2-03**: App mobile white-label por tenant

### App Mobile Nativo

- **MOB-V2-01**: App do dono: agenda, faturamento, clientes, notificações
- **MOB-V2-02**: App do barbeiro: agenda própria, próximos clientes, marcar COMPLETED

### IA Agenda

- **AI-V2-01**: Sugestão inteligente de horários baseada em preferência e histórico do cliente
- **AI-V2-02**: Previsão de tempo ocioso para otimização de agenda

---

## Out of Scope

| Feature | Motivo |
|---------|--------|
| Marketplace / busca de barbearias | Produto diferente, complexidade separada — tipo iFood para barbearias |
| Gestão de estoque e produtos | Fora do foco de agendamento |
| Hardware de PDV | Infraestrutura física fora do escopo |
| Controle de ponto eletrônico | Não solicitado |
| Gestão de franquias / multi-unidade | Complexidade de v3+ |
| Reviews e avaliações públicas | Não diferencia o produto no v1 |
| Chat em tempo real | Substituído por WhatsApp |
| Integração com sistemas contábeis | Exportação CSV é suficiente para v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| AUTH-02 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| AUTH-03 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| AUTH-04 | Phase 0 → Phase 1 (schema Phase 0; onboarding flow Phase 1) | Pending |
| AUTH-05 | Phase 0 (schema + /aceitar-convite) → Phase 1 (invite-sending UI) | Pending |
| AUTH-06 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| AUTH-07 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| AUTH-08 | Phase 0 — Infrastructure & Multi-Tenancy Baseline | Complete |
| BOOK-01 | Phase 2 — Client Booking Portal | Pending |
| BOOK-02 | Phase 2 — Client Booking Portal | Pending |
| BOOK-03 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BOOK-04 | Phase 2 — Client Booking Portal | Pending |
| BOOK-05 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BARB-01 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BARB-02 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BARB-03 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BARB-04 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| BARB-05 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| SVC-01 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| SVC-02 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| SVC-03 | Phase 1 — Owner Onboarding + Barber & Service Setup | Pending |
| QR-01 | Phase 3 — QR Check-In | Pending |
| QR-02 | Phase 3 — QR Check-In | Pending |
| QR-03 | Phase 3 — QR Check-In | Pending |
| QR-04 | Phase 3 — QR Check-In | Pending |
| LOY-01 | Phase 4 — Loyalty (Carimbo Digital) | Pending |
| LOY-02 | Phase 4 — Loyalty (Carimbo Digital) | Pending |
| LOY-03 | Phase 4 — Loyalty (Carimbo Digital) | Pending |
| WA-01 | Phase 5 — WhatsApp Notifications | Pending |
| WA-02 | Phase 5 — WhatsApp Notifications | Pending |
| WA-03 | Phase 5 — WhatsApp Notifications | Pending |
| FIN-01 | Phase 7 — Financial Reports & Dashboard | Pending |
| FIN-02 | Phase 7 — Financial Reports & Dashboard | Pending |
| FIN-03 | Phase 7 — Financial Reports & Dashboard | Pending |
| WL-01 | Phase 8 — White Label Basics | Pending |
| WL-02 | Phase 8 — White Label Basics | Pending |
| BILL-01 | Phase 6 — SaaS Billing (Asaas) | Pending |
| BILL-02 | Phase 6 — SaaS Billing (Asaas) | Pending |
| BILL-03 | Phase 6 — SaaS Billing (Asaas) | Pending |
| BILL-04 | Phase 6 — SaaS Billing (Asaas) | Pending |

**Coverage:**
- v1 requirements: 40 total (8 AUTH + 5 BOOK + 5 BARB + 3 SVC + 4 QR + 3 LOY + 3 WA + 3 FIN + 2 WL + 4 BILL)
- Mapped to phases: 40
- Unmapped: 0

**Note on count:** The original placeholder said "33 total" but counting individual v1 requirement IDs gives 40. All 40 are mapped above. No orphans.

---
*Requirements defined: 2026-05-29*
*Last updated: 2026-05-29 — traceability populated during roadmap creation*
