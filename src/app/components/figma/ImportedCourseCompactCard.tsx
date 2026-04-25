import { useEffect, useRef, useState } from 'react'
import {
  FolderOpen,
  Circle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  MoreVertical,
  Pencil,
  Trash2,
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
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyVisible } from '@/hooks/useLazyVisible'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_THRESHOLD_PX = 10

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

interface ImportedCourseCompactCardProps {
  course: ImportedCourse
  /** Reserved for parity with ImportedCourseCard; not rendered in compact view. */
  allTags?: string[]
  completionPercent?: number
  /** Hides destructive controls. Status changes remain available. */
  readOnly?: boolean
}

/**
 * Thumbnail-centric, dense course card for E99-S04 compact grid view.
 *
 * Renders only thumbnail + 2-line title + 2px progress overlay. Status badge
 * and overflow menu are hover-revealed on devices that support hover, and
 * always-visible on touch devices (`@media (hover: none)`). Long-press
 * (>500ms, <10px movement) opens the overflow menu on touch.
 */
export function ImportedCourseCompactCard({
  course,
  completionPercent = 0,
  readOnly = false,
}: ImportedCourseCompactCardProps) {
  const navigate = useNavigate()
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const thumbnailUrls = useCourseImportStore(state => state.thumbnailUrls)
  const thumbnailUrl = thumbnailUrls[course.id] ?? course.youtubeThumbnailUrl ?? null

  const [lazyRef, isCardVisible] = useLazyVisible<HTMLElement>()

  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Long-press tracking
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = useRef(false)

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current)
      }
    }
  }, [])

  const status = course.status
  const config = statusConfig[status]
  const StatusIcon = config.icon
  const isCompleted = status === 'completed' || completionPercent === 100
  const safeProgress = Math.max(0, Math.min(100, completionPercent))

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
  }

  function handlePointerDown(e: React.PointerEvent) {
    // Only track primary button / touch / pen
    if (e.pointerType === 'mouse' && e.button !== 0) return
    longPressTriggeredRef.current = false
    pressStartRef.current = { x: e.clientX, y: e.clientY }
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setMenuOpen(true)
      pressTimerRef.current = null
    }, LONG_PRESS_MS)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const start = pressStartRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearPressTimer()
    }
  }

  function handlePointerEnd() {
    clearPressTimer()
  }

  function handleCardClick(e: React.MouseEvent) {
    if (longPressTriggeredRef.current) {
      // Suppress navigation when click follows a long-press
      e.preventDefault()
      e.stopPropagation()
      longPressTriggeredRef.current = false
      return
    }
    navigate(`/courses/${course.id}/overview`)
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/courses/${course.id}/overview`)
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

  return (
    <>
      <article
        ref={lazyRef}
        data-testid="imported-course-compact-card"
        aria-label={`${course.name}${safeProgress > 0 ? `, ${safeProgress}% complete` : ''}`}
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        className={cn(
          'group relative flex flex-col cursor-pointer outline-none',
          'min-h-[44px] min-w-[44px]',
          'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg'
        )}
      >
        {/* Thumbnail wrapper */}
        <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
          {/* Placeholder background (always present) */}
          <div
            data-testid="compact-card-placeholder"
            className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center"
          >
            {(!thumbnailUrl || !isCardVisible) && (
              <FolderOpen
                className="size-8 text-emerald-300 dark:text-emerald-600"
                aria-hidden="true"
              />
            )}
          </div>

          {thumbnailUrl && isCardVisible && (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Completion overlay (subtle dim + check) */}
          {isCompleted && (
            <div
              className="absolute inset-0 bg-success/40 flex items-center justify-center"
              data-testid="compact-completion-overlay"
            >
              <CheckCircle2 className="size-8 text-success-foreground" aria-hidden="true" />
            </div>
          )}

          {/* Status badge — top-left, hover-revealed on desktop, always visible on touch */}
          <div
            data-testid="compact-status-wrapper"
            className={cn(
              'absolute top-1 left-1 z-10',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              '[@media(hover:none)]:opacity-100',
              'motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out'
            )}
          >
            <Badge
              data-testid="compact-status-badge"
              className={cn('border-0 text-[10px] gap-1 px-1.5 py-0', config.badgeClass)}
            >
              <StatusIcon className="size-2.5" aria-hidden="true" />
              {config.label}
            </Badge>
          </div>

          {/* Overflow menu — top-right */}
          <div
            data-testid="compact-overflow-wrapper"
            className={cn(
              'absolute top-1 right-1 z-10',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              '[@media(hover:none)]:opacity-100',
              'motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out'
            )}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="compact-overflow-trigger"
                  aria-label={`Course actions for ${course.name}`}
                  className="rounded-full bg-black/50 backdrop-blur-sm p-1 text-white hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white outline-none"
                >
                  <MoreVertical className="size-3.5" aria-hidden="true" />
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
                      data-testid="compact-edit-menu-item"
                      className="gap-2 min-h-[44px]"
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/courses/${course.id}/overview`)
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Open course
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="compact-delete-menu-item"
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

          {/* Progress bar — flush to bottom of thumbnail */}
          {safeProgress > 0 && !isCompleted && (
            <div
              data-testid="compact-progress-bar"
              role="progressbar"
              aria-valuenow={safeProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${safeProgress}% complete`}
              className="absolute bottom-0 left-0 h-0.5 bg-brand"
              style={{ width: `${safeProgress}%` }}
            />
          )}
        </div>

        {/* Title */}
        <h3
          data-testid="compact-card-title"
          className={cn(
            'mt-2 text-xs sm:text-sm font-medium leading-tight line-clamp-2',
            'text-muted-foreground group-hover:text-foreground',
            'motion-safe:transition-colors motion-safe:duration-150'
          )}
        >
          {course.name}
        </h3>
      </article>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="compact-delete-confirm-dialog">
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
              data-testid="compact-delete-confirm-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
