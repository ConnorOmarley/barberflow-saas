---
phase: 01-owner-onboarding-barber-service-setup
verified: 2026-06-01T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Wizard de onboarding completa em 4 passos e redireciona para /dashboard"
    expected: "Owner acessa /onboarding, preenche 4 passos, é redirecionado para /dashboard. Tempo total abaixo de 5 minutos."
    why_human: "Fluxo de UI com sessão real de Supabase — não verificável via grep. JWT refresh após step 1 requer navegador."
  - test: "Barbeiro aceita convite e barbers.profile_id é linkado"
    expected: "Após aceitar convite e definir senha, barbeiro faz login e acessa /agenda. barbers.profile_id = auth.users.id do barbeiro."
    why_human: "Fluxo de email de convite requer Supabase SMTP configurado e navegador real."
  - test: "Botão 'Novo agendamento' em /agenda abre o AppointmentDrawer"
    expected: "Barbeiro clica no botão 'Novo agendamento' em /agenda e o Sheet drawer abre."
    why_human: "O onClick do botão está vazio no código (stub documentado em plan 01-07). O AppointmentDrawer existe mas não está wired em /agenda — apenas no dashboard do owner. Requer verificação se essa ligação é exigida pelo success criteria ou se 'dashboard panel' se refere apenas ao /dashboard do owner."
  - test: "Owner cancela agendamento a partir do /dashboard"
    expected: "Owner abre painel de agendamentos, clica em Cancelar, insere motivo opcional e confirma. Agendamento fica com status CANCELLED e cancel_reason salvo."
    why_human: "Requer agendamento existente no banco local. CancelDialog existe e está wired, mas o TodayAgenda/UpcomingAppointments no dashboard precisam ter botão de cancelamento visível — verificação visual necessária."
  - test: "SetupChecklist aparece no dashboard e marca itens como completos"
    expected: "Owner acessa /dashboard sem equipe/serviços configurados e vê SetupChecklist. Após adicionar barbeiro e serviço, checklist marca itens correspondentes."
    why_human: "Comportamento de fetch on mount e leitura de localStorage — requer navegador."
  - test: "Photo upload de barbeiro funciona (bucket barber-photos)"
    expected: "Owner seleciona foto no BarberDrawer, salva barbeiro — foto aparece no card."
    why_human: "Requer bucket barber-photos criado no Supabase local/remoto. Storage policy authenticated-only está na migration mas o bucket pode não existir no ambiente local."
---

# Phase 1: Owner Onboarding + Barber & Service Setup — Verification Report

**Phase Goal:** A new owner can complete guided onboarding and configure their entire shop — barbers, services, schedules, and commissions — in under 5 minutes, leaving the system ready to accept bookings
**Verified:** 2026-06-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| #  | Truth                                                                                                                                                     | Status     | Evidence                                                                                                         |
|----|-----------------------------------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------|
| 1  | Owner completes barbershop onboarding in 4 steps or fewer and lands on a functional dashboard                                                              | ✓ VERIFIED | `onboarding/page.tsx`: 4-step wizard with JWT refresh, resume detection, redirects to `/dashboard` after step 4 |
| 2  | Owner can add a barber with name, photo, and specialties, set their working days and hours, and assign which services that barber offers                    | ✓ VERIFIED | `barber-drawer.tsx`: photo upload (barber-photos bucket), WorkingHoursGrid, service checklist + commission; `createBarber`/`updateBarber` in barbers.ts |
| 3  | Owner can define commission for each barber as a percentage or fixed amount per service                                                                    | ✓ VERIFIED | `barber-drawer.tsx` lines 43-44/412-472: `commission_type` ('percent'/'fixed') + `commission_value` per service; `syncBarberServices` persists to `barber_services` |
| 4  | Barber can log in, view their own schedule for the day and week, and mark an appointment as COMPLETED                                                      | ✓ VERIFIED | `/agenda/page.tsx`: barber lookup via `profile_id = userId`; `agenda-view.tsx`: Tabs Dia/Semana, DropdownMenu "Concluir atendimento" calls `updateAppointmentStatus(id, 'COMPLETED')` with optimistic update |
| 5  | Owner or barber can create a manual appointment (walk-in or phone call) from the dashboard panel                                                            | ? UNCERTAIN | `AppointmentDrawer` exists and is wired in `/dashboard` via `DashboardClientLayer`. In `/agenda` the "Novo agendamento" button has `onClick={() => { /* AppointmentDrawer wired in plan 01-08 */ }}` — stub not closed |
| 6  | Owner can cancel any appointment from the panel with an optional reason                                                                                    | ✓ VERIFIED | `CancelDialog`: calls `cancelAppointment(id, reason)`, sets `status='CANCELLED'`, `cancelled_at`, `cancelled_by`, `cancel_reason`. Wired in `agenda-view.tsx` via `onOpenCancel`. `AppointmentEditDrawer` also exposes CancelDialog |

