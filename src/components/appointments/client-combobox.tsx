'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, UserPlus, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Client {
  id: string
  full_name: string
  whatsapp_number: string
}

interface NewClientData {
  full_name: string
  whatsapp_number: string
}

interface ClientComboboxProps {
  value: string | null
  onChange: (clientId: string | null) => void
  onNewClient: (data: NewClientData) => void
}

export function ClientCombobox({ value, onChange, onNewClient }: ClientComboboxProps) {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Limpar seleção quando value é zerado externamente
  useEffect(() => {
    if (!value) setSelectedClient(null)
  }, [value])

  const search = useCallback(async (q: string) => {
    setIsLoading(true)
    const supabase = createClient()
    const query_builder = supabase
      .from('clients')
      .select('id, full_name, whatsapp_number')
      .limit(10)
      .order('full_name')

    if (q.trim()) {
      query_builder.or(`full_name.ilike.%${q}%,whatsapp_number.ilike.%${q}%`)
    }

    const { data } = await query_builder
    setClients(data ?? [])
    setIsLoading(false)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    setShowDropdown(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  function handleFocus() {
    setShowDropdown(true)
    if (clients.length === 0) search(query)
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client)
    onChange(client.id)
    setQuery('')
    setShowDropdown(false)
    setShowInlineCreate(false)
  }

  function handleClear() {
    setSelectedClient(null)
    onChange(null)
    setQuery('')
    setClients([])
  }

  function handleCreateNew() {
    setShowInlineCreate(true)
    setShowDropdown(false)
    setQuery('')
  }

  function handleSubmitNewClient() {
    if (!newClientName.trim() || !newClientPhone.trim()) return
    onNewClient({ full_name: newClientName.trim(), whatsapp_number: newClientPhone.trim() })
    setShowInlineCreate(false)
    setNewClientName('')
    setNewClientPhone('')
    onChange(null)
  }

  function handleCancelCreate() {
    setShowInlineCreate(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  // Cliente já selecionado — mostrar chip
  if (selectedClient) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
        <Check className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground truncate">{selectedClient.full_name}</span>
          <span className="ml-2 text-xs text-[var(--text-secondary)]">{selectedClient.whatsapp_number}</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-[var(--text-tertiary)] hover:text-foreground"
          aria-label="Remover cliente"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Formulário de criação inline
  if (showInlineCreate) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-[var(--surface-raised,#1a1f2a)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#d4a574]" />
            Novo cliente
          </span>
          <button
            type="button"
            onClick={handleCancelCreate}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-client-name">Nome *</Label>
          <Input
            id="new-client-name"
            placeholder="Ex: João Silva"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-client-phone">WhatsApp *</Label>
          <Input
            id="new-client-phone"
            type="tel"
            placeholder="(11) 99999-9999"
            value={newClientPhone}
            onChange={(e) => setNewClientPhone(e.target.value)}
          />
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleSubmitNewClient}
          disabled={!newClientName.trim() || !newClientPhone.trim()}
          className="w-full"
        >
          Criar cliente
        </Button>
      </div>
    )
  }

  // Input de busca com dropdown
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar cliente por nome ou WhatsApp..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          className="h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-white/[0.1] bg-[#0f1117] shadow-lg">
          {!isLoading && clients.length === 0 ? (
            <div className="p-2">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleCreateNew() }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[#d4a574] hover:bg-white/[0.06]"
              >
                <UserPlus className="h-4 w-4" />
                {query.trim() ? `Criar "${query.trim()}"` : 'Criar novo cliente'}
              </button>
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {clients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectClient(client) }}
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-white/[0.06]"
                  >
                    <span className="font-medium text-foreground">{client.full_name}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{client.whatsapp_number}</span>
                  </button>
                </li>
              ))}
              <li className="border-t border-white/[0.06]">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleCreateNew() }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#d4a574] hover:bg-white/[0.06]"
                >
                  <UserPlus className="h-4 w-4" />
                  Criar novo cliente
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
