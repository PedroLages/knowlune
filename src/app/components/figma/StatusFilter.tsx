import { Circle, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import type { LearnerCourseStatus } from '@/data/types'

export const statuses: {
  value: LearnerCourseStatus
  label: string
  icon: typeof Circle
  activeClass: string
}[] = [
  {
    value: 'not-started',
    label: 'Not Started',
    icon: PlayCircle,
    activeClass:
      'data-[state=on]:bg-warning data-[state=on]:text-warning-foreground data-[state=on]:hover:bg-warning/90',
  },
  {
    value: 'active',
    label: 'In Progress',
    icon: Circle,
    activeClass:
      'data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover',
  },
  {
    value: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    activeClass:
      'data-[state=on]:bg-success data-[state=on]:text-success-foreground data-[state=on]:hover:bg-success/90',
  },
  {
    value: 'paused',
    label: 'Paused',
    icon: PauseCircle,
    activeClass:
      'data-[state=on]:bg-muted-foreground data-[state=on]:text-background data-[state=on]:hover:bg-muted-foreground/90',
  },
]

interface StatusFilterProps {
  selectedStatuses: LearnerCourseStatus[]
  onSelectedStatusesChange: (statuses: LearnerCourseStatus[]) => void
}

export function StatusFilter({ selectedStatuses, onSelectedStatusesChange }: StatusFilterProps) {
  return (
    <div data-testid="status-filter-bar" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={selectedStatuses.length === 0}
        onClick={() => onSelectedStatusesChange([])}
        data-testid="status-filter-all"
        className={cn(
          'inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-semibold',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          selectedStatuses.length === 0
            ? 'border-transparent bg-foreground text-background'
            : 'border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        All
      </button>
      <ToggleGroup
        type="multiple"
        value={selectedStatuses}
        onValueChange={value => onSelectedStatusesChange(value as LearnerCourseStatus[])}
        aria-label="Filter by status"
        className="flex w-auto flex-wrap items-center gap-1.5 rounded-none bg-transparent shadow-none"
      >
        {statuses.map(({ value, label, icon: Icon, activeClass }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            data-testid="status-filter-button"
            className={cn(
              // Reset ToggleGroupItem defaults (segmented control + toggle focus border) so each
              // option is a standalone pill — matches TopicFilter.tsx.
              'flex-none min-h-[44px] rounded-full border px-3 py-2',
              'inline-flex items-center gap-1',
              'text-xs font-semibold transition-colors cursor-pointer shadow-none',
              'first:rounded-full last:rounded-full',
              'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
              'data-[state=off]:bg-transparent data-[state=off]:hover:bg-accent data-[state=off]:border-input',
              'data-[state=on]:border-transparent',
              activeClass
            )}
          >
            <Icon className="size-3" aria-hidden="true" />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
