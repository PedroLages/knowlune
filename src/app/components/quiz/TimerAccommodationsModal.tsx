import { useEffect, useState } from 'react'
import type { TimerAccommodation } from '@/types/quiz'
import { TimerAccommodationEnum, getAccommodationMultiplier } from '@/types/quiz'
import { Button } from '@/app/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'

interface TimerAccommodationsModalProps {
  /** Base quiz time limit in minutes */
  baseTimeMinutes: number
  /** Currently selected accommodation */
  value: TimerAccommodation
  /** Called when user confirms their selection */
  onSave: (accommodation: TimerAccommodation) => void
}

/** Format minutes to a human-readable duration string */
function formatDuration(minutes: number): string {
  const whole = Math.floor(minutes)
  const fractional = minutes - whole
  const seconds = fractional > 0 ? Math.min(Math.round(fractional * 60), 59) : 0
  if (seconds === 0) return `${whole} ${whole === 1 ? 'minute' : 'minutes'}`
  return `${whole} min ${seconds} sec`
}

const ACCOMMODATION_OPTIONS: {
  value: TimerAccommodation
  label: string
}[] = [
  { value: 'standard', label: 'Standard time' },
  { value: '150%', label: '150% extended time' },
  { value: '200%', label: '200% extended time' },
  { value: 'untimed', label: 'Untimed' },
]

export function TimerAccommodationsModal({
  baseTimeMinutes,
  value,
  onSave,
}: TimerAccommodationsModalProps) {
  const [selected, setSelected] = useState<TimerAccommodation>(value)

  // Sync local state when the modal opens — reset to current prop value
  useEffect(() => {
    setSelected(value)
  }, [value])

  const handleValueChange = (v: string) => {
    const result = TimerAccommodationEnum.safeParse(v)
    if (result.success) setSelected(result.data)
  }

  const handleSave = () => {
    onSave(selected)
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Timer Accommodations</DialogTitle>
        <DialogDescription>
          Extended time is available for learners who need additional time due to disabilities or
          other needs.
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={selected}
        onValueChange={handleValueChange}
        aria-label="Timer accommodation"
        className="mt-2 gap-2"
      >
        {ACCOMMODATION_OPTIONS.map(option => {
          const isSelected = selected === option.value
          const multiplier = getAccommodationMultiplier(option.value)
          const duration =
            multiplier != null ? formatDuration(baseTimeMinutes * multiplier) : 'No time limit'

          return (
            <label
              key={option.value}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 min-h-12 cursor-pointer transition-colors duration-200',
                isSelected
                  ? 'border-brand bg-brand-soft'
                  : 'border-border bg-card hover:border-brand/50'
              )}
            >
              <RadioGroupItem value={option.value} />
              <div className="flex-1 py-2">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground ml-1">({duration})</span>
              </div>
            </label>
          )
        })}
      </RadioGroup>

      <Button variant="brand" className="mt-4 w-full rounded-xl h-12" onClick={handleSave}>
        Save
      </Button>
    </DialogContent>
  )
}
