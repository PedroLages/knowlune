import { useEffect, useState } from 'react'
import type { TimerAccommodation } from '@/types/quiz'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'

interface TimerAccommodationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
  const seconds = Math.round((minutes - whole) * 60)
  if (seconds === 0) return `${whole} ${whole === 1 ? 'minute' : 'minutes'}`
  return `${whole} min ${seconds} sec`
}

const ACCOMMODATION_OPTIONS: {
  value: TimerAccommodation
  label: string
  multiplier: number | null
}[] = [
  { value: 'standard', label: 'Standard time', multiplier: 1 },
  { value: '150%', label: '150% extended time', multiplier: 1.5 },
  { value: '200%', label: '200% extended time', multiplier: 2 },
  { value: 'untimed', label: 'Untimed', multiplier: null },
]

export function TimerAccommodationsModal({
  open,
  onOpenChange,
  baseTimeMinutes,
  value,
  onSave,
}: TimerAccommodationsModalProps) {
  const [selected, setSelected] = useState<TimerAccommodation>(value)

  // Sync local state when the modal opens — reset to current prop value
  useEffect(() => {
    if (open) setSelected(value)
  }, [open, value])

  const handleSave = () => {
    onSave(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Timer Accommodations</DialogTitle>
          <DialogDescription>
            Choose a time accommodation that suits your learning needs.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={v => setSelected(v as TimerAccommodation)}
          aria-label="Timer accommodation"
          className="mt-2 gap-2"
        >
          {ACCOMMODATION_OPTIONS.map(option => {
            const isSelected = selected === option.value
            const duration =
              option.multiplier != null
                ? formatDuration(baseTimeMinutes * option.multiplier)
                : 'No time limit'

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

        <p className="text-sm text-muted-foreground mt-2">
          Extended time is available for learners who need additional time due to disabilities or
          other needs.
        </p>

        <Button variant="brand" className="mt-4 w-full rounded-xl h-12" onClick={handleSave}>
          Save
        </Button>
      </DialogContent>
    </Dialog>
  )
}
