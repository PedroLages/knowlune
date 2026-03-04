import { Link, useNavigate } from 'react-router'
import { Clock, Video, FileText, BookOpen, CheckCircle, Eye, Info } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { ProgressRing } from './ProgressRing'
import { VideoPlayer } from './VideoPlayer'
import { getProgress } from '@/lib/progress'
import { getResourceUrl } from '@/lib/media'
import { cn } from '@/app/components/ui/utils'
import { useCourseCardPreview } from '@/hooks/useCourseCardPreview'
import type { Course, CourseCategory } from '@/data/types'

// ── Shared constants ────────────────────────────────────────────────

const categoryLabels: Record<CourseCategory, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
  'confidence-mastery': 'Confidence Mastery',
  'operative-training': 'Operative Training',
  'research-library': 'Research Library',
}

const categoryColors: Record<CourseCategory, string> = {
  'behavioral-analysis':
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'influence-authority': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'confidence-mastery': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'operative-training': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'research-library': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

// ── Helper functions ────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const now = new Date()
  const date = new Date(isoDate)
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  }
  const months = Math.floor(diffInSeconds / 2592000)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

function getDifficultyBadgeVariant(
  difficulty: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (difficulty.toLowerCase()) {
    case 'beginner':
      return 'secondary'
    case 'intermediate':
      return 'default'
    case 'advanced':
      return 'destructive'
    default:
      return 'outline'
  }
}

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ── Types ───────────────────────────────────────────────────────────

type CourseCardVariant = 'library' | 'overview' | 'progress'

interface CourseCardProps {
  course: Course
  variant?: CourseCardVariant
  completionPercent?: number
  status?: 'in-progress' | 'completed' | 'not-started'
  lastAccessedAt?: string
}

// ── Component ───────────────────────────────────────────────────────

