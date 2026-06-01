# Phase 1: Owner Onboarding + Barber & Service Setup — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 18 (new/modified files from CONTEXT.md + RESEARCH.md)
**Analogs found:** 16 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260531000001_phase1_schema.sql` | migration | CRUD | `supabase/migrations/20260529000001_initial_schema.sql` | exact |
| `src/lib/supabase/admin.ts` | utility | request-response | `src/lib/supabase/server.ts` | role-match |
| `src/middleware.ts` (modify) | middleware | request-response | `src/middleware.ts` | exact (self) |
| `src/app/(owner)/onboarding/page.tsx` | component | request-response | `src/app/(auth)/cadastro/page.tsx` | role-match |
| `src/app/(owner)/onboarding/components/wizard-steps.tsx` | component | request-response | `src/app/(auth)/aceitar-convite/page.tsx` | role-match |
| `src/app/(owner)/onboarding/components/working-hours-grid.tsx` | component | CRUD | `src/app/(auth)/cadastro/page.tsx` | partial-match |
| `src/app/(owner)/dashboard/equipe/page.tsx` | component | CRUD | `src/app/(owner)/dashboard/page.tsx` | exact |
| `src/app/(owner)/dashboard/equipe/components/barber-drawer.tsx` | component | CRUD | `src/app/(auth)/aceitar-convite/page.tsx` | role-match |
| `src/app/(owner)/dashboard/servicos/page.tsx` | component | CRUD | `src/app/(owner)/dashboard/page.tsx` | exact |
| `src/app/(owner)/dashboard/servicos/components/service-drawer.tsx` | component | CRUD | `src/app/(auth)/aceitar-convite/page.tsx` | role-match |
| `src/app/(barber)/agenda/page.tsx` (fill) | component | CRUD | `src/app/(owner)/dashboard/page.tsx` | role-match |
| `src/app/actions/barbershop.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/actions/barbers.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/actions/services.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/actions/barber-services.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/actions/working-hours.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/actions/appointments.ts` | service | CRUD | `src/app/actions/auth.ts` | role-match |
| `src/app/(auth)/aceitar-convite/page.tsx` (modify) | component | request-response | `src/app/(auth)/aceitar-convite/page.tsx` | exact (self) |
| `src/components/appointments/appointment-drawer.tsx` | component | CRUD | `src/app/(auth)/aceitar-convite/page.tsx` | role-match |
| `src/components/appointments/cancel-dialog.tsx` | component | request-response | `src/app/(auth)/aceitar-convite/page.tsx` | role-match |
| `src/components/appointments/client-combobox.tsx` | component | request-response | no analog | none |
| `src/components/dashboard/setup-checklist.tsx` | component | request-response | `src/components/dashboard/primitives.tsx` | role-match |
| `src/components/shell/dashboard-shell.tsx` (modify) | component | request-response | `src/components/shell/dashboard-shell.tsx` | exact (self) |
| `src/types/database.types.ts` (regenerate) | config | — | `src/types/database.types.ts` | exact (self) |

---

## Pattern Assignments

### `supabase/migrations/20260531000001_phase1_schema.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260529000001_initial_schema.sql`

**Header comment pattern** (lines 1–9):
```sql
-- ============================================================
-- BarberFlow Phase 1 — [Description]
-- Migration: 20260531000001_phase1_schema.sql
--
-- MULTI-TENANCY CONTRACT:
--   Every table has ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE.
--   All RLS policies read barbershop_id from JWT app_metadata (not user_metadata).
--   Cast is always explicit: (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
-- ============================================================
```

**Direct barbershop_id RLS pattern** (lines 25–36, used for tables with direct barbershop_id column):
```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_<table>_all" ON public.<table_name>
  FOR ALL TO authenticated
  USING (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  )
  WITH CHECK (
    barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
  );
```
Apply to: `barbers`, `services`, `appointments`

**Subquery RLS pattern** (for tables with no direct barbershop_id — join via barbers):
```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_<table>_all" ON public.<table_name>
  FOR ALL TO authenticated
  USING (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  )
  WITH CHECK (
    barber_id IN (
      SELECT id FROM public.barbers
      WHERE barbershop_id = (auth.jwt() -> 'app_metadata' ->> 'barbershop_id')::UUID
    )
  );
```
Apply to: `working_hours`, `barber_services`

**Trigger function pattern** (lines 123–148, SECURITY DEFINER with pinned search_path):
```sql
CREATE OR REPLACE FUNCTION public.handle_invite_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- guard condition
  IF (...) THEN
    UPDATE public.barbers
    SET profile_id = NEW.id
    WHERE id = (NEW.raw_user_meta_data->>'barber_id')::UUID
      AND profile_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_invite_accepted
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_accepted();
```

**Security hardening to add at end of migration** (from `20260530000004_security_hardening.sql`, lines 20–24):
```sql
ALTER FUNCTION public.handle_invite_accepted() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_invite_accepted()
  FROM public, anon, authenticated;
```

**ON CONFLICT idempotency pattern** (line 139):
```sql
ON CONFLICT (id) DO NOTHING;
```

---

### `src/lib/supabase/admin.ts` (utility, request-response)

**Analog:** `src/lib/supabase/server.ts`

**Imports pattern** (server.ts lines 1–3):
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
```

**Core pattern** — admin client is `createClient` (not `createServerClient`) with service role key, no cookie management, session disabled:
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```
Note: Unlike `server.ts` which uses `createServerClient` + cookies, admin uses bare `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`). No cookie setup needed.

---

### `src/middleware.ts` (modify — extend existing file)

**Analog:** `src/middleware.ts` (self)

**Existing pattern to preserve** (lines 1–57 — entire file):

All existing rules A, B, C remain. Add Rule D after Rule C (before `return response`):

**New Rule D — Onboarding guard** (insert after line 55):
```typescript
// Rule D — Owner without barbershop_id → redirect to /onboarding
// (one direction only — no inverse redirect to avoid loop before JWT refresh)
const barbershop_id = claims?.app_metadata?.barbershop_id as string | undefined
if (isOwnerRoute && role === 'owner' && !barbershop_id) {
  return NextResponse.redirect(new URL('/onboarding', request.url))
}

// Rule E — Owner with barbershop_id trying to access /onboarding → redirect to /dashboard
if (pathname.startsWith('/onboarding') && claims && !error && role === 'owner' && barbershop_id) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

**getClaims auth pattern** (lines 29–31 — reuse exactly):
```typescript
const { data, error } = await supabase.auth.getClaims()
const claims = data?.claims
const role = claims?.app_metadata?.role as string | undefined
```

**Matcher config** (lines 60–64 — add `/onboarding` to protected routes):
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/).*)',
  ],
}
```
Matcher already covers `/onboarding` — no change needed.

---

### `src/app/actions/barbershop.ts` (service, CRUD)

**Analog:** `src/app/actions/auth.ts`

**Imports pattern** (auth.ts lines 1–4):
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
```