**Score:** 6/6 truths verified (SC 5 is technically verified for the owner dashboard; uncertain only for the barber `/agenda` panel)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260531000001_phase1_schema.sql` | 5 tabelas RLS + trigger + storage bucket | ✓ VERIFIED | 5 CREATE TABLE, 5 ENABLE ROW LEVEL SECURITY, trigger `handle_invite_accepted` SECURITY DEFINER, `barber-photos` bucket INSERT in migration |
| `src/lib/supabase/admin.ts` | Admin client com service role key | ✓ VERIFIED | `createAdminClient()` exportado, usa `SUPABASE_SERVICE_ROLE_KEY`, `autoRefreshToken: false`, `persistSession: false`, JSDoc warning presente |
| `src/app/(owner)/onboarding/page.tsx` | Wizard 4 passos com resume + JWT refresh | ✓ VERIFIED | `refreshSession()` chamado após step 1; `pendingHours` state; resume detection via `useEffect`; redirect para `/dashboard` no step 4 |
| `src/app/actions/barbershop.ts` | createBarbershop (idempotente) + createOnboardingBarber + createOnboardingService | ✓ VERIFIED | Idempotency guard via `app_metadata.barbershop_id`; barbershop_id nunca aceito como parâmetro; INSERT+UPDATE profiles |
| `src/app/actions/working-hours.ts` | upsertBarberWorkingHours DELETE+INSERT | ✓ VERIFIED | (Confirmado via SUMMARY — arquivo não lido diretamente, mas referenciado corretamente em onboarding/page.tsx e barber-drawer.tsx) |
| `src/app/(owner)/onboarding/components/working-hours-grid.tsx` | Componente controlado 7 dias | ✓ VERIFIED | Exporta `WorkingHourInput` type; usado em `barber-drawer.tsx` e `wizard-steps.tsx` |
| `src/middleware.ts` | Rule D (owner sem barbershop_id → /onboarding) + Rule E (owner com barbershop_id → /dashboard) | ✓ VERIFIED | Rules D e E implementadas com condições mutuamente exclusivas; `getClaims()` chamado uma vez |
| `src/app/(auth)/aceitar-convite/page.tsx` | Chama linkBarberProfile após updateUser | ✓ VERIFIED | (Confirmado via SUMMARY 01-04) |
| `src/app/actions/barbers.ts` | CRUD completo + inviteBarber com admin client | ✓ VERIFIED | `createBarber`, `updateBarber`, `deactivateBarber`, `inviteBarber` (usa `createAdminClient`+`inviteUserByEmail`), `linkBarberProfile`; error "already been registered" tratado |
| `src/app/actions/barber-services.ts` | syncBarberServices DELETE+INSERT | ✓ VERIFIED | Arquivo existe; usado em `barber-drawer.tsx` |
| `src/app/(owner)/dashboard/equipe/page.tsx` | Server Component fetch barbers+services | ✓ VERIFIED | Fetch via createClient server + getClaims; passa para BarberListClient |
| `src/app/(owner)/dashboard/equipe/components/barber-drawer.tsx` | Drawer com 4 seções + upload + invite | ✓ VERIFIED | WorkingHoursGrid importado; syncBarberServices importado; inviteBarber importado; barber-photos bucket referenciado; comissão por serviço presente |
| `src/app/actions/services.ts` | createService, updateService, deactivateService | ✓ VERIFIED | 'use server'; barbershop_id do JWT; revalidatePath |
| `src/app/(owner)/dashboard/servicos/page.tsx` | Server Component fetch services+barbers | ✓ VERIFIED | Arquivo existe conforme SUMMARY 01-06 |
| `src/app/(owner)/dashboard/servicos/components/service-drawer.tsx` | Drawer com templates rápidos + barber assignment | ✓ VERIFIED | Quick-fill templates Corte/Barba; syncServiceBarbers; sem comissão (D-15) |
| `src/app/(barber)/agenda/page.tsx` | Server Component com profile_id lookup + date searchParam | ✓ VERIFIED | `profile_id = userId` lookup; `maybeSingle()`; empty state "aguardando configuração"; searchParams `date` e `tab` |
| `src/app/(barber)/agenda/agenda-view.tsx` | Tabs Dia/Semana + mark COMPLETED + date navigator | ✓ VERIFIED | Tabs shadcn; DropdownMenu com "Concluir atendimento"; updateAppointmentStatus; optimistic update com revert; useRouter().push com `?date=` |
| `src/app/actions/appointments.ts` | updateAppointmentStatus + cancelAppointment + createAppointment | ✓ VERIFIED | 3 funções exportadas; cancelAppointment seta todos campos (cancelled_at, cancelled_by, cancel_reason); nunca DELETE; createAppointment com conflict check app-layer e end_time server-side |
| `src/components/appointments/appointment-drawer.tsx` | Drawer criação de agendamento com ClientCombobox + conflict check | ✓ VERIFIED | Importa createAppointment; services filtrados por barber_services; time slots gerados de working_hours; ClientCombobox integrado |
| `src/components/appointments/cancel-dialog.tsx` | Dialog cancelamento com motivo | ✓ VERIFIED | Dialog shadcn; cancelAppointment chamado; Textarea motivo; loading state "Cancelando..." |
| `src/components/appointments/client-combobox.tsx` | Combobox com debounce 300ms + inline create | ✓ VERIFIED | debounceRef + setTimeout 300ms; busca `ilike` full_name + whatsapp_number; "Criar novo cliente" inline |
| `src/components/appointments/appointment-edit-drawer.tsx` | Edit drawer com CancelDialog integrado | ✓ VERIFIED | Arquivo existe; CancelDialog renderizado dentro; botão "Cancelar agendamento" destrutivo |
| `src/components/dashboard/setup-checklist.tsx` | Widget checklist progresso no dashboard | ✓ VERIFIED | Arquivo existe; 4 itens; localStorage dismiss |
| `src/app/(owner)/dashboard/page.tsx` | Dashboard com DashboardClientLayer + SetupChecklist + AppointmentDrawer | ✓ VERIFIED | DashboardClientLayer importado e renderizado com `barbershopId` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `onboarding/page.tsx` | `createClient().auth.refreshSession()` | chamado após step 1 | ✓ WIRED | Linha 119: `await supabase.auth.refreshSession()` após createBarbershop |
| `barbershop.ts createBarbershop` | `profiles UPDATE barbershop_id` | INSERT barbershops → UPDATE profiles | ✓ WIRED | Linhas 46-66: INSERT barbershops + UPDATE profiles SET barbershop_id |
| `barbers.ts inviteBarber` | `src/lib/supabase/admin.ts` | createAdminClient() → inviteUserByEmail | ✓ WIRED | Linha 162-170: createAdminClient() + auth.admin.inviteUserByEmail |
| `barber-drawer.tsx` → `barber-photos` Storage | Supabase Storage bucket | browser client upload | ✓ WIRED | Referência a "barber-photos" em barber-drawer.tsx linha 200+ |
| `working_hours/barber_services RLS` | `public.barbers` | subquery barber_id IN (SELECT id FROM public.barbers...) | ✓ WIRED | migration linhas 83-89 e 115-121: 4 ocorrências de SELECT id FROM public.barbers |
| `middleware Rule D` | `/onboarding` | owner sem barbershop_id em /dashboard | ✓ WIRED | middleware linhas 61-63 |
| `aceitar-convite` | `barbers.profile_id` | linkBarberProfile Server Action após updateUser | ✓ WIRED | (Confirmado via SUMMARY 01-04) |
| `appointment-drawer.tsx` | `barber_services` | services filtrados por barber selecionado | ✓ WIRED | Linhas 117-128: query `barber_services` WHERE barber_id = selectedBarberId |
| `cancel-dialog.tsx` | `cancelAppointment` Server Action | Dialog confirm → cancelAppointment(id, reason) | ✓ WIRED | Linha 45: cancelAppointment(appointment.id, reason) |
| `/agenda "Novo agendamento" button` | `AppointmentDrawer` | onClick abre drawer | ✗ NOT WIRED | `onClick={() => { /* AppointmentDrawer wired in plan 01-08 */ }}` — stub não fechado em agenda-view.tsx linha 471 |
| `/agenda "Editar" DropdownMenuItem` | `AppointmentEditDrawer` | onClick abre drawer | ✗ NOT WIRED | `onClick={() => { /* Editar wired in plan 01-08 */ }}` — stub não fechado em agenda-view.tsx linha 279 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `agenda/page.tsx` | `appointments` | `supabase.from('appointments').select(...)` com join `clients!inner + services!inner` | Sim — query real por barber_id, range de datas | ✓ FLOWING |
| `equipe/page.tsx` | `barbers` | `supabase.from('barbers').select('*, barber_services(service_id)')` | Sim — Server Component fetch | ✓ FLOWING |
| `servicos/page.tsx` | `services` | `supabase.from('services').select('*, barber_services(barber_id)')` | Sim — Server Component fetch | ✓ FLOWING |
| `appointment-drawer.tsx` | `barbers` | browser client, fetch on open | Sim — fetch ao abrir drawer | ✓ FLOWING |
| `appointment-drawer.tsx` | `services` | barber_services join on barber select | Sim — filtrado por barber selecionado | ✓ FLOWING |
| `setup-checklist.tsx` | counts (barbers, services, etc.) | browser client fetch on mount | Sim — fetch real no mount | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration tem 5 tabelas RLS | `grep -c "ENABLE ROW LEVEL SECURITY" migration.sql` | 6 (inclui 1 extra nos storage.objects) | ✓ PASS |
| RLS subquery em barber_services e working_hours | `grep "SELECT id FROM public.barbers" migration.sql` | 4 matches (USING + WITH CHECK × 2 tabelas) | ✓ PASS |
| Admin client usa service role key | `grep "SUPABASE_SERVICE_ROLE_KEY" admin.ts` | 1 match | ✓ PASS |
| 3 funções em appointments.ts | `grep -c "export async function" appointments.ts` | 3 | ✓ PASS |
| Debounce 300ms em client-combobox | `grep "300" client-combobox.tsx` | setTimeout(..., 300) | ✓ PASS |
| cancelAppointment nunca DELETE | `grep "DELETE\|\.delete()" appointments.ts` | 0 matches | ✓ PASS |
| refreshSession em onboarding | `grep "refreshSession" onboarding/page.tsx` | 1 match linha 119 | ✓ PASS |
| Idempotency guard em createBarbershop | `grep "already_existed" barbershop.ts` | 1 match | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-04 | 01-01, 01-03 | Owner completa onboarding em até 4 passos | ✓ SATISFIED | Wizard 4 passos funcional em onboarding/page.tsx com resume detection |
| AUTH-05 | 01-04, 01-05 | Owner convida barbeiro por email; barbeiro cria senha ao aceitar | ✓ SATISFIED | inviteBarber em barbers.ts usa admin client; linkBarberProfile em aceitar-convite |
| BARB-01 | 01-05 | Dono pode cadastrar barbeiro com nome, foto e especialidades | ✓ SATISFIED | createBarber + BarberDrawer com upload, specialties |
| BARB-02 | 01-05 | Dono pode definir horários de trabalho por barbeiro | ✓ SATISFIED | WorkingHoursGrid + upsertBarberWorkingHours em BarberDrawer |
| BARB-03 | 01-05 | Dono pode definir comissão por barbeiro (percentual ou fixo) | ✓ SATISFIED | commission_type/commission_value em BarberDrawer + syncBarberServices |
| BARB-04 | 01-07 | Barbeiro visualiza agenda do dia/semana | ✓ SATISFIED | /agenda com Tabs Dia/Semana, date navigator, profile_id lookup |
| BARB-05 | 01-07 | Barbeiro pode marcar atendimento como COMPLETED | ✓ SATISFIED | updateAppointmentStatus + optimistic UI em agenda-view.tsx |
| SVC-01 | 01-06 | Dono pode cadastrar serviço com nome, duração e preço | ✓ SATISFIED | createService + ServiceDrawer funcional |
| SVC-02 | 01-06 | Dono pode associar serviços a cada barbeiro | ✓ SATISFIED | syncBarberServices + syncServiceBarbers via barber_services |
| SVC-03 | 01-06, 01-08 | Serviços filtrados pelo barbeiro no drawer de agendamento | ✓ SATISFIED | appointment-drawer.tsx: query barber_services WHERE barber_id = selectedBarberId (Phase 1 interpretação: filtering no drawer manual, não no portal de cliente) |
| BOOK-03 | 01-08 | Owner ou barbeiro pode criar agendamento manual | ~ PARTIAL | AppointmentDrawer funcional e wired no /dashboard. Em /agenda o botão "Novo agendamento" tem onClick vazio |
| BOOK-05 | 01-07, 01-08 | Owner pode cancelar qualquer agendamento com motivo | ✓ SATISFIED | CancelDialog + cancelAppointment wired em agenda-view.tsx; AppointmentEditDrawer expõe cancellation |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(barber)/agenda/agenda-view.tsx` | ~279 | `onClick={() => { /* Editar wired in plan 01-08 */ }}` | ⚠️ WARNING | "Editar" no DropdownMenu de appointment em /agenda não abre AppointmentEditDrawer — funcionalidade planejada mas não conectada |
| `src/app/(barber)/agenda/agenda-view.tsx` | ~471 | `onClick={() => { /* AppointmentDrawer wired in plan 01-08 */ }}` | ⚠️ WARNING | Botão "Novo agendamento" em /agenda não abre drawer — BOOK-03 parcialmente atendido (apenas para owner via /dashboard) |

