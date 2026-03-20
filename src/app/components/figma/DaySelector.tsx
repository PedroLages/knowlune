import { cn } from '@/app/components/ui/utils'
import type { DayOfWeek } from '@/data/types'

const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
]

interface DaySelectorProps {
  selectedDays: DayOfWeek[]
  onChange: (days: DayOfWeek[]) => void
  disabled?: boolean
  'aria-labelledby'?: string
}

export function DaySelector({
  selectedDays,
  onChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
}: DaySelectorProps) {
  function toggleDay(day: DayOfWeek) {
    if (disabled) return
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day))
    } else {
      onChange([...selectedDays, day])
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabelledBy ? undefined : 'Days of the week'}
      aria-labelledby={ariaLabelledBy}
      data-testid="course-reminder-day-selector"
      className="flex flex-wrap gap-2"
    >
      {DAYS.map(({ value, label, short }) => {
        const isSelected = selectedDays.includes(value)
        return (
          <button
            key={value}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={label}
            disabled={disabled}
            onClick={() => toggleDay(value)}
            className={cn(
              'min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-full text-sm font-medium',
              'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand',
              isSelected
                ? 'bg-brand text-brand-foreground hover:bg-brand-hover'
                : 'bg-background border border-border text-muted-foreground hover:border-brand/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}