**Auth guard pattern** — always re-read from getClaims, never trust client-passed values:
```typescript
const supabase = await createClient()
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
if (claimsError || !claimsData) return { error: 'Não autenticado' }

const userId = claimsData.claims.sub as string
const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
```

**Idempotency guard** (for createBarbershop specifically — prevent duplicate rows on wizard refresh):
```typescript
if (barbershop_id) {
  return { data: { barbershop_id, already_existed: true } }
}
```

**Core CRUD pattern** (insert + select single):
```typescript
const { data, error } = await supabase
  .from('barbershops')
  .insert({ name: data.name, slug, timezone: data.timezone })
  .select()
  .single()

if (error) return { error: error.message }

revalidatePath('/onboarding')
return { data }
```

**Profile link after barbershop insert** (two-step operation in same action):
```typescript
const { error: profileError } = await supabase
  .from('profiles')
  .update({ barbershop_id: barbershop.id })
  .eq('id', userId)

if (profileError) return { error: profileError.message }
```

**Return shape** — always `{ data } | { error: string }`, never throw:
```typescript
if (error) return { error: error.message }
return { data }
```

---

### `src/app/actions/barbers.ts` (service, CRUD)

**Analog:** `src/app/actions/auth.ts`

**Imports pattern** (standard Server Action + admin client for invite):
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
```

**Standard CRUD action** (createBarber — auth guard → insert → revalidate):
```typescript
export async function createBarber(formData: {
  name: string
  phone?: string
  photo_url?: string
  specialties?: string[]
}) {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims) return { error: 'Não autenticado' }

  const barbershop_id = claims.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Barbearia não configurada' }

  const { data, error } = await supabase
    .from('barbers')
    .insert({ ...formData, barbershop_id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/equipe')
  return { data }
}
```

**inviteBarber admin pattern** (uses createAdminClient — service role required):
```typescript
export async function inviteBarber(email: string, barberId: string) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const barbershop_id = claims?.claims.app_metadata?.barbershop_id as string | undefined
  if (!barbershop_id) return { error: 'Não autorizado' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/aceitar-convite`,
    data: {
      barbershop_id,
      role: 'barber',
      barber_id: barberId,
    },
  })

  if (error) {
    if (error.message.includes('already been registered'))
      return { error: 'Este email já está cadastrado no sistema.' }
    return { error: error.message }
  }

  return { success: true }
}
```

---

### `src/app/actions/appointments.ts` (service, CRUD)

**Analog:** `src/app/actions/auth.ts`

**Imports pattern:**
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
```

**App-layer conflict check before INSERT** (D-17):
```typescript
async function checkConflict(
  supabase: SupabaseClient,
  barberId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const { data } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', barberId)
    .neq('status', 'CANCELLED')
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1)
  return (data?.length ?? 0) > 0
}
```

**Cancel pattern** — UPDATE, never DELETE (D-18):
```typescript
const { error } = await supabase
  .from('appointments')
  .update({
    status: 'CANCELLED',
    cancelled_at: new Date().toISOString(),
    cancelled_by: userId,
    cancel_reason: reason ?? null,
  })
  .eq('id', appointmentId)
  .eq('barbershop_id', barbershop_id)  // RLS belt-and-suspenders
```

---

### `src/app/actions/working-hours.ts` (service, CRUD)

**Analog:** `src/app/actions/auth.ts`

**Upsert pattern** — DELETE then INSERT (not UPSERT), to handle split-shift replacement cleanly:
```typescript
// DELETE all rows for this barber+day, then INSERT the new set
const { error: deleteError } = await supabase
  .from('working_hours')
  .delete()
  .eq('barber_id', barberId)

if (deleteError) return { error: deleteError.message }

const { error: insertError } = await supabase
  .from('working_hours')
  .insert(rows.map(r => ({ ...r, barber_id: barberId })))

if (insertError) return { error: insertError.message }

revalidatePath('/dashboard/equipe')
return { success: true }
```

---

### `src/app/actions/barber-services.ts` (service, CRUD)

**Analog:** `src/app/actions/auth.ts`

**Sync pattern** — same DELETE+INSERT as working-hours for junction table:
```typescript
// Remove all existing assignments for this barber, re-insert selected
const { error: deleteError } = await supabase
  .from('barber_services')
  .delete()
  .eq('barber_id', barberId)

if (deleteError) return { error: deleteError.message }

if (assignments.length > 0) {
  const { error: insertError } = await supabase
    .from('barber_services')
    .insert(assignments.map(a => ({ barber_id: barberId, ...a })))
  if (insertError) return { error: insertError.message }
}

revalidatePath('/dashboard/equipe')
return { success: true }
```

---

### `src/app/(owner)/onboarding/page.tsx` (component, request-response)

**Analog:** `src/app/(auth)/cadastro/page.tsx`

**Client component declaration + imports** (cadastro/page.tsx lines 1–27):
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
```

**Multi-step state pattern** (use useState for current step — no URL changes):
```typescript
const [step, setStep] = useState(1)
const [barbershopId, setBarbershopId] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**JWT refresh after step 1** (client-side — runs after Server Action returns):
```typescript
import { createClient } from '@/lib/supabase/client'

async function onStep1Complete(formData: Step1Data) {
  setIsLoading(true)
  const result = await createBarbershop(formData)  // Server Action
  if (result.error) { setError(result.error); setIsLoading(false); return }

  // Force token refresh — barbershop_id must be in JWT for steps 2–4 RLS
  const supabase = createClient()
  await supabase.auth.refreshSession()

  setBarbershopId(result.data.barbershop_id)
  setStep(2)
  setIsLoading(false)
}
```

**Resume detection on mount** (check profiles.barbershop_id to skip already-completed steps):
```typescript
useEffect(() => {
  async function detectProgress() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('barbershop_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.barbershop_id) {
      setBarbershopId(profile.barbershop_id)
      // Check which step to resume from based on what exists
      // (barbers count, services count, working_hours count)
      setStep(determineResumeStep(profile.barbershop_id))
    }
  }
  detectProgress()
}, [])
```

**Form submit button pattern** (cadastro/page.tsx lines 168–185):
```typescript
<Button
  type="submit"
  className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-black font-semibold transition-colors"
  disabled={form.formState.isSubmitting}
  aria-busy={form.formState.isSubmitting}
