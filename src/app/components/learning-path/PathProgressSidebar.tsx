import { Clock, BookOpen, BarChart3, Calendar, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { ProgressionModeToggle } from '@/app/components/learning-path/ProgressionModeToggle'
import { cn } from '@/app/components/ui/utils'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'
import type { PathProgressionMode, LearningPathEntry } from '@/data/types'

interface PathProgressSidebarProps {
  progress: PathProgressSummary
  /** Path entries — needed to detect completionTargets for dual progress display */
  entries?: LearningPathEntry[]
  skillTags?: string[]
  className?: string
  /** Track metadata (optional — for backward compat with learning paths) */
  difficultyLabel?: string
  estimatedHours?: number
  courseCount?: number
  createdAt?: string
  updatedAt?: string
  /** Progression mode toggle (optional — for learning tracks with 2+ courses) */
  progressionMode?: PathProgressionMode
  onProgressionModeChange?: (mode: PathProgressionMode) => void
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function PathProgressSidebar({
  progress,
  entries,
  skillTags,
  className,
  difficultyLabel,
  estimatedHours,
  courseCount,
  createdAt,
  updatedAt,
  progressionMode,
  onProgressionModeChange,
}: PathProgressSidebarProps) {
  const {
    completionPct,
    completedCourses,
    totalCourses,
    estimatedRemainingHours,
    completedLessons,
    totalLessons,
  } = progress

  // Check if any entry has a completionTarget — dual display applies
  const hasTargets =
    entries?.some(e => e.completionTarget?.targetLessonCount != null) ?? false

  // Compute aggregate absolute total lessons from per-course data
  let absoluteTotal = totalLessons
  if (hasTargets) {
    let absTotal = 0
    for (const cp of progress.courseProgress.values()) {
      absTotal += cp.absoluteTotalLessons
    }
    absoluteTotal = absTotal
  }

  // Compute absolute estimated remaining hours (all lessons, not just target)
  let absoluteEstimatedRemaining = estimatedRemainingHours
  if (hasTargets) {
    let totalAbsRemaining = 0
    for (const cp of progress.courseProgress.values()) {
      const absoluteCompleted =
        cp.absoluteTotalLessons > 0
          ? Math.round((cp.absoluteCompletionPct / 100) * cp.absoluteTotalLessons)
          : 0
      totalAbsRemaining += cp.absoluteTotalLessons - absoluteCompleted
    }
    absoluteEstimatedRemaining = Math.round(
      ((totalAbsRemaining * MINUTES_PER_LESSON) / 60) * 10
    ) / 10
  }

  // Format hours for display
  const formattedTime =
    estimatedRemainingHours > 0 ? `~${Math.round(estimatedRemainingHours)}h` : '0h'
  const formattedAbsTime =
    absoluteEstimatedRemaining > 0 ? `~${Math.round(absoluteEstimatedRemaining)}h` : '0h'

  const showDualTime = hasTargets && Math.round(estimatedRemainingHours) !== Math.round(absoluteEstimatedRemaining)

  // ARIA label for the progress ring — explains target vs absolute progress
  const ringAriaLabel = hasTargets
    ? `${completedLessons} of ${totalLessons} target lessons complete. ${completedLessons} of ${absoluteTotal} total lessons.`
    : undefined

  // Secondary text for dual display: target-capped numerator / absolute denominator
  const secondaryText = hasTargets
    ? `${completedLessons}/${absoluteTotal} total lessons`
    : null

  return (
    <aside className={cn('space-y-6', className)}>
      {/* Progress card — cinematic glass surface */}
      <Card className="rounded-[24px] border border-border/50 bg-card shadow-card-ambient">
        <CardContent className="p-6">
          {/* Your Progress heading */}
          <h3 className="font-display text-lg font-bold mb-6">Your Progress</h3>

          {/* Progress ring with soft brand glow wrapper */}
          <div
            className={cn(
              'mb-6 relative',
              hasTargets
                ? 'flex max-sm:flex-col sm:flex-row sm:items-center sm:justify-center sm:gap-6'
                : 'flex justify-center'
            )}
          >
            {/* Ambient glow behind the ring */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-36 rounded-full bg-brand/5 blur-2xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="flex justify-center"
              role={hasTargets ? 'img' : undefined}
              aria-label={ringAriaLabel}
            >
              <PathProgressRing percentage={completionPct} size="xl" strokeWidth={6}>
                <div className="text-center" aria-live="polite" aria-atomic="true">
                  <span className="block text-2xl font-extrabold text-foreground">
                    {completionPct > 0 && Math.round(completionPct) === 0
                      ? '< 1%'
                      : `${Math.round(completionPct)}%`}
                  </span>
                  <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Complete
                  </span>
                </div>
              </PathProgressRing>
            </div>

            {/* Dual display: secondary text with absolute progress */}
            {secondaryText && (
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">{secondaryText}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <BookOpen className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Modules Completed</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {completedCourses}/{totalCourses}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Estimated Time Left</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {showDualTime
                  ? `${formattedTime} (target) / ${formattedAbsTime} (full)`
                  : formattedTime}
              </span>
            </div>
          </div>

          {/* Divider */}
          {skillTags && skillTags.length > 0 && <hr className="my-6 border-border/50" />}

          {/* Skills tags */}
          {skillTags && skillTags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3">Skills you&apos;ll gain</h3>
              <div className="flex flex-wrap gap-2">
                {skillTags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-muted border border-border/50 rounded-md text-xs font-bold text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificate card removed — see R9 */}
      {/* Track metadata card (only when props are provided) */}
      {(difficultyLabel ||
        estimatedHours != null ||
        courseCount != null ||
        createdAt ||
        updatedAt) && (
        <Card className="rounded-[24px] border border-border/50 bg-card shadow-card-ambient">
          <CardContent className="p-5">
            <h3 className="font-display text-sm font-bold mb-4">Track Info</h3>
            <div className="space-y-2.5 text-sm">
              {difficultyLabel && (
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className="ml-auto font-medium text-foreground">{difficultyLabel}</span>
                </div>
              )}
              {estimatedHours != null && estimatedHours > 0 && (
                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Est. Hours</span>
                  <span className="ml-auto font-medium text-foreground tabular-nums">
                    ~{estimatedHours}h
                  </span>
                </div>
              )}
              {courseCount != null && (
                <div className="flex items-center gap-2.5">
                  <BookOpen className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Courses</span>
                  <span className="ml-auto font-medium text-foreground tabular-nums">
                    {courseCount}
                  </span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Created</span>
                  <span className="ml-auto font-medium text-foreground">
                    {formatDate(createdAt)}
                  </span>
                </div>
              )}
              {updatedAt && updatedAt !== createdAt && (
                <div className="flex items-center gap-2.5">
                  <Pencil className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Updated</span>
                  <span className="ml-auto font-medium text-foreground">
                    {formatDate(updatedAt)}
                  </span>
                </div>
              )}
              {courseCount != null &&
                courseCount > 1 &&
                onProgressionModeChange != null && (
                  <>
                    <hr className="my-3 border-border/50" />
                    <ProgressionModeToggle
                      mode={progressionMode ?? 'sequential'}
                      onChange={onProgressionModeChange}
                    />
                  </>
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </aside>
  )
}
