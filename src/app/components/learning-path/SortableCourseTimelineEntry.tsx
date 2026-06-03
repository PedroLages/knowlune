/**
 * SortableCourseTimelineEntry — drag-and-drop sortable course card.
 *
 * This is the edit-mode variant of CourseTimelineEntry. It uses @dnd-kit/sortable's
 * useSortable for drag-and-drop reordering. No motion.div wrapper here —
 * inline CSS transforms from useSortable handle positioning (avoids animation
 * conflict between motion.div and useSortable CSS transforms).
 *
 * Only rendered inside DndContext + SortableContext (see PathTimeline.tsx).
 *
 * NOTE: The card content rendered below intentionally duplicates
 * CourseTimelineEntry's renderCardContent. The two components diverge
 * significantly in wrapper structure (useSortable CSS transforms vs
 * motion.div) and expanded-lesson rendering paths, making a shared
 * abstraction more costly than the duplication.
 */
import { useRef, useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Lock, GripVertical, ChevronDown, Video, Clock } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { EntryActionButton, LessonRow } from '@/app/components/learning-path/TimelinePrimitives'
import { formatClockDuration } from '@/lib/formatDuration'
import type { ChapterGroup } from '@/lib/curriculumGrouping'
import type { PathCourseInfo, ImportedVideo, VideoProgress } from '@/data/types'
import type { LearningPathEntry } from '@/data/types'

interface SortableCourseTimelineEntryProps {
  entry: LearningPathEntry
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
}

export function SortableCourseTimelineEntry({
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
}: SortableCourseTimelineEntryProps) {
  const isLocked = !isCompleted && !isInProgress
  const status = isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'locked'
  const statusLabel = isManuallyCompleted
    ? 'Completed'
    : isCompleted
      ? 'Completed'
      : isInProgress
        ? hasRealProgress
          ? 'In Progress'
          : 'Up Next'
        : 'Locked'
  const prevLockedRef = useRef(isLocked)
  const justUnlocked = prevLockedRef.current && !isLocked

  const [isExpanded, setIsExpanded] = useState(false)

  const groupsWithVideos = lessonGroups?.filter(g => g.videos.length > 0) ?? []
  const videoCount = info?.videoCount ?? videos?.length ?? 0
  const hasContent =
    Boolean(info?.description) ||
    videoCount > 0 ||
    (info?.totalDuration ?? 0) > 0 ||
    Boolean(videos?.length) ||
    groupsWithVideos.length > 0

  useEffect(() => {
    prevLockedRef.current = isLocked
  }, [isLocked])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.courseId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div className="flex gap-3">
      {/* Connector line column */}
      {!simplified && (
        <div className="flex flex-col items-center">
          <span
            className={cn(
              'flex size-[14px] shrink-0 items-center justify-center rounded-full border-2',
              status === 'completed' && 'border-success bg-success',
              status === 'in-progress' && 'border-brand bg-brand',
              status === 'locked' && 'border-border bg-card'
            )}
            aria-label={statusLabel}
          >
            {status === 'completed' && <Check className="size-2.5 text-white" aria-hidden="true" />}
          </span>
          <div className="w-[2px] flex-1 bg-border" />
        </div>
      )}

      {/* Simplified mode: compact status dot */}
      {simplified && (
        <div className="flex-shrink-0 pt-1">
          <span
            className={cn(
              'flex size-[10px] shrink-0 items-center justify-center rounded-full',
              status === 'completed' && 'bg-success',
              status === 'in-progress' && 'bg-brand',
              status === 'locked' && 'bg-muted-foreground/30'
            )}
            aria-label={statusLabel}
          />
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 min-w-0 mb-4' : 'flex-1 pb-8 min-w-0'}>
        <div
          ref={setNodeRef}
          // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value from useSortable
          style={style}
          {...attributes}
        >
          <Card
            className={cn(
              'rounded-2xl border transition-all duration-300 group overflow-hidden',
              !isLocked && 'shadow-md border-brand/20 ring-1 ring-brand/5',
              isCompleted && 'border-success/20',
              isInProgress && 'border-brand/20 ring-1 ring-brand/5',
              isLocked && 'border-border/50 opacity-60',
              isDragging && 'opacity-50 shadow-lg z-10',
              justUnlocked && 'shadow-brand/10 shadow-lg'
            )}
            {...(isLocked
              ? {}
              : {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Module ${index + 1}: ${info?.name || 'Course'} — ${statusLabel}`,
                  onClick: () => setIsExpanded(prev => !prev),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setIsExpanded(prev => !prev)
                    }
                  },
                })}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <button
                  type="button"
                  className="flex-shrink-0 w-8 flex items-center justify-center self-stretch cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing opacity-100 transition-opacity duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  aria-label={`Drag to reorder module ${index + 1}`}
                  data-testid={`drag-handle-${entry.courseId}`}
                  {...listeners}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>

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
                        <span className="size-1.5 rounded-full bg-brand-soft-foreground motion-safe:animate-pulse" />
                      )}
                      {isLocked && <Lock className="size-3 opacity-50" aria-hidden="true" />}
                      {statusLabel}
                    </span>
                  </div>

                  {/* Row 2: Title */}
                  <h3 className="text-xl font-bold">{info?.name || 'Unknown Course'}</h3>

                  {/* Row 3: Description */}
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
                            {formatClockDuration(info!.totalDuration!)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
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
            </CardContent>

            {/* Expanded content: grouped lessons */}
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

            {/* Expanded content: flat video list */}
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
        </div>
      </div>
    </div>
  )
}