>
  {form.formState.isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Carregando...
    </>
  ) : (
    'Próximo'
  )}
</Button>
```

---

### `src/app/(owner)/dashboard/equipe/page.tsx` (component, CRUD)

**Analog:** `src/app/(owner)/dashboard/page.tsx`

**Server Component pattern** (dashboard/page.tsx lines 1–16, 33–45):
```typescript
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/shell/dashboard-shell'

export const metadata: Metadata = {
  title: 'Equipe — BarberFlow',
}

export default async function EquipePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const claims = data.claims
  const email = (claims.email as string | undefined) ?? ''
  const barbershop_id = claims.app_metadata?.barbershop_id as string | undefined

  if (!barbershop_id) redirect('/onboarding')

  const { data: barbers } = await supabase
    .from('barbers')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .order('name')

  return (
    <DashboardShell displayName={...} email={email}>
      {/* Client components for CRUD here */}
    </DashboardShell>
  )
}
```

**Data fetch + pass to client** pattern: fetch in Server Component, pass serializable data as props to client child components.

---

### `src/app/(owner)/dashboard/equipe/components/barber-drawer.tsx` (component, CRUD)

**Analog:** `src/app/(auth)/aceitar-convite/page.tsx`

**Client form pattern** (aceitar-convite/page.tsx lines 1–53):
```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
```

**Sheet/Drawer wrapper** (new — no existing analog; follow shadcn Sheet pattern):
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{isEditing ? 'Editar Barbeiro' : 'Novo Barbeiro'}</SheetTitle>
    </SheetHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
        {/* FormField blocks here */}
      </form>
    </Form>
  </SheetContent>
</Sheet>
```