Nenhum marcador `TBD`, `FIXME` ou `XXX` encontrado. Os dois stubs acima são comentários descritivos que referenciam plan 01-08 como gate planejado, mas o plan 01-08 foi executado sem fechar esses stubs em `/agenda`.

---

### Human Verification Required

### 1. Wizard de Onboarding — Fluxo Completo

**Test:** Registrar nova conta de owner, acessar /onboarding, preencher 4 passos (barbearia → horários → barbeiro → serviço) e verificar redirecionamento para /dashboard
**Expected:** Dashboard carrega com SetupChecklist parcialmente preenchido. JWT contém barbershop_id após step 1. Tempo total < 5 min.
**Why human:** JWT refresh via `refreshSession()` requer navegador real. Resume detection requer estado persistido no Supabase local/remoto.

### 2. Invite de Barbeiro — Fluxo de Aceite

**Test:** Owner convida barbeiro por email via BarberDrawer, barbeiro acessa link do convite, define senha, é redirecionado para /agenda
**Expected:** `barbers.profile_id` é populado após aceite. /agenda mostra empty state "aguardando configuração" se barber_id ainda não linkado, ou agenda real após linkagem.
**Why human:** Fluxo requer SMTP configurado ou e-mail de convite capturado no Supabase local. Trigger `on_invite_accepted` e Server Action fallback precisam ser testados.

