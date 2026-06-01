'use client'

import { useState, useEffect } from 'react'
import { Loader2, X, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WorkingHoursGrid } from '@/app/(owner)/onboarding/components/working-hours-grid'
import type { WorkingHourInput } from '@/app/(owner)/onboarding/components/working-hours-grid'
import { createBarber, updateBarber, deactivateBarber, inviteBarber } from '@/app/actions/barbers'
import { upsertBarberWorkingHours } from '@/app/actions/working-hours'
import { syncBarberServices } from '@/app/actions/barber-services'
import type { Tables } from '@/types/database.types'

// ─── Default working hours: Seg–Sex open 09:00–18:00, Dom+Sáb closed ───────────
const DEFAULT_HOURS: WorkingHourInput[] = [
  { day_of_week: 0, start_time: '09:00', end_time: '18:00', is_active: false },
  { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_active: true },
  { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_active: true },
  { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_active: true },
  { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_active: true },
  { day_of_week: 5, start_time: '09:00', end_time: '18:00', is_active: true },
  { day_of_week: 6, start_time: '09:00', end_time: '18:00', is_active: false },
]

// ─── Service assignment state per service ID ──────────────────────────────────
type ServiceAssignmentState = {
  checked: boolean
  commission_type: 'percent' | 'fixed' | null
  commission_value: string
}

interface BarberDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  barber: Tables<'barbers'> | null
  services: Tables<'services'>[]
  onSaved: () => void
}

