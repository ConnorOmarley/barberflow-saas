import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
import { BookingWizard } from './components/booking-wizard'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('name')
    .eq('slug', slug)
    .single()

  return {
    title: barbershop ? `Agendar — ${barbershop.name}` : 'Agendamento',
  }
}

/**
 * Pagina de agendamento — Server Component.
 * Pre-carrega barbershop, services e barbers em paralelo (Promise.all) para evitar
 * waterfalls no cliente. Passa dados como props ao BookingWizard (client component).
 *
 * barbershop_id NUNCA e aceito como parametro de URL — sempre resolvido via slug server-side.
 */
export default async function BookingPage({ params }: Props) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, timezone')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  // Pre-carrega services e barbers em paralelo — sem waterfall
  const [{ data: services }, { data: barbers }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('barbershop_id', barbershop.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('barbers')
      .select('id, name, photo_url')
      .eq('barbershop_id', barbershop.id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <BookingWizard
      barbershop={barbershop}
      services={services ?? []}
      barbers={barbers ?? []}
    />
  )
}
