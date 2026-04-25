import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import { cn } from '@/app/components/ui/utils'
import type { CourseGridColumns } from '@/stores/useEngagementPrefsStore'

const OPTIONS: ReadonlyArray<{
  value: CourseGridColumns
  /** Visible button label (short form) */
  short: string
  /** Accessible label (long form) */
  label: string
}> = [
  { value: 'auto', short: 'Auto', label: 'Auto columns' },
  { value: 2, short: '2', label: '2 columns' },
  { value: 3, short: '3', label: '3 columns' },
  { value: 4, short: '4', label: '4 columns' },
  { value: 5, short: '5', label: '5 columns' },
] as const

/** Map a Radix ToggleGroup string value back to the typed union. */
function parseValue(raw: string): CourseGridColumns | null {
  if (raw === 'auto') return 'auto'
  if (raw === '2') return 2
  if (raw === '3') return 3
  if (raw === '4') return 4
  if (raw === '5') return 5
  return null
}

export interface GridColumnControlProps {
  value: CourseGridColumns
  onChange: (value: CourseGridColumns) => void
  className?: string
}

/**
 * GridColumnControl — column-count selector for the Courses page grid view
 * (E99-S02). Visible only when `courseViewMode === 'grid'` (the parent owns
 * that conditional). On viewports < 640px the toggle stays visible but a
 * helper line clarifies that the preference applies on larger screens —
 * mobile always renders one column regardless of selection.
 */
export function GridColumnControl({ value, onChange, className }: GridColumnControlProps) {
  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <ToggleGroup
        type="single"
        variant="outline"
        value={String(value)}
        onValueChange={next => {
          // Radix emits '' when the active item is clicked again. Ignore it
          // so the component behaves as a strict radio group.
          const parsed = parseValue(next)
          if (parsed !== null) {
            onChange(parsed)
          }
        }}
        aria-label="Course grid column count"
        data-testid="course-grid-column-control"
        className="rounded-xl"
      >
        {OPTIONS.map(({ value: option, short, label }) => (
          <ToggleGroupItem
            key={String(option)}
            value={String(option)}
            aria-label={label}
            data-testid={`course-grid-columns-${option}`}
            className={cn(
              'min-h-11 min-w-11 px-3',
              'text-muted-foreground',
              'data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground',
              'motion-safe:transition-colors'
            )}
          >
            <span className="text-sm">{short}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p
        className="text-xs text-muted-foreground sm:hidden"
        data-testid="course-grid-columns-mobile-hint"
      >
        Applies on larger screens
      </p>
    </div>
  )
}

export default GridColumnControl