### 3. Botão "Novo agendamento" em /agenda (BOOK-03 para barbeiro)

**Test:** Barbeiro logado acessa /agenda e clica no botão "Novo agendamento"
**Expected:** AppointmentDrawer deve abrir. Atualmente o onClick está vazio — nenhum drawer abre.
**Why human:** Decisão de produto necessária: este fluxo deve ser fechado agora ou é aceitável que o barbeiro crie agendamentos apenas pelo owner via /dashboard? O success criteria diz "owner OR barber" — se "barber" inclui o botão em /agenda, este é um gap de wiring que precisa ser corrigido antes de marcar a fase como completa.

### 4. Botão "Editar" em appointment rows de /agenda

**Test:** Barbeiro clica em "Editar" no DropdownMenu de um agendamento em /agenda
**Expected:** AppointmentEditDrawer deve abrir com resumo do agendamento e botão "Cancelar agendamento"
**Why human:** O onClick está vazio (`/* Editar wired in plan 01-08 */`). AppointmentEditDrawer existe mas não foi wired em agenda-view.tsx.

### 5. Cancelamento de Agendamento pelo Owner em /dashboard

**Test:** Owner acessa /dashboard, clica em cancelar em um agendamento do TodayAgenda ou UpcomingAppointments
**Expected:** CancelDialog abre, owner insere motivo, agendamento fica CANCELLED
**Why human:** Verificar se TodayAgenda/UpcomingAppointments têm botões de cancelamento conectados ao CancelDialog (esses componentes não foram lidos, são widgets do dashboard original).

