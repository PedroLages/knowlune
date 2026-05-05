import { Check, Lock } from 'lucide-react'
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
 * Timeline node for Course Journey — HTML-reference proportions (~48px) with
 * Knowlune theme tokens. Rail offset is tuned in CourseOverview (`-left-[…]`).
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
        'size-12 shrink-0 rounded-full border-4 border-background flex items-center justify-center transition-colors duration-300',
        status === 'completed' &&
          'bg-success text-success-foreground shadow-[0_0_16px_var(--success)]',
        status === 'active' &&
          'bg-card text-brand shadow-[0_0_20px_var(--brand)] border-brand ring-0',
        status === 'upcoming' &&
          'bg-muted/50 text-muted-foreground shadow-none border-border ring-1 ring-border/80',
        className
      )}
    >
      {status === 'completed' ? (
        <Check className="size-6 stroke-[3]" aria-hidden="true" />
      ) : status === 'active' ? (
        <span className="size-3.5 rounded-full bg-brand shadow-inner" aria-hidden="true" />
      ) : (
        <Lock className="size-5" aria-hidden="true" strokeWidth={2} />
      )}
    </div>
  )
}
