import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'

export interface DateRange {
  from: Date | null
  to: Date | null
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null },
] as const

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

/**
 * Shared date range filter for Reports page tabs.
 * Supports preset buttons and custom date inputs.
 * Clamps future dates to today.
 */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const today = useMemo(() => startOfDay(new Date()), [])

  function applyPreset(days: number | null) {
    if (days === null) {
      onChange({ from: null, to: null })
    } else {
      onChange({
        from: startOfDay(subDays(today, days)),
        to: endOfDay(today),
      })
    }
  }

  function updateFrom(dateStr: string) {
    const date = dateStr ? startOfDay(new Date(dateStr + 'T00:00:00')) : null
    // Clamp to today
    const clamped = date && date > today ? today : date
    onChange({ ...value, from: clamped })
  }

  function updateTo(dateStr: string) {
    const date = dateStr ? endOfDay(new Date(dateStr + 'T00:00:00')) : null
    // Clamp to today
    const clamped = date && date > today ? endOfDay(today) : date
    onChange({ ...value, to: clamped })
  }

  const activePreset = (() => {
    if (!value.from && !value.to) return 'All time'
    for (const preset of PRESETS) {
      if (preset.days === null) continue
      const expectedFrom = startOfDay(subDays(today, preset.days))
      const expectedTo = endOfDay(today)
      if (
        value.from?.getTime() === expectedFrom.getTime() &&
        value.to?.getTime() === expectedTo.getTime()
      ) {
        return preset.label
      }
    }
    return null
  })()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <CalendarDays className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <div role="group" aria-label="Date range presets" className="flex gap-1">
        {PRESETS.map(preset => (
          <Button
            key={preset.label}
            variant={activePreset === preset.label ? 'default' : 'outline'}
            size="sm"
            className="min-h-[36px] text-xs"
            onClick={() => applyPreset(preset.days)}
            aria-pressed={activePreset === preset.label}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <label htmlFor="date-from" className="sr-only">
          From date
        </label>
        <Input
          id="date-from"
          type="date"
          className="h-8 w-[140px] text-xs"
          value={value.from ? format(value.from, 'yyyy-MM-dd') : ''}
          onChange={e => updateFrom(e.target.value)}
          max={format(today, 'yyyy-MM-dd')}
        />
        <span className="text-muted-foreground">to</span>
        <label htmlFor="date-to" className="sr-only">
          To date
        </label>
        <Input
          id="date-to"
          type="date"
          className="h-8 w-[140px] text-xs"
          value={value.to ? format(value.to, 'yyyy-MM-dd') : ''}
          onChange={e => updateTo(e.target.value)}
          max={format(today, 'yyyy-MM-dd')}
        />
      </div>
    </div>
  )
}
