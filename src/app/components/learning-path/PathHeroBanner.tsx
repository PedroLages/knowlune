import { useState, useCallback } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Clock,
  PlayCircle,
  BookOpen,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
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
  /** Track context — when present, the CTA link carries fromTrack state so the
   *  Layout back-link shows "← {trackName}" on the lesson player page. */
  trackId?: string
  trackName?: string
}

// ─── WCAG contrast guarantee ──────────────────────────────────────────────────
// Cinematic overlay: a fixed black bottom-up gradient whose text band carries
// scrim opacity >= 0.70, guaranteeing white text >= 4.5:1 against ANY cover
// pixel (worst case = pure white cover). This is a deterministic compositing
// result, not theme-dependent.
//
// The scrim is always present (even on fallback gradients) so that overlay text
// stays readable across all themes, dark mode, and the vibrant toggle.
// ─────────────────────────────────────────────────────────────────────────────

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
  trackId,
  trackName,
}: PathHeroBannerProps) {
  const hasDropdownActions = onEdit || onDelete

  // Course-count based overflow (may exceed visible avatar slots when some courses lack thumbnails).
  const overflowCount = Math.max(0, courseCount - 4)

  // Determine CTA target and label
  const ctaCourseId = currentCourseId ?? firstCourseId
  const ctaLabel = pathProgress.completionPct > 0 ? 'Continue Learning' : 'Start Learning'

  // --- Cover image load state, keyed by the image URL ---
  // The URL string is the image identity: tracking which URL has loaded/failed
  // self-resets the pending state when `coverImageUrl` changes, and stays
  // stable across non-image metadata changes (title, description, updatedAt).
  const coverUrl = path.coverImageUrl
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const showCoverImage = !!coverUrl && loadedUrl === coverUrl
  const coverFailed = !!coverUrl && failedUrl === coverUrl

  // Cached covers and data URLs can finish loading before React attaches the
  // onLoad handler, which would otherwise leave a valid cover stuck hidden.
  // A ref lets us promote an already-complete image on mount. Failures are
  // still handled by onError (an undecoded image simply stays on the fallback).
  const handleCoverRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node || !coverUrl) return
      if (node.complete && node.naturalWidth > 0) {
        setLoadedUrl(coverUrl)
      }
    },
    [coverUrl]
  )

  return (
    <section
      className={cn(
        // Cinematic hero stage: tall, full-bleed, cover-led.
        // Content is anchored to the bottom via flex layout.
        'relative overflow-hidden rounded-[28px] border border-border/50 shadow-card-ambient',
        'min-h-[420px] md:min-h-[480px] lg:min-h-[560px]',
        'flex flex-col justify-end',
        'bg-black' // Base fallback while pending — matches the scrim's darkest tone.
      )}
      data-testid="hero-section"
    >
      {/* Layer 0 — Primary cover image: full-bleed, sharp, recognizable.
          Ken Burns entrance: scale 1.05 → 1.00, opacity 0 → 100 on load.
          Motion-safe only; reduced-motion renders immediately at rest. */}
      {coverUrl && !coverFailed && (
        <img
          key={coverUrl}
          ref={handleCoverRef}
          src={coverUrl}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            'motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-out',
            showCoverImage ? 'opacity-100 motion-safe:scale-100' : 'opacity-0 motion-safe:scale-105'
          )}
          onLoad={() => setLoadedUrl(coverUrl)}
          onError={() => setFailedUrl(coverUrl)}
          data-testid="hero-cover-image"
        />
      )}

      {/* Layer 1 — Fallback gradient (no cover, pending, or failed).
          Uses the preset gradient or brand gradient as the stage background,
          sitting under the same scrim as the cover. */}
      {!showCoverImage && (
        <>
          <div
            className={cn(
              'absolute inset-0',
              path.coverPreset && GRADIENT_COVER_CLASSES[path.coverPreset]
                ? GRADIENT_COVER_CLASSES[path.coverPreset]
                : 'bg-gradient-to-br from-brand to-brand-hover'
            )}
          />
          {/* Radial highlight overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
        </>
      )}

      {/* Layer 2 — Fixed dark cinematic scrim (theme-independent).
          Text sits in the lower band (from-black/85) guaranteeing ≥ 4.5:1
          contrast for white text against any cover pixel.
          Present in every cover state — even on fallback gradients. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5"
        data-testid="hero-scrim"
        aria-hidden="true"
      />

      {/* Faint left vignette for the title column — adds depth while keeping
          the scrim's contrast guarantee intact. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {coverFailed && (
        <div className="sr-only" aria-live="polite" role="status">
          Cover image could not be loaded
        </div>
      )}

      {/* Layer 3 — Overlay content (relative z-10, text-white).
          Anchored to the bottom of the tall stage, above the dark scrim.
          All text is white on the dark scrim for guaranteed WCAG contrast. */}
      <div
        className="relative z-10 p-4 sm:p-6 lg:p-8 pb-10 sm:pb-12 lg:pb-14"
        data-testid="hero-content-surface"
      >
        {/* Top row: Back link (left) + Dropdown (right) */}
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white motion-safe:transition-colors min-h-[44px] py-2"
            data-testid="hero-back-link"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>

          {hasDropdownActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 bg-white/10 backdrop-blur-md text-white/80 hover:text-white hover:bg-white/20 rounded-full motion-safe:transition-colors"
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

        {/* Lower band — frosted-glass chips, title, description, CTA, avatars, progress */}
        <div className="max-w-3xl">
          {/* Frosted-glass metadata chips */}
          <div className="flex flex-wrap items-center gap-3 mb-4 sm:mb-5">
            {path.difficultyLabel && (
              <span className="rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
                {path.difficultyLabel}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-white/80 text-sm font-medium">
              <Clock className="size-3.5" aria-hidden="true" />
              {courseCount} {courseCount === 1 ? 'course' : 'courses'}
              {path.estimatedHours != null && path.estimatedHours > 0 && (
                <>
                  {' · '}~{path.estimatedHours}h
                </>
              )}
            </span>
          </div>

          {/* Title — white with drop-shadow for readability */}
          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px] font-display font-extrabold tracking-tight text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] mb-3 sm:mb-4"
            data-testid="hero-title"
          >
            {path.name}
          </h1>

          {/* Description — white/85 for subtle differentiation from the title */}
          {path.description && (
            <p className="text-sm sm:text-base leading-relaxed text-white/85 max-w-2xl mb-6 sm:mb-8">
              {path.description}
            </p>
          )}

          {/* CTA + Avatar stack + Progress row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* CTA button — brand-filled for guaranteed contrast against the dark scrim */}
            {ctaCourseId && (
              <Link
                to={
                  targetLessonId
                    ? `/courses/${ctaCourseId}/lessons/${targetLessonId}`
                    : `/courses/${ctaCourseId}`
                }
                state={trackId && trackName ? { fromTrack: { trackId, trackName } } : undefined}
                className="inline-flex items-center gap-2 bg-brand text-brand-foreground hover:bg-brand-hover shadow-lg rounded-xl font-bold px-6 py-3 min-h-[44px] motion-safe:transition-all motion-safe:duration-200 hover:shadow-xl hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                data-testid="hero-cta"
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
                    className="size-10 rounded-full ring-2 ring-white/30 bg-black/30 object-cover hover:scale-110 motion-reduce:hover:scale-100 hover:z-20 motion-safe:transition-transform"
                    loading="lazy"
                  />
                ))}
                {orderedCourseThumbnails.length === 0 && (
                  <div className="size-10 rounded-full ring-2 ring-white/30 bg-black/30 flex items-center justify-center">
                    <BookOpen className="size-4 text-white/60" aria-hidden="true" />
                  </div>
                )}
                {overflowCount > 0 && (
                  <div className="size-10 rounded-full ring-2 ring-white/30 bg-black/30 flex items-center justify-center text-xs font-bold text-white/80">
                    +{overflowCount}
                  </div>
                )}
              </div>
            )}

            {/* Progress indicator */}
            {courseCount > 0 && (
              <span className="text-white/80 text-sm font-medium">
                {completedCount} of {courseCount} completed
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
