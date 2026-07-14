import { useState, useEffect, useRef } from 'react'
import {
  FolderOpen,
  Video,
  FileText,
  Circle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Eye,
  Info,
  Camera,
  Trash2,
  Pencil,
  Clock,
  X,
  HardDrive,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/app/components/ui/dialog'
import { Checkbox } from '@/app/components/ui/checkbox'
import { VideoPlayer } from '@/app/components/figma/VideoPlayer'
import { ThumbnailPickerDialog } from '@/app/components/figma/ThumbnailPickerDialog'
import { EditCourseDialog } from '@/app/components/figma/EditCourseDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useImportedCourseStartFlow } from '@/app/hooks/useImportedCourseStartFlow'
import { useCourseCardPreview } from '@/hooks/useCourseCardPreview'
import { useLazyVisible } from '@/hooks/useLazyVisible'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { getAvatarSrc } from '@/lib/authors'
import { db } from '@/db/schema'
import { formatCourseDuration, formatFileSize, getResolutionLabel } from '@/lib/format'
import { ProgressRing } from './ProgressRing'
import {
  CardCover,
  CoverProgressBar,
  CompletionOverlay,
  CoverCornerChip,
  OVERLAY_SCRIM_CLASS,
} from './CourseCardShell'
import type { ImportedCourse, ImportedVideo, LearnerCourseStatus } from '@/data/types'

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

/**
 * Trim minutes from course duration at card scale when hours >= 10.
 * "134h 36m" → "134h"; "8h 24m" stays as-is.
 */
function formatCourseDurationCompact(totalSeconds: number): string {
  const hours = Math.floor(Math.max(0, totalSeconds) / 3600)
  if (hours >= 10) return `${hours}h`
  return formatCourseDuration(totalSeconds)
}

interface ImportedCourseCardProps {
  course: ImportedCourse
  allTags: string[]
  completionPercent?: number
  /** Hides editing controls (camera overlay, edit/delete menu, tag editing). Status changes remain available. */
  readOnly?: boolean
  /** When provided, enables selection mode with a checkbox overlay */
  selected?: boolean
  onToggleSelect?: (courseId: string) => void
}

export function ImportedCourseCard({
  course,
  allTags,
  completionPercent = 0,
  readOnly = false,
  selected = false,
  onToggleSelect,
}: ImportedCourseCardProps) {
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const thumbnailUrls = useCourseImportStore(state => state.thumbnailUrls)
  const navigate = useNavigate()

  // Subscribe to author store so card re-renders when authors load
  const storeAuthors = useAuthorStore(state => state.authors)
  const loadAuthors = useAuthorStore(state => state.loadAuthors)
  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])
  const authorData = course.authorId ? storeAuthors.find(a => a.id === course.authorId) : undefined

  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const statusBadgeRef = useRef<HTMLButtonElement>(null)
  const continuingRef = useRef(false)
  const { startStudying } = useImportedCourseStartFlow(course.id)
  const thumbnailUrl = thumbnailUrls[course.id] ?? course.youtubeThumbnailUrl ?? null

  // Lazy-load thumbnail: only render <img> when card enters viewport (E1B-S04 AC5)
  const [lazyRef, isCardVisible] = useLazyVisible<HTMLElement>()

  const {
    showPreview,
    videoReady,
    setVideoReady,
    previewHandlers,
    previewOpen,
    setPreviewOpen,
    infoOpen,
    setInfoOpen,
    guardNavigation,
  } = useCourseCardPreview()
  const [firstVideo, setFirstVideo] = useState<ImportedVideo | null>(null)
  const [searching, setSearching] = useState(false)
  const [previewVideo, setPreviewVideo] = useState<ImportedVideo | null>(null)

  const modalUsesRemoteSource = Boolean(firstVideo?.serverUrl)
  const videoHandle =
    previewOpen && !searching && firstVideo && !modalUsesRemoteSource
      ? firstVideo.fileHandle
      : undefined
  const { blobUrl, error: videoError, loading: videoLoading } = useVideoFromHandle(videoHandle)
  const modalVideoSrc = firstVideo?.serverUrl ?? blobUrl
  const modalVideoError = modalUsesRemoteSource ? null : videoError
  const modalVideoLoading = searching || (!modalUsesRemoteSource && videoLoading)

  const activePreviewHandle =
    showPreview && previewVideo?.fileHandle ? previewVideo.fileHandle : undefined
  const { blobUrl: previewBlobUrl } = useVideoFromHandle(activePreviewHandle)
  const previewVideoSrc = previewVideo?.serverUrl ?? previewBlobUrl

  useEffect(() => {
    if (!showPreview || course.videoCount === 0 || course.source === 'youtube') {
      setPreviewVideo(null)
      setVideoReady(false)
      return
    }
    let cancelled = false
    db.importedVideos
      .where('courseId')
      .equals(course.id)
      .sortBy('order')
      .then(vids => {
        if (cancelled) return
        if (!vids[0]) {
          console.warn('[CourseCardPreview] No videos found for course', course.id)
          setPreviewVideo(null)
          setVideoReady(false)
          return
        }
        if (!vids[0].fileHandle && !vids[0].serverUrl) {
          console.warn(
            '[CourseCardPreview] First video has no previewable source',
            vids[0].filename,
            course.id
          )
          setPreviewVideo(null)
          setVideoReady(false)
          return
        }
        setPreviewVideo(vids[0])
      })
      .catch(err => {
        // silent-catch-ok: hover preview is optional; the poster remains visible on failure.
        console.warn('[CourseCardPreview] DB query failed for course', course.id, err)
        setPreviewVideo(null)
        setVideoReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [showPreview, course.id, course.videoCount, course.source])

  const status = course.status
  const config = statusConfig[status]
  const StatusIcon = config.icon

  function handleCardClick(e: React.MouseEvent) {
    guardNavigation(e)
    if (onToggleSelect) {
      onToggleSelect(course.id)
      return
    }
    if (course.status === 'not-started' && !readOnly && !e.defaultPrevented) {
      void startStudying(e)
      return
    }
    if (!e.defaultPrevented) navigate(`/courses/${course.id}/overview`)
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onToggleSelect) {
        onToggleSelect(course.id)
        return
      }
      if (course.status === 'not-started' && !readOnly) {
        void startStudying(e)
        return
      }
      navigate(`/courses/${course.id}/overview`)
    }
  }

  function handleStatusChange(newStatus: LearnerCourseStatus) {
    if (newStatus !== status) {
      updateCourseStatus(course.id, newStatus)
    }
  }

  async function handlePreviewClick(e: React.MouseEvent) {
    e.stopPropagation()
    setSearching(true)
    setFirstVideo(null)
    setPreviewOpen(true)
    const vids = await db.importedVideos.where('courseId').equals(course.id).sortBy('order')
    setFirstVideo(vids[0] ?? null)
    setSearching(false)
  }

  function handleDialogChange(open: boolean) {
    setPreviewOpen(open)
    if (!open) {
      setFirstVideo(null)
      setSearching(false)
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

  const isLoading = modalVideoLoading

  // Derive a single completion state to avoid Play+Complete overlay collision when
  // cross-device sync produces inconsistent (status='not-started', completion=100%) pairs.
  const isCompleted = course.status === 'completed' || completionPercent === 100
  const showPlay = course.status === 'not-started' && !isCompleted && !readOnly

  async function handleContinueLearning(e: React.SyntheticEvent) {
    e.stopPropagation()
    if (continuingRef.current) return
    continuingRef.current = true
    try {
      if (status === 'paused') {
        await updateCourseStatus(course.id, 'active')
        const { importError } = useCourseImportStore.getState()
        if (importError) {
          toast.error(importError)
          return
        }
      }
      navigate(`/courses/${course.id}/overview`)
    } finally {
      continuingRef.current = false
    }
  }

  return (
    <>
      <article
        ref={lazyRef}
        data-testid="imported-course-card"
        aria-label={`${course.name} — ${course.videoCount} ${course.videoCount === 1 ? 'video' : 'videos'}${course.totalDuration ? `, ${formatCourseDuration(course.totalDuration)}` : ''}, ${course.pdfCount} ${course.pdfCount === 1 ? 'PDF' : 'PDFs'}`}
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        {...previewHandlers}
        data-preview={showPreview && videoReady ? '' : undefined}
        className={cn(
          'group cursor-default focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none rounded-lg',
          'relative hover:-translate-y-0.5 hover:z-10 hover:shadow-lg motion-safe:transition-[transform,box-shadow] motion-reduce:transition-none motion-reduce:hover:-translate-y-0'
        )}
      >
        <div className="group-hover:translate-y-2 motion-safe:transition-transform motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          <CardCover heightClass="aspect-video w-full">
            {/* Keep the poster mounted beneath the preview so loading never exposes a flash. */}
            <div
              data-testid="course-card-placeholder"
              className="absolute inset-0 bg-muted flex items-center justify-center"
            >
              {(!thumbnailUrl || !isCardVisible) && (
                <FolderOpen className="size-16 text-muted-foreground/40" aria-hidden="true" />
              )}
            </div>
            {thumbnailUrl && isCardVisible && (
              <img
                src={thumbnailUrl}
                alt=""
                width={1280}
                height={720}
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            )}
            {/* Fade the first rendered frame over the poster only after playback begins. */}
            {showPreview && previewVideoSrc && (
              // width/height attrs prevent the browser from using intrinsic video dimensions before layout.
              // This was the root cause of the pixelated/cropped preview on non-16:9 source videos.
              <video
                key={previewVideoSrc}
                src={previewVideoSrc}
                muted
                autoPlay
                playsInline
                loop
                preload="metadata"
                aria-hidden="true"
                width="100%"
                height="100%"
                onLoadStart={() => setVideoReady(false)}
                onPlaying={() => setVideoReady(true)}
                className={cn(
                  'absolute inset-0 block w-full h-full object-cover pointer-events-none transition-opacity duration-200 motion-reduce:transition-none',
                  videoReady ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}

            {/* Selection checkbox — top-left, only when selection mode is active */}
            {onToggleSelect && (
              <div className="absolute top-3 left-3 z-40" onClick={e => e.stopPropagation()}>
                <div className="bg-background/80 rounded-full p-0.5">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(course.id)}
                    aria-label={`Select ${course.name}`}
                  />
                </div>
              </div>
            )}

            {/* Completion/progress badge — top-left */}
            {completionPercent === 100 ? (
              <div
                className="absolute top-3 left-3 z-30 bg-success text-success-foreground rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1"
                data-testid="completion-badge"
              >
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Complete
              </div>
            ) : completionPercent > 0 ? (
              <div className="absolute top-3 left-3 z-30" data-testid="completion-ring">
                <ProgressRing percent={completionPercent} size={40} strokeWidth={3} />
              </div>
            ) : null}

            {/* Status dropdown — top-right.
              When status is 'active' (default on My Courses), show an icon-only
              affordance instead of the pill — every card is active, so the label
              adds noise. Other statuses render the pill with an overlay scrim. */}
            <div className="absolute top-3 right-3 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={statusBadgeRef}
                    data-testid="status-badge"
                    onClick={e => e.stopPropagation()}
                    className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-full outline-none min-h-[44px] flex items-center"
                    aria-label={`Course status: ${config.label}. Click to change.`}
                  >
                    {status === 'active' ? (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-full p-1.5 cursor-pointer hover:opacity-80 transition-opacity',
                          OVERLAY_SCRIM_CLASS
                        )}
                      >
                        <StatusIcon className="size-3.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <Badge
                        className={cn(
                          'border-0 text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity',
                          OVERLAY_SCRIM_CLASS
                        )}
                      >
                        <StatusIcon className="size-3" aria-hidden="true" />
                        {config.label}
                      </Badge>
                    )}
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
                        data-testid="edit-course-menu-item"
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
                        data-testid="change-thumbnail-menu-item"
                        className="gap-2 min-h-[44px]"
                        onClick={e => {
                          e.stopPropagation()
                          setThumbnailPickerOpen(true)
                        }}
                      >
                        <Camera className="size-4" aria-hidden="true" />
                        Change thumbnail
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid="delete-course-menu-item"
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

            {/* Info button — bottom-right, hover-revealed */}
            <div
              className="absolute bottom-3 right-3 z-30"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <Popover open={infoOpen} onOpenChange={setInfoOpen}>
                <PopoverTrigger asChild>
                  <button
                    data-testid="course-info-button"
                    onClick={e => e.stopPropagation()}
                    aria-label="Course details"
                    className="rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-all duration-300 hover:bg-black/70 hover:scale-110 cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none"
                  >
                    <Info className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-72 p-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm leading-tight">{course.name}</h4>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          Imported {new Date(course.importedAt).toLocaleDateString()}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none shrink-0',
                            config.badgeClass
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {course.videoCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Video className="size-3.5" aria-hidden="true" />
                          {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                        </span>
                      )}
                      {course.totalDuration != null && course.totalDuration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {formatCourseDuration(course.totalDuration)}
                        </span>
                      )}
                      {course.pdfCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="size-3.5" aria-hidden="true" />
                          {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                        </span>
                      )}
                      {course.totalFileSize != null && course.totalFileSize > 0 && (
                        <span className="text-muted-foreground">
                          {formatFileSize(course.totalFileSize)}
                        </span>
                      )}
                    </div>

                    {course.videoCount > 0 && (
                      <Button
                        size="sm"
                        data-testid="course-preview-video-btn"
                        className="w-full gap-2 hover:brightness-110 active:scale-95 transition-all"
                        onClick={e => {
                          e.stopPropagation()
                          setInfoOpen(false)
                          handlePreviewClick(e)
                        }}
                      >
                        <Eye className="size-4" aria-hidden="true" />
                        Preview First Video
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Completion overlay */}
            <CompletionOverlay show={isCompleted} />

            {/* Resolution chip — bottom-left, only when ≥1080p (sub-HD is not a selling point) */}
            {course.maxResolutionHeight != null && course.maxResolutionHeight >= 1080 && (
              <CoverCornerChip position="bottom-left" data-testid="course-card-resolution">
                {getResolutionLabel(course.maxResolutionHeight)}
              </CoverCornerChip>
            )}

            {/* Duration chip — bottom-right (YouTube/Vimeo convention).
              Hidden on hover so the hover-revealed info button (same corner)
              has clear space. */}
            {course.totalDuration != null && course.totalDuration > 0 && (
              <span className="transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:group-hover:opacity-100 motion-reduce:transition-none">
                <CoverCornerChip position="bottom-right" data-testid="course-card-duration">
                  <Clock className="size-3" aria-hidden="true" />
                  {formatCourseDurationCompact(course.totalDuration)}
                </CoverCornerChip>
              </span>
            )}

            {/* Cover-edge progress bar */}
            <div data-testid="completion-progress-bar" className="contents">
              <CoverProgressBar progress={completionPercent} />
            </div>
          </CardCover>
        </div>

        {/* Card body */}
        <div className="mt-3 px-1 min-h-32 flex flex-col">
          <h3
            data-testid="course-card-title"
            className="font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-brand transition-colors"
          >
            {course.name}
          </h3>
          {/* Author */}
          {authorData ? (
            <div className="flex min-h-5 items-center gap-2">
              <button
                type="button"
                data-testid="course-card-author"
                onClick={e => {
                  e.stopPropagation()
                  navigate(`/authors/${authorData.id}`)
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors w-fit"
              >
                <Avatar className="size-5">
                  <AvatarImage {...getAvatarSrc(authorData.photoUrl ?? '', 20)} alt="" />
                  <AvatarFallback className="text-[8px]">
                    {authorData.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{authorData.name}</span>
              </button>
            </div>
          ) : (
            // Author row is hidden when no author is set — exposing "Unknown Author"
            // as user-facing text reads as a bug. A visually hidden span preserves
            // the data-testid for any tests that rely on the fallback element.
            <span data-testid="course-card-unknown-author" className="sr-only" aria-hidden="true" />
          )}
          <div
            data-testid="course-card-metadata"
            className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground"
          >
            {course.videoCount > 0 && (
              <span data-testid="course-card-video-count" className="flex items-center gap-1">
                <Video className="size-4" aria-hidden="true" />
                <span>
                  {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                </span>
              </span>
            )}
            {course.pdfCount > 0 && (
              <span data-testid="course-card-pdf-count" className="flex items-center gap-1">
                <FileText className="size-4" aria-hidden="true" />
                <span>
                  {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                </span>
              </span>
            )}
            {course.totalFileSize != null && course.totalFileSize > 0 && (
              <span data-testid="course-card-file-size" className="text-muted-foreground">
                {formatFileSize(course.totalFileSize)}
              </span>
            )}
            {course.source === 'drive' && (
              <span
                data-testid="course-card-source-badge"
                className="inline-flex items-center gap-1 rounded-md bg-brand-soft/80 px-1.5 py-0.5 text-[10px] font-medium text-brand-soft-foreground"
              >
                <HardDrive className="size-3" aria-hidden="true" />
                Drive
              </span>
            )}
          </div>

          {/* Action buttons — always visible, no hover needed */}
          {!readOnly &&
            (showPlay || ((status === 'active' || status === 'paused') && !isCompleted)) && (
              <div data-testid="course-card-actions" className="mt-auto pt-3">
                {showPlay && (
                  <Button
                    variant="brand"
                    size="sm"
                    data-testid="start-course-btn"
                    onClick={startStudying}
                    aria-label={`Start studying "${course.name}"`}
                    className="w-full button-press gap-2"
                  >
                    <PlayCircle className="size-4" aria-hidden="true" />
                    Start Learning
                  </Button>
                )}
                {(status === 'active' || status === 'paused') && !isCompleted && (
                  <Button
                    variant="brand-outline"
                    size="sm"
                    data-testid="continue-course-btn"
                    aria-label={`Continue "${course.name}"`}
                    className="w-full button-press gap-2"
                    onClick={handleContinueLearning}
                  >
                    <PlayCircle className="size-4" aria-hidden="true" />
                    Continue Learning
                  </Button>
                )}
              </div>
            )}
        </div>
      </article>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          data-testid="delete-confirm-dialog"
          onCloseAutoFocus={e => {
            e.preventDefault()
            statusBadgeRef.current?.focus()
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

      <ThumbnailPickerDialog
        open={thumbnailPickerOpen}
        onOpenChange={setThumbnailPickerOpen}
        courseId={course.id}
        courseName={course.name}
        firstVideo={firstVideo}
      />

      <EditCourseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        course={course}
        allTags={allTags}
      />

      <Dialog open={previewOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          hideClose
          overlayClassName="bg-black/80"
          onOpenAutoFocus={e => e.preventDefault()}
          className="sm:max-w-[92vw] lg:max-w-5xl p-0 overflow-visible border-0 shadow-none bg-transparent"
        >
          {/* Title is redundant with the card that spawned the modal — keep
              for screen readers but hide visually. */}
          <DialogHeader className="sr-only">
            <DialogTitle>{course.name} — Preview</DialogTitle>
            <DialogDescription className="sr-only">
              Course details and available actions
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl">
            {isLoading && <Skeleton className="absolute inset-0 rounded-2xl" />}
            {!isLoading && modalVideoError && (
              <p className="absolute inset-0 flex items-center justify-center text-white/90 text-sm text-center px-6">
                {modalVideoError}
              </p>
            )}
            {!isLoading && !modalVideoError && modalVideoSrc && (
              <VideoPlayer src={modalVideoSrc} title={firstVideo?.filename} autoplay />
            )}
            {!isLoading && !modalVideoError && !modalVideoSrc && (
              <p className="absolute inset-0 flex items-center justify-center text-white/70 text-sm text-center px-6">
                No video found in this course.
              </p>
            )}
            <DialogClose
              aria-label="Close preview"
              className={cn(
                'absolute top-4 right-4 z-50 size-10 rounded-full flex items-center justify-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                'transition-opacity hover:opacity-90',
                OVERLAY_SCRIM_CLASS
              )}
            >
              <X className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
