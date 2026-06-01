'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── createBarbershop ────────────────────────────────────────────────────────
// Idempotency guard: if barbershop_id already exists in JWT claims (owner
// refreshed page mid-onboarding), return early without creating a second row.

export async function createBarbershop(data: {
  name: string
  timezone: string
}): Promise<{ data: { barbershop_id: string; already_existed?: boolean } } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: authData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !authData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const claims = authData.claims
    const userId = claims.sub as string | undefined
    if (!userId) {
      return { error: 'Usuário não encontrado.' }
    }

    // Idempotency guard — if barbershop_id already set, return early
    const existingBarbershopId = claims.app_metadata?.barbershop_id as string | undefined
    if (existingBarbershopId) {
      return { data: { barbershop_id: existingBarbershopId, already_existed: true } }
    }

    // Generate slug from name + random suffix
    const slug =
      data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 7)

    // INSERT into barbershops
    const { data: barbershop, error: insertError } = await supabase
      .from('barbershops')
      .insert({ name: data.name, slug, timezone: data.timezone })
      .select('id')
      .single()

    if (insertError || !barbershop) {
      return { error: insertError?.message ?? 'Erro ao criar barbearia.' }
    }

    // UPDATE profiles.barbershop_id so JWT can be refreshed with the new claim
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ barbershop_id: barbershop.id })
      .eq('id', userId)

    if (updateError) {
      return { error: updateError.message }
    }

    revalidatePath('/onboarding')
    return { data: { barbershop_id: barbershop.id } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}

// ─── createOnboardingBarber ──────────────────────────────────────────────────
// Creates the first barber row for the barbershop. barbershop_id is always
// read from JWT claims — never accepted as a parameter from the client.

export async function createOnboardingBarber(data: {
  name: string
  phone?: string
}): Promise<{ data: { barber_id: string } } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: authData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !authData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const claims = authData.claims
    const barbershopId = claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershopId) {
      return { error: 'Barbearia não encontrada. Complete o passo 1 primeiro.' }
    }

    const { data: barber, error: insertError } = await supabase
      .from('barbers')
      .insert({
        barbershop_id: barbershopId,
        name: data.name,
        phone: data.phone ?? null,
      })
      .select('id')
      .single()

    if (insertError || !barber) {
      return { error: insertError?.message ?? 'Erro ao criar barbeiro.' }
    }

    revalidatePath('/onboarding')
    return { data: { barber_id: barber.id } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}

// ─── createOnboardingService ─────────────────────────────────────────────────
// Creates the first service row for the barbershop. barbershop_id is always
// read from JWT claims — never accepted as a parameter from the client.

export async function createOnboardingService(data: {
  name: string
  duration_minutes: number
  price: number
}): Promise<{ data: { service_id: string } } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: authData, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError || !authData?.claims) {
      return { error: 'Não autenticado.' }
    }

    const claims = authData.claims
    const barbershopId = claims.app_metadata?.barbershop_id as string | undefined
    if (!barbershopId) {
      return { error: 'Barbearia não encontrada. Complete o passo 1 primeiro.' }
    }

    const { data: service, error: insertError } = await supabase
      .from('services')
      .insert({
        barbershop_id: barbershopId,
        name: data.name,
        duration_minutes: data.duration_minutes,
        price: data.price,
      })
      .select('id')
      .single()

    if (insertError || !service) {
      return { error: insertError?.message ?? 'Erro ao criar serviço.' }
    }

    revalidatePath('/onboarding')
    return { data: { service_id: service.id } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado.' }
  }
}
