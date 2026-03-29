/**
 * LessonNavigation — Prev/next lesson navigation buttons with lesson title preview.
 *
 * Renders a horizontal bar with Previous and Next buttons. Disables Previous on
 * the first lesson and Next on the last lesson. Each button includes an aria-label
 * with the target lesson name for accessibility.
 *
 * @see E89-S08
 */

import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { LessonItem } from '@/lib/courseAdapter'

interface LessonNavigationProps {
  courseId: string
  prevLesson: LessonItem | null
  nextLesson: LessonItem | null
  currentIndex: number
  totalLessons: number
}

export function LessonNavigation({
  courseId,
  prevLesson,
  nextLesson,
  currentIndex,
  totalLessons,
}: LessonNavigationProps) {
  const navigate = useNavigate()

  const handlePrev = () => {
    if (prevLesson) {
      navigate(`/courses/${courseId}/lessons/${prevLesson.id}`)
    }
  }

  const handleNext = () => {
    if (nextLesson) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
    }
  }

  return (
    <nav
      data-testid="lesson-navigation"
      className="flex items-center justify-between gap-3 px-4 py-2 border-t bg-background"
      aria-label="Lesson navigation"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrev}
        disabled={!prevLesson}
        className="gap-1.5 max-w-[45%]"
        aria-label={prevLesson ? `Previous: ${prevLesson.title}` : 'No previous lesson'}
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate text-xs">{prevLesson ? prevLesson.title : 'Previous'}</span>
      </Button>

      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {totalLessons > 0 ? `${currentIndex + 1} / ${totalLessons}` : ''}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={!nextLesson}
        className="gap-1.5 max-w-[45%]"
        aria-label={nextLesson ? `Next: ${nextLesson.title}` : 'No next lesson'}
      >
        <span className="truncate text-xs">{nextLesson ? nextLesson.title : 'Next'}</span>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
      </Button>
    </nav>
  )
}
