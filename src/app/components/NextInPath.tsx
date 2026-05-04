/**
 * NextInPath — Post-completion suggestion for path-based continuity.
 *
 * Shown after a course-level completion celebration closes when the completed
 * course belongs to a learning path. Shows the next course in the path or a
 * "path complete" message for the last course.
 *
 * @see R9, R10 — docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Route, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface NextInPathProps {
  /** Name of the learning path */
  pathName: string
  /** Name of the completed course */
  courseName: string
  /** Whether this was the last course in the path */
  isLastInPath: boolean
  /** The next course's courseId (null for last course) */
  nextCourseId: string | null
  /** The target lesson ID for the next course (null for last course or when unavailable) */
  nextTargetLessonId: string | null
  /** The path ID for navigation on completion */
  pathId: string
  /** Called when user navigates away */
  onDismiss: () => void
}

/**
 * Post-completion suggestion card for path-based continuity.
 */
export function NextInPath({
  pathName,
  courseName,
  isLastInPath,
  nextCourseId,
  nextTargetLessonId,
  pathId,
  onDismiss,
}: NextInPathProps) {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  // Focus card on mount for keyboard accessibility
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  const handleNavigate = () => {
    if (isLastInPath) {
      navigate(`/learning-paths/${pathId}`)
    } else if (nextCourseId) {
      const url = nextTargetLessonId
        ? `/courses/${nextCourseId}/lessons/${nextTargetLessonId}`
        : `/courses/${nextCourseId}`
      navigate(url)
    }
    onDismiss()
  }

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      data-testid="next-in-path"
      className="rounded-2xl bg-card shadow-sm border border-border/50 p-6 outline-none animate-in fade-in duration-300 motion-reduce:animate-none"
      role="region"
      aria-label="Next in path"
    >
      <div className="flex items-start gap-4">
        {/* Icon area */}
        <div className="shrink-0 size-12 rounded-xl bg-brand-soft flex items-center justify-center">
          {isLastInPath ? (
            <CheckCircle2 className="size-6 text-brand-soft-foreground" aria-hidden="true" />
          ) : (
            <Route className="size-6 text-brand-soft-foreground" aria-hidden="true" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            {isLastInPath ? 'Path Complete' : 'Next in Path'}
          </p>
          <h3 className="text-sm font-semibold truncate">
            {isLastInPath
              ? `${courseName} finished!`
              : pathName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLastInPath
              ? 'View your achievement and path summary.'
              : `Continue with the next course in this path.`}
          </p>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <Button
            variant="brand"
            size="sm"
            onClick={handleNavigate}
            aria-label={isLastInPath ? 'View path details' : 'Continue to next course'}
          >
            {isLastInPath ? 'View Path' : 'Continue'}
            {!isLastInPath && <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label="Dismiss suggestion"
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
