'use client'

import { Switch } from '@/components/ui/switch'

// WorkingHourInput represents one time slot per weekday for a barber.
// Multiple rows per day (split shifts) are supported in the barber edit drawer
// (plan 01-05), but not in the onboarding wizard.
export type WorkingHourInput = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
  is_active: boolean
}

const DAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

const ALL_DAYS: WorkingHourInput['day_of_week'][] = [0, 1, 2, 3, 4, 5, 6]

interface WorkingHoursGridProps {
  value: WorkingHourInput[]
  onChange: (hours: WorkingHourInput[]) => void
}

// Controlled stateless component — parent controls value/onChange.
export function WorkingHoursGrid({ value, onChange }: WorkingHoursGridProps) {
  const getDay = (day: WorkingHourInput['day_of_week']): WorkingHourInput => {
    return (
      value.find((h) => h.day_of_week === day) ?? {
        day_of_week: day,
        start_time: '09:00',
        end_time: '18:00',
        is_active: false,
      }
    )
  }

  const updateDay = (day: WorkingHourInput['day_of_week'], patch: Partial<WorkingHourInput>) => {
    const current = getDay(day)
    const updated = { ...current, ...patch }
    const rest = value.filter((h) => h.day_of_week !== day)
    onChange([...rest, updated].sort((a, b) => a.day_of_week - b.day_of_week))
  }

  const toggleDay = (day: WorkingHourInput['day_of_week'], active: boolean) => {
    if (active) {
      updateDay(day, { is_active: true, start_time: '09:00', end_time: '18:00' })
    } else {
      updateDay(day, { is_active: false })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {ALL_DAYS.map((day) => {
        const slot = getDay(day)
        return (
          <div key={day} className="flex items-center gap-3">
            {/* Day label */}
            <span className="w-8 text-sm font-medium text-[var(--text-secondary)]">
              {DAY_LABELS[day]}
            </span>

            {/* Open/closed toggle */}
            <Switch
              checked={slot.is_active}
              onCheckedChange={(checked: boolean) => toggleDay(day, checked)}
              aria-label={`${DAY_LABELS[day]} aberto`}
            />

            {/* Time inputs — only visible when active */}
            {slot.is_active ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={`start-${day}`}
                    className="text-xs text-[var(--text-tertiary)]"
                  >
                    Início
                  </label>
                  <input
                    id={`start-${day}`}
                    type="time"
                    value={slot.start_time}
                    onChange={(e) => updateDay(day, { start_time: e.target.value })}
                    title={`Horário de início — ${DAY_LABELS[day]}`}
                    className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={`end-${day}`}
                    className="text-xs text-[var(--text-tertiary)]"
                  >
                    Fim
                  </label>
                  <input
                    id={`end-${day}`}
                    type="time"
                    value={slot.end_time}
                    onChange={(e) => updateDay(day, { end_time: e.target.value })}
                    title={`Horário de fim — ${DAY_LABELS[day]}`}
                    className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs text-[var(--text-tertiary)]">Fechado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
