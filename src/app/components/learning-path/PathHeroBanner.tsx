import { Link } from 'react-router'
import { ArrowLeft, Clock, PlayCircle, BookOpen, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
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

  // Collect up to 4 thumbnail URLs for the avatar stack
  const avatarUrls = Object.values(thumbnailUrls).filter(Boolean).slice(0, 4)
  const overflowCount = Math.max(0, courseCount - 4)

  // Determine CTA target and label
  const ctaCourseId = currentCourseId ?? firstCourseId
  const ctaLabel = pathProgress.completionPct > 0 ? 'Continue Learning' : 'Start Learning'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-hover">
      {/* Radial highlight overlay — same pattern as PathCardHeader */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto pt-8 pb-20 px-8 lg:px-12">
        {/* Back link */}
        <Link
          to={backUrl}
          className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-6 hover:-translate-x-1 transition-transform"
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
                  className="size-11 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
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
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-widest text-white">
              {path.difficultyLabel}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-white/80 text-sm font-medium">
            <Clock className="size-3.5" aria-hidden="true" />
            {courseCount} {courseCount === 1 ? 'course' : 'courses'}
            {path.estimatedHours != null && path.estimatedHours > 0 && (
              <>{' · '}~{path.estimatedHours}h</>
            )}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-brand-foreground">
          {path.name}
        </h1>

        {/* Description */}
        {path.description && (
          <p className="text-white/80 text-lg leading-relaxed mb-8 max-w-2xl">
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
                  className="size-10 rounded-full ring-2 ring-brand bg-muted object-cover hover:scale-110 hover:z-20 transition-transform"
                  loading="lazy"
                />
              ))}
              {avatarUrls.length === 0 && (
                <div className="size-10 rounded-full ring-2 ring-brand bg-white/20 flex items-center justify-center">
                  <BookOpen className="size-4 text-white/80" aria-hidden="true" />
                </div>
              )}
              {overflowCount > 0 && (
                <div className="size-10 rounded-full ring-2 ring-brand bg-white/20 border-2 border-brand flex items-center justify-center text-xs font-bold text-white">
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
    </section>
  )
}
