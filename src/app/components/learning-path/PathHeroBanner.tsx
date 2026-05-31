import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Clock, PlayCircle, BookOpen, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/components/ui/utils'

import type { LearningPath } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

// Named gradient class strings (literal, for Tailwind v4 JIT scanning)
const GRADIENT_COVER_CLASSES: Record<string, string> = {
  'cyan-blue': 'bg-gradient-to-br from-cyan-400 to-blue-600',
  'emerald-green': 'bg-gradient-to-br from-emerald-400 to-green-600',
  'purple-indigo': 'bg-gradient-to-br from-purple-500 to-indigo-700',
  'orange-blue': 'bg-gradient-to-br from-orange-400 to-blue-500',
  'pink-purple': 'bg-gradient-to-br from-pink-400 to-purple-600',
  'amber-orange': 'bg-gradient-to-br from-amber-400 to-orange-600',
  'teal-cyan': 'bg-gradient-to-br from-teal-400 to-cyan-600',
  'rose-red': 'bg-gradient-to-br from-rose-400 to-red-600',
}

interface PathHeroBannerProps {
  path: LearningPath
  courseCount: number
  completedCount: number
  pathProgress: PathProgressSummary
  /** Course cover URLs for the avatar stack, in display order (path-scoped, pre-sliced). */
  orderedCourseThumbnails: string[]
  /** The courseId of the current in-progress course, if any */
  currentCourseId: string | null
  /** The courseId of the first course in the path */
  firstCourseId: string | null
  /** Optional: navigate directly to a specific lesson within the CTA course */
  targetLessonId?: string
  /** Back link URL (defaults to "/learning-tracks"). */
  backUrl?: string
  /** Back link label (defaults to "Back to Learning Tracks"). */
  backLabel?: string
  onEdit?: () => void
  onDelete?: () => void
}