export function CourseCard({
  course,
  variant = 'library',
  completionPercent = 0,
  status,
  lastAccessedAt,
}: CourseCardProps) {
  const navigate = useNavigate()
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

  // ── Shared derived state ──────────────────────────────────────────

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const firstLesson = course.modules[0]?.lessons[0]?.id
  const resumeLesson = getProgress(course.id).lastWatchedLesson ?? firstLesson
  const lessonLink = resumeLesson
    ? `/courses/${course.id}/${resumeLesson}`
    : `/courses/${course.id}`

  const firstVideoResource = course.modules
    .flatMap(m => m.lessons)
    .flatMap(l => l.resources)
    .find(r => r.type === 'video')

  const previewSrc = firstVideoResource ? getResourceUrl(firstVideoResource) : undefined

  const isInProgress = completionPercent > 0 && completionPercent < 100
  const isCompleted = completionPercent === 100

  // ── Shared sub-components ─────────────────────────────────────────

  const inlineVideoPreview = showPreview && previewSrc && (
    <video
      key={previewSrc}
      src={previewSrc}
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
  )

  const infoPopoverContent = (
    <div className="space-y-3">
      <div>
        {variant === 'library' ? (
          <Badge className={`border-0 text-xs ${categoryColors[course.category]}`}>
            {categoryLabels[course.category]}
          </Badge>
        ) : variant === 'overview' ? (
          <Badge
            variant="secondary"
            className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            {formatCategory(course.category)}
          </Badge>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{categoryLabels[course.category] ?? course.category}</Badge>
            <Badge
              variant={getDifficultyBadgeVariant(course.difficulty)}
              className={
                course.difficulty.toLowerCase() === 'beginner'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                  : course.difficulty.toLowerCase() === 'intermediate'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
                    : ''
              }
            >
              {course.difficulty}
            </Badge>
          </div>
        )}
        <h4 className="font-semibold text-sm leading-tight mt-2">{course.title}</h4>
      </div>

      {course.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{course.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Video className="size-3.5" aria-hidden="true" />
          {course.totalVideos} videos
        </span>
        <span className="flex items-center gap-1">
          <FileText className="size-3.5" aria-hidden="true" />
          {course.totalPDFs} docs
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />~{course.estimatedHours}h
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

      {completionPercent > 0 && (
        <Progress value={completionPercent} showLabel className="h-1.5" />
      )}

      <Button
        size="sm"
        className="w-full gap-2 hover:brightness-110 active:scale-95 transition-all"
        disabled={!previewSrc}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setInfoOpen(false)
          setPreviewOpen(true)
        }}
      >
        <Eye className="size-4" aria-hidden="true" />
        {previewSrc ? 'Preview Course' : 'No preview available'}
      </Button>
    </div>
  )

  const previewDialog = (
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[24px]">
        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle>{course.title} — Preview</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          {previewSrc && (
            <VideoPlayer
              src={previewSrc}
              title={firstVideoResource?.title}
              poster={course.coverImage ? `${course.coverImage}-768w.png` : undefined}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  // ── Thumbnail overlays (variant-specific) ─────────────────────────

  function renderThumbnailOverlays() {
    switch (variant) {
      case 'library':
        return (
          <>
            {completionPercent === 100 ? (
              <div className="absolute top-3 right-3 bg-success text-success-foreground rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1" data-testid="completion-badge">
                <CheckCircle className="size-3" />
                Complete
              </div>
            ) : completionPercent > 0 ? (
              <div className="absolute top-3 right-3">
                <ProgressRing percent={completionPercent} size={40} strokeWidth={3} />
              </div>
            ) : null}
            <Badge
              className={`absolute top-3 left-3 border-0 text-xs ${categoryColors[course.category]}`}
            >
              {categoryLabels[course.category]}
            </Badge>
          </>
        )
      case 'overview':
        return (
          <>
            {isInProgress && (
              <div className="absolute top-2 right-2 bg-card/95 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold text-brand shadow-lg">
                {completionPercent}%
              </div>
            )}
            {isCompleted && (
              <div className="absolute top-2 right-2 bg-success text-success-foreground rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1">
                <CheckCircle className="size-3" />
                Completed
              </div>
            )}
          </>
        )
      case 'progress':
        return (
          <>
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
              aria-hidden="true"
            />
            {status === 'completed' && (
              <div
                className="absolute top-2 right-2 bg-success text-success-foreground rounded-full p-1"
                role="status"
                aria-label="Course completed"
              >
                <CheckCircle className="size-4" aria-hidden="true" />
              </div>
            )}
          </>
        )
    }
  }

  // ── Info button (shared, with variant-specific click handling) ─────

  function renderInfoButton() {
    // library/overview: inside a <Link>, needs wrapper div with preventDefault
    // progress: inside a Card onClick, only needs stopPropagation
    if (variant === 'progress') {
      return (
        <Popover open={infoOpen} onOpenChange={setInfoOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={e => {
                e.stopPropagation()
              }}
              aria-label="Course details"
              className="absolute bottom-2 right-2 z-20 rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/70 hover:scale-110 cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none"
            >
              <Info className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-72 p-4">
            {infoPopoverContent}
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <div
        className="absolute bottom-3 right-3 z-20"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Popover open={infoOpen} onOpenChange={setInfoOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Course details"
              className="rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/70 hover:scale-110 cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white outline-none"
            >
              <Info className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-72 p-4">
            {infoPopoverContent}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  // ── Thumbnail section ─────────────────────────────────────────────

  const thumbnailHeight = variant === 'overview' ? 'h-32' : 'h-44'

  function renderThumbnail() {
    if (variant === 'progress') {
      // progress variant: simpler <picture> + <img>, rounded top
      return (
        <div className="relative overflow-hidden rounded-t-[24px]">
          <picture>
            <source
              type="image/webp"
              srcSet={`${course.coverImage}-320w.webp 320w, ${course.coverImage}-640w.webp 640w`}
              sizes="(max-width: 640px) 320px, 640px"
            />
            <img
              src={`${course.coverImage}-640w.webp`}
              alt={course.title}
              className={`w-full ${thumbnailHeight} object-cover transition-transform duration-200 group-hover:scale-105`}
              loading="lazy"
            />
          </picture>
          {inlineVideoPreview}
          {renderThumbnailOverlays()}
          {renderInfoButton()}
        </div>
      )
    }

    // library + overview: gradient fallback + full responsive srcSet
    return (
      <div
        className={`relative ${thumbnailHeight} bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 flex items-center justify-center overflow-hidden`}
      >
        {course.coverImage ? (
          variant === 'library' ? (
            <picture className="absolute inset-0">
              <source
                type="image/webp"
                srcSet={`
                  ${course.coverImage}-320w.webp 320w,
                  ${course.coverImage}-640w.webp 640w,
                  ${course.coverImage}-768w.webp 768w,
                  ${course.coverImage}-1024w.webp 1024w
                `}
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 768px"
              />
              <img
                src={`${course.coverImage}-768w.png`}
                srcSet={`
                  ${course.coverImage}-320w.png 320w,
                  ${course.coverImage}-640w.png 640w,
                  ${course.coverImage}-768w.png 768w,
                  ${course.coverImage}-1024w.png 1024w
                `}
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 768px"
                alt={course.title}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </picture>
          ) : (
            <img
              src={`${course.coverImage}-640w.webp`}
              alt={course.title}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 absolute inset-0"
              loading="lazy"
            />
          )
        ) : (
          <BookOpen className="h-16 w-16 text-blue-300 dark:text-blue-600" />
        )}
        {inlineVideoPreview}
        {renderThumbnailOverlays()}
        {renderInfoButton()}
      </div>
    )
  }

  // ── Body content (variant-specific) ───────────────────────────────

  function renderBody() {
    switch (variant) {
      case 'library':
        return (
          <div className="p-5 flex flex-col flex-1">
            <h3 className="font-semibold text-base mb-3 group-hover:text-brand transition-colors line-clamp-2">
              {course.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-auto mb-3">
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                {course.totalVideos} videos
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {course.totalPDFs} docs
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {course.estimatedHours}h
              </span>
            </div>
            <Progress value={completionPercent} showLabel className="h-1.5" />
          </div>
        )

      case 'overview':
        return (
          <div className="p-5 flex-1 flex flex-col">
            <Badge
              variant="secondary"
              className="mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 w-fit"
            >
              {formatCategory(course.category)}
            </Badge>
            <h3 className="font-semibold text-base line-clamp-2 mb-2 group-hover:text-brand transition-colors">
              {course.title}
            </h3>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
              </span>
              {isInProgress && (
                <span className="flex items-center gap-1 text-brand font-medium">
                  <Clock className="size-3" />
                  In Progress
                </span>
              )}
              {!isInProgress && !isCompleted && (
                <span className="text-muted-foreground">Not Started</span>
              )}
            </div>
            {isInProgress && (
              <div className="mt-3">
                <Progress value={completionPercent} showLabel className="h-1.5" />
              </div>
            )}
            {isCompleted && (
              <div className="mt-3 flex items-center gap-2 text-sm text-success font-medium">
                <CheckCircle className="size-4" />
                Completed
              </div>
            )}
          </div>
        )

      case 'progress':
        return (
          <div className="p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="badge-entrance">
                {categoryLabels[course.category] ?? course.category}
              </Badge>
              <Badge
                variant={getDifficultyBadgeVariant(course.difficulty)}
                className={`badge-entrance ${
                  course.difficulty.toLowerCase() === 'beginner'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900'
                    : course.difficulty.toLowerCase() === 'intermediate'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900'
                      : ''
                }`}
              >
                {course.difficulty}
              </Badge>
            </div>

            <h3
              className="font-semibold text-base line-clamp-2 group-hover:text-brand transition-colors"
              title={course.title}
            >
              {course.title}
            </h3>

            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  {course.totalVideos} videos
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {course.totalPDFs} docs
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{course.estimatedHours}h
                </span>
              </div>

              {status === 'in-progress' && (
                <>
                  <Progress value={completionPercent} showLabel className="h-2" />
                  {lastAccessedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(lastAccessedAt)}
                    </span>
                  )}
                  <Button asChild className="button-press w-full bg-blue-600 hover:bg-blue-700">
                    <Link to={lessonLink} onClick={e => e.stopPropagation()}>
                      Resume Learning
                    </Link>
                  </Button>
                </>
              )}

              {status === 'completed' && (
                <>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Completed · {totalLessons} lessons
                  </p>
                  <Button asChild variant="outline" className="button-press w-full">
                    <Link to={lessonLink} onClick={e => e.stopPropagation()}>
                      Review Course
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )
    }
  }

  // ── Card shell ────────────────────────────────────────────────────

  const cardShell = (
    <Card
      data-preview={showPreview && videoReady ? '' : undefined}
      className={cn(
        'group bg-card border-0 shadow-sm overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 motion-reduce:hover:scale-100 cursor-default h-full flex flex-col',
        showPreview && videoReady && '!scale-[1.05] z-10',
        variant === 'progress' &&
          status === 'completed' &&
          'border-green-200 dark:border-green-800',
        variant === 'progress' && status === 'not-started' && 'opacity-80 hover:opacity-100'
      )}
    >
      {variant === 'progress' ? (
        <CardContent className="p-0 flex flex-col h-full">
          {renderThumbnail()}
          {renderBody()}
        </CardContent>
      ) : (
        <>
          {renderThumbnail()}
          {renderBody()}
        </>
      )}
    </Card>
  )

  // ── Navigation wrapper ────────────────────────────────────────────

  if (variant === 'progress') {
    // progress: Card onClick (inner Link buttons for Resume/Review)
    return (
      <>
        <div
          onClick={e => {
            guardNavigation(e)
            if (!e.defaultPrevented) navigate(lessonLink)
          }}
          {...previewHandlers}
          className="h-full"
        >
          {cardShell}
        </div>
        {previewDialog}
      </>
    )
  }

  // library + overview: <Link> wraps entire card
  return (
    <>
      <Link
        to={lessonLink}
        onClick={guardNavigation}
        {...previewHandlers}
        className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full cursor-default"
      >
        {cardShell}
      </Link>
      {previewDialog}
    </>
  )
}

export { categoryLabels, categoryColors }
