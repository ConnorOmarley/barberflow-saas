import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Public Supabase client — anon key, sem sessao, sem cookies.
 *
 * Use APENAS para leituras publicas em Server Components e Server Actions
 * do portal de agendamento. RLS policies de SELECT com anon role controlam
 * o que e visivel.
 *
 * NUNCA use este client para writes — use createAdminClient() para INSERT/UPDATE
 * em contexto publico (bypassa RLS com controle server-side de barbershop_id).
 * O barbershop_id NUNCA deve vir do cliente — sempre resolvido via slug server-side.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
