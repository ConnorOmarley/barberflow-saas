import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BarberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/entrar')
  }

  const role = data.claims.app_metadata?.role as string | undefined

  // Owner accessing barber route → redirect to their dashboard
  if (role !== 'barber') {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  )
}
