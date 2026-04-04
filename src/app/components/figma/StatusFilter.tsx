import { Circle, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import type { LearnerCourseStatus } from '@/data/types'

const statuses: {
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
      'data-[state=on]:bg-amber-500 data-[state=on]:text-white data-[state=on]:hover:bg-amber-500/90',
  },
  {
    value: 'active',
    label: 'Active',
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
      'data-[state=on]:bg-muted-foreground data-[state=on]:text-white data-[state=on]:hover:bg-muted-foreground/90',
  },
]

interface StatusFilterProps {
  selectedStatuses: LearnerCourseStatus[]
  onSelectedStatusesChange: (statuses: LearnerCourseStatus[]) => void
}

export function StatusFilter({ selectedStatuses, onSelectedStatusesChange }: StatusFilterProps) {
  return (
    <div data-testid="status-filter-bar" className="flex flex-wrap gap-2 items-center mb-6">
      <span className="text-xs text-muted-foreground mr-1">Status:</span>
      <ToggleGroup
        type="multiple"
        value={selectedStatuses}
        onValueChange={value => onSelectedStatusesChange(value as LearnerCourseStatus[])}
        aria-label="Filter by status"
        className="flex flex-wrap gap-2"
      >
        {statuses.map(({ value, label, icon: Icon, activeClass }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            data-testid="status-filter-button"
            className={cn(
              'min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition-colors first:rounded-full last:rounded-full gap-1 cursor-pointer shadow-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
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
      {selectedStatuses.length > 0 && (
        <button
          type="button"
          data-testid="clear-status-filters"
          onClick={() => onSelectedStatusesChange([])}
          className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
        >
          Clear
        </button>
      )}
    </div>
  )
}
