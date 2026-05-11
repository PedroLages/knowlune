import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Link } from 'react-router'
import {
  Check,
  PlayCircle,
  PauseCircle,
  Circle,
  ChevronDown,
  Video,
  Clock,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Camera,
  Trash2,
  BookOpen,
} from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { toast } from 'sonner'
import { formatDuration } from '@/lib/formatDuration'
import { MomentumBadge } from '@/app/components/figma/MomentumBadge'
import { EditCourseDialog } from '@/app/components/figma/EditCourseDialog'
import { ThumbnailPickerDialog } from '@/app/components/figma/ThumbnailPickerDialog'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse, ImportedVideo, VideoProgress, LearnerCourseStatus } from '@/data/types'
import type { ChapterGroup } from '@/lib/curriculumGrouping'
import type { MomentumScore } from '@/lib/momentum'

// ---- Types ----

export interface CourseTimelineViewProps {
  courses: ImportedCourse[]
  completionMap: Map<string, number>
  momentumMap: Map<string, MomentumScore>
  progressMap: Map<string, VideoProgress>
  lessonGroupsByCourse: Map<string, ChapterGroup[]>
  isLoading: boolean
  allTags: string[]
}

// ---- Sub-components ----

/** Status circle matching PathTimeline visual pattern, adapted for course statuses */
function StatusCircle({
  status,
  simplified,
}: {
  status: LearnerCourseStatus
  simplified?: boolean
}) {
  const dotSize = simplified ? 'size-5' : 'size-7'
  const borderRing = simplified ? '' : 'border-4 border-card'
  const baseClass = cn(
    dotSize,
    'shrink-0 rounded-full flex items-center justify-center relative z-10 transition-all duration-300',
    borderRing
  )
  const iconSize = simplified ? 'size-3' : 'size-3.5'

  if (status === 'completed') {
    return (
      <div className={cn(baseClass, 'bg-success text-success-foreground')}>
        <Check className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div
        className={cn(
          baseClass,
          'bg-brand text-brand-foreground ring-4 ring-brand-soft'
        )}
      >
        <div
          className={cn(
            'rounded-full bg-brand-foreground animate-pulse',
            simplified ? 'size-2' : 'size-2.5'
          )}
        />
      </div>
    )
  }

  if (status === 'paused') {
    return (
      <div className={cn(baseClass, 'bg-warning/20 text-warning')}>
        <PauseCircle className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  // Not started — hollow outline circle
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

/** Single lesson row within an expanded course accordion */
function LessonRow({
  video,
  courseId,
  isCompleted,
}: {
  video: ImportedVideo
  courseId: string
  isCompleted: boolean
}) {
  const displayName = video.title ?? video.filename.replace(/\.\w+$/, '')

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

/** Skeleton placeholder matching timeline entry layout */
function TimelineSkeleton() {
  return (
    <div className="space-y-6" data-testid="timeline-skeleton">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Skeleton className="size-7 rounded-full" />
            <div className="w-[2px] flex-1 bg-muted" />
          </div>
          <div className="flex-1 pb-8">
            <Card className="rounded-2xl border">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center gap-4 mt-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Overflow menu action items for a course entry */
function CourseOverflowMenu({
  courseId,
  status,
  onDelete,
  onEdit,
  onChangeThumbnail,
}: {
  courseId: string
  status: LearnerCourseStatus
  onDelete: () => void
  onEdit: () => void
  onChangeThumbnail: () => void
}) {
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)

  const statusConfig: Record<
    LearnerCourseStatus,
    { label: string; icon: typeof Circle }
  > = {
    'not-started': { label: 'Not Started', icon: PlayCircle },
    active: { label: 'Active', icon: Circle },
    completed: { label: 'Completed', icon: CheckCircle2 },
    paused: { label: 'Paused', icon: PauseCircle },
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="timeline-course-menu"
          onClick={e => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none"
          aria-label="Course actions"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem
          data-testid="edit-course-menu-item"
          className="gap-2 min-h-[44px]"
          onClick={onEdit}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="change-thumbnail-menu-item"
          className="gap-2 min-h-[44px]"
          onClick={onChangeThumbnail}
        >
          <Camera className="size-4" aria-hidden="true" />
          Change thumbnail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(Object.entries(statusConfig) as [LearnerCourseStatus, typeof statusConfig['not-started']][]).map(
          ([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <DropdownMenuItem
                key={key}
                onClick={() => updateCourseStatus(courseId, key)}
                className="gap-2 min-h-[44px]"
              >
                <Icon className="size-4" aria-hidden="true" />
                {cfg.label}
                {key === status && (
                  <CheckCircle2 className="size-3.5 ml-auto text-brand" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            )
          }
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="delete-course-menu-item"
          variant="destructive"
          className="gap-2 min-h-[44px]"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete course
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Single course entry in the timeline, expandable to show lessons */
function CourseTimelineEntry({
  course,
  completionPercent,
  momentumScore,
  lessonGroups,
  videoProgressMap,
  allTags,
  simplified,
}: {
  course: ImportedCourse
  completionPercent: number
  momentumScore?: MomentumScore
  lessonGroups?: ChapterGroup[]
  videoProgressMap?: Map<string, VideoProgress>
  allTags: string[]
  simplified?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)

  const groupsWithVideos = lessonGroups?.filter(g => g.videos.length > 0) ?? []
  const firstVid = lessonGroups?.flatMap(g => g.videos)[0] ?? null

  const statusDot = (
    <StatusCircle status={course.status} simplified={simplified} />
  )

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    await removeImportedCourse(course.id)
    const { importError } = useCourseImportStore.getState()
    if (importError) {
      toast.error('Failed to delete course')
      setDeleting(false)
    } else {
      toast.success('Course deleted')
    }
  }

  function handleCardClick() {
    setIsExpanded(prev => !prev)
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  // Count total videos across all groups for display
  const totalLessons = groupsWithVideos.reduce((sum, g) => sum + g.videos.length, 0)

  return (
    <div className="flex gap-3">
      {/* Connector line column */}
      {!simplified && (
        <div className="flex flex-col items-center">
          {statusDot}
          <div className="w-[2px] flex-1 bg-border" />
        </div>
      )}

      {/* Simplified mode: compact status dot */}
      {simplified && (
        <div className="flex-shrink-0 pt-1">
          {statusDot}
        </div>
      )}

      {/* Content */}
      <div className={simplified ? 'flex-1 min-w-0 w-full mb-4' : 'flex-1 pb-8 min-w-0'}>
        <Card
          className={cn(
            'rounded-2xl border hover:shadow-md transition-all duration-300 group overflow-hidden',
            course.status === 'completed' && 'border-success/20',
            course.status === 'active' && 'border-brand/20 ring-1 ring-brand/5',
            course.status === 'paused' && 'border-warning/20',
            'cursor-pointer'
          )}
          role="button"
          tabIndex={0}
          aria-label={`${course.name} — ${course.status}, ${totalLessons} lessons`}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Status badge + expand chevron */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1',
                      course.status === 'completed' && 'bg-success-soft text-success',
                      course.status === 'active' && 'bg-brand-soft text-brand-soft-foreground',
                      course.status === 'not-started' && 'bg-muted text-muted-foreground',
                      course.status === 'paused' && 'bg-warning/10 text-warning'
                    )}
                  >
                    {course.status === 'completed' && <Check className="size-3" aria-hidden="true" />}
                    {course.status === 'active' && (
                      <span className="size-1.5 rounded-full bg-brand-soft-foreground animate-pulse" />
                    )}
                    {course.status === 'paused' && <PauseCircle className="size-3" aria-hidden="true" />}
                    {course.status === 'completed'
                      ? 'Completed'
                      : course.status === 'active'
                        ? 'Active'
                        : course.status === 'paused'
                          ? 'Paused'
                          : 'Not Started'}
                  </span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      className={cn(
                        'size-5 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                        isExpanded && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Row 2: Title */}
                <h3 className="text-lg font-bold">{course.name}</h3>

                {/* Row 3: Stats row */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium mt-2">
                  {course.videoCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Video className="size-4" aria-hidden="true" />
                      {course.videoCount} {course.videoCount === 1 ? 'lesson' : 'lessons'}
                    </span>
                  )}
                  {course.pdfCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="size-4" aria-hidden="true" />
                      {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                    </span>
                  )}
                  {course.totalDuration != null && course.totalDuration > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden="true" />
                      {formatDuration(course.totalDuration * 1000)}
                    </span>
                  )}
                </div>

                {/* Row 4: Progress bar + Momentum + Overflow */}
                <div className="flex items-center justify-between gap-3 mt-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Progress bar */}
                    {completionPercent > 0 && (
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              completionPercent >= 100
                                ? 'bg-success'
                                : 'bg-brand'
                            )}
                            style={{ width: `${completionPercent}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {completionPercent}%
                        </span>
                      </div>
                    )}
                    {momentumScore && momentumScore.score > 0 && (
                      <MomentumBadge score={momentumScore.score} tier={momentumScore.tier} />
                    )}
                  </div>
                  <CourseOverflowMenu
                    courseId={course.id}
                    status={course.status}
                    onDelete={() => setDeleteDialogOpen(true)}
                    onEdit={() => setEditDialogOpen(true)}
                    onChangeThumbnail={() => setThumbnailPickerOpen(true)}
                  />
                </div>
              </div>
            </div>
          </CardContent>

          {/* Expanded content: grouped lessons */}
          <AnimatePresence initial={false}>
            {isExpanded && groupsWithVideos.length > 0 && (
              <motion.div
                key="expanded-lessons"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden border-t border-border"
              >
                <div className="px-6 pb-4 pt-3 space-y-3">
                  {groupsWithVideos.map((group, gi) => (
                    <div key={`${group.title}-${gi}`} className="space-y-1">
                      {group.title && (
                        <h4 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.title}
                        </h4>
                      )}
                      {group.videos.map(video => {
                        const prog = videoProgressMap?.get(video.id)
                        const isVideoCompleted = (prog?.completionPercentage ?? 0) >= 90
                        return (
                          <LessonRow
                            key={video.id}
                            video={video}
                            courseId={course.id}
                            isCompleted={isVideoCompleted}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* No lessons message */}
          <AnimatePresence initial={false}>
            {isExpanded && groupsWithVideos.length === 0 && (
              <motion.div
                key="no-lessons"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="px-6 py-4 text-sm text-muted-foreground text-center">
                  No lessons available
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{course.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the course and all its content from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditCourseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        course={course}
        allTags={allTags}
      />

      <ThumbnailPickerDialog
        open={thumbnailPickerOpen}
        onOpenChange={setThumbnailPickerOpen}
        courseId={course.id}
        courseName={course.name}
        firstVideo={firstVid}
      />
    </div>
  )
}

// ---- Main Component ----

/**
 * Vertical timeline view for the courses page.
 * Displays imported courses as expandable cards in a vertical syllabus tree,
 * matching the PathTimeline visual pattern but adapted for independent courses.
 */
export function CourseTimelineView({
  courses,
  completionMap,
  momentumMap,
  progressMap,
  lessonGroupsByCourse,
  isLoading,
  allTags,
}: CourseTimelineViewProps) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (courses.length === 0) {
    return (
      <div
        className="text-center py-12 text-muted-foreground"
        data-testid="timeline-empty-state"
      >
        <BookOpen className="size-12 mx-auto mb-3 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm">No courses to display</p>
      </div>
    )
  }

  return (
    <div
      className="space-y-0 overflow-auto"
      role="list"
      aria-label="Course timeline"
      data-testid="course-timeline-view"
    >
      {courses.map(course => (
        <div key={course.id} role="listitem">
          <CourseTimelineEntry
            course={course}
            completionPercent={completionMap.get(course.id) ?? 0}
            momentumScore={momentumMap.get(course.id)}
            lessonGroups={lessonGroupsByCourse.get(course.id)}
            videoProgressMap={progressMap}
            allTags={allTags}
            simplified={isMobile}
          />
        </div>
      ))}
    </div>
  )
}

export default CourseTimelineView
