import { useEffect, useRef } from 'react'
import { Check, Play, Lock, AlertCircle, Import, Search, Replace, BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { CourseTypeBadge } from '@/app/components/shared/CourseTypeBadge'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'

// ---- Types ----

export interface GapResolution {
  entryId: string
  type: 'import' | 'match' | 'replace'
}

interface TimelineEntry extends LearningPathEntry {
  info?: PathCourseInfo
  thumbnailUrl?: string
}

interface PathTimelineProps {
  entries: TimelineEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  thumbnailUrls: Record<string, string>
  gapEntries: TimelineEntry[]
  onGapResolve: (resolution: GapResolution) => void
  onCourseClick: (courseId: string) => void
  /** Optional: auto-scroll to the current in-progress entry */
  autoScrollToCurrent?: boolean
  /** Set of course IDs that are currently loading */
  loadingResolve?: Set<string>
  className?: string
}

// ---- Sub-components ----

/** Status circle on the timeline connector line */
function StatusCircle({
  status,
}: {
  status: 'completed' | 'in-progress' | 'locked' | 'gap'
  position: number
}) {
  const baseClass =
    'size-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold relative z-10'

  if (status === 'completed') {
    return (
      <div className={cn(baseClass, 'bg-success text-success-foreground')}>
        <Check className="size-4" aria-hidden="true" />
      </div>
    )
  }

  if (status === 'in-progress') {
    return (
      <div
        className={cn(baseClass, 'bg-brand text-brand-foreground shadow-[0_0_8px_var(--brand)]')}
      >
        <Play className="size-4 fill-current" aria-hidden="true" />
      </div>
    )
  }

  if (status === 'gap') {
    return (
      <div
        className={cn(
          baseClass,
          'bg-warning/20 text-warning border-2 border-dashed border-warning/50'
        )}
      >
        <AlertCircle className="size-4" aria-hidden="true" />
      </div>
    )
  }

  // Locked
  return (
    <div className={cn(baseClass, 'bg-muted text-muted-foreground')}>
      <Lock className="size-4" aria-hidden="true" />
    </div>
  )
}

/** Gap entry card with resolution buttons */
function GapTimelineEntry({
  entry,
  onResolve,
  isLoading,
}: {
  entry: TimelineEntry
  onResolve: (resolution: GapResolution) => void
  isLoading?: boolean
}) {
  const matchTitleMatch = entry.justification?.match(/\[Search for: (.+)\]$/)
  const searchTerm = matchTitleMatch ? matchTitleMatch[1] : undefined
  const justification = entry.justification?.replace(/\s*\[Search for: .+\]$/, '') || undefined

  return (
    <div className="flex gap-4" data-testid={`gap-entry-${entry.id}`}>
      {/* Connector line column */}
      <div className="flex flex-col items-center">
        <StatusCircle status="gap" position={entry.position} />
        <div className="w-px flex-1 bg-gradient-to-b from-warning/50 to-warning/20" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <Card className="border-2 border-dashed border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">
                  {justification || searchTerm || `Course ${entry.position}`}
                </h4>
                {justification && justification !== searchTerm && (
                  <p className="text-xs text-muted-foreground mt-0.5">{justification}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs border-warning/60 text-warning">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Not in your library
                  </Badge>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs w-full justify-start"
                  onClick={() => onResolve({ entryId: entry.id, type: 'import' })}
                  disabled={isLoading}
                >
                  <Import className="size-3.5 mr-1" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs w-full justify-start"
                  onClick={() => onResolve({ entryId: entry.id, type: 'match' })}
                  disabled={isLoading}
                >
                  <Search className="size-3.5 mr-1" />
                  Match
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs w-full justify-start"
                  onClick={() => onResolve({ entryId: entry.id, type: 'replace' })}
                  disabled={isLoading}
                >
                  <Replace className="size-3.5 mr-1" />
                  Replace
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Regular course entry card on the timeline */
function CourseTimelineEntry({
  entry,
  info,
  thumbUrl,
  isCompleted,
  isInProgress,
  onClick,
}: {
  entry: TimelineEntry
  info?: PathCourseInfo
  thumbUrl?: string
  isCompleted: boolean
  isInProgress: boolean
  onClick: () => void
}) {
  const status = isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'locked'
  const entryRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex gap-4" ref={entryRef}>
      {/* Connector line column */}
      <div className="flex flex-col items-center">
        <StatusCircle status={status} position={entry.position} />
        <div className="w-px flex-1 bg-gradient-to-b from-brand/40 via-border to-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all duration-200',
            isCompleted && 'border-success/20 bg-success/5',
            isInProgress && 'border-brand/20 bg-brand/5'
          )}
          onClick={onClick}
          tabIndex={0}
          role="button"
          aria-label={`${info?.name || 'Course'} — ${isCompleted ? 'Completed' : isInProgress ? `${info?.completionPct ?? 0}% complete` : 'Not started'}`}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="size-12 shrink-0 rounded-lg bg-muted overflow-hidden">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="size-full flex items-center justify-center">
                    <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Course info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm leading-tight truncate">
                    {info?.name || 'Unknown Course'}
                  </h3>
                  <CourseTypeBadge courseType={entry.courseType} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {info?.authorName && (
                    <span className="text-xs text-muted-foreground truncate">
                      {info.authorName}
                    </span>
                  )}
                  {isCompleted ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider border-success/30 text-success"
                    >
                      Completed
                    </Badge>
                  ) : isInProgress ? (
                    <span className="text-xs text-brand font-medium">
                      {info?.completionPct ?? 0}% complete
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not started</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- Main Component ----

/**
 * Vertical timeline showing all courses in sequence with status indicators.
 * Replaces the flat RoadmapListView with a connector line and status circles.
 */
export function PathTimeline({
  entries,
  courseInfoMap,
  thumbnailUrls,
  gapEntries,
  onGapResolve,
  onCourseClick,
  autoScrollToCurrent = true,
  loadingResolve,
  className,
}: PathTimelineProps) {
  const gapEntryIds = new Set(gapEntries.map(e => e.id))
  const timelineRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the current in-progress entry on mount
  useEffect(() => {
    if (!autoScrollToCurrent || entries.length === 0) return

    const currentIndex = entries.findIndex(e => {
      if (e.courseId === '' || gapEntryIds.has(e.id)) return false
      const info = courseInfoMap.get(e.courseId)
      const pct = info?.completionPct ?? 0
      return pct > 0 && pct < 100
    })

    if (currentIndex === -1) return

    // Small delay to let the DOM render first
    const timer = setTimeout(() => {
      const container = timelineRef.current
      if (!container) return
      const rows = container.querySelectorAll('[role="listitem"]')
      if (rows[currentIndex]) {
        rows[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [autoScrollToCurrent, entries, courseInfoMap, gapEntryIds])

  if (entries.length === 0) {
    return null
  }

  return (
    <div ref={timelineRef} className={cn('space-y-0', className)} role="list" aria-label="Timeline">
      {entries.map((entry, i) => {
        // Gap entry — render with resolution actions
        if (entry.courseId === '' || gapEntryIds.has(entry.id)) {
          return (
            <div key={entry.id || `gap-${i}`} role="listitem">
              <GapTimelineEntry
                entry={entry}
                onResolve={onGapResolve}
                isLoading={loadingResolve?.has(entry.id)}
              />
            </div>
          )
        }

        const info = courseInfoMap.get(entry.courseId)
        const thumbUrl = thumbnailUrls[entry.courseId]
        const isCompleted = (info?.completionPct ?? 0) >= 100
        const isInProgress = (info?.completionPct ?? 0) > 0 && !isCompleted

        return (
          <div key={entry.courseId} role="listitem">
            <CourseTimelineEntry
              entry={entry}
              info={info}
              thumbUrl={thumbUrl}
              isCompleted={isCompleted}
              isInProgress={isInProgress}
              onClick={() => onCourseClick(entry.courseId)}
            />
          </div>
        )
      })}
    </div>
  )
}
