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
  Loader2,
  Pencil,
  Clock,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { TagBadgeList } from '@/app/components/figma/TagBadgeList'
import { TagEditor } from '@/app/components/figma/TagEditor'
import { VideoPlayer } from '@/app/components/figma/VideoPlayer'
import { ThumbnailPickerDialog } from '@/app/components/figma/ThumbnailPickerDialog'
import { EditCourseDialog } from '@/app/components/figma/EditCourseDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useCourseCardPreview } from '@/hooks/useCourseCardPreview'
import { useLazyVisible } from '@/hooks/useLazyVisible'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { getAvatarSrc } from '@/lib/authors'
import { db } from '@/db/schema'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { formatCourseDuration, formatFileSize, getResolutionLabel } from '@/lib/format'
import { MomentumBadge } from './MomentumBadge'
import { ProgressRing } from './ProgressRing'
import { CardCover, CoverProgressBar, PlayOverlay, CompletionOverlay } from './courseCardShell'
import type { ImportedCourse, ImportedVideo, LearnerCourseStatus } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'

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

interface ImportedCourseCardProps {
  course: ImportedCourse
  allTags: string[]
  completionPercent?: number
  momentumScore?: MomentumScore
  /** Hides editing controls (camera overlay, edit/delete menu, tag editing). Status changes remain available. */
  readOnly?: boolean
}

