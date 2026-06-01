'use client'

/**
 * BookingWizard — STUB temporario.
 * Este componente sera substituido pela implementacao real no plano 02-03.
 * Exporta a interface de props que o booking/page.tsx ja usa para que o TypeScript compile.
 */
export function BookingWizard({
  barbershop,
  services,
  barbers,
}: {
  barbershop: { id: string; name: string; slug: string; timezone: string }
  services: Array<{ id: string; name: string; duration_minutes: number; price: number }>
  barbers: Array<{ id: string; name: string; photo_url: string | null }>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151922] p-8 shadow-2xl">
        <p className="text-center text-foreground">
          Carregando agendamento para{' '}
          <span className="font-semibold text-[#d4a574]">{barbershop.name}</span>
          ...
        </p>
        <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
          {services.length} servico(s) · {barbers.length} barbeiro(s) disponivel(is)
        </p>
      </div>
    </div>
  )
}
