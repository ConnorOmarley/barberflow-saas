import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Admin Supabase client — service role key.
 * Use ONLY in Server Actions, never in client components.
 *
 * This client bypasses RLS. It MUST NOT be imported in 'use client' files.
 * Required for privileged operations such as supabase.auth.admin.inviteUserByEmail().
 */
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
