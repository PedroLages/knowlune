import { Link } from 'react-router'
import { BookOpen, Play, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'

interface ContinueLearningBentoProps {
  entry: LearningPathEntry
  courseInfo?: PathCourseInfo
  thumbnailUrl?: string
  /** Optional: navigate directly to a specific lesson within the course */
  targetLessonId?: string
  onViewCurriculum?: () => void
  className?: string
  /** Track context — when present, lesson/course links carry fromTrack state so
   *  the Layout back-link shows "← {trackName}" on the lesson player. */
  trackId?: string
  trackName?: string
  /** Position of this course within the track (1-based). */
  coursePosition?: number
  /** Total number of courses in the track. */
  totalCourses?: number
}

/**
 * Bento-style hero card showing the current in-progress course.
 * Features a gradient overlay, thumbnail with play button overlay,
 * course metadata, progress bar, and action buttons.
 */
export function ContinueLearningBento({
  entry,
  courseInfo,
  thumbnailUrl,
  targetLessonId,
  onViewCurriculum,
  className,
  trackId,
  trackName,
  coursePosition,
  totalCourses,
}: ContinueLearningBentoProps) {
  const pct = courseInfo?.completionPct ?? 0
  const lessonPath = targetLessonId
    ? `/courses/${entry.courseId}/lessons/${targetLessonId}`
    : `/courses/${entry.courseId}`
  const linkState =
    trackId && trackName ? { fromTrack: { trackId, trackName } } : undefined

  return (
    <div
      className={cn(
        'rounded-[24px] border border-border/50 bg-card overflow-hidden shadow-card-ambient',
        className
      )}
    >
      <div className="flex flex-col md:flex-row min-h-[200px] relative">
        {/* Gradient overlay across the entire card */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-soft/20 to-transparent" />
        </div>

        {/* Left: Thumbnail with play overlay */}
        <div className="md:w-2/5 relative bg-muted overflow-hidden group">
          {thumbnailUrl ? (
            <div className="relative h-full">
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover group-hover:scale-105 motion-reduce:group-hover:scale-100 motion-safe:transition-transform motion-safe:duration-300"
                loading="lazy"
              />
              {/* Deeper gradient overlay for cinematic feel */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-brand-soft/40 via-transparent to-black/30 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="h-full min-h-[180px] flex items-center justify-center bg-gradient-to-br from-brand/10 to-brand/30">
              <BookOpen className="size-16 text-brand/40" aria-hidden="true" />
            </div>
          )}
          {/* Centered play button overlay with brand glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              to={lessonPath}
              state={linkState}
              className="group size-16 rounded-full bg-brand flex items-center justify-center text-brand-foreground shadow-[0_0_20px_color-mix(in_oklch,var(--brand)_30%,transparent)] hover:shadow-[0_0_30px_color-mix(in_oklch,var(--brand)_45%,transparent)] hover:bg-brand hover:scale-110 motion-reduce:hover:scale-100 motion-safe:transition-all motion-safe:duration-200"
              aria-label={`Continue ${courseInfo?.name || 'course'}`}
            >
              <Play
                className="size-7 ml-0.5 fill-current group-hover:scale-110 motion-safe:transition-transform motion-safe:duration-200"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* Right: Course info and actions — subtle glass surface */}
        <div className="md:w-3/5 p-6 flex flex-col justify-between relative z-10 bg-card/50 backdrop-blur-sm">
          <div>
            <h3 className="text-xl md:text-2xl font-bold mb-1">
              {courseInfo?.name || 'Unknown Course'}
            </h3>
            {courseInfo?.authorName && (
              <p className="text-sm text-muted-foreground mb-3">{courseInfo.authorName}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              {coursePosition != null && totalCourses != null ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                  Course {coursePosition} of {totalCourses}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-brand" aria-hidden="true" />
                <span className="text-brand font-medium">{pct}% complete</span>
              </span>
            </div>
            <div className="w-full bg-muted h-2 rounded-full mb-6">
              <div
                className="bg-brand h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="brand" asChild>
              <Link to={lessonPath} state={linkState}>
                Continue lesson
                <ArrowRight className="size-4 ml-2" aria-hidden="true" />
              </Link>
            </Button>
            {onViewCurriculum && (
              <Button variant="brand-outline" onClick={onViewCurriculum}>
                View curriculum
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
