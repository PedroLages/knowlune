import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Video,
  FileText,
  Circle,
  CheckCircle2,
  PauseCircle,
  Eye,
  Info,
  Camera,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Card } from '@/app/components/ui/card'
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
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useCourseCardPreview } from '@/hooks/useCourseCardPreview'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { db } from '@/db/schema'
import { MomentumBadge } from './MomentumBadge'
import type { ImportedCourse, ImportedVideo, LearnerCourseStatus } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'

const statusConfig: Record<
  LearnerCourseStatus,
  { label: string; icon: typeof Circle; badgeClass: string }
> = {
  active: {
    label: 'Active',
    icon: Circle,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  paused: {
    label: 'Paused',
    icon: PauseCircle,
    badgeClass: 'bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-400',
  },
}

interface ImportedCourseCardProps {
  course: ImportedCourse
  allTags: string[]
  momentumScore?: MomentumScore
}

export function ImportedCourseCard({ course, allTags, momentumScore }: ImportedCourseCardProps) {
  const updateCourseTags = useCourseImportStore(state => state.updateCourseTags)
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const thumbnailUrls = useCourseImportStore(state => state.thumbnailUrls)
  const navigate = useNavigate()

  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const thumbnailUrl = thumbnailUrls[course.id] ?? null

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
    if (!e.defaultPrevented) navigate(`/imported-courses/${course.id}`)
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/imported-courses/${course.id}`)
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
    await removeImportedCourse(course.id)
    const { importError } = useCourseImportStore.getState()
    if (importError) {
      toast.error('Failed to remove course')
    } else {
      toast.success('Course removed')
    }
  }

  const isLoading = searching || videoLoading

  return (
    <>
      <article
        data-testid="imported-course-card"
        aria-label={`${course.name} — ${course.videoCount} ${course.videoCount === 1 ? 'video' : 'videos'}, ${course.pdfCount} ${course.pdfCount === 1 ? 'PDF' : 'PDFs'}`}
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        {...previewHandlers}
        data-preview={showPreview && videoReady ? '' : undefined}
        className={cn(
          'group rounded-[24px] cursor-default focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none hover:shadow-2xl hover:[transform:scale(1.02)] transition-shadow duration-300 motion-reduce:hover:[transform:scale(1)] h-full',
          showPreview && videoReady && '[transform:scale(1.05)] z-10'
        )}
      >
        <Card className="bg-card rounded-[24px] border-0 shadow-sm overflow-hidden h-full flex flex-col">
          <div
            data-testid="course-card-placeholder"
            className="relative h-44 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center"
          >
            {/* Static thumbnail image (when set) */}
            {thumbnailUrl && !showPreview && (
              <img
                src={thumbnailUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Gradient placeholder icon (shown when no thumbnail) */}
            {!thumbnailUrl && (
              <FolderOpen className="size-16 text-emerald-300 dark:text-emerald-600" />
            )}
            {/* Camera overlay — appears on hover to change thumbnail */}
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
            {/* Inline video preview */}
            {showPreview && previewBlobUrl && (
              <video
                key={previewBlobUrl}
                src={previewBlobUrl}
                muted
                autoPlay
                playsInline
                loop
                preload="none"
                aria-hidden="true"
                onCanPlay={() => setVideoReady(true)}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500',
                  videoReady ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}
            <div className="absolute top-3 right-3 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="status-badge"
                    onClick={e => e.stopPropagation()}
                    className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-full outline-none"
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="delete-course-menu-item"
                    className="text-destructive focus:text-destructive gap-2"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete course
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Info button */}
            <Popover open={infoOpen} onOpenChange={setInfoOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={e => {
                    e.stopPropagation()
                  }}
                  aria-label="Course details"
                  className="absolute bottom-3 right-3 z-20 rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/70 hover:scale-110 cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none"
                >
                  <Info className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 p-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm leading-tight">{course.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Imported {new Date(course.importedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <Badge className={cn('border-0 text-xs gap-1', config.badgeClass)}>
                    <StatusIcon className="size-3" aria-hidden="true" />
                    {config.label}
                  </Badge>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Video className="size-3.5" aria-hidden="true" />
                      {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="size-3.5" aria-hidden="true" />
                      {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                    </span>
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
          <div className="p-5">
            <h3
              data-testid="course-card-title"
              className="font-bold text-base mb-1 line-clamp-2 group-hover:text-brand"
            >
              {course.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Imported {new Date(course.importedAt).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-1.5 mb-3">
              <TagBadgeList tags={course.tags} onRemove={handleRemoveTag} maxVisible={3} />
              <TagEditor currentTags={course.tags} allTags={allTags} onAddTag={handleAddTag} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span data-testid="course-card-video-count" className="flex items-center gap-1">
                <Video className="size-3.5" aria-hidden="true" />
                <span>
                  {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                </span>
              </span>
              <span data-testid="course-card-pdf-count" className="flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden="true" />
                <span>
                  {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                </span>
              </span>
            </div>
            {momentumScore && momentumScore.score > 0 && (
              <div className="mt-2">
                <MomentumBadge score={momentumScore.score} tier={momentumScore.tier} />
              </div>
            )}
          </div>
        </Card>
      </article>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{course.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the course and all its content from your
              library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
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

      <Dialog open={previewOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[24px]">
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
