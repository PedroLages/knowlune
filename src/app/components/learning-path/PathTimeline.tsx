import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useReducedMotion, motion, AnimatePresence } from 'motion/react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Check,
  Lock,
  AlertCircle,
  Import,
  Search,
  Replace,
  GripVertical,
  ChevronDown,
  Video,
  Clock,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { extractGapSearchTerm, cleanGapJustification } from '@/data/learningPathUtils'
import {
  StatusCircle,
  EntryActionButton,
  LessonRow,
} from '@/app/components/learning-path/TimelinePrimitives'
import { SortableCourseTimelineEntry } from '@/app/components/learning-path/SortableCourseTimelineEntry'
import { formatClockDuration } from '@/lib/formatDuration'
import { isCourseInProgress } from '@/lib/progressUtils'
import type { ChapterGroup } from '@/lib/curriculumGrouping'
import type {
  LearningPathEntry,
  PathCourseInfo,
  ImportedVideo,
  VideoProgress,
  PathProgressionMode,
} from '@/data/types'

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
  /** Optional: set of entry IDs manually marked as completed */
  manuallyCompletedIds?: Set<string>
  /** Optional: called when user marks an entry complete (toggles on/off) */
  onMarkComplete?: (entryId: string) => void
  /** When true, enables edit mode with drag-and-drop reordering */
  editable?: boolean
  /**
   * Preferred drag-end callback: course IDs match `@dnd-kit/sortable` and stay
   * correct when gap rows exist between modules.
   */
  onReorderByCourseId?: (activeCourseId: string, overCourseId: string) => void
  /** Legacy index-based reorder (skips calling when `onReorderByCourseId` is set) */
  onReorder?: (fromIndex: number, toIndex: number) => void
  className?: string
  /** When 'free', all non-gap courses are accessible regardless of completion status */
  progressionMode?: PathProgressionMode
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

