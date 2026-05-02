import { useState, useEffect, useRef } from 'react'
import {
  FolderOpen,
  Video,
  FileText,
  Circle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Badge } from '@/app/components/ui/badge'
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
import { TagBadgeList } from '@/app/components/figma/TagBadgeList'
import { EditCourseDialog } from '@/app/components/figma/EditCourseDialog'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { formatCourseDuration } from '@/lib/format'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'

const statusConfig: Record<
  LearnerCourseStatus,
  { label: string; icon: typeof Circle; badgeClass: string }
> = {
  'not-started': {
    label: 'Not Started',
    icon: PlayCircle,
    badgeClass: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
  },
  active: {
    label: 'Active',
    icon: Circle,
    badgeClass: 'bg-brand-soft text-brand-soft-foreground',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-success/10 text-success dark:bg-success/20 dark:text-success',
  },
  paused: {
    label: 'Paused',
    icon: PauseCircle,
    badgeClass: 'bg-muted text-muted-foreground',
  },
}

interface ImportedCourseListRowProps {
  course: ImportedCourse
  allTags: string[]
  completionPercent?: number
  /** Hides editing controls (edit/delete menu items). Status changes remain available. */
  readOnly?: boolean
}

export function ImportedCourseListRow({
  course,
  allTags,
  completionPercent = 0,
  readOnly = false,
}: ImportedCourseListRowProps) {
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const thumbnailUrls = useCourseImportStore(state => state.thumbnailUrls)
  const navigate = useNavigate()

  const storeAuthors = useAuthorStore(state => state.authors)
  const loadAuthors = useAuthorStore(state => state.loadAuthors)
  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])
  const authorData = course.authorId ? storeAuthors.find(a => a.id === course.authorId) : undefined

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  const thumbnailUrl = thumbnailUrls[course.id] ?? course.youtubeThumbnailUrl ?? null
  const status = course.status
  const config = statusConfig[status]
  const StatusIcon = config.icon

  function navigateToCourse() {
    navigate(`/courses/${course.id}/overview`)
  }

  function handleRowClick() {
    navigateToCourse()
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLLIElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigateToCourse()
    }
  }

  function handleStatusChange(newStatus: LearnerCourseStatus) {
    if (newStatus !== status) {
      updateCourseStatus(course.id, newStatus)
    }
  }

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

  const importedDate = new Date(course.importedAt).toLocaleDateString()
  const isCompleted = status === 'completed' || completionPercent === 100

  return (
    <>
      <li
        role="button"
        tabIndex={0}
        aria-label={`Open course: ${course.name}`}
        data-testid="imported-course-list-row"
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        className={cn(
          'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl cursor-pointer',
          'min-h-11 sm:min-h-[72px]',
          'hover:bg-muted/50 transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          'border border-transparent hover:border-border'
        )}
      >
        {/* Thumbnail */}
        <div
          data-testid="course-list-row-thumbnail"
          className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="w-full h-full object-cover"
              onError={e => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <FolderOpen
              className="size-6 sm:size-7 text-emerald-300 dark:text-emerald-600"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Metadata column */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3
            data-testid="course-list-row-title"
            className="font-semibold text-sm leading-tight truncate"
          >
            {course.name}
          </h3>
          <p
            data-testid="course-list-row-author"
            className="text-xs text-muted-foreground truncate"
          >
            {authorData ? authorData.name : 'Unknown Author'}
          </p>

          {/* Progress bar (thin) */}
          {completionPercent > 0 && (
            <div
              className="mt-1 h-0.5 w-full max-w-48 bg-muted rounded-full overflow-hidden"
              data-testid="course-list-row-progress"
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${course.name} progress: ${completionPercent}%`}
            >
              <div
                className={cn('h-full', isCompleted ? 'bg-success' : 'bg-brand')}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          )}

          {/* Inline metadata (counts, duration) — shown on tablet+ */}
          <div className="hidden sm:flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Video className="size-3" aria-hidden="true" />
              {course.videoCount}
            </span>
            {course.totalDuration != null && course.totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden="true" />
                {formatCourseDuration(course.totalDuration)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <FileText className="size-3" aria-hidden="true" />
              {course.pdfCount}
            </span>
          </div>
        </div>

        {/* Tag badges — hidden on mobile, capped on desktop */}
        <div className="hidden md:flex shrink-0 max-w-48">
          {course.tags.length > 0 && (
            <TagBadgeList tags={course.tags} maxVisible={2} />
          )}
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <Badge
            data-testid="course-list-row-status"
            className={cn('border-0 text-xs gap-1', config.badgeClass)}
          >
            <StatusIcon className="size-3" aria-hidden="true" />
            <span className="hidden sm:inline">{config.label}</span>
          </Badge>
        </div>

        {/* Last-imported timestamp — desktop only */}
        <div
          data-testid="course-list-row-imported-at"
          className="hidden lg:block shrink-0 text-xs text-muted-foreground tabular-nums w-24 text-right"
        >
          {importedDate}
        </div>

        {/* Overflow menu */}
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                ref={menuTriggerRef}
                type="button"
                data-testid="course-list-row-overflow-trigger"
                onClick={e => e.stopPropagation()}
                aria-label={`More actions for ${course.name}`}
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              {(Object.entries(statusConfig) as [LearnerCourseStatus, typeof config][]).map(
                ([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      className="gap-2"
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {cfg.label}
                      {key === status && (
                        <CheckCircle2
                          className="size-3.5 ml-auto text-brand"
                          aria-hidden="true"
                        />
                      )}
                    </DropdownMenuItem>
                  )
                }
              )}
              {!readOnly && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="course-list-row-edit-menu-item"
                    className="gap-2 min-h-[44px]"
                    onClick={e => {
                      e.stopPropagation()
                      setEditDialogOpen(true)
                    }}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="course-list-row-delete-menu-item"
                    variant="destructive"
                    className="gap-2 min-h-[44px]"
                    onClick={e => {
                      e.stopPropagation()
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete course
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          data-testid="course-list-row-delete-confirm-dialog"
          onCloseAutoFocus={e => {
            e.preventDefault()
            menuTriggerRef.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{course.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the course and all its content from your library. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="course-list-row-delete-confirm-button"
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
    </>
  )
}
