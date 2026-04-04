/**
 * DayPicker — Multi-select day-of-week toggle group.
 *
 * Uses shadcn ToggleGroup (type="multiple") with abbreviated labels.
 * Touch-friendly (min 44x44px), accessible (full day names as aria-labels).
 *
 * @see E50-S05
 */

import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import { cn } from '@/app/components/ui/utils'
import type { DayOfWeek } from '@/data/types'

const DAYS: { value: DayOfWeek; label: string; ariaLabel: string }[] = [
  { value: 'monday', label: 'M', ariaLabel: 'Monday' },
  { value: 'tuesday', label: 'T', ariaLabel: 'Tuesday' },
  { value: 'wednesday', label: 'W', ariaLabel: 'Wednesday' },
  { value: 'thursday', label: 'T', ariaLabel: 'Thursday' },
  { value: 'friday', label: 'F', ariaLabel: 'Friday' },
  { value: 'saturday', label: 'S', ariaLabel: 'Saturday' },
  { value: 'sunday', label: 'S', ariaLabel: 'Sunday' },
]

interface DayPickerProps {
  value: DayOfWeek[]
  onChange: (days: DayOfWeek[]) => void
}

export function DayPicker({ value, onChange }: DayPickerProps) {
  return (
    <ToggleGroup
      type="multiple"
      value={value}
      onValueChange={v => onChange(v as DayOfWeek[])}
      className="flex flex-wrap gap-1.5"
    >
      {DAYS.map(day => (
        <ToggleGroupItem
          key={day.value}
          value={day.value}
          aria-label={day.ariaLabel}
          className={cn(
            'min-w-[44px] min-h-[44px] rounded-lg text-sm font-medium transition-colors',
            'data-[state=on]:bg-brand data-[state=on]:text-brand-foreground',
            'data-[state=off]:bg-muted data-[state=off]:text-muted-foreground'
          )}
        >
          {day.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