export function BarberDrawer({
  open,
  onOpenChange,
  barber,
  services,
  onSaved,
}: BarberDrawerProps) {
  const isEditing = barber !== null

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [hours, setHours] = useState<WorkingHourInput[]>(DEFAULT_HOURS)
  const [serviceAssignments, setServiceAssignments] = useState<
    Record<string, ServiceAssignmentState>
  >({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // ─── Populate form when editing ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    if (barber) {
      setName(barber.name)
      setPhone(barber.phone ?? '')
      setPhotoPreview(barber.photo_url ?? null)
      setPhotoFile(null)
    } else {
      setName('')
      setPhone('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setHours(DEFAULT_HOURS)
    }

    // Reset invite state
    setInviteEmail('')
    setInviteSuccess(false)
    setErrorMessage(null)

    // Initialize service assignments (all unchecked by default)
    const initial: Record<string, ServiceAssignmentState> = {}
    for (const svc of services) {
      initial[svc.id] = { checked: false, commission_type: null, commission_value: '' }
    }
    setServiceAssignments(initial)
  }, [open, barber, services])

  // ─── Photo file selection ───────────────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ─── Service assignment toggle ───────────────────────────────────────────────
  function toggleService(serviceId: string, checked: boolean) {
    setServiceAssignments((prev) => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] ?? { commission_type: null, commission_value: '' }),
        checked,
      },
    }))
  }

  function updateCommission(
    serviceId: string,
    field: 'commission_type' | 'commission_value',
    value: string
  ) {
    setServiceAssignments((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: field === 'commission_type' ? (value as 'percent' | 'fixed') : value,
      },
    }))
  }

  // ─── Upload photo to barber-photos Storage bucket ───────────────────────────
  async function uploadPhoto(barberId: string): Promise<string | null> {
    if (!photoFile) return barber?.photo_url ?? null

    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    // T-01-12: path uses UUID barberId + timestamp — no user input traversal possible
    const path = `${barberId}/${Date.now()}.${ext}`

    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('barber-photos')
      .upload(path, photoFile, { upsert: true })

    if (error) {
      if (error.message.toLowerCase().includes('bucket') && error.message.toLowerCase().includes('not found')) {
        setErrorMessage(
          "Bucket 'barber-photos' não encontrado. Configure no Supabase Dashboard."
        )
      } else {
        setErrorMessage(`Erro ao fazer upload da foto: ${error.message}`)
      }
      return null
    }

    const { data: urlData } = supabase.storage.from('barber-photos').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  // ─── Main save handler ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage('O nome do barbeiro é obrigatório.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      let barberId: string

      if (isEditing && barber) {
        // Upload photo first if changed
        let photoUrl: string | null | undefined = undefined
        if (photoFile) {
          photoUrl = await uploadPhoto(barber.id)
          if (photoUrl === null && errorMessage) {
            // Upload failed and errorMessage was set — continue without photo
            photoUrl = barber.photo_url
          }
        }

        const result = await updateBarber({
          id: barber.id,
          name: name.trim(),
          phone: phone.trim() || undefined,
          photo_url: (photoUrl !== undefined ? photoUrl : barber.photo_url) ?? undefined,
          specialties: barber.specialties ?? undefined,
        })

        if ('error' in result) {
          setErrorMessage(result.error)
          setIsSaving(false)
          return
        }

        barberId = barber.id
      } else {
        // Create barber first (need ID for photo upload)
        const createResult = await createBarber({
          name: name.trim(),
          phone: phone.trim() || undefined,
        })

        if ('error' in createResult) {
          setErrorMessage(createResult.error)
          setIsSaving(false)
          return
        }

        barberId = createResult.data.id

        // Upload photo if provided
        if (photoFile) {
          const photoUrl = await uploadPhoto(barberId)
          if (photoUrl) {
            await updateBarber({ id: barberId, photo_url: photoUrl })
          }
          // If upload fails, barber is still saved without photo
        }
      }

      // Sync working hours (DELETE+INSERT)
      const hoursResult = await upsertBarberWorkingHours(barberId, hours)
      if ('error' in hoursResult) {
        setErrorMessage(hoursResult.error)
        setIsSaving(false)
        return
      }

      // Sync service assignments (DELETE+INSERT)
      const assignments = Object.entries(serviceAssignments)
        .filter(([, state]) => state.checked)
        .map(([serviceId, state]) => ({
          service_id: serviceId,
          commission_type: state.commission_type,
          commission_value: state.commission_value ? parseFloat(state.commission_value) : null,
        }))

      const servicesResult = await syncBarberServices(barberId, assignments)
      if ('error' in servicesResult) {
        setErrorMessage(servicesResult.error)
        setIsSaving(false)
        return
      }

      toast.success('Barbeiro salvo com sucesso.')
      onSaved()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Invite handler ──────────────────────────────────────────────────────────
  async function handleInvite() {
    if (!barber?.id) {
      setErrorMessage('Salve o barbeiro antes de enviar o convite.')
      return
    }
    if (!inviteEmail.trim()) {
      setErrorMessage('Informe o email para envio do convite.')
      return
    }

    setIsInviting(true)
    setErrorMessage(null)

    const result = await inviteBarber(inviteEmail.trim(), barber.id)

    setIsInviting(false)

    if ('error' in result) {
      setErrorMessage(result.error)
    } else {
      setInviteSuccess(true)
      toast.success('Convite enviado com sucesso.')
    }
  }

  // ─── Deactivate handler ──────────────────────────────────────────────────────
  async function handleDeactivate() {
    if (!barber) return

    const result = await deactivateBarber(barber.id)

    if ('error' in result) {
      setErrorMessage(result.error)
    } else {
      toast.success('Barbeiro desativado.')
      onSaved()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 border-b border-white/[0.06] bg-card px-6 py-4">
          <SheetTitle className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            {isEditing ? 'Editar barbeiro' : 'Adicionar barbeiro'}
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            {/* Error alert */}
            {errorMessage && (
              <Alert className="border-red-900/50 bg-red-950/30 text-red-400">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Section: Dados pessoais */}
            <section className="space-y-4">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">Dados pessoais</h3>

              {/* Avatar upload */}
              <div className="flex items-center gap-4">
                <label
                  htmlFor="photo-upload"
                  className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-white/5 hover:border-white/30 transition-colors overflow-hidden"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Foto do barbeiro"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Upload className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden />
                  )}
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Foto do barbeiro</p>
                  <p className="text-xs text-[var(--text-secondary)]">Opcional. Clique para selecionar.</p>
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="barber-name">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="barber-name"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <Label htmlFor="barber-phone">Telefone</Label>
                <Input
                  id="barber-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </section>

            <Separator className="bg-white/[0.06]" />

            {/* Section: Horários de trabalho */}
            <section className="space-y-4">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">
                Horários de trabalho
              </h3>
              <WorkingHoursGrid value={hours} onChange={setHours} />
            </section>

            <Separator className="bg-white/[0.06]" />

            {/* Section: Serviços oferecidos */}
            <section className="space-y-4">
              <div>
                <h3 className="text-[0.9375rem] font-semibold text-foreground">
                  Serviços oferecidos
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Defina quais serviços este barbeiro realiza e a comissão por serviço
                </p>
              </div>

              {services.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Nenhum serviço cadastrado. Adicione serviços em{' '}
                  <span className="text-[#d4a574]">Serviços</span>.
                </p>
              ) : (
                <div className="space-y-3">
                  {services.map((svc) => {
                    const state = serviceAssignments[svc.id] ?? {
                      checked: false,
                      commission_type: null,
                      commission_value: '',
                    }
                    return (
                      <div key={svc.id} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`svc-${svc.id}`}
                            checked={state.checked}
                            onCheckedChange={(v) => toggleService(svc.id, v === true)}
                          />
                          <label
                            htmlFor={`svc-${svc.id}`}
                            className="text-sm font-medium text-foreground cursor-pointer select-none"
                          >
                            {svc.name}
                          </label>
                          <span className="ml-auto text-xs text-[var(--text-secondary)] tabular-nums">
                            R$ {svc.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Commission fields — visible when service is checked */}
                        {state.checked && (
                          <div className="ml-7 flex gap-2">
                            <Select
                              value={state.commission_type ?? ''}
                              onValueChange={(v) =>
                                updateCommission(svc.id, 'commission_type', v ?? '')
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue placeholder="Tipo de comissão" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">Percentual (%)</SelectItem>
                                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0"
                              value={state.commission_value}
                              onChange={(e) =>
                                updateCommission(svc.id, 'commission_value', e.target.value)
                              }
                              className="h-8 text-xs w-24 tabular-nums"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <Separator className="bg-white/[0.06]" />

            {/* Section: Acesso ao painel */}
            <section className="space-y-4">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">Acesso ao painel</h3>

              {barber?.profile_id ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                    Perfil vinculado
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Convidar para o painel</Label>
                    <div className="flex gap-2">
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="email@barbeiro.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviteSuccess}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleInvite}
                        disabled={isInviting || inviteSuccess || !isEditing}
                        className="shrink-0"
                      >
                        {isInviting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : inviteSuccess ? (
                          'Enviado'
                        ) : (
                          'Convidar'
                        )}
                      </Button>
                    </div>
                    {!isEditing && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Salve o barbeiro primeiro para poder enviar o convite.
                      </p>
                    )}
                    {isEditing && !inviteSuccess && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        O barbeiro receberá um link de convite por email para criar sua senha.
                      </p>
                    )}
                    {inviteSuccess && (
                      <p className="text-xs text-emerald-400">
                        Convite enviado com sucesso para {inviteEmail}.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-white/[0.06] bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Deactivate (only when editing an active barber) */}
            <div>
              {isEditing && barber?.is_active && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-xs"
                  onClick={handleDeactivate}
                >
                  Desativar barbeiro
                </Button>
              )}
            </div>

            {/* Right side: Fechar + Salvar */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Fechar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 text-xs bg-amber-600 text-black hover:bg-amber-500 font-semibold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar barbeiro'
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