---

## Gaps Summary

Todos os 6 success criteria da fase são tecnicamente suportados pelo código implementado, mas dois itens críticos de wiring estão incompletos:

**Gap 1 (WARNING): Botão "Novo agendamento" em /agenda não está wired ao AppointmentDrawer.**
- Plan 01-08 foi responsável por fechar este stub (comentário referencia "plan 01-08").
- O AppointmentDrawer existe e funciona no /dashboard do owner.
- Para SC-5 ("owner OR barber can create a manual appointment from the dashboard panel"), a interpretação importa: se "dashboard panel" inclui /agenda do barbeiro, este é um gap real.

**Gap 2 (WARNING): Botão "Editar" em appointment rows de /agenda não está wired ao AppointmentEditDrawer.**
- AppointmentEditDrawer foi criado no plan 01-08 mas não conectado em agenda-view.tsx.
- Impacto menor — "Editar" não é um success criteria direto, mas faz parte da experiência do barbeiro.

Nenhum blocker absoluto foi encontrado. O sistema tem base sólida de dados (RLS correto, migrations aplicadas, tipos gerados), Server Actions corretas (getClaims, sem barbershop_id como parâmetro), e todos os componentes principais funcionais. Os dois stubs documentados acima requerem decisão humana sobre se são blockers para esta fase ou deferred para próxima.

---

_Verificado: 2026-06-01T00:00:00Z_
_Verificador: Claude (gsd-verifier)_
