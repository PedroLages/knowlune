/**
 * TutorModeChips (E57-S04)
 *
 * Horizontal chip group for switching between Socratic and Explain modes.
 * Uses design tokens and aria-pressed for accessibility.
 */

import { cn } from '@/app/components/ui/utils'
import type { TutorMode } from '@/ai/tutor/types'

interface TutorModeChipsProps {
  mode: TutorMode
  onModeChange: (mode: TutorMode) => void
  disabled?: boolean
}

// 'quiz' mode is system-controlled — not user-selectable
const MODES: { value: TutorMode; label: string }[] = [
  { value: 'socratic', label: 'Socratic' },
  { value: 'explain', label: 'Explain' },
]

export function TutorModeChips({ mode, onModeChange, disabled }: TutorModeChipsProps) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Tutor mode">
      {MODES.map(({ value, label }) => {
        const isSelected = mode === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onModeChange(value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
              'min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected
                ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:border-brand/50 hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
