'use client'

import { useState } from 'react'
import { Search, Users, MessageCircle } from 'lucide-react'
import type { ClientWithStats } from '../page'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso))
}

export function ClientList({ clients }: { clients: ClientWithStats[] }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? clients.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (c.whatsapp_number ?? '').includes(search),
      )
    : clients

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
        <Users className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" strokeWidth={1.5} />
        <p className="text-[0.9375rem] font-semibold text-foreground">Nenhum cliente ainda</p>
        <p className="mt-1 max-w-xs text-sm text-[var(--text-secondary)]">
          Os clientes aparecem aqui quando fazem seu primeiro agendamento.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Buscar por nome ou WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Nenhum cliente encontrado para &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Cliente
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] sm:table-cell">
                  WhatsApp
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Atendimentos
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] md:table-cell">
                  Último
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] lg:table-cell">
                  Cliente desde
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((client) => (
                <tr key={client.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4a574]/20 text-sm font-bold text-[#d4a574]">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{client.full_name}</p>
                        {client.whatsapp_number && (
                          <p className="mt-0.5 text-xs text-[var(--text-secondary)] sm:hidden">
                            {client.whatsapp_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {client.whatsapp_number ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--text-secondary)]">{client.whatsapp_number}</span>
                        {client.whatsapp_opt_in && (
                          <MessageCircle className="h-3.5 w-3.5 text-green-500" aria-label="Opt-in WhatsApp ativo" />
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        client.totalAppointments > 0
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-white/5 text-[var(--text-tertiary)]'
                      }`}
                    >
                      {client.totalAppointments}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--text-secondary)] md:table-cell">
                    {client.lastAppointment ? formatDate(client.lastAppointment) : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--text-secondary)] lg:table-cell">
                    {formatDate(client.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
