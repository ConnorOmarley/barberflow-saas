'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'

interface AppointmentQRCodeProps {
  checkInUrl: string
}

/**
 * AppointmentQRCode — Renderiza o QR Code de check-in como SVG.
 *
 * Usa react-qr-code para geração SVG pura (sem Canvas, sem DOM APIs).
 * Recebe checkInUrl como prop (gerada pelo Server Action generateQrToken).
 *
 * T-03-07: NÃO importa createAdminClient — apenas recebe a URL como prop.
 */
export function AppointmentQRCode({ checkInUrl }: AppointmentQRCodeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silencioso — clipboard pode ser bloqueado em alguns contextos
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-xl bg-white p-4">
        <QRCode
          value={checkInUrl}
          size={200}
          level="M"
          style={{ display: 'block' }}
        />
      </div>
      <p className="text-xs text-[var(--text-secondary)] text-center">
        Mostre este QR na barbearia para fazer check-in
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-[#d4a574]/40 hover:bg-[#d4a574]/5"
      >
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}