**Error display pattern** (aceitar-convite/page.tsx lines 107–119):
```typescript
{errorMessage && (
  <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400">
    <AlertDescription>{errorMessage}</AlertDescription>
  </Alert>
)}
```

**FormField pattern** (aceitar-convite/page.tsx lines 128–160):
```typescript
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nome do Barbeiro</FormLabel>
      <FormControl>
        <Input placeholder="Ex: João Silva" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Destructive secondary button** (cancel action in drawer — D-19):
```typescript
<Button
  type="button"
  variant="destructive"
  className="w-full"
  onClick={() => setCancelDialogOpen(true)}
>
  Cancelar Agendamento
</Button>
```

---

### `src/app/(owner)/dashboard/servicos/page.tsx` and `service-drawer.tsx` (component, CRUD)

Same patterns as `equipe/page.tsx` and `barber-drawer.tsx` above. Use identical Server Component fetch + DashboardShell wrapper + Sheet drawer + Form patterns.

---

### `src/app/(barber)/agenda/page.tsx` (component, CRUD)

**Analog:** `src/app/(owner)/dashboard/page.tsx`

**Server Component with barber-specific claims pattern:**
```typescript
export default async function AgendaPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/entrar')

  const userId = data.claims.sub as string

  // Find barber row via profile_id linkage
  const { data: barberRow } = await supabase
    .from('barbers')
    .select('id, name')
    .eq('profile_id', userId)
    .maybeSingle()

  if (!barberRow) {
    // Show "aguardando configuração" empty state
    return <DashboardShell ...><EmptyState /></DashboardShell>
  }

  // Fetch appointments for this barber
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, start_time, end_time, status, notes,
      clients!inner(full_name, whatsapp_number),
      services!inner(name, duration_minutes)
    `)
    .eq('barber_id', barberRow.id)
    .neq('status', 'CANCELLED')
    .order('start_time')
```

