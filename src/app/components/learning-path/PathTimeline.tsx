import { useEffect, useRef, useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { Check, Play, Lock, AlertCircle, Import, Search, Replace, PlayCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { CourseThumbnail } from '@/app/components/shared/CourseThumbnail'
import { extractGapSearchTerm, cleanGapJustification } from '@/data/learningPathUtils'
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
  /** When true, renders cards without the timeline connector column */
  simplified?: boolean
  className?: string
}

// ---- Sub-components ----

/** Status circle on the timeline connector line */
function StatusCircle({
  status,
}: {
  status: 'completed' | 'in-progress' | 'locked' | 'gap'
}) {
  const baseClass =
    'size-7 shrink-0 rounded-full flex items-center justify-center relative z-10'

  if (status === 'completed') {
    return (
      <div className={cn(baseClass, 'bg-success text-success-foreground')}>
        <Check className="size-3.5" aria-hidden="true" />
      </div>
    )
  }

  if (status === 'in-progress') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Pulse ring */}
        <div className="absolute inset-0 size-7 rounded-full ring-[3px] ring-brand-soft animate-pulse" />
        <div className={cn(baseClass, 'bg-brand text-brand-foreground')}>
          <Play className="size-3.5 fill-current" aria-hidden="true" />
        </div>
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
        <AlertCircle className="size-3.5" aria-hidden="true" />
      </div>
    )
  }

  // Locked
  return (
    <div className={cn(baseClass, 'bg-muted text-muted-foreground')}>
      <Lock className="size-3.5" aria-hidden="true" />
    </div>
  )
}

/** Gap entry card with resolution buttons */
function GapTimelineEntry({
  entry,
  onResolve,
  isLoading,
  simplified,
}: {
  entry: TimelineEntry
  onResolve: (resolution: GapResolution) => void
  isLoading?: boolean
  simplified?: boolean
}) {
  const searchTerm = extractGapSearchTerm(entry.justification)
  const justification = cleanGapJustification(entry.justification)

  return (
    <div className="flex gap-4" data-testid={`gap-entry-${entry.id}`}>
      {/* Connector line column */}
      {!simplified && (
        <div className="flex flex-col items-center">
          <StatusCircle status="gap" />
          <div className="w-[2px] flex-1 bg-gradient-to-b from-warning/50 to-warning/20" />
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 mb-4' : 'flex-1 pb-8'}>
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
  index,
  onClick,
  simplified,
}: {
  entry: TimelineEntry
  info?: PathCourseInfo
  thumbUrl?: string
  isCompleted: boolean
  isInProgress: boolean
  index: number
  onClick: () => void
  simplified?: boolean
}) {
  const status = isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'locked'
  const entryRef = useRef<HTMLDivElement>(null)

  const statusLabel = isCompleted ? 'Completed' : isInProgress ? 'Up Next' : 'Locked'

  return (
    <div className="flex gap-4" ref={entryRef}>
      {/* Connector line column */}
      {!simplified && (
        <div className="flex flex-col items-center">
          <StatusCircle status={status} />
          <div className="w-[2px] flex-1 bg-gradient-to-b from-brand/40 via-border to-border" />
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 min-w-0 mb-4' : 'flex-1 pb-8 min-w-0'}>
        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all duration-200',
            isCompleted && 'border-success/20',
            isInProgress && 'border-brand/20'
          )}
          onClick={onClick}
          tabIndex={0}
          role="button"
          aria-label={`Module ${index + 1}: ${info?.name || 'Course'} — ${statusLabel}`}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
        >
          <CardContent className="p-5">
            {/* Header: module number + status badge */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Module {index + 1}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1',
                  isCompleted && 'bg-success-soft text-success',
                  isInProgress && 'bg-brand-soft text-brand-soft-foreground',
                  !isCompleted && !isInProgress && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted && <Check className="size-3" aria-hidden="true" />}
                {isInProgress && (
                  <span className="size-1.5 rounded-full bg-brand-soft-foreground animate-pulse" />
                )}
                {statusLabel}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold mb-1">{info?.name || 'Unknown Course'}</h3>

            {/* Author */}
            {info?.authorName && !simplified && (
              <p className="text-sm text-muted-foreground mb-3">{info.authorName}</p>
            )}

            {/* Metadata row */}
            {!simplified && (
              <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium mb-4">
                <span className="inline-flex items-center gap-1.5">
                  <CourseThumbnail url={thumbUrl} className="size-4 rounded" />
                  <span>{entry.courseType === 'imported' ? 'Imported' : 'Catalog'}</span>
                </span>
              </div>
            )}

            {/* Action button */}
            {!simplified && (
              <div className="flex justify-end">
                {isInProgress ? (
                  <Button
                    variant="brand"
                    size="sm"
                    className="px-5 py-2 rounded-xl text-sm font-bold shadow-sm"
                    onClick={e => {
                      e.stopPropagation()
                      onClick()
                    }}
                  >
                    <PlayCircle className="size-4 mr-1.5" aria-hidden="true" />
                    Start Module
                  </Button>
                ) : isCompleted ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-5 py-2 rounded-xl text-sm font-bold"
                    onClick={e => {
                      e.stopPropagation()
                      onClick()
                    }}
                  >
                    <RotateCcw className="size-4 mr-1.5" aria-hidden="true" />
                    Review
                  </Button>
                ) : (
                  <span className="px-5 py-2 rounded-xl text-sm font-bold bg-muted/50 text-muted-foreground cursor-not-allowed inline-flex items-center gap-1.5">
                    <Lock className="size-3.5" aria-hidden="true" />
                    Locked
                  </span>
                )}
              </div>
            )}
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
  simplified,
  className,
}: PathTimelineProps) {
  const gapEntryIds = useMemo(() => new Set(gapEntries.map(e => e.id)), [gapEntries])
  const timelineRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

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
        rows[currentIndex].scrollIntoView({ behavior: prefersReducedMotion ? 'instant' : 'smooth', block: 'center' })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [autoScrollToCurrent, entries, courseInfoMap, gapEntryIds, prefersReducedMotion])

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
                simplified={simplified}
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
              index={i}
              onClick={() => onCourseClick(entry.courseId)}
              simplified={simplified}
            />
          </div>
        )
      })}
    </div>
  )
}
