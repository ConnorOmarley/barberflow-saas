# Phase 4: Loyalty — Carimbo Digital — Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 6 (1 migration, 2 Server Actions files, 3 components)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/YYYYMMDD_phase4_schema.sql` | migration | CRUD | `supabase/migrations/20260601000001_phase2_schema.sql` + `20260602000001_phase3_schema.sql` | exact |
| `src/app/actions/loyalty.ts` | service | CRUD | `src/app/actions/services.ts` + `src/app/actions/barbers.ts` | exact |
| `src/app/(owner)/dashboard/fidelidade/page.tsx` | component (Server) | request-response | `src/app/(owner)/dashboard/servicos/page.tsx` | exact |
| `src/app/(owner)/dashboard/fidelidade/components/loyalty-config.tsx` | component (Client) | request-response | `src/app/(owner)/dashboard/servicos/components/service-drawer.tsx` | exact |
| `src/app/(owner)/dashboard/fidelidade/components/loyalty-card-list.tsx` | component (Client) | CRUD | `src/app/(owner)/dashboard/equipe/components/barber-list-client.tsx` | role-match |
| `src/app/actions/appointments.ts` (modificação) | service | CRUD | `src/app/actions/appointments.ts` (self) | self |

---

## Pattern Assignments

### `supabase/migrations/YYYYMMDD_phase4_schema.sql` (migration, CRUD)

**Analogs:** `supabase/migrations/20260531000001_phase1_schema.sql` (RLS com barbershop_id direto) e `supabase/migrations/20260602000001_phase3_schema.sql` (RLS via subquery FK)

**Header comment pattern** (phase1 lines 1-9):
```sql
-- ============================================================
-- BarberFlow Phase 4 — Loyalty Schema
-- Migration: YYYYMMDD_phase4_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================
```

**Tabela com barbershop_id direto + RLS** (phase1 lines 15-37):
```sql
CREATE TABLE public.loyalty_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  stamps_required INT  NOT NULL DEFAULT 10,
  reward_description TEXT NOT NULL DEFAULT 'Corte grátis',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_loyalty_rules_all" ON public.loyalty_rules
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

**Tabela com isolamento via subquery FK** (phase3 lines 68-75 — padrão para loyalty_stamps e loyalty_redemptions, que têm barbershop_id via client_id ou appointment_id):
```sql
-- Opção A: adicionar barbershop_id direto (preferido — mais simples e performático)
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_loyalty_stamps_all" ON public.loyalty_stamps
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

**Constraint UNIQUE para evitar double-stamp** (phase3 lines 44-45 como referência de unique index):
```sql
-- Previne stamp duplicado para o mesmo appointment
CREATE UNIQUE INDEX loyalty_stamps_appointment_id_idx
  ON public.loyalty_stamps (appointment_id);
```

---

### `src/app/actions/loyalty.ts` (service, CRUD)

**Analog principal:** `src/app/actions/services.ts` (getBarbershopId helper + adminClient pattern)
**Analog secundário:** `src/app/actions/barbers.ts` (getAuthContext helper com userId + barbershopId)

**CRITICAL — Padrao de autenticacao obrigatorio** (barbers.ts lines 9-36):

O projeto usa **dois padroes distintos** de Server Action. A MEMORY.md confirma:
- `adminClient + profiles.barbershop_id` — **nunca JWT app_metadata** para Server Actions que escrevem dados.
- `try-catch` obrigatorio em todas as acoes.

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Helper de autenticação (copiar de barbers.ts) ────────────────────────────
async function getAuthContext(): Promise<
  { userId: string; barbershopId: string } | { error: string }
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return { error: 'Não autenticado' }

    const userId = data.claims.sub as string | undefined
    if (!userId) return { error: 'Usuário não encontrado' }

    // CRÍTICO: ler barbershop_id de profiles, NÃO do JWT app_metadata
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('barbershop_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.barbershop_id) {
      return { error: 'Barbearia não configurada' }
    }

    return { userId, barbershopId: profile.barbershop_id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro de autenticação' }
  }
}
```

**Core CRUD pattern — upsertLoyaltyRule** (services.ts lines 26-48 como base):
```typescript
export async function upsertLoyaltyRule(data: {
  stamps_required: number
  reward_description: string
}): Promise<{ data: { id: string } } | { error: string }> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data: rule, error } = await admin
      .from('loyalty_rules')
      .upsert(
        {
          barbershop_id: ctx.barbershopId,
          stamps_required: data.stamps_required,
          reward_description: data.reward_description,
          is_active: true,
        },
        { onConflict: 'barbershop_id' }
      )
      .select('id')
      .single()

    if (error || !rule) return { error: error?.message ?? 'Erro ao salvar regra' }
    revalidatePath('/dashboard/fidelidade')
    return { data: rule }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

