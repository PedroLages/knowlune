import { useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import { X, Trophy, Clock, BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { computeNextCourseSuggestion } from '@/lib/suggestions'
import { getAllProgress } from '@/lib/progress'
import { useSuggestionStore } from '@/stores/useSuggestionStore'
import { allCourses } from '@/data/courses'

interface NextCourseSuggestionProps {
  completedCourseId: string
  onDismiss?: () => void
}

/**
 * Shown after a course-level completion celebration.
 * Computes the best next course and renders a suggestion card,
 * or a congratulatory message if all courses are done.
 */
export function NextCourseSuggestion({ completedCourseId, onDismiss }: NextCourseSuggestionProps) {
  const navigate = useNavigate()
  const { isDismissed, dismiss } = useSuggestionStore()
  const cardRef = useRef<HTMLDivElement>(null)

  // Focus card on mount for keyboard accessibility
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  // Guard: already dismissed for this completed course
  if (isDismissed(completedCourseId)) return null

  const allProgress = getAllProgress()
  const candidate = computeNextCourseSuggestion(completedCourseId, allCourses, allProgress)

  const handleDismiss = () => {
    dismiss(completedCourseId)
    onDismiss?.()
  }

  // Congratulatory empty state — all courses complete
  if (!candidate) {
    return (
      <div
        ref={cardRef}
        tabIndex={-1}
        data-testid="next-course-congratulations"
        className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-lg rounded-[24px] bg-card shadow-2xl border border-border p-6 outline-none"
        role="region"
        aria-label="All courses completed"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <Trophy className="h-12 w-12 text-brand" aria-hidden="true" />
          <h2 className="text-lg font-bold">You've completed all active courses!</h2>
          <p className="text-sm text-muted-foreground">
            Explore your course library to find your next adventure.
          </p>
          <Link
            to="/courses"
            className="text-sm font-medium text-brand hover:underline"
            onClick={handleDismiss}
          >
            Browse course library →
          </Link>
          <Button variant="outline" size="sm" className="mt-1" onClick={handleDismiss}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const { course, tagOverlapCount } = candidate
  const completedCourseTags = allCourses.find(c => c.id === completedCourseId)?.tags ?? []
  const sharedTags = course.tags.filter(t =>
    completedCourseTags.map(x => x.toLowerCase()).includes(t.toLowerCase())
  )
  const displayTags = sharedTags.slice(0, 4)
  const extraTagCount = sharedTags.length - displayTags.length

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      data-testid="next-course-suggestion"
      className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-lg rounded-[24px] bg-card shadow-2xl border border-border p-5 outline-none"
      role="region"
      aria-label="Next course suggestion"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss course suggestion"
        className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Header */}
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
        Up Next
      </p>

      {/* Course title */}
      <h2 className="text-base font-bold pr-6 mb-1">{course.title}</h2>

      {/* Description — truncated to 2 lines */}
      {course.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Category badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand capitalize">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          {course.category.replace(/-/g, ' ')}
        </span>

        {/* Estimated hours */}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {course.estimatedHours}h
        </span>
      </div>

      {/* Shared tags */}
      {tagOverlapCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4" aria-label="Shared topics">
          {displayTags.map(tag => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{extraTagCount} more
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <Button
        className="w-full"
        onClick={() => {
          navigate(`/courses/${course.id}`)
          handleDismiss()
        }}
      >
        Start Course
      </Button>
    </div>
  )
}
