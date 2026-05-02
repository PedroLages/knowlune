import { LayoutGrid, List, Rows3 } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import { cn } from '@/app/components/ui/utils'
import type { CourseViewMode } from '@/stores/useEngagementPrefsStore'

const OPTIONS: ReadonlyArray<{
  value: CourseViewMode
  label: string
  Icon: typeof LayoutGrid
}> = [
  { value: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { value: 'list', label: 'List view', Icon: List },
  { value: 'compact', label: 'Compact view', Icon: Rows3 },
] as const

export interface ViewModeToggleProps {
  value: CourseViewMode
  onChange: (value: CourseViewMode) => void
  className?: string
}

/**
 * ViewModeToggle — three-option toggle (grid / list / compact) for the Courses
 * page. E99-S01 ships the toggle and persistence; the list/compact renderers
 * land in S03/S04 — until then all three values render the existing grid.
 *
 * Uses shadcn ToggleGroup (Radix `role="radiogroup"`) so arrow-key navigation
 * and selected-state semantics are provided for free.
 */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={next => {
        // Radix emits '' when the active item is clicked again. Ignore it so
        // the component behaves as a strict radio group (one always selected).
        if (next === 'grid' || next === 'list' || next === 'compact') {
          onChange(next)
        }
      }}
      aria-label="Courses view mode"
      data-testid="course-view-mode-toggle"
      className={cn('rounded-xl', className)}
    >
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-label={label}
          data-testid={`course-view-mode-${option}`}
          className={cn(
            'min-h-11 min-w-11 px-3 gap-2',
            'text-muted-foreground',
            'data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground',
            'motion-safe:transition-colors'
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="sr-only md:not-sr-only md:text-sm">{label.replace(' view', '')}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export default ViewModeToggle
