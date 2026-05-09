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
import { PathCoverReadabilityScrim } from '@/app/components/learning-path/PathCoverReadabilityScrim'
import { normalizePathCoverCompletionPct, resolvePathCoverTheme } from '@/data/pathCoverGradients'
import type { LearningPath } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

interface PathHeroBannerProps {
  path: LearningPath
  courseCount: number
  completedCount: number
  pathProgress: PathProgressSummary
  thumbnailUrls: Record<string, string>
  /** The courseId of the current in-progress course, if any */
  currentCourseId: string | null
  /** The courseId of the first course in the path */
  firstCourseId: string | null
  /** Back link URL (defaults to "/learning-paths" for backward compatibility) */
  backUrl?: string
  /** Back link label (defaults to "Back to Learning Paths" for backward compatibility) */
  backLabel?: string
  onEdit?: () => void
  onDelete?: () => void
}

export function PathHeroBanner({
  path,
  courseCount,
  completedCount,
  pathProgress,
  thumbnailUrls,
  currentCourseId,
  firstCourseId,
  backUrl = '/learning-paths',
  backLabel = 'Back to Learning Paths',
  onEdit,
  onDelete,
}: PathHeroBannerProps) {
  const hasDropdownActions = onEdit || onDelete

  const completionPct = normalizePathCoverCompletionPct(pathProgress.completionPct)
  const theme = resolvePathCoverTheme({
    pathName: path.name,
    coverImageUrl: path.coverImageUrl,
    coverPreset: path.coverPreset,
    completionPct,
  })
  const onDark = theme.heroTextOnDark

  // Collect up to 4 thumbnail URLs for the avatar stack
  const avatarUrls = Object.values(thumbnailUrls).filter(Boolean).slice(0, 4)
  const overflowCount = Math.max(0, courseCount - 4)

  // Determine CTA target and label (same normalized % as cover theme)
  const ctaCourseId = currentCourseId ?? firstCourseId
  const ctaLabel = completionPct > 0 ? 'Continue Learning' : 'Start Learning'

  return (
    <section
      data-testid="path-hero-banner"
      className={cn(
        'relative overflow-hidden',
        theme.kind === 'image' ? 'bg-muted' : `bg-gradient-to-br ${theme.tailwindFragment}`
      )}
    >
      {theme.kind === 'image' && (
        <>
          <img
            src={theme.url}
            alt=""
            role="presentation"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <PathCoverReadabilityScrim />
        </>
      )}
      {theme.kind === 'gradient' && (
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto pt-8 pb-20 px-8 lg:px-12">
        {/* Back link */}
        <Link
          to={backUrl}
          className={cn(
            'inline-flex items-center gap-2 text-sm font-medium mb-6 hover:-translate-x-1 transition-transform',
            onDark ? 'text-white/80 hover:text-white' : 'text-foreground/80 hover:text-foreground'
          )}
          data-testid="hero-back-link"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>

        {/* Dropdown menu — over gradient, top-right */}
        {hasDropdownActions && (
          <div className="absolute top-8 right-8 lg:right-12 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-11 backdrop-blur-md rounded-full',
                    onDark
                      ? 'bg-white/20 hover:bg-white/40 text-white'
                      : 'bg-background/80 hover:bg-background text-foreground border border-border'
                  )}
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
          </div>
        )}

        {/* Metadata badges row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {path.difficultyLabel && (
            <span
              data-testid="path-hero-difficulty"
              className={cn(
                'px-3 py-1 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-widest',
                onDark
                  ? 'bg-white/20 text-white'
                  : 'bg-background/90 text-foreground border border-border'
              )}
            >
              {path.difficultyLabel}
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              onDark ? 'text-white/80' : 'text-muted-foreground'
            )}
          >
            <Clock className="size-3.5" aria-hidden="true" />
            {courseCount} {courseCount === 1 ? 'course' : 'courses'}
            {path.estimatedHours != null && path.estimatedHours > 0 && (
              <>{' · '}~{path.estimatedHours}h</>
            )}
          </span>
        </div>

        {/* Title */}
        <h1
          className={cn(
            'font-display text-4xl lg:text-5xl font-bold tracking-tight mb-4',
            onDark
              ? 'text-white [text-shadow:_0_2px_12px_rgba(0,0,0,0.25)]'
              : 'text-foreground'
          )}
        >
          {path.name}
        </h1>

        {/* Description */}
        {path.description && (
          <p
            className={cn(
              'text-lg leading-relaxed mb-8 max-w-2xl',
              onDark ? 'text-white/80' : 'text-muted-foreground'
            )}
          >
            {path.description}
          </p>
        )}

        {/* CTA + Avatar stack row */}
        <div className="flex flex-wrap items-center gap-6">
          {/* CTA button */}
          {ctaCourseId && (
            <Link
              to={`/courses/${ctaCourseId}`}
              className="inline-flex items-center gap-2 bg-card text-brand hover:bg-brand-soft hover:text-brand-soft-foreground shadow-lg rounded-xl font-bold px-6 py-3 transition-colors"
            >
              <PlayCircle className="size-5" aria-hidden="true" />
              {ctaLabel}
            </Link>
          )}

          {/* Avatar stack */}
          {courseCount > 0 && (
            <div className="flex -space-x-3 overflow-hidden">
              {avatarUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className={cn(
                    'size-10 rounded-full bg-muted object-cover hover:scale-110 hover:z-20 transition-transform ring-2',
                    onDark ? 'ring-white/40' : 'ring-foreground/20'
                  )}
                  loading="lazy"
                />
              ))}
              {avatarUrls.length === 0 && (
                <div
                  className={cn(
                    'size-10 rounded-full ring-2 flex items-center justify-center',
                    onDark ? 'ring-white/40 bg-white/20' : 'ring-foreground/20 bg-muted'
                  )}
                >
                  <BookOpen
                    className={cn('size-4', onDark ? 'text-white/80' : 'text-muted-foreground')}
                    aria-hidden="true"
                  />
                </div>
              )}
              {overflowCount > 0 && (
                <div
                  className={cn(
                    'size-10 rounded-full ring-2 flex items-center justify-center text-xs font-bold border-2',
                    onDark
                      ? 'ring-white/40 bg-white/20 border-white/40 text-white'
                      : 'ring-foreground/20 bg-muted border-border text-foreground'
                  )}
                >
                  +{overflowCount}
                </div>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {courseCount > 0 && (
            <span
              className={cn(
                'text-sm font-medium',
                onDark ? 'text-white/80' : 'text-muted-foreground'
              )}
            >
              {completedCount} of {courseCount} completed
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