/** Regular course entry card on the timeline */
function CourseTimelineEntry({
  entry,
  info,
  isCompleted,
  isInProgress,
  hasRealProgress,
  isManuallyCompleted,
  index,
  onClick,
  onMarkComplete,
  simplified,
  videos,
  lessonGroups,
  videoProgressMap,
  progressionMode,
  suppressAnimations,
}: {
  entry: TimelineEntry
  info?: PathCourseInfo
  isCompleted: boolean
  isInProgress: boolean
  /** When true, the module has real progress (1-99%) — shows "In Progress" label and "Continue Module" button */
  hasRealProgress?: boolean
  isManuallyCompleted?: boolean
  index: number
  onClick: () => void
  onMarkComplete?: () => void
  simplified?: boolean
  videos?: ImportedVideo[]
  lessonGroups?: ChapterGroup[]
  videoProgressMap?: Map<string, VideoProgress>
  progressionMode?: PathProgressionMode
  suppressAnimations?: boolean
}) {
  const isFreeMode = progressionMode === 'free'
  const isLocked = isFreeMode ? false : !isCompleted && !isInProgress
  const status = isCompleted
    ? 'completed'
    : isFreeMode
      ? 'available'
      : isInProgress
        ? 'in-progress'
        : 'locked'
  const statusLabel = isManuallyCompleted
    ? 'Completed'
    : isCompleted
      ? 'Completed'
      : isFreeMode
        ? 'Available'
        : isInProgress
          ? hasRealProgress
            ? 'In Progress'
            : 'Up Next'
          : 'Locked'
  const entryRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const prevLockedRef = useRef(isLocked)
  const justUnlocked = !suppressAnimations && prevLockedRef.current && !isLocked
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = !prefersReducedMotion

  // Update ref after render so next render can detect transitions
  useEffect(() => {
    prevLockedRef.current = isLocked
  }, [isLocked])

  const groupsWithVideos = lessonGroups?.filter(g => g.videos.length > 0) ?? []
  const videoCount = info?.videoCount ?? videos?.length ?? 0
  const hasContent =
    Boolean(info?.description) ||
    videoCount > 0 ||
    (info?.totalDuration ?? 0) > 0 ||
    Boolean(videos?.length) ||
    groupsWithVideos.length > 0

  // NOTE: This card content intentionally duplicates SortableCourseTimelineEntry's
  // rendering rather than extracting a shared component. The two components diverge
  // significantly in wrapper structure (motion.div vs useSortable CSS transforms)
  // and expanded-lesson rendering paths, so a shared abstraction would introduce
  // more complexity than the duplication costs.

  const renderCardContent = () => (
    <div className="flex items-start gap-3">
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
              isFreeMode && !isCompleted && !isInProgress && 'bg-muted/60 text-muted-foreground',
              isLocked && 'bg-muted text-muted-foreground'
            )}
          >
            {isCompleted && <Check className="size-3" aria-hidden="true" />}
            {isInProgress && (
              <span className="size-1.5 rounded-full bg-brand-soft-foreground motion-safe:animate-pulse" />
            )}
            {isLocked && <Lock className="size-3" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        {/* Row 2: Title */}
        <h3 className="text-xl font-bold">{info?.name || 'Unknown Course'}</h3>

        {/* Row 3: Stats — lessons, duration, progress */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
          {videoCount > 0 && (
            <span className="flex items-center gap-1.5 font-medium">
              <Video className="size-4" aria-hidden="true" />
              {videoCount} {videoCount === 1 ? 'lesson' : 'lessons'}
            </span>
          )}
          {(info?.totalDuration ?? 0) > 0 && (
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="size-4" aria-hidden="true" />
              {formatClockDuration(info!.totalDuration!)}
            </span>
          )}
          {info?.completionPct != null && info.completionPct > 0 && (
            <span className="font-semibold text-brand">{info.completionPct}% complete</span>
          )}
        </div>

        {/* Row 4: Description + Why This Matters */}
        {(info?.description || entry.justification) && (
          <div className="mt-3 space-y-2">
            {info?.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{info.description}</p>
            )}
            {/* Why this matters — justification from AI or manifest */}
            {entry.justification && (
              <details className="group">
                <summary className="text-xs font-semibold text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors list-none flex items-center gap-1.5">
                  <ChevronDown
                    className="size-3.5 group-open:rotate-180 transition-transform"
                    aria-hidden="true"
                  />
                  Why this matters
                </summary>
                <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed pl-5">
                  {entry.justification}
                </p>
              </details>
            )}
          </div>
        )}

        {/* Row 5: Progress bar + actions (non-simplified) */}
        {!simplified && (
          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex-1">
              {info?.completionPct != null && info.completionPct > 0 && (
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-brand h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
                    style={{ width: `${info.completionPct}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <EntryActionButton
                status={status}
                isManuallyCompleted={isManuallyCompleted}
                hasRealProgress={hasRealProgress}
                onClick={onClick}
                onMarkComplete={onMarkComplete}
              />
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
        <motion.div
          key={`${entry.courseId}-${isLocked ? 'locked' : 'unlocked'}`}
          initial={shouldAnimate && justUnlocked ? { opacity: 0.8, scale: 0.97 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card
            className={cn(
              'rounded-2xl border hover:shadow-md transition-all duration-300 group overflow-hidden',
              isCompleted && 'border-success/20',
              isInProgress && 'border-brand/20 ring-1 ring-brand/5',
              isLocked && 'border-border/50 opacity-60 pointer-events-none',
              justUnlocked && shouldAnimate && 'shadow-brand/10 shadow-lg'
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
            <CardContent className="p-6">{renderCardContent()}</CardContent>

            {/* Expanded content: grouped lessons (preferred) or flat list */}
            <AnimatePresence initial={false}>
              {!isLocked && isExpanded && groupsWithVideos.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="px-6 pb-4 pt-3 space-y-3">
                    {(() => {
                      const singleUngrouped =
                        groupsWithVideos.length === 1 && groupsWithVideos[0].title === ''
                      return groupsWithVideos.map((group, gi) => (
                        <div key={`${group.title}-${gi}`} className="space-y-1">
                          {!singleUngrouped &&
                            (groupsWithVideos.length > 1 || group.title !== '') && (
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
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {!isLocked &&
                isExpanded &&
                groupsWithVideos.length === 0 &&
                videos &&
                videos.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="px-6 pb-4 pt-3 space-y-1">
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
                  </motion.div>
                )}
            </AnimatePresence>
          </Card>
        </motion.div>
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
  manuallyCompletedIds,
  onMarkComplete,
  editable,
  onReorder,
  onReorderByCourseId,
  className,
  progressionMode,
}: PathTimelineProps) {
  // Suppress per-entry unlock animations when the mode itself changes
  // (many entries transition from locked→unlocked simultaneously).
  const prevModeRef = useRef(progressionMode)
  const suppressAnimations = prevModeRef.current !== progressionMode
  useEffect(() => {
    prevModeRef.current = progressionMode
  }, [progressionMode])

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
    () =>
      filteredEntries.some(e => {
        if (e.courseId === '' || gapEntryIds.has(e.id)) return false
        return (courseInfoMap.get(e.courseId)?.completionPct ?? 0) > 0
      }),
    [filteredEntries, courseInfoMap, gapEntryIds]
  )
  const firstNonGapIndex = useMemo(
    () => filteredEntries.findIndex(e => e.courseId !== '' && !gapEntryIds.has(e.id)),
    [filteredEntries, gapEntryIds]
  )

  // Find the first non-completed, non-gap entry — this is the "next unlocked" module.
  // Manual completions count as completed, so they unlock the following entry.
  const nextUnlockedIndex = useMemo(() => {
    for (let i = 0; i < filteredEntries.length; i++) {
      const e = filteredEntries[i]
      if (e.courseId === '' || gapEntryIds.has(e.id)) continue
      const pct = courseInfoMap.get(e.courseId)?.completionPct ?? 0
      const manualDone = manuallyCompletedIds?.has(e.id) ?? false
      if (pct < 100 && !manualDone) return i
    }
    return -1
  }, [filteredEntries, courseInfoMap, gapEntryIds, manuallyCompletedIds])

  // Sortable infrastructure (edit mode)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Sortable entry IDs — exclude gap entries
  const sortableEntryIds = useMemo(
    () =>
      filteredEntries.filter(e => e.courseId !== '' && !gapEntryIds.has(e.id)).map(e => e.courseId),
    [filteredEntries, gapEntryIds]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id || (!onReorder && !onReorderByCourseId)) return

      const activeCourseId = active.id as string
      const overCourseId = over.id as string

      if (onReorderByCourseId) {
        onReorderByCourseId(activeCourseId, overCourseId)
        return
      }

      const activeEntryIndex = filteredEntries.findIndex(e => e.courseId === activeCourseId)
      const overEntryIndex = filteredEntries.findIndex(e => e.courseId === overCourseId)

      if (activeEntryIndex === -1 || overEntryIndex === -1 || !onReorder) return

      onReorder(activeEntryIndex, overEntryIndex)
    },
    [filteredEntries, onReorder, onReorderByCourseId]
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
        rows[currentIndex].scrollIntoView({
          behavior: prefersReducedMotion ? 'instant' : 'smooth',
          block: 'center',
        })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [autoScrollToCurrent, filteredEntries, courseInfoMap, gapEntryIds, prefersReducedMotion])

  if (filteredEntries.length === 0) {
    return null
  }

  if (editable) {
    // Edit mode: DndContext + SortableContext for drag-and-drop reordering
    const activeEntry = activeId ? filteredEntries.find(e => e.courseId === activeId) : null
    const activeInfo = activeEntry ? courseInfoMap.get(activeEntry.courseId) : null

    return (
      <div
        ref={timelineRef}
        className={cn('space-y-0 max-w-[900px]', className)}
        role="list"
        aria-label="Timeline"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Key by ordered IDs so programmatic store reorders reset sortable internals (otherwise useSortable can keep stale transforms while entry order props update). */}
          <SortableContext
            key={sortableEntryIds.join('|')}
            items={sortableEntryIds}
            strategy={verticalListSortingStrategy}
          >
            {filteredEntries.map((entry, i) => {
              // Gap entry — render outside SortableContext
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
              const isManuallyCompleted = manuallyCompletedIds?.has(entry.id) ?? false
              const isCompleted = (info?.completionPct ?? 0) >= 100 || isManuallyCompleted
              const hasRealProgress = isCourseInProgress(info?.completionPct, isCompleted)
              const isInProgress =
                (!hasAnyProgress && i === firstNonGapIndex && !isCompleted) ||
                hasRealProgress ||
                i === nextUnlockedIndex

              return (
                <div key={entry.courseId} role="listitem">
                  <SortableCourseTimelineEntry
                    entry={entry}
                    info={info}
                    isCompleted={isCompleted}
                    isInProgress={isInProgress}
                    hasRealProgress={hasRealProgress}
                    isManuallyCompleted={isManuallyCompleted}
                    index={i}
                    onClick={() => onCourseClick(entry.courseId)}
                    onMarkComplete={onMarkComplete ? () => onMarkComplete(entry.id) : undefined}
                    simplified={simplified}
                    videos={videosByCourse?.get(entry.courseId)}
                    lessonGroups={lessonGroupsByCourse?.get(entry.courseId)}
                    videoProgressMap={videoProgressMap}
                    progressionMode={progressionMode}
                    suppressAnimations={suppressAnimations}
                  />
                </div>
              )
            })}
          </SortableContext>

          <DragOverlay>
            {activeEntry && activeInfo ? (
              <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-card px-6 py-4 shadow-xl">
                <div className="flex-shrink-0 w-8 flex items-center justify-center self-stretch text-muted-foreground">
                  <GripVertical className="size-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold">{activeInfo.name || 'Unknown Course'}</h3>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Module {filteredEntries.findIndex(e => e.courseId === activeEntry.courseId) + 1}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    )
  }

  // Read-only mode (existing behavior)
  return (
    <div ref={timelineRef} className={cn('space-y-0 max-w-[900px]', className)} role="list" aria-label="Timeline">
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
        const isManuallyCompleted = manuallyCompletedIds?.has(entry.id) ?? false
        const isCompleted = (info?.completionPct ?? 0) >= 100 || isManuallyCompleted
        const hasRealProgress = isCourseInProgress(info?.completionPct, isCompleted)
        const isInProgress =
          (!hasAnyProgress && i === firstNonGapIndex && !isCompleted) ||
          hasRealProgress ||
          i === nextUnlockedIndex

        return (
          <div key={entry.courseId} role="listitem">
            <CourseTimelineEntry
              entry={entry}
              info={info}
              isCompleted={isCompleted}
              isInProgress={isInProgress}
              hasRealProgress={hasRealProgress}
              isManuallyCompleted={isManuallyCompleted}
              index={i}
              onClick={() => onCourseClick(entry.courseId)}
              onMarkComplete={onMarkComplete ? () => onMarkComplete(entry.id) : undefined}
              simplified={simplified}
              videos={videosByCourse?.get(entry.courseId)}
              lessonGroups={lessonGroupsByCourse?.get(entry.courseId)}
              videoProgressMap={videoProgressMap}
              progressionMode={progressionMode}
              suppressAnimations={suppressAnimations}
            />
          </div>
        )
      })}
    </div>
  )
}
