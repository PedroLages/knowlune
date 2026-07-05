import {
  Clock,
  BookOpen,
  BarChart3,
  Calendar,
  Pencil,
  Target,
  TrendingUp,
  Flag,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { ProgressionModeToggle } from '@/app/components/learning-path/ProgressionModeToggle'
import { cn } from '@/app/components/ui/utils'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'
import type { PathProgressionMode } from '@/data/types'

interface PathProgressSidebarProps {
  progress: PathProgressSummary
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
  /** Current in-progress course info */
  currentCourseName?: string
  currentCoursePct?: number
  /** Weekly study data */
  weeklyStudyMinutes?: number
  weeklyGoalMinutes?: number
  onSetWeeklyGoal?: () => void
  /** Next milestone data */
  nextMilestoneName?: string
  nextMilestoneEstimate?: string
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function PathProgressSidebar({
  progress,
  skillTags,
  className,
  difficultyLabel,
  estimatedHours,
  courseCount,
  createdAt,
  updatedAt,
  progressionMode,
  onProgressionModeChange,
  currentCourseName,
  currentCoursePct,
  weeklyStudyMinutes,
  weeklyGoalMinutes,
  onSetWeeklyGoal,
  nextMilestoneName,
  nextMilestoneEstimate,
}: PathProgressSidebarProps) {
  const { completionPct, completedCourses, totalCourses, estimatedRemainingHours } = progress

  const formattedTime =
    estimatedRemainingHours > 0 ? `~${Math.round(estimatedRemainingHours)}h` : '0h'

  return (
    <aside className={cn('space-y-6', className)}>
      {/* Progress card — cinematic glass surface */}
      <Card className="rounded-[24px] border border-border/50 bg-card shadow-card-ambient">
        <CardContent className="p-6">
          {/* Your Progress heading */}
          <h3 className="font-display text-lg font-bold mb-6">Your Progress</h3>

          {/* Progress ring with soft brand glow wrapper */}
          <div className="flex justify-center mb-6 relative">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-36 rounded-full bg-brand/5 blur-2xl pointer-events-none"
              aria-hidden="true"
            />
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

          {/* Stats with explicit labels */}
          <div className="space-y-3">
            {/* Track progress */}
            <div className="flex items-center gap-3 text-sm">
              <TrendingUp className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Track progress</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {completionPct > 0 && Math.round(completionPct) === 0
                  ? '< 1%'
                  : `${Math.round(completionPct)}%`}
              </span>
            </div>

            {/* Current course progress */}
            {currentCourseName != null && currentCoursePct != null && (
              <div className="flex items-center gap-3 text-sm">
                <BookOpen className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
                <span
                  className="text-muted-foreground truncate max-w-[140px]"
                  title={currentCourseName}
                >
                  Current course
                </span>
                <span className="ml-auto font-bold text-foreground tabular-nums">
                  {Math.round(currentCoursePct)}%
                </span>
              </div>
            )}

            {/* Courses completed */}
            <div className="flex items-center gap-3 text-sm">
              <Flag className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Courses completed</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {completedCourses} / {totalCourses}
              </span>
            </div>

            {/* Estimated time left */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Estimated time left</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Divider + skills */}
          {skillTags && skillTags.length > 0 && (
            <>
              <hr className="my-6 border-border/50" />
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
            </>
          )}
        </CardContent>
      </Card>

      {/* This Week card */}
      <Card className="rounded-[24px] border border-border/50 bg-card shadow-card-ambient">
        <CardContent className="p-5">
          <h3 className="font-display text-sm font-bold mb-4 flex items-center gap-2">
            <Target className="size-4 text-brand" aria-hidden="true" />
            This Week
          </h3>
          {weeklyStudyMinutes != null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatHours(weeklyStudyMinutes)} studied
                </span>
                {weeklyGoalMinutes != null && weeklyGoalMinutes > 0 && (
                  <span className="font-medium text-foreground tabular-nums">
                    Goal: {formatHours(weeklyGoalMinutes)}
                  </span>
                )}
              </div>
              {weeklyGoalMinutes != null && weeklyGoalMinutes > 0 && (
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand h-full rounded-full motion-safe:transition-all motion-safe:duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((weeklyStudyMinutes / weeklyGoalMinutes) * 100))}%`,
                    }}
                  />
                </div>
              )}
              {weeklyGoalMinutes == null && onSetWeeklyGoal && (
                <Button
                  variant="brand-outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onSetWeeklyGoal}
                >
                  Set weekly goal
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">Start studying to track your time.</p>
          )}
        </CardContent>
      </Card>

      {/* Next Milestone card */}
      {nextMilestoneName && (
        <Card className="rounded-[24px] border border-border/50 bg-card shadow-card-ambient">
          <CardContent className="p-5">
            <h3 className="font-display text-sm font-bold mb-3 flex items-center gap-2">
              <Flag className="size-4 text-brand" aria-hidden="true" />
              Next Milestone
            </h3>
            <p className="text-sm font-semibold text-foreground">{nextMilestoneName}</p>
            {nextMilestoneEstimate && (
              <p className="text-xs text-muted-foreground mt-1">{nextMilestoneEstimate}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Track Info card */}
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
              {courseCount != null && courseCount > 1 && onProgressionModeChange != null && (
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