export function ImportedCourseCard({
  course,
  allTags,
  completionPercent = 0,
  momentumScore,
  readOnly = false,
}: ImportedCourseCardProps) {
  const updateCourseTags = useCourseImportStore(state => state.updateCourseTags)
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const thumbnailUrls = useCourseImportStore(state => state.thumbnailUrls)
  const analysisStatus = useCourseImportStore(state => state.autoAnalysisStatus[course.id])
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
  const [previewHandle, setPreviewHandle] = useState<FileSystemFileHandle | null>(null)

  const videoHandle = previewOpen && !searching && firstVideo ? firstVideo.fileHandle : undefined
  const { blobUrl, error: videoError, loading: videoLoading } = useVideoFromHandle(videoHandle)
  const activePreviewHandle = showPreview ? previewHandle : undefined
  const { blobUrl: previewBlobUrl } = useVideoFromHandle(activePreviewHandle)

  useEffect(() => {
    if (!showPreview || course.videoCount === 0) {
      setPreviewHandle(null)
      setVideoReady(false)
      return
    }
    let cancelled = false
    db.importedVideos
      .where('courseId')
      .equals(course.id)
      .sortBy('order')
      .then(vids => {
        if (!cancelled && vids[0]) {
          setPreviewHandle(vids[0].fileHandle)
        }
      })
    return () => {
      cancelled = true
    }
  }, [showPreview, course.id, course.videoCount])

  const status = course.status
  const config = statusConfig[status]
  const StatusIcon = config.icon

  function handleCardClick(e: React.MouseEvent) {
    guardNavigation(e)
    if (!e.defaultPrevented) navigate(`/courses/${course.id}/overview`)
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/courses/${course.id}/overview`)
    }
  }

  function handleRemoveTag(tag: string) {
    updateCourseTags(
      course.id,
      course.tags.filter(t => t !== tag)
    )
  }

  function handleAddTag(tag: string) {
    updateCourseTags(course.id, [...course.tags, tag])
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

  const isLoading = searching || videoLoading

  function handleStartStudying(e: React.MouseEvent) {
    e.stopPropagation()
    handleStatusChange('active')
    navigate(`/courses/${course.id}/overview`)
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
          'group cursor-default focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none',
          showPreview && videoReady && 'z-10'
        )}
      >
        <CardCover heightClass="h-44">
          {/* Background: gradient placeholder or lazy-loaded thumbnail */}
          <div
            data-testid="course-card-placeholder"
            className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center"
          >
            {(!thumbnailUrl || !isCardVisible) && !showPreview && (
              <FolderOpen className="size-16 text-emerald-300 dark:text-emerald-600" />
            )}
          </div>
          {thumbnailUrl && !showPreview && isCardVisible && (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Inline video preview */}
          {showPreview && previewBlobUrl && (
            // width/height attrs prevent the browser from using intrinsic video dimensions before layout.
            // This was the root cause of the pixelated/cropped preview on non-16:9 source videos.
            <video
              key={previewBlobUrl}
              src={previewBlobUrl}
              muted
              autoPlay
              playsInline
              loop
              preload="none"
              aria-hidden="true"
              width="100%"
              height="100%"
              onCanPlay={() => setVideoReady(true)}
              className={cn(
                'absolute inset-0 block w-full h-full object-cover pointer-events-none transition-opacity duration-500',
                videoReady ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}
          {/* Completion/progress badge — top-left */}
          {completionPercent === 100 ? (
            <div
              className="absolute top-3 left-3 z-20 bg-success text-success-foreground rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1"
              data-testid="completion-badge"
            >
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Complete
            </div>
          ) : completionPercent > 0 ? (
            <div className="absolute top-3 left-3 z-20" data-testid="completion-ring">
              <ProgressRing percent={completionPercent} size={40} strokeWidth={3} />
            </div>
          ) : null}

          {/* Status dropdown — top-right */}
          <div className="absolute top-3 right-3 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={statusBadgeRef}
                    data-testid="status-badge"
                    onClick={e => e.stopPropagation()}
                    className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-full outline-none min-h-[44px] flex items-center"
                    aria-label={`Course status: ${config.label}. Click to change.`}
                  >
                    <Badge
                      className={cn(
                        'border-0 text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity',
                        config.badgeClass
                      )}
                    >
                      <StatusIcon className="size-3" aria-hidden="true" />
                      {config.label}
                    </Badge>
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
            className="absolute bottom-3 right-3 z-20"
            onClick={e => { e.preventDefault(); e.stopPropagation() }}
          >
            <Popover open={infoOpen} onOpenChange={setInfoOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  aria-label="Course details"
                  className="rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/70 hover:scale-110 cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none"
                >
                  <Info className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 p-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm leading-tight">{course.name}</h4>
                    {/* Import date moved here from body — frees a body line for the stats row */}
                    <p className="text-xs text-muted-foreground mt-1">
                      Imported {new Date(course.importedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <Badge className={cn('border-0 text-xs gap-1', config.badgeClass)}>
                    <StatusIcon className="size-3" aria-hidden="true" />
                    {config.label}
                  </Badge>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Video className="size-3.5" aria-hidden="true" />
                      {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                    </span>
                    {course.totalDuration != null && course.totalDuration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatCourseDuration(course.totalDuration)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FileText className="size-3.5" aria-hidden="true" />
                      {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                    </span>
                    {course.totalFileSize != null && course.totalFileSize > 0 && (
                      <span className="text-muted-foreground/70">
                        {formatFileSize(course.totalFileSize)}
                      </span>
                    )}
                  </div>

                  {course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.tags.slice(0, 4).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {course.videoCount > 0 && (
                    <Button
                      size="sm"
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

          {/* Camera overlay — only shown when not-started (mutually exclusive with Play overlay) */}
          {!readOnly && status !== 'not-started' && (
            <button
              onClick={e => {
                e.stopPropagation()
                setThumbnailPickerOpen(true)
              }}
              aria-label="Change thumbnail"
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none z-10"
            >
              <Camera className="size-8 text-white drop-shadow" aria-hidden="true" />
            </button>
          )}

          {/* Play overlay — only on not-started courses */}
          <PlayOverlay
            show={status === 'not-started' && !readOnly}
            onClick={handleStartStudying}
            data-testid="start-course-btn"
            aria-label={`Start studying "${course.name}"`}
          />

          {/* Full completion overlay */}
          <CompletionOverlay show={completionPercent === 100} />

          {/* Cover-edge progress bar */}
          <CoverProgressBar progress={completionPercent} />
        </CardCover>

        {/* Card body */}
        <div className="mt-3 px-1">
            <h3
              data-testid="course-card-title"
              className="font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-brand transition-colors"
            >
              {course.name}
            </h3>
            {authorData ? (
              <button
                type="button"
                data-testid="course-card-author"
                onClick={e => {
                  e.stopPropagation()
                  navigate(`/authors/${authorData.id}`)
                }}
                className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground hover:text-brand transition-colors w-fit"
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
            ) : (
              <p
                data-testid="course-card-unknown-author"
                className="text-xs text-muted-foreground mb-1"
              >
                Unknown Author
              </p>
            )}
            {/* "Imported DATE" moved to info popover — frees body for stats row */}
            <div className="flex items-center gap-1.5 mt-1 mb-2">
              <span aria-live="polite" className="contents">
                {analysisStatus === 'analyzing' && (
                  <span
                    data-testid="ai-tagging-indicator"
                    className="text-xs text-muted-foreground animate-pulse flex items-center gap-1"
                  >
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    AI tagging...
                  </span>
                )}
                {analysisStatus === 'complete' && course.tags.length > 0 && (
                  <span className="sr-only">
                    AI tagging complete. {course.tags.length} tags added.
                  </span>
                )}
              </span>
              <TagBadgeList
                tags={course.tags}
                onRemove={readOnly ? undefined : handleRemoveTag}
                maxVisible={3}
              />
              {!readOnly && (
                <TagEditor currentTags={course.tags} allTags={allTags} onAddTag={handleAddTag} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span data-testid="course-card-video-count" className="flex items-center gap-1">
                <Video className="size-3.5" aria-hidden="true" />
                <span>
                  {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                </span>
              </span>
              {course.totalDuration != null && course.totalDuration > 0 && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        data-testid="course-card-duration"
                        className="flex items-center gap-1 cursor-default"
                      >
                        <Clock className="size-3.5" aria-hidden="true" />
                        <span>{formatCourseDuration(course.totalDuration)}</span>
                      </span>
                    </TooltipTrigger>
                    {course.totalFileSize != null && course.totalFileSize > 0 && (
                      <TooltipContent>
                        <span data-testid="course-card-file-size">
                          Total size: {formatFileSize(course.totalFileSize)}
                        </span>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
              <span data-testid="course-card-pdf-count" className="flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden="true" />
                <span>
                  {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                </span>
              </span>
              {course.maxResolutionHeight != null && course.maxResolutionHeight > 0 && (
                <Badge
                  data-testid="course-card-resolution"
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-medium opacity-70"
                >
                  {getResolutionLabel(course.maxResolutionHeight)}
                </Badge>
              )}
            </div>
            {momentumScore && momentumScore.score > 0 && (
              <div className="mt-2">
                <MomentumBadge score={momentumScore.score} tier={momentumScore.tier} />
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-5 pb-2">
            <DialogTitle>{course.name} — Preview</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}
            {!isLoading && videoError && (
              <p className="text-destructive text-sm py-8 text-center">{videoError}</p>
            )}
            {!isLoading && !videoError && blobUrl && (
              <VideoPlayer src={blobUrl} title={firstVideo?.filename} />
            )}
            {!isLoading && !videoError && !blobUrl && (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No video found in this course.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
