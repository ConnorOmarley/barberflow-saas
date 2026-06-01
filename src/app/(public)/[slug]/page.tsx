import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'

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
    title: barbershop ? `${barbershop.name} — Agendar` : 'Barbearia',
  }
}

/**
 * Landing page publica da barbearia.
 * Exibe nome, lista de servicos ativos e CTA para /[slug]/booking.
 * Sem DashboardShell — layout proprio minimalista.
 * Sem auth check — rota completamente publica.
 */
export default async function BarbershopLandingPage({ params }: Props) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, timezone')
    .eq('slug', slug)
    .single()

  if (!barbershop) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Brand mark */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a574] text-sm font-bold text-[#0b0f17]">
            B
          </div>
          <span className="text-sm font-semibold tracking-[0.15em] text-foreground">
            BARBERFLOW
          </span>
        </div>

        {/* Card principal */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151922] p-8 shadow-2xl">
          {/* Topo dourado */}
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: 'linear-gradient(90deg, #e8c89a, #d4a574)' }}
          />

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">{barbershop.name}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Agende seu horario online
            </p>
          </div>

          {/* Lista de servicos */}
          {services && services.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Servicos
              </h2>
              <div className="flex flex-col gap-2">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{service.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {service.duration_minutes} min
                      </p>
                    </div>
                    <p className="font-semibold text-[#d4a574]">
                      {(service.price / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/${slug}/booking`}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#d4a574] text-sm font-medium text-[#0b0f17] transition-colors hover:bg-[#e8c89a]"
          >
            Agendar agora
          </Link>
        </div>
      </div>
    </div>
  )
}