---

### `src/app/(auth)/aceitar-convite/page.tsx` (modify — extend existing)

**Analog:** self (exact)

**Extension point** — after `supabase.auth.updateUser({ password })` succeeds, call a Server Action to set `barbers.profile_id` as a client-side fallback (Postgres trigger is primary mechanism). Add after line 70:

```typescript
const { error } = await supabase.auth.updateUser({ password: values.password })
if (error) { /* existing error handling */ return }

// Phase 1 addition: if invite carried a barber_id, link profile_id via Server Action
// (Postgres trigger on_invite_accepted is the primary mechanism; this is the fallback)
const { data: { user } } = await supabase.auth.getUser()
if (user?.user_metadata?.barber_id) {
  await linkBarberProfile(user.user_metadata.barber_id as string)  // Server Action
}

router.push('/agenda')
```

**`raw_user_meta_data` vs `user_metadata`:** In the browser client, `user.user_metadata` corresponds to `raw_user_meta_data` in the DB. The `barber_id` was set via `inviteUserByEmail options.data` which populates `raw_user_meta_data`.

---

### `src/components/appointments/appointment-drawer.tsx` (component, CRUD)

**Analog:** `src/app/(auth)/aceitar-convite/page.tsx`

**Pattern:** Same Sheet + Form pattern as barber-drawer.tsx. Key differences:

**Controlled Sheet open state** with trigger from parent (global action button):
```typescript
'use client'

export function AppointmentDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // ...
}
```

**Dependent select pattern** (service options filtered by selected barber):
```typescript
const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
const [services, setServices] = useState<Service[]>([])

useEffect(() => {
  if (!selectedBarberId) { setServices([]); return }
  // Fetch services for this barber via barber_services join
  supabase
    .from('barber_services')
    .select('service_id, services!inner(id, name, duration_minutes, price)')
    .eq('barber_id', selectedBarberId)
    .then(({ data }) => setServices(data?.map(r => r.services) ?? []))
}, [selectedBarberId])
```

---

### `src/components/appointments/cancel-dialog.tsx` (component, request-response)

**Analog:** `src/app/(auth)/aceitar-convite/page.tsx` (form pattern)

**Dialog pattern** (shadcn Dialog — no existing analog in codebase):
```typescript
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Cancelar Agendamento</DialogTitle>
      <DialogDescription>
        Esta ação não pode ser desfeita. O agendamento será marcado como cancelado.
      </DialogDescription>
    </DialogHeader>
    <Textarea
      placeholder="Motivo (opcional)"
      value={reason}
      onChange={(e) => setReason(e.target.value)}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Voltar
      </Button>
      <Button
        variant="destructive"
        disabled={isLoading}
        onClick={handleConfirm}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Cancelamento'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### `src/components/dashboard/setup-checklist.tsx` (component, request-response)

**Analog:** `src/components/dashboard/primitives.tsx`

**Panel wrapper pattern** (primitives.tsx lines 87–97):
```typescript
import { Panel, PanelHeader } from '@/components/dashboard/primitives'