**Core CRUD pattern — getLoyaltyRule** (services.ts lines 50-71 como base):
```typescript
export async function getLoyaltyRule(): Promise<
  { data: LoyaltyRule } | { error: string }
> {
  try {
    const ctx = await getAuthContext()
    if ('error' in ctx) return ctx

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('loyalty_rules')
      .select('*')
      .eq('barbershop_id', ctx.barbershopId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

**Error handling obrigatorio** (barbers.ts lines 71-96):
```typescript
// Sempre try-catch envolvendo toda a funcao
// Retorno padrao: { data: ... } | { error: string }
// Nunca throw — sempre retornar { error: string }
export async function createStamp(...): Promise<{ success: true } | { error: string }> {
  try {
    // ...
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

---

### `src/app/(owner)/dashboard/fidelidade/page.tsx` (Server Component, request-response)

**Analog:** `src/app/(owner)/dashboard/servicos/page.tsx`

**Imports pattern** (servicos/page.tsx lines 1-6):
```typescript
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'
import { FidelidadeClient } from './components/loyalty-card-list'
```

**Auth + redirect guard** (servicos/page.tsx lines 12-21):
```typescript
export default async function FidelidadePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')
```

**displayName derivado de profile** (servicos/page.tsx lines 38-48):
```typescript
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', claims.sub as string)
    .maybeSingle()

  const handle = email.split('@')[0] ?? 'Dono'
  const derived = handle.split(/[._-]/)[0]
  const displayName =
    profile?.full_name?.trim() ||
    derived.charAt(0).toUpperCase() + derived.slice(1)
```

**Fetch de dados + DashboardShell** (servicos/page.tsx lines 22-58):
```typescript
  // Fetch loyalty rule
  const { data: loyaltyRule } = await supabase
    .from('loyalty_rules')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .maybeSingle()

  // Fetch clients with stamp counts
  const { data: clients } = await supabase
    .from('clients')
    .select('*, loyalty_stamps(count)')
    .eq('barbershop_id', barbershop_id)
    .order('full_name')

  return (
    <DashboardShell displayName={displayName} email={email}>
      <FidelidadeClient
        loyaltyRule={loyaltyRule ?? null}
        clients={clients ?? []}
      />
    </DashboardShell>
  )
}
```

---

### `src/app/(owner)/dashboard/fidelidade/components/loyalty-config.tsx` (Client Component, formulário)

**Analog:** `src/app/(owner)/dashboard/servicos/components/service-drawer.tsx` (usa React Hook Form + Zod + Sheet)

**Imports pattern com RHF + Zod** (service-drawer.tsx lines 1-33):
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { upsertLoyaltyRule } from '@/app/actions/loyalty'
```

**Zod schema pattern** (service-drawer.tsx lines 51-57):
```typescript
const loyaltyConfigSchema = z.object({
  stamps_required: z.coerce.number().min(1, 'Mínimo 1 carimbo').max(50, 'Máximo 50 carimbos'),
  reward_description: z.string().min(1, 'Descrição é obrigatória').max(200),
})

type LoyaltyConfigValues = z.infer<typeof loyaltyConfigSchema>
```

**Form com useEffect para popular dados ao abrir** (service-drawer.tsx lines 95-112):
```typescript
useEffect(() => {
  if (open) {
    setErrorMessage(null)
    if (rule) {
      form.reset({
        stamps_required: rule.stamps_required,
        reward_description: rule.reward_description,
      })
    } else {
      form.reset({ stamps_required: 10, reward_description: 'Corte grátis' })
    }
  }
}, [open, rule, form])
```

**onSubmit pattern com error display** (service-drawer.tsx lines 134-172):
```typescript
async function onSubmit(values: LoyaltyConfigValues) {
  setErrorMessage(null)
  const result = await upsertLoyaltyRule(values)
  if ('error' in result) {
    setErrorMessage(result.error)
    return
  }
  onSaved()
}
```

**Error Alert pattern** (service-drawer.tsx lines 203-207):
```typescript
{errorMessage && (
  <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
    <AlertDescription>{errorMessage}</AlertDescription>
  </Alert>
)}
```

**Footer com botao Salvar** (service-drawer.tsx lines 359-384):
```typescript
<SheetFooter className="border-t border-white/[0.06]">
  <Button
    type="button"
    variant="ghost"
    onClick={() => onOpenChange(false)}
    disabled={isSubmitting}
  >
    Fechar
  </Button>
  <Button
    type="submit"
    form="loyalty-config-form"
    className="bg-[#d4a574] font-semibold text-[#0b0f17] hover:bg-[#c8995f]"
    disabled={isSubmitting}
  >
    {isSubmitting ? (
      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
    ) : (
      'Salvar configuração'
    )}
  </Button>
</SheetFooter>
```

---

### `src/app/(owner)/dashboard/fidelidade/components/loyalty-card-list.tsx` (Client Component, lista)

**Analog:** `src/app/(owner)/dashboard/equipe/components/barber-list-client.tsx`

**Shell pattern** (barber-list-client.tsx lines 1-18):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoyaltyConfigSheet } from './loyalty-config'
// Tipos locais — evitar import cycle Server<->Client
type LoyaltyRule = { id: string; stamps_required: number; reward_description: string }
type ClientWithStamps = { id: string; full_name: string; stamp_count: number }

interface LoyaltyCardListProps {
  loyaltyRule: LoyaltyRule | null
  clients: ClientWithStamps[]
}
```

**useState para drawer + handlers** (barber-list-client.tsx lines 20-38):
```typescript
export function LoyaltyCardList({ loyaltyRule, clients }: LoyaltyCardListProps) {
  const [configOpen, setConfigOpen] = useState(false)

  function handleSaved() {
    setConfigOpen(false)
    // Server Component atualiza via revalidatePath na Server Action
  }
```

**Header com botao de acao** (barber-list-client.tsx lines 40-53):
```typescript
  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
          Fidelidade
        </h1>
        <Button
          onClick={() => setConfigOpen(true)}
          className="h-10 gap-2 bg-amber-600 text-black hover:bg-amber-500 font-semibold"
        >
          Configurar regra
        </Button>
      </header>
```

**Empty state pattern** (barber-list-client.tsx lines 56-75):
```typescript
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-[0.9375rem] font-semibold text-foreground">
            Nenhum cliente com carimbos ainda
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Os carimbos aparecem automaticamente ao concluir agendamentos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientLoyaltyCard key={client.id} client={client} rule={loyaltyRule} />
          ))}
        </div>
      )}
```

---

### `src/app/actions/appointments.ts` — modificação: `createStampOnComplete` (service, CRUD)

**Analog:** o proprio `src/app/actions/appointments.ts` — adicionar chamada interna apos update bem-sucedido.

**Ponto de insercao** — dentro de `updateAppointmentStatus`, apos o update bem-sucedido (appointments.ts lines 26-39):
```typescript
// Inserir APOS o .update() e ANTES do revalidatePath
// appointments.ts — updateAppointmentStatus:

  const { error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('barbershop_id', barbershop_id)

  if (error) return { error: error.message }

  // NOVO: auto-stamp quando status = COMPLETED
  if (status === 'COMPLETED') {
    await createStampOnComplete(appointmentId, barbershop_id)
    // fire-and-forget — falha silenciosa para nao bloquear o status update
  }

  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/fidelidade') // NOVO
  return { success: true }
```

**createStampOnComplete — funcao helper interna** (padrao de services.ts helper `getBarbershopId`):
```typescript
// Nao exportar — uso interno apenas
async function createStampOnComplete(
  appointmentId: string,
  barbershop_id: string
): Promise<void> {
  try {
    const admin = createAdminClient()

    // Buscar client_id e loyalty_rule do appointment
    const { data: appt } = await admin
      .from('appointments')
      .select('client_id')
      .eq('id', appointmentId)
      .single()

    if (!appt) return

    // Verificar se ja existe stamp (unique index garante — mas verifica por seguranca)
    const { error: stampError } = await admin
      .from('loyalty_stamps')
      .insert({
        barbershop_id,
        appointment_id: appointmentId,
        client_id: appt.client_id,
        // NÃO incluir stamped_at — campo não existe no schema; usar created_at (DEFAULT NOW())
      })

    // unique violation (23505) = stamp ja existe — ignorar silenciosamente
    if (stampError && !stampError.code?.includes('23505')) {
      console.error('[loyalty] stamp insert error:', stampError.message)
    }
  } catch (err) {
    console.error('[loyalty] createStampOnComplete error:', err)
  }
}
```

---

## Shared Patterns

### Autenticacao e barbershop_id (CRITICO — ver MEMORY.md)

**Source:** `src/app/actions/barbers.ts` (getAuthContext, lines 9-36)
**Apply to:** `loyalty.ts` — toda Server Action que lê ou escreve dados de tenant

```typescript
// OBRIGATORIO: ler barbershop_id de profiles via adminClient
// NUNCA usar JWT app_metadata como fonte primaria em Server Actions que escrevem
const admin = createAdminClient()
const { data: profile } = await admin
  .from('profiles')
  .select('barbershop_id')
  .eq('id', userId)
  .single()
```

**EXCECAO:** `updateAppointmentStatus` ja tem `barbershop_id` do JWT porque e uma funcao existente — nao alterar o padrao dela. O helper interno `createStampOnComplete` recebe `barbershop_id` como parametro.

### Error Handling

**Source:** `src/app/actions/services.ts` e `src/app/actions/barbers.ts`
**Apply to:** Todas as funcoes em `loyalty.ts`

```typescript
// Padrao uniforme de retorno
export async function nomeDaAcao(...): Promise<{ data: X } | { error: string }> {
  try {
    // ...
    if (error) return { error: error.message }
    return { data: result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
```

### RLS em Migrations

**Source:** `supabase/migrations/20260531000001_phase1_schema.sql` (lines 28-37)
**Apply to:** Todas as tabelas da migration da Fase 4

```sql
-- Padrao obrigatorio pos-CREATE TABLE:
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_<tabela>_all" ON public.<tabela>
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```

### revalidatePath

**Source:** `src/app/actions/services.ts` (line 43) e `src/app/actions/appointments.ts` (lines 37-38)
**Apply to:** Todas as Server Actions que mutam dados de loyalty

```typescript
revalidatePath('/dashboard/fidelidade')
// Tambem revalidar /dashboard quando houver impact nos stats gerais
```

### Componentes shadcn/ui em uso (sem asChild)

**Source:** `src/app/(owner)/dashboard/servicos/components/service-drawer.tsx`
**Apply to:** `loyalty-config.tsx` e `loyalty-card-list.tsx`

Componentes confirmados no projeto (nao usar asChild em nenhum):
- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetFooter`
- `Button`, `Input`, `Label`, `Separator`
- `Alert`, `AlertDescription`
- `Form`, `FormControl`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`

---

## No Analog Found

Nenhum arquivo da Fase 4 fica sem analog. Todos os padrões estão cobertos por analogs existentes.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/app/(owner)/dashboard/`, `supabase/migrations/`
**Files scanned:** 9 arquivos lidos integralmente
**Pattern extraction date:** 2026-06-02
