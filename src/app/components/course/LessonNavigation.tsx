import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, BookOpenCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import type { LessonItem } from '@/lib/courseAdapter'

interface LessonNavigationProps {
  courseId: string
  prevLesson: LessonItem | null
  nextLesson: LessonItem | null
  parentLesson?: LessonItem | null
  currentIndex: number
  totalLessons: number
  isCurrentCompleted?: boolean
  onNavigate?: () => void
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.repeat) return true
  if (event.metaKey || event.ctrlKey || event.altKey) return true
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return Boolean(target.closest('[role="dialog"], [contenteditable="true"]'))
}

export function LessonNavigation({
  courseId,
  prevLesson,
  nextLesson,
  parentLesson = null,
  currentIndex,
  totalLessons,
  isCurrentCompleted = false,
  onNavigate,
}: LessonNavigationProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const previousTarget = parentLesson ?? prevLesson
  const previousLabel = parentLesson ? 'Back to Lesson' : 'Previous'
  const nextPath = nextLesson
    ? `/courses/${courseId}/lessons/${nextLesson.id}`
    : isCurrentCompleted
      ? `/courses/${courseId}`
      : null

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcut(event)) return

      if (event.key === '[' && previousTarget) {
        event.preventDefault()
        onNavigate?.()
        navigate(`/courses/${courseId}/lessons/${previousTarget.id}${location.search}`, {
          state: location.state,
        })
      }

      if (event.key === ']' && nextPath) {
        event.preventDefault()
        onNavigate?.()
        navigate(`${nextPath}${location.search}`, { state: location.state })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [courseId, location.search, location.state, navigate, nextPath, onNavigate, previousTarget])

  return (
    <nav
      data-testid="lesson-navigation"
      className="mt-3 grid grid-cols-2 items-stretch gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3"
      aria-label="Lesson navigation"
    >
      {previousTarget ? (
        <Button
          asChild
          variant="outline"
          className="h-14 min-w-0 justify-start px-3 sm:h-auto sm:min-h-14"
        >
          <Link
            to={{
              pathname: `/courses/${courseId}/lessons/${previousTarget.id}`,
              search: location.search,
            }}
            state={location.state}
            onClick={onNavigate}
            aria-label={`${previousLabel}: ${previousTarget.title}`}
            aria-keyshortcuts="["
          >
            {parentLesson ? (
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 text-left leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {previousLabel}
              </span>
              <span className="block truncate text-xs sm:text-sm">{previousTarget.title}</span>
            </span>
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled
          className="h-14 min-w-0 justify-start px-3 sm:h-auto sm:min-h-14"
          aria-label="No previous lesson"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm">Previous Lesson</span>
        </Button>
      )}

      <div className="hidden items-center px-2 text-xs text-muted-foreground tabular-nums sm:flex">
        {totalLessons > 0 && currentIndex >= 0 ? `${currentIndex + 1} / ${totalLessons}` : ''}
      </div>

      {nextLesson ? (
        <Button
          asChild
          variant="brand"
          className="h-14 min-w-0 justify-end px-3 sm:h-auto sm:min-h-14"
        >
          <Link
            to={{
              pathname: `/courses/${courseId}/lessons/${nextLesson.id}`,
              search: location.search,
            }}
            state={location.state}
            onClick={onNavigate}
            aria-label={`Next: ${nextLesson.title}`}
            aria-keyshortcuts="]"
          >
            <span className="min-w-0 text-right leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Next
              </span>
              <span className="block truncate text-xs sm:text-sm">{nextLesson.title}</span>
            </span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </Button>
      ) : isCurrentCompleted ? (
        <Button
          asChild
          variant="brand"
          className="h-14 min-w-0 justify-end px-3 sm:h-auto sm:min-h-14"
        >
          <Link
            to={`/courses/${courseId}`}
            state={location.state}
            onClick={onNavigate}
            aria-label="Course Overview"
            aria-keyshortcuts="]"
          >
            <span className="min-w-0 text-right leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Finished
              </span>
              <span className="block truncate text-xs sm:text-sm">Course Overview</span>
            </span>
            <BookOpenCheck className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled
          className={cn('h-14 min-w-0 justify-end px-3 sm:h-auto sm:min-h-14')}
          aria-label="End of Course. Complete this lesson to continue to the course overview."
        >
          <span className="text-xs sm:text-sm">End of Course</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Button>
      )}
    </nav>
  )
}
