'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Buscar cliente selecionado quando value muda externamente
  useEffect(() => {
    if (!value) {
      setSelectedClient(null)
    }
  }, [value])

  // Debounced search — 300ms, mínimo 2 chars
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setClients([])
      return
    }
    setIsLoading(true)
    const supabase = createClient()
    // RLS enforces barbershop_id automatically via JWT
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, whatsapp_number')
      .or(`full_name.ilike.%${q}%,whatsapp_number.ilike.%${q}%`)
      .limit(8)
    setClients(data ?? [])
    setIsLoading(false)
  }, [])

  function handleInputChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      search(q)
    }, 300)
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client)
    onChange(client.id)
    setShowInlineCreate(false)
    setOpen(false)
    setQuery('')
  }

  function handleCreateNew() {
    setShowInlineCreate(true)
    setOpen(false)
    setQuery('')
  }

  function handleSubmitNewClient() {
    if (!newClientName.trim() || !newClientPhone.trim()) return
    onNewClient({ full_name: newClientName.trim(), whatsapp_number: newClientPhone.trim() })
    setShowInlineCreate(false)
    setNewClientName('')
    setNewClientPhone('')
    // Limpar seleção de ID pois é um novo cliente
    onChange(null)
  }

  function handleCancelCreate() {
    setShowInlineCreate(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  const displayLabel = selectedClient
    ? selectedClient.full_name
    : showInlineCreate
    ? 'Novo cliente'
    : 'Buscar cliente por nome ou WhatsApp...'

  return (
    <div className="space-y-3">
      {/* Combobox de busca */}
      {!showInlineCreate && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Selecionar cliente"
              className={cn(
                'w-full justify-between font-normal',
                !selectedClient && 'text-muted-foreground'
              )}
            >
              <span className="truncate">{displayLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <div className="relative">
                <CommandInput
                  placeholder="Nome ou WhatsApp..."
                  value={query}
                  onValueChange={handleInputChange}
                />
                {isLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <CommandList>
                {!isLoading && query.length >= 2 && clients.length === 0 && (
                  <CommandEmpty>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-2 text-sm text-[#d4a574] hover:bg-accent"
                      onClick={handleCreateNew}
                    >
                      <UserPlus className="h-4 w-4" />
                      Criar novo cliente
                    </button>
                  </CommandEmpty>
                )}
                {clients.length > 0 && (
                  <CommandGroup>
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        onSelect={() => handleSelectClient(client)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === client.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{client.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {client.whatsapp_number}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                    <CommandItem
                      value="__create_new__"
                      onSelect={handleCreateNew}
                      className="text-[#d4a574]"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Criar novo cliente
                    </CommandItem>
                  </CommandGroup>
                )}
                {!isLoading && query.length < 2 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Digite ao menos 2 caracteres para buscar
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Formulário inline de criação de cliente */}
      {showInlineCreate && (
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
            <Label htmlFor="new-client-name">Nome do cliente *</Label>
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

          <p className="text-xs text-[var(--text-tertiary,#64748b)]">
            Notificações por WhatsApp serão configuradas na Fase 5.
          </p>

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
      )}
    </div>
  )
}
