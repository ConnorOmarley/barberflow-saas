import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'

/**
 * Layout do route group (public) — valida que o slug existe antes de renderizar filhos.
 * Nao faz nenhuma verificacao de autenticacao — rota completamente publica.
 * Se o slug nao existir na tabela barbershops, retorna 404.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  return <>{children}</>
}
