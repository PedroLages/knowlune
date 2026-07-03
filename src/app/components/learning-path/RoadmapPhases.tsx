import { Link } from 'react-router'
import { Check, Lock, ArrowRight } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface RoadmapPhase {
  name: string
  description?: string
  courseIds: string[]
}

interface RoadmapPhasesProps {
  entries: LearningPathEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  phases: RoadmapPhase[]
  trackId: string
  trackName: string
  /** Currently in-progress course ID (highlighted) */
  currentCourseId?: string | null
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Visual roadmap showing the learning journey broken into phases.
 * Each phase is a horizontal card with a phase name and course pills
 * that link to the course detail or lesson player.
 */
export function RoadmapPhases({
  entries,
  courseInfoMap,
  phases,
  trackId,
  trackName,
  currentCourseId,
  className,
}: RoadmapPhasesProps) {
  const linkState = { fromTrack: { trackId, trackName } }

  // Build a courseId → entry lookup for position info
  const entryByCourseId = new Map(entries.map(e => [e.courseId, e]))

  return (
    <div className={cn('space-y-8', className)}>
      {phases.map((phase, phaseIdx) => {
        const phaseCourses = phase.courseIds
          .map(cid => {
            const info = courseInfoMap.get(cid)
            const entry = entryByCourseId.get(cid)
            return { courseId: cid, info, entry }
          })
          .filter(c => c.info && c.entry)

        if (phaseCourses.length === 0) return null

        return (
          <section key={phase.name}>
            {/* Phase header */}
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center size-8 rounded-full bg-brand-soft text-brand-soft-foreground text-sm font-bold">
                  {phaseIdx + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">{phase.name}</h3>
                  {phase.description && (
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Course pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {phaseCourses.map(({ courseId, info, entry }) => {
                const pct = info?.completionPct ?? 0
                const isCompleted = pct >= 100
                const isCurrent = courseId === currentCourseId
                const isLocked = !isCompleted && !isCurrent

                return (
                  <Link
                    key={courseId}
                    to={`/courses/${courseId}`}
                    state={linkState}
                    className={cn(
                      'group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                      isCurrent
                        ? 'border-brand/30 bg-brand-soft/20 ring-1 ring-brand/10'
                        : isCompleted
                          ? 'border-success/20 bg-success-soft/30'
                          : 'border-border/50 bg-card hover:border-brand/20 hover:bg-brand-soft/5'
                    )}
                  >
                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <div className="size-6 rounded-full bg-success text-success-foreground flex items-center justify-center">
                          <Check className="size-3.5" aria-hidden="true" />
                        </div>
                      ) : isCurrent ? (
                        <div className="size-6 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </div>
                      ) : (
                        <div className="size-6 rounded-full bg-muted/50 border border-muted-foreground/20 flex items-center justify-center">
                          <Lock className="size-3 text-muted-foreground/50" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Course info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          isCompleted
                            ? 'text-muted-foreground'
                            : isCurrent
                              ? 'text-brand-soft-foreground'
                              : 'text-foreground group-hover:text-brand-soft-foreground'
                        )}
                      >
                        {info?.name || 'Course'}
                      </p>
                      {pct > 0 && !isCompleted && (
                        <p className="text-xs text-muted-foreground">{pct}% complete</p>
                      )}
                      {isCompleted && (
                        <p className="text-xs text-success">Completed</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
