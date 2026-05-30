import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OwnerLayout({
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

  if (role !== 'owner') {
    redirect('/entrar')
  }

  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  )
}