export function PathHeroBanner({
  path,
  courseCount,
  completedCount,
  pathProgress,
  orderedCourseThumbnails,
  currentCourseId,
  firstCourseId,
  targetLessonId,
  backUrl = '/learning-tracks',
  backLabel = 'Back to Learning Tracks',
  onEdit,
  onDelete,
}: PathHeroBannerProps) {
  const hasDropdownActions = onEdit || onDelete

  // Course-count based overflow (may exceed visible avatar slots when some courses lack thumbnails).
  const overflowCount = Math.max(0, courseCount - 4)

  // Determine CTA target and label
  const ctaCourseId = currentCourseId ?? firstCourseId
  const ctaLabel = pathProgress.completionPct > 0 ? 'Continue Learning' : 'Start Learning'

  // --- Cover image state machine: pending -> loaded -> failed ---
  const [imageState, setImageState] = useState<'pending' | 'loaded' | 'failed'>(() =>
    path.coverImageUrl ? 'pending' : 'loaded'
  )

  // Reset state when coverImageUrl changes (new URL = new image identity)
  useEffect(() => {
    setImageState(path.coverImageUrl ? 'pending' : 'loaded')
  }, [path.coverImageUrl])

  const showCoverImage = imageState === 'loaded' && !!path.coverImageUrl

return (
    <section
      className={cn(
        // Thin frame padding so the uploaded cover (or gradient) stays visible
        // around the readable content surface, like matted cover art.
        'relative overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-card-ambient p-3 sm:p-4'
      )}
    >
      {/* Primary cover image — full-cover, sharp, and recognizable (not a
          decorative blur). Promoted to opacity-100 only after onLoad. */}
      {path.coverImageUrl && imageState !== 'failed' && (
        <img
          key={path.coverImageUrl}
          src={path.coverImageUrl}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-300 ease-out',
            showCoverImage ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setImageState('loaded')}
          onError={() => setImageState('failed')}
          data-testid="hero-cover-image"
        />
      )}

      {/* Targeted scrim over the visible cover — lighter at top-left so the
          cover stays composed, deeper toward bottom-right for cohesion. The
          contrast guarantee is carried by the content surface, not the scrim. */}
      {showCoverImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-background/15 via-background/45 to-background/80" />
      )}

      {/* Fallback gradient (no cover image, pending, or failed) */}
      {!showCoverImage && (
        <>
          <div className={cn('absolute inset-0',
            path.coverPreset && GRADIENT_COVER_CLASSES[path.coverPreset]
              ? GRADIENT_COVER_CLASSES[path.coverPreset]
              : 'bg-gradient-to-br from-brand to-brand-hover'
          )} />
          {/* Radial highlight overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
        </>
      )}

      {imageState === 'failed' && (
        <div className="sr-only" aria-live="polite" role="status">
          Cover image could not be loaded
        </div>
      )}

      {/* Readable content surface — present in every cover state so text and
          controls keep guaranteed contrast over arbitrary bright/dark/busy
          covers as well as the preset/default gradients. */}
      <div
        className="relative z-10 rounded-[22px] border border-border/50 bg-card/95 shadow-card-ambient backdrop-blur-md p-4 sm:p-8"
        data-testid="hero-content-surface"
      >
        {/* Back link + Dropdown row */}
        <div className="flex items-start justify-between mb-6">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground motion-safe:transition-colors min-h-[44px] py-2"
            data-testid="hero-back-link"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>

          {/* Dropdown menu */}
          {hasDropdownActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 bg-muted backdrop-blur-md text-muted-foreground rounded-full"
                  aria-label={`Actions for ${path.name}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onSelect={() => onEdit()}>
                    <Pencil className="mr-2 size-4" aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onSelect={() => onDelete()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Metadata badges row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {path.difficultyLabel && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-widest">
              {path.difficultyLabel}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
            <Clock className="size-3.5" aria-hidden="true" />
            {courseCount} {courseCount === 1 ? 'course' : 'courses'}
            {path.estimatedHours != null && path.estimatedHours > 0 && (
              <>{' · '}~{path.estimatedHours}h</>
            )}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-display font-extrabold tracking-tight text-foreground mb-4">
          {path.name}
        </h1>

        {/* Description */}
        {path.description && (
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-2xl mb-8">
            {path.description}
          </p>
        )}

        {/* CTA + Avatar stack row */}
        <div className="flex flex-wrap items-center gap-6">
          {/* CTA button — brand-filled for guaranteed contrast on the card
              surface (>=4.5:1 against bg-card). */}
          {ctaCourseId && (
            <Link
              to={
                targetLessonId
                  ? `/courses/${ctaCourseId}/lessons/${targetLessonId}`
                  : `/courses/${ctaCourseId}`
              }
              className="inline-flex items-center gap-2 bg-brand text-brand-foreground hover:bg-brand-hover shadow-lg rounded-xl font-bold px-6 py-3 min-h-[44px] motion-safe:transition-colors"
            >
              <PlayCircle className="size-5" aria-hidden="true" />
              {ctaLabel}
            </Link>
          )}

          {/* Avatar stack */}
          {courseCount > 0 && (
            <div className="flex -space-x-3 overflow-hidden">
              {orderedCourseThumbnails.map((url, i) => (
                <img
                  key={`${i}:${url}`}
                  src={url}
                  alt=""
                  className="size-10 rounded-full ring-2 ring-border bg-muted object-cover hover:scale-110 hover:z-20 motion-safe:transition-transform"
                  loading="lazy"
                />
              ))}
              {orderedCourseThumbnails.length === 0 && (
                <div className="size-10 rounded-full ring-2 ring-border bg-muted flex items-center justify-center">
                  <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
              {overflowCount > 0 && (
                <div className="size-10 rounded-full ring-2 ring-border bg-muted border-2 border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                  +{overflowCount}
                </div>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {courseCount > 0 && (
            <span className="text-muted-foreground text-sm font-medium">
              {completedCount} of {courseCount} completed
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
