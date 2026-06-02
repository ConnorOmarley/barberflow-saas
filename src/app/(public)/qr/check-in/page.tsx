import type { Metadata } from 'next'
import { CheckCircle, XCircle } from 'lucide-react'
import { processQrCheckIn } from '@/app/actions/qr-checkin'

// Server Component — todo o processamento do token acontece server-side.
// O cliente vê o resultado sem precisar de JavaScript para processar o token.
// CRITICAL: Não adicionar `export const runtime = 'edge'` — crypto.createHmac é Node.js only.

export const metadata: Metadata = {
  title: 'Check-In | BarberFlow',
}

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function QrCheckInPage({ searchParams }: Props) {
  const { token } = await searchParams

  // Processar resultado server-side
  type CheckInResult =
    | { success: true; clientName: string; appointmentId: string }
    | { error: string }

  let result: CheckInResult

  if (!token) {
    result = { error: 'QR Code inválido ou incompleto' }
  } else {
    result = await processQrCheckIn(token)
  }

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

        {/* Card de resultado */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-8">
          {'success' in result ? (
            // Estado success
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#d4a574]/15">
                <CheckCircle className="size-9 text-[#d4a574]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Check-in realizado!</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Bem-vindo, {result.clientName}. Você está registrado.
                </p>
              </div>
              {/* Badge CHECKED_IN em purple */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-purple-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-400">
                <span className="size-1.5 rounded-full bg-purple-400" />
                Check-In Confirmado
              </div>
            </div>
          ) : (
            // Estado error
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-red-500/15">
                <XCircle className="size-9 text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Check-in não realizado</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {result.error}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
