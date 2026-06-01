'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getBarbershopId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return null
    const userId = data.claims.sub as string | undefined
    if (!userId) return null
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('barbershop_id')
      .eq('id', userId)
      .single()
    return profile?.barbershop_id ?? null
  } catch {
    return null
  }
}

export async function createService(data: {
  name: string
  duration_minutes: number
  price: number
}): Promise<{ data: { id: string; name: string } } | { error: string }> {
  try {
    const barbershopId = await getBarbershopId()
    if (!barbershopId) return { error: 'Barbearia não configurada' }

    const admin = createAdminClient()
    const { data: service, error } = await admin
      .from('services')
      .insert({ barbershop_id: barbershopId, name: data.name, duration_minutes: data.duration_minutes, price: data.price })
      .select('id, name')
      .single()

    if (error || !service) return { error: error?.message ?? 'Erro ao criar serviço' }
    revalidatePath('/dashboard/servicos')
    return { data: service }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

export async function updateService(data: {
  id: string
  name?: string
  duration_minutes?: number
  price?: number
  is_active?: boolean
}): Promise<{ success: true } | { error: string }> {
  try {
    const barbershopId = await getBarbershopId()
    if (!barbershopId) return { error: 'Barbearia não configurada' }

    const { id, ...fields } = data
    const admin = createAdminClient()
    const { error } = await admin.from('services').update(fields).eq('id', id).eq('barbershop_id', barbershopId)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/servicos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}

export async function deactivateService(serviceId: string): Promise<{ success: true } | { error: string }> {
  try {
    const barbershopId = await getBarbershopId()
    if (!barbershopId) return { error: 'Barbearia não configurada' }

    const admin = createAdminClient()
    const { error } = await admin.from('services').update({ is_active: false }).eq('id', serviceId).eq('barbershop_id', barbershopId)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/servicos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro inesperado' }
  }
}
