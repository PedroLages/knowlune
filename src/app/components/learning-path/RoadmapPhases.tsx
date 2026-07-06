import { useState } from 'react'
import { Link } from 'react-router'
import {
  Check,
  Lock,
  ArrowRight,
  ChevronDown,
  Clock,
  BookOpen,
  Play,
  Target,
} from 'lucide-react'
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

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; chip: string }> = {
  current: { label: 'Current', chip: 'bg-brand text-brand-foreground' },
  next: { label: 'Next', chip: 'bg-muted-foreground/10 text-muted-foreground' },
  completed: { label: 'Complete', chip: 'bg-success-soft text-success' },
  locked: { label: 'Locked', chip: 'bg-muted text-muted-foreground' },
  available: { label: 'Available', chip: 'bg-muted text-muted-foreground' },
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Visual roadmap with stacked phase sections.
 * Each phase shows: header (numbered + name + description + metadata),
 * then stacked course cards with Current/Next/Locked status, progress,
 * and expandable details.
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
  const entryByCourseId = new Map(entries.map(e => [e.courseId, e]))

  // Track which course cards are expanded
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  const toggleExpand = (courseId: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) {
        next.delete(courseId)
      } else {
        next.add(courseId)
      }
      return next
    })
  }

  return (
    <div className={cn('space-y-10', className)}>
      {phases.map((phase, phaseIdx) => {
        const phaseCourses = phase.courseIds
          .map(cid => {
            const info = courseInfoMap.get(cid)
            const entry = entryByCourseId.get(cid)
            return { courseId: cid, info, entry }
          })
          .filter(c => c.info && c.entry)

        if (phaseCourses.length === 0) return null

        // Phase metadata
        const totalLessons = phaseCourses.reduce(
          (sum, c) => sum + (c.info?.videoCount ?? 0),
          0
        )
        const totalDuration = phaseCourses.reduce(
          (sum, c) => sum + (c.info?.totalDuration ?? 0),
          0
        )
        const phaseHours = totalDuration > 0 ? Math.round(totalDuration / 3600) : undefined

        // Find the current course index in this phase (-1 if none)
        const currentIdx = phaseCourses.findIndex(c => c.courseId === currentCourseId)

        return (
          <section key={phase.name} className="space-y-4">
            {/* ── Phase Header ── */}
            <div className="flex items-start gap-4">
              <span className="flex items-center justify-center size-9 rounded-full bg-brand-soft text-brand-soft-foreground text-sm font-bold flex-shrink-0 mt-0.5">
                {phaseIdx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-bold text-foreground">{phase.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                  <span>
                    {phaseCourses.length}{' '}
                    {phaseCourses.length === 1 ? 'course' : 'courses'}
                  </span>
                  {phaseHours != null && phaseHours > 0 && (
                    <span>~{phaseHours}h</span>
                  )}
                  {totalLessons > 0 && (
                    <span>
                      {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
                    </span>
                  )}
                </div>
                {phase.description && (
                  <p className="text-sm text-muted-foreground mt-1.5">{phase.description}</p>
                )}
              </div>
            </div>

            {/* ── Course Cards ── */}
            <div className="space-y-3 pl-[52px]">
              {phaseCourses.map(({ courseId, info, entry }, idx) => {
                const pct = info?.completionPct ?? 0
                const isCompleted = pct >= 100
                const isCurrent = courseId === currentCourseId
                // "Next" = the first non-completed course after current
                const isNext =
                  !isCompleted &&
                  !isCurrent &&
                  currentIdx >= 0 &&
                  idx === currentIdx + 1
                const isLocked = !isCompleted && !isCurrent && !isNext
                const isExpanded = expandedCourses.has(courseId)

                const status = isCompleted
                  ? 'completed'
                  : isCurrent
                    ? 'current'
                    : isNext
                      ? 'next'
                      : isLocked
                        ? 'locked'
                        : 'available'
                const style = STATUS_STYLES[status]

                return (
                  <div
                    key={courseId}
                    className={cn(
                      'rounded-2xl border transition-all duration-200 overflow-hidden',
                      isCurrent
                        ? 'border-brand/40 ring-2 ring-brand/10 bg-brand-soft/10'
                        : isCompleted
                          ? 'border-success/20 bg-success-soft/5'
                          : isNext
                            ? 'border-border/60 bg-card'
                            : 'border-border/40 bg-card/60 opacity-70'
                    )}
                  >
                    {/* Card body — clickable to expand */}
                    <button
                      type="button"
                      className="w-full text-left p-4 flex items-start gap-4"
                      onClick={() => toggleExpand(courseId)}
                      aria-expanded={isExpanded}
                      aria-label={`${info?.name || 'Course'} — ${style.label}`}
                    >
                      {/* Status indicator */}
                      <div className="flex-shrink-0 mt-0.5">
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
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4
                            className={cn(
                              'text-base font-bold',
                              isCompleted
                                ? 'text-muted-foreground'
                                : isCurrent
                                  ? 'text-brand-soft-foreground'
                                  : 'text-foreground'
                            )}
                          >
                            {info?.name || 'Course'}
                          </h4>
                          <span
                            className={cn(
                              'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider',
                              style.chip
                            )}
                          >
                            {style.label}
                          </span>
                        </div>

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                          {(info?.videoCount ?? 0) > 0 && (
                            <span>
                              {info?.videoCount}{' '}
                              {info?.videoCount === 1 ? 'lesson' : 'lessons'}
                            </span>
                          )}
                          {pct > 0 && !isCompleted && (
                            <span className="font-semibold text-brand">{pct}% complete</span>
                          )}
                          {isCompleted && (
                            <span className="font-semibold text-success">Completed</span>
                          )}
                        </div>

                        {/* Progress bar (non-completed, with progress) */}
                        {pct > 0 && !isCompleted && (
                          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                              className="bg-brand h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Expand chevron + action for current course */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isCurrent && (
                          <Link
                            to={`/courses/${courseId}`}
                            state={linkState}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand-hover transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <Play className="size-4" aria-hidden="true" />
                            Resume
                          </Link>
                        )}
                        <ChevronDown
                          className={cn(
                            'size-5 text-muted-foreground transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border">
                        <div className="pt-4 space-y-3">
                          {/* Course actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/courses/${courseId}`}
                              state={linkState}
                              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand-hover transition-colors"
                            >
                              <BookOpen className="size-4" aria-hidden="true" />
                              View Course
                            </Link>
                            {(info?.videoCount ?? 0) > 0 && (
                              <span className="text-sm text-muted-foreground">
                                {info?.videoCount}{' '}
                                {info?.videoCount === 1 ? 'lesson' : 'lessons'}
                                {info?.totalDuration != null &&
                                  info.totalDuration > 0 &&
                                  ` · ${formatDuration(info.totalDuration)}`}
                              </span>
                            )}
                          </div>

                          {/* Course description */}
                          {info?.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {info.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Milestone project placeholder */}
              <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/20 p-4 flex items-center gap-3 opacity-70">
                <Target className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Milestone projects will appear here as you progress
                </p>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Format helpers ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return '< 1m'
}