export function SetupChecklist({ barbershopId }: { barbershopId: string }) {
  return (
    <Panel>
      <PanelHeader
        title="Configure sua barbearia"
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      {/* checklist items */}
    </Panel>
  )
}
```

---

### `src/components/shell/dashboard-shell.tsx` (modify — add hrefs)

**Analog:** self (exact)

**Current nav items without hrefs** (lines 26–31):
```typescript
{ label: "Agenda", icon: Calendar },
{ label: "Clientes", icon: Users },
{ label: "Serviços", icon: Scissors },
{ label: "Equipe", icon: UsersRound },
```

**Add hrefs for Phase 1 routes:**
```typescript
{ label: "Agenda", icon: Calendar, href: "/dashboard/agenda" },
{ label: "Serviços", icon: Scissors, href: "/dashboard/servicos" },
{ label: "Equipe", icon: UsersRound, href: "/dashboard/equipe" },
```

**Active link detection** — change from static `active: true` on Dashboard to dynamic detection using `usePathname()` (convert nav rendering to client component or pass `activePath` prop from Server Component).

---

### `src/components/appointments/client-combobox.tsx` (component, request-response)

**No analog found** — no existing combobox/command pattern in codebase.

Use RESEARCH.md Pattern 7 as implementation reference:
```typescript
// src/components/appointments/client-combobox.tsx — 'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

async function searchClients(query: string) {
  const supabase = createClient()
  // RLS enforces barbershop_id automatically via JWT
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, whatsapp_number')
    .or(`full_name.ilike.%${query}%,whatsapp_number.ilike.%${query}%`)
    .limit(8)
  return data ?? []
}
```

---

### `src/types/database.types.ts` (regenerate)

**Analog:** self (exact — regenerate after migration)

**Command to run after Phase 1 migration is applied:**
```bash
supabase gen types typescript --local > src/types/database.types.ts
```

**Adds new table types:** `barbers`, `services`, `barber_services`, `working_hours`, `appointments`.

The `Tables<'barbers'>` helper (same pattern as existing `Tables<'profiles'>` at lines 139–165) will then be available throughout the codebase for full type safety.

---

## Shared Patterns

### Authentication Guard (all Server Components and Server Actions)

**Source:** `src/app/(owner)/layout.tsx` (lines 9–22) and `src/app/(owner)/dashboard/page.tsx` (lines 33–38)

**Apply to:** All Server Component pages (`equipe/page.tsx`, `servicos/page.tsx`, `agenda/page.tsx`) and all Server Actions (`barbershop.ts`, `barbers.ts`, `services.ts`, etc.)

**Server Component guard:**
```typescript
const supabase = await createClient()
const { data, error } = await supabase.auth.getClaims()
if (error || !data?.claims) redirect('/entrar')

const role = data.claims.app_metadata?.role as string | undefined
if (role !== 'owner') redirect('/entrar')  // or '/agenda' for barber pages
```

**Server Action guard:**
```typescript
const supabase = await createClient()
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
if (claimsError || !claimsData) return { error: 'Não autenticado' }

const barbershop_id = claimsData.claims.app_metadata?.barbershop_id as string | undefined
if (!barbershop_id) return { error: 'Barbearia não configurada' }
```

**Critical:** NEVER use `supabase.auth.getSession()` — always `getClaims()` for server-side auth. This is verified in Phase 0 throughout the codebase.

---

### Error Response Shape (all Server Actions)

**Source:** `src/app/actions/auth.ts` (signOut — simple) extended by RESEARCH.md Pattern 1

**Apply to:** All Server Actions

**Shape:**
```typescript
// On error:
return { error: string }

