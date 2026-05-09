import { useEffect, useRef, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { Check, Lock, AlertCircle, Import, Search, Replace, PlayCircle, RotateCcw, GripVertical, ChevronDown, Video, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { extractGapSearchTerm, cleanGapJustification } from '@/data/learningPathUtils'
import { formatDuration } from '@/lib/formatDuration'
import type { ChapterGroup } from '@/lib/curriculumGrouping'
import type { LearningPathEntry, PathCourseInfo, ImportedVideo, VideoProgress } from '@/data/types'

// ---- Types ----

export interface GapResolution {
  entryId: string
  type: 'import' | 'match' | 'replace'
}

interface TimelineEntry extends LearningPathEntry {
  info?: PathCourseInfo
}

interface PathTimelineProps {
  entries: TimelineEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  gapEntries: TimelineEntry[]
  onGapResolve: (resolution: GapResolution) => void
  onCourseClick: (courseId: string) => void
  /** Optional: auto-scroll to the current in-progress entry */
  autoScrollToCurrent?: boolean
  /** Set of course IDs that are currently loading */
  loadingResolve?: Set<string>
  /** When true, renders cards without the timeline connector column */
  simplified?: boolean
  /** Optional: exclude a specific entry from rendering (for dedup with ContinueLearningBento) */
  skipCourseId?: string
  /** Optional: videos grouped by course ID for accordion lesson rows */
  videosByCourse?: Map<string, ImportedVideo[]>
  /** Optional: chapter/folder groups per course (same as CourseOverview); when set, drives expanded lesson layout */
  lessonGroupsByCourse?: Map<string, ChapterGroup[]>
  /** Optional: video progress map for lesson completion status */
  videoProgressMap?: Map<string, VideoProgress>
  className?: string
}

// ---- Sub-components ----

/** Status circle on the timeline connector line */
function StatusCircle({
  status,
  simplified,
}: {
  status: 'completed' | 'in-progress' | 'locked' | 'gap'
  /** When true, renders a compact variant without border ring */
  simplified?: boolean
}) {
  const dotSize = simplified ? 'size-6' : 'size-8'
  const borderRing = simplified ? '' : 'border-4 border-card'
  const baseClass = cn(
    dotSize,
    'shrink-0 rounded-full flex items-center justify-center relative z-10',
    borderRing
  )
  const iconSize = simplified ? 'size-3' : 'size-4'

  if (status === 'completed') {
    return (
      <div className={cn(baseClass, 'bg-success text-success-foreground')}>
        <Check className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  if (status === 'in-progress') {
    return (
      <div
        className={cn(
          baseClass,
          'bg-brand text-brand-foreground ring-4 ring-brand-soft'
        )}
      >
        <div
          className={cn(
            'rounded-full bg-white animate-pulse',
            simplified ? 'size-2' : 'size-2.5'
          )}
        />
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
        <AlertCircle className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  // Locked — hollow outline circle with less visual weight
  return (
    <div className={cn(baseClass, 'bg-muted/30 border border-muted-foreground/30')}>
      <div
        className={cn(
          'rounded-full bg-muted-foreground/30',
          simplified ? 'size-1.5' : 'size-2'
        )}
      />
    </div>
  )
}

/** Single lesson row within an expanded module accordion */
function LessonRow({
  video,
  courseId,
  isCompleted,
}: {
  video: ImportedVideo
  courseId: string
  isCompleted: boolean
}) {
  const displayName = video.filename.replace(/\.\w+$/, '')

  return (
    <Link
      to={`/courses/${courseId}/lessons/${video.id}`}
      className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] rounded-xl transition-colors hover:bg-muted/50 group"
    >
      {isCompleted ? (
        <CheckCircle2 className="size-5 text-success flex-shrink-0" aria-hidden="true" />
      ) : (
        <Video className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground/80 group-hover:text-foreground transition-colors">
          {displayName}
        </p>
      </div>
      {video.duration > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
          {formatDuration(video.duration)}
        </span>
      )}
    </Link>
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
          <div className="w-[2px] flex-1 bg-warning/40" />
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 mb-4' : 'flex-1 pb-8'}>
        <Card className="border-2 border-dashed border-warning/40 bg-warning/5 rounded-2xl">
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

/** Action for an unlocked timeline entry: Start Module or Review (locked uses header badge only). */
function EntryActionButton({
  status,
  onClick,
}: {
  status: 'completed' | 'in-progress' | 'locked'
  onClick: () => void
}) {
  if (status === 'in-progress') {
    return (
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
    )
  }

  if (status === 'completed') {
    return (
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
    )
  }

  // Locked state: status pill in the card header already says "Locked" — avoid duplicating it beside metadata.
  return null
}

/** Regular course entry card on the timeline */
function CourseTimelineEntry({
  entry,
  info,
  isCompleted,
  isInProgress,
  index,
  onClick,
  simplified,
  videos,
  lessonGroups,
  videoProgressMap,
}: {
  entry: TimelineEntry
  info?: PathCourseInfo
  isCompleted: boolean
  isInProgress: boolean
  index: number
  onClick: () => void
  simplified?: boolean
  videos?: ImportedVideo[]
  lessonGroups?: ChapterGroup[]
  videoProgressMap?: Map<string, VideoProgress>
}) {
  const isLocked = !isCompleted && !isInProgress
  const status = isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'locked'
  const statusLabel = isCompleted ? 'Completed' : isInProgress ? 'Up Next' : 'Locked'
  const entryRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const groupsWithVideos = lessonGroups?.filter(g => g.videos.length > 0) ?? []
  const videoCount = info?.videoCount ?? videos?.length ?? 0
  const hasContent =
    Boolean(info?.description) ||
    videoCount > 0 ||
    (info?.totalDuration ?? 0) > 0 ||
    Boolean(videos?.length) ||
    groupsWithVideos.length > 0

  const renderCardContent = () => (
    <div className="flex items-start gap-3">
      {/* Drag handle (visual hint for reorderability) */}
      <div className="flex-shrink-0 w-8 flex items-center justify-center self-stretch opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground/50">
        <GripVertical className="size-4" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Row 1: Module number + status badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Module {index + 1}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1',
              isCompleted && 'bg-success-soft text-success',
              isInProgress && 'bg-brand-soft text-brand-soft-foreground',
              isLocked && 'bg-muted text-muted-foreground'
            )}
          >
            {isCompleted && <Check className="size-3" aria-hidden="true" />}
            {isInProgress && (
              <span className="size-1.5 rounded-full bg-brand-soft-foreground animate-pulse" />
            )}
            {isLocked && <Lock className="size-3" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        {/* Row 2: Title */}
        <h3 className="text-xl font-bold">{info?.name || 'Unknown Course'}</h3>

        {/* Row 3: Description (always visible) */}
        {info?.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {info.description}
          </p>
        )}

        {/* Row 4: Stats + Action button */}
        {!simplified && (
          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
              {videoCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Video className="size-4" aria-hidden="true" />
                  {videoCount} {videoCount === 1 ? 'lesson' : 'lessons'}
                </span>
              )}
              {(info?.totalDuration ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  {formatDuration(info!.totalDuration!)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <EntryActionButton status={status} onClick={onClick} />
              {hasContent && !isLocked && (
                <ChevronDown
                  className={cn(
                    'size-5 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                    isExpanded && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex gap-3" ref={entryRef}>
      {/* Connector line column */}
      {!simplified && (
        <div className="flex flex-col items-center">
          <StatusCircle status={status} />
          <div className="w-[2px] flex-1 bg-border" />
        </div>
      )}

      {/* Simplified mode: compact status dot */}
      {simplified && (
        <div className="flex-shrink-0 pt-1">
          <StatusCircle status={status} simplified />
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 min-w-0 mb-4' : 'flex-1 pb-8 min-w-0'}>
        <Card
          className={cn(
            'rounded-2xl border hover:shadow-md transition-shadow duration-200 group overflow-hidden',
            isCompleted && 'border-success/20',
            isInProgress && 'border-brand/20 ring-1 ring-brand/5',
            isLocked && 'border-border/50 opacity-60 pointer-events-none'
          )}
          {...(isLocked
            ? {}
            : {
                role: 'button',
                tabIndex: 0,
                'aria-label': `Module ${index + 1}: ${info?.name || 'Course'} — ${statusLabel}`,
                onClick: () => setIsExpanded(!isExpanded),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setIsExpanded(!isExpanded)
                  }
                },
              })}
        >
          <CardContent className="p-6">
            {renderCardContent()}
          </CardContent>

          {/* Expanded content: grouped lessons (preferred) or flat list */}
          {!isLocked && isExpanded && groupsWithVideos.length > 0 && (
            <div className="border-t border-border px-6 pb-4 pt-3 space-y-3">
              {(() => {
                const singleUngrouped = groupsWithVideos.length === 1 && groupsWithVideos[0].title === ''
                return groupsWithVideos.map((group, gi) => (
                  <div key={`${group.title}-${gi}`} className="space-y-1">
                    {!singleUngrouped && (groupsWithVideos.length > 1 || group.title !== '') && (
                      <h4 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.title || 'Lessons'}
                      </h4>
                    )}
                    {group.videos.map(video => {
                      const prog = videoProgressMap?.get(video.id)
                      const isVideoCompleted = (prog?.completionPercentage ?? 0) >= 90
                      return (
                        <LessonRow
                          key={video.id}
                          video={video}
                          courseId={entry.courseId}
                          isCompleted={isVideoCompleted}
                        />
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          )}
          {!isLocked &&
            isExpanded &&
            groupsWithVideos.length === 0 &&
            videos &&
            videos.length > 0 && (
              <div className="border-t border-border px-6 pb-4 pt-3 space-y-1">
                {videos.map(video => {
                  const prog = videoProgressMap?.get(video.id)
                  const isVideoCompleted = (prog?.completionPercentage ?? 0) >= 90
                  return (
                    <LessonRow
                      key={video.id}
                      video={video}
                      courseId={entry.courseId}
                      isCompleted={isVideoCompleted}
                    />
                  )
                })}
              </div>
            )}
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
  gapEntries,
  onGapResolve,
  onCourseClick,
  autoScrollToCurrent = true,
  loadingResolve,
  simplified,
  skipCourseId,
  videosByCourse,
  lessonGroupsByCourse,
  videoProgressMap,
  className,
}: PathTimelineProps) {
  const gapEntryIds = useMemo(() => new Set(gapEntries.map(e => e.id)), [gapEntries])

  // Filter out the skipped entry (used for dedup with ContinueLearningBento)
  const filteredEntries = useMemo(
    () => (skipCourseId ? entries.filter(e => e.courseId !== skipCourseId) : entries),
    [entries, skipCourseId]
  )

  // When no courses have any progress data, the first non-gap entry should
  // default to "in-progress" so the user sees a "Start Module" CTA rather
  // than all courses appearing as "Locked".
  const hasAnyProgress = useMemo(
    () => filteredEntries.some(e => {
      if (e.courseId === '' || gapEntryIds.has(e.id)) return false
      return (courseInfoMap.get(e.courseId)?.completionPct ?? 0) > 0
    }),
    [filteredEntries, courseInfoMap, gapEntryIds]
  )
  const firstNonGapIndex = useMemo(
    () => filteredEntries.findIndex(e => e.courseId !== '' && !gapEntryIds.has(e.id)),
    [filteredEntries, gapEntryIds]
  )

  const timelineRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  // Auto-scroll to the current in-progress entry on mount
  useEffect(() => {
    if (!autoScrollToCurrent || filteredEntries.length === 0) return

    const currentIndex = filteredEntries.findIndex(e => {
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
  }, [autoScrollToCurrent, filteredEntries, courseInfoMap, gapEntryIds, prefersReducedMotion])

  if (filteredEntries.length === 0) {
    return null
  }

  return (
    <div ref={timelineRef} className={cn('space-y-0', className)} role="list" aria-label="Timeline">
      {filteredEntries.map((entry, i) => {
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
        const isCompleted = (info?.completionPct ?? 0) >= 100
        const isInProgress =
          (!hasAnyProgress && i === firstNonGapIndex) ||
          ((info?.completionPct ?? 0) > 0 && !isCompleted)

        return (
          <div key={entry.courseId} role="listitem">
            <CourseTimelineEntry
              entry={entry}
              info={info}
              isCompleted={isCompleted}
              isInProgress={isInProgress}
              index={i}
              onClick={() => onCourseClick(entry.courseId)}
              simplified={simplified}
              videos={videosByCourse?.get(entry.courseId)}
              lessonGroups={lessonGroupsByCourse?.get(entry.courseId)}
              videoProgressMap={videoProgressMap}
            />
          </div>
        )
      })}
    </div>
  )
}
