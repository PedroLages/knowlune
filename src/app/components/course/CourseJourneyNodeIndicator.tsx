import { Check, Circle } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

export type CourseJourneyNodeStatus = 'completed' | 'active' | 'upcoming'

const ARIA_LABEL: Record<CourseJourneyNodeStatus, string> = {
  completed: 'Completed module',
  active: 'Current module',
  upcoming: 'Upcoming module',
}

type Props = {
  status: CourseJourneyNodeStatus
  className?: string
  'data-testid'?: string
}

/**
 * Timeline node for Course Journey. Uses size-6 to align with the existing
 * rail (`pl-8` / `-left-[13px]`); reference mocks often use ~50px for less-dense layouts.
 */
export function CourseJourneyNodeIndicator({
  status,
  className,
  'data-testid': testId = 'course-journey-node-indicator',
}: Props) {
  return (
    <div
      role="img"
      aria-label={ARIA_LABEL[status]}
      data-testid={testId}
      data-status={status}
      className={cn(
        'size-6 rounded-full border-4 border-background flex items-center justify-center transition-colors duration-300',
        status === 'completed' && 'bg-success text-success-foreground shadow-sm',
        status === 'active' && 'bg-card text-brand border-brand shadow-sm',
        status === 'upcoming' && 'bg-muted text-muted-foreground shadow-none border-border',
        className
      )}
    >
      {status === 'completed' ? (
        <Check className="size-3" aria-hidden="true" />
      ) : status === 'active' ? (
        <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
      ) : (
        <Circle className="size-3" aria-hidden="true" strokeWidth={2} />
      )}
    </div>
  )
}