// On success:
return { data: T }
// or
return { success: true }
```

Never throw from Server Actions — always return `{ error }`. Client components check `result.error` before proceeding.

---

### RHF + Zod Form Pattern (all form-containing client components)

**Source:** `src/app/(auth)/cadastro/page.tsx` (lines 29–54, 110–187) and `src/components/ui/form.tsx`

**Apply to:** Onboarding wizard steps, barber-drawer, service-drawer, appointment-drawer, cancel-dialog

**Zod schema pattern (Zod v4):**
```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  price: z.coerce.number().min(0, 'Preço inválido'),
})

type FormValues = z.infer<typeof schema>
```

**useForm setup:**
```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: '', price: 0 },
})
```

**FormControl wraps the input (NOT Radix Slot)** — `form.tsx` line 104 uses a `div` wrapper, not `@radix-ui/react-slot`. Children render directly inside the div. Never use `asChild` pattern.

---

### Supabase Client Selection

**Source:** `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

**Apply to:** All new files

| Context | Import | When |
|---------|--------|------|
| Server Component / Server Action | `import { createClient } from '@/lib/supabase/server'` | Any `async` server-side code |
| Client Component (browser) | `import { createClient } from '@/lib/supabase/client'` | `'use client'` components |
| Admin operations (inviteByEmail) | `import { createAdminClient } from '@/lib/supabase/admin'` | Server Actions only — NEVER in client |

---

### revalidatePath after mutations

**Source:** `src/app/actions/auth.ts` (pattern established, extended in RESEARCH.md)

**Apply to:** All Server Actions that mutate DB

```typescript
import { revalidatePath } from 'next/cache'

// After successful mutation:
revalidatePath('/dashboard/equipe')     // barber mutations
revalidatePath('/dashboard/servicos')   // service mutations
revalidatePath('/dashboard')            // appointment mutations
revalidatePath('/onboarding')           // onboarding mutations
```

---

### DashboardShell wrapper pattern

**Source:** `src/app/(owner)/dashboard/page.tsx` (lines 62–126)

**Apply to:** All new owner dashboard pages, barber agenda page

```typescript
return (
  <DashboardShell displayName={displayName} email={email} role="owner">
    <div className="px-5 py-6 lg:px-8 lg:py-7">
      {/* page content */}
    </div>
  </DashboardShell>
)
```

For barber pages: `role="barber"` prop.

---

### Panel + PanelHeader card pattern

**Source:** `src/components/dashboard/primitives.tsx` (lines 87–123)

**Apply to:** Setup checklist widget, barber list card, service list card

```typescript
import { Panel, PanelHeader } from '@/components/dashboard/primitives'

<Panel>
  <PanelHeader
    title="Equipe"
    icon={<UsersRound className="h-4 w-4" />}
    action={<Button size="sm" onClick={openDrawer}>Adicionar</Button>}
  />
  {/* content */}
</Panel>
```

---

### Avatar component (barber cards)

**Source:** `src/components/dashboard/primitives.tsx` (lines 4–49)

**Apply to:** Barber cards in `/dashboard/equipe`, barber drawer header

```typescript
import { Avatar } from '@/components/dashboard/primitives'

<Avatar name={barber.name} size={48} />
```

Deterministic gradient from name hash — no photo required. If `barber.photo_url` is set, wrap with `<Image>` overlay or replace conditionally.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/appointments/client-combobox.tsx` | component | request-response | No Command/Popover combobox exists in codebase — first use of shadcn `command` + `popover` |
| `src/app/(owner)/onboarding/components/working-hours-grid.tsx` | component | CRUD | No time-grid or schedule-grid input component exists — first of its kind |

For these files, use RESEARCH.md Patterns 5 and 7 as reference, plus shadcn official documentation for `command` and `popover` components.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/`, `supabase/migrations/`, `src/types/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-31
