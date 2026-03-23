import { useNavigate } from 'react-router'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface QuizBadgeProps {
  courseId: string
  lessonId: string
  lessonTitle: string
  /** Best score percentage (0-100). null = quiz exists but never attempted. */
  bestScore: number | null
}

/**
 * Quiz availability badge for lesson rows.
 * Shows "Take Quiz" (muted) when the quiz has never been attempted,
 * or "Quiz: X%" (success) showing the best score after completion.
 * Navigates to the quiz start screen on click.
 */
export function QuizBadge({ courseId, lessonId, lessonTitle, bestScore }: QuizBadgeProps) {
  const navigate = useNavigate()

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid={`quiz-badge-${lessonId}`}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)
      }}
      className="flex items-center gap-1.5 min-h-[44px] px-2 text-xs shrink-0"
      aria-label={`${bestScore != null ? `Quiz score: ${bestScore}%` : 'Take quiz'} for ${lessonTitle}`}
    >
      <ClipboardCheck className="size-3.5" aria-hidden="true" />
      {bestScore != null ? (
        <span className="text-success" data-testid={`quiz-score-text-${lessonId}`}>Quiz: {bestScore}%</span>
      ) : (
        <span className="text-muted-foreground">Take Quiz</span>
      )}
    </Button>
  )
}
