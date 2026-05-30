import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (claims) {
    const role = claims.app_metadata?.role
    redirect(role === 'barber' ? '/agenda' : '/dashboard')
  }

  redirect('/entrar')
}
