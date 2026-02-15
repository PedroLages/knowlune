import { Circle, CheckCircle2, PauseCircle } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import type { LearnerCourseStatus } from '@/data/types'

const statuses: {
  value: LearnerCourseStatus
  label: string
  icon: typeof Circle
  activeClass: string
}[] = [
  {
    value: 'active',
    label: 'Active',
    icon: Circle,
    activeClass: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  {
    value: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    activeClass: 'bg-green-600 text-white hover:bg-green-700',
  },
  {
    value: 'paused',
    label: 'Paused',
    icon: PauseCircle,
    activeClass: 'bg-gray-400 text-white hover:bg-gray-500',
  },
]

interface StatusFilterProps {
  selectedStatuses: LearnerCourseStatus[]
  onSelectedStatusesChange: (statuses: LearnerCourseStatus[]) => void
}

export function StatusFilter({ selectedStatuses, onSelectedStatusesChange }: StatusFilterProps) {
  function toggleStatus(status: LearnerCourseStatus) {
    if (selectedStatuses.includes(status)) {
      onSelectedStatusesChange(selectedStatuses.filter(s => s !== status))
    } else {
      onSelectedStatusesChange([...selectedStatuses, status])
    }
  }

  return (
    <div
      data-testid="status-filter-bar"
      role="group"
      aria-label="Filter by status"
      className="flex flex-wrap gap-2 items-center mb-6"
    >
      <span className="text-xs text-muted-foreground mr-1">Status:</span>
      {statuses.map(({ value, label, icon: Icon, activeClass }) => {
        const isSelected = selectedStatuses.includes(value)
        return (
          <button
            key={value}
            type="button"
            data-testid="status-filter-button"
            aria-pressed={isSelected}
            onClick={() => toggleStatus(value)}
          >
            <Badge
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer gap-1',
                isSelected ? activeClass : 'hover:bg-accent'
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
              {label}
            </Badge>
          </button>
        )
      })}
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
