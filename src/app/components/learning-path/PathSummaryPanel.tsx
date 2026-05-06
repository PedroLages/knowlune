import { BookOpen, Clock, CheckCircle2, Flame } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

interface PathSummaryPanelProps {
  progress: PathProgressSummary
  className?: string
}

/**
 * Glass-panel summary strip showing 4 key metrics and a progress bar.
 * Used at the top of the learning path detail page.
 *
 * - Overall Progress (%)
 * - Lessons Completed (X / Y)
 * - Courses Done (X / Y)
 * - Estimated Remaining Time (~Xh)
 */
export function PathSummaryPanel({ progress, className }: PathSummaryPanelProps) {
  const {
    completionPct,
    completedLessons,
    totalLessons,
    completedCourses,
    totalCourses,
    estimatedRemainingHours,
  } = progress

  const stats = [
    {
      icon: BookOpen,
      label: 'Progress',
      value: `${completionPct}%`,
    },
    {
      icon: Clock,
      label: 'Lessons',
      value: `${completedLessons} / ${totalLessons}`,
    },
    {
      icon: CheckCircle2,
      label: 'Courses',
      value: `${completedCourses} / ${totalCourses}`,
    },
    {
      icon: Flame,
      label: 'Remaining',
      value: estimatedRemainingHours > 0 ? `~${estimatedRemainingHours}h` : '0h',
    },
  ]

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] backdrop-blur-xl p-4 md:p-6',
        className
      )}
      data-testid="path-summary-panel"
    >
      {/* 4-column stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-lg bg-brand-soft flex items-center justify-center">
                <Icon className="size-5 text-brand-soft-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold tabular-nums text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
            style={{ width: `${Math.min(completionPct, 100)}%` }}
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${completionPct}% complete`}
          />
        </div>
      </div>
    </div>
  )
}
