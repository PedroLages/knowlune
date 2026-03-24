import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { Question } from '@/types/quiz'
import { calculatePointsForQuestion, isUnanswered, formatCorrectAnswer } from '@/lib/scoring'
import { MarkdownRenderer } from '@/app/components/quiz/MarkdownRenderer'
import { cn } from '@/app/components/ui/utils'

type FeedbackState = 'correct' | 'incorrect' | 'partial' | 'time-expired'

interface AnswerFeedbackProps {
  question: Question
  userAnswer: string | string[] | undefined
  isTimerExpired?: boolean
}

function deriveFeedbackState(
  question: Question,
  userAnswer: string | string[] | undefined,
  isTimerExpired?: boolean
): { state: FeedbackState; pointsEarned: number; isCorrect: boolean } {
  if (isTimerExpired && isUnanswered(userAnswer)) {
    return { state: 'time-expired', pointsEarned: 0, isCorrect: false }
  }

  const { pointsEarned, isCorrect } = calculatePointsForQuestion(question, userAnswer)

  if (isCorrect) return { state: 'correct', pointsEarned, isCorrect }
  if (pointsEarned > 0) return { state: 'partial', pointsEarned, isCorrect }
  return { state: 'incorrect', pointsEarned, isCorrect }
}

const stateConfig = {
  correct: {
    border: 'border-l-success',
    bg: 'bg-success-soft',
    icon: CheckCircle,
    iconColor: 'text-success',
    title: 'Correct!',
  },
  incorrect: {
    border: 'border-l-warning',
    bg: 'bg-warning/10',
    icon: AlertCircle,
    iconColor: 'text-warning',
    title: 'Not quite',
  },
  partial: {
    border: 'border-l-warning',
    bg: 'bg-warning/10',
    icon: AlertCircle,
    iconColor: 'text-warning',
    title: '', // dynamically set
  },
  'time-expired': {
    border: 'border-l-muted',
    bg: 'bg-muted/50',
    icon: Clock,
    iconColor: 'text-muted-foreground',
    title: 'Not answered in time',
  },
} as const

function computePartialBreakdown(question: Question, userAnswer: string | string[]) {
  if (
    question.type !== 'multiple-select' ||
    !Array.isArray(question.correctAnswer) ||
    !Array.isArray(userAnswer)
  ) {
    return null
  }
  const correctSet = new Set(question.correctAnswer)
  const userSet = new Set(userAnswer)
  const selectedCorrectly = [...userSet].filter(a => correctSet.has(a))
  const selectedIncorrectly = [...userSet].filter(a => !correctSet.has(a))
  const missedCorrect = [...correctSet].filter(a => !userSet.has(a))
  return {
    title: `${selectedCorrectly.length} of ${correctSet.size} correct`,
    selectedCorrectly,
    selectedIncorrectly,
    missedCorrect,
  }
}

/**
 * Inline feedback card shown after a learner answers a quiz question.
 * Displays correct/incorrect/partial credit state with explanation.
 *
 * Non-judgmental design: uses orange "Not quite" instead of red "Wrong".
 * ARIA live region announces feedback to screen readers.
 */
export function AnswerFeedback({ question, userAnswer, isTimerExpired }: AnswerFeedbackProps) {
  const { state, pointsEarned } = deriveFeedbackState(question, userAnswer, isTimerExpired)
  const config = stateConfig[state]
  const Icon = config.icon

  const partial = state === 'partial' ? computePartialBreakdown(question, userAnswer!) : null
  const title = partial?.title ?? config.title

  return (
    <div
      data-testid="answer-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'mt-4 rounded-lg border-l-4 p-3 sm:p-4',
        'animate-in slide-in-from-bottom-2 fade-in duration-300 motion-reduce:animate-none',
        config.border,
        config.bg
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('size-5 shrink-0 sm:size-6', config.iconColor)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-foreground">{title}</h3>

          {/* Explanation */}
          {question.explanation?.trim() && (
            <div className="mt-2 text-sm text-foreground">
              <MarkdownRenderer content={question.explanation} />
            </div>
          )}

          {/* Correct answer indicator (incorrect / time-expired only) */}
          {(state === 'incorrect' || state === 'time-expired') && (
            <p className="mt-2 text-sm text-foreground">
              <strong>Correct answer:</strong> {formatCorrectAnswer(question.correctAnswer)}
            </p>
          )}

          {/* Partial credit breakdown (multiple-select only) */}
          {partial && (
            <ul aria-label="Answer breakdown" className="mt-2 space-y-1 text-sm">
              {partial.selectedCorrectly.map(opt => (
                <li key={opt} className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-success shrink-0" aria-hidden="true" />
                  <span>{opt}</span>
                </li>
              ))}
              {partial.selectedIncorrectly.map(opt => (
                <li key={opt} className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-warning shrink-0" aria-hidden="true" />
                  <span>{opt}</span>
                </li>
              ))}
              {partial.missedCorrect.map(opt => (
                <li key={opt} className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-4 shrink-0 text-center">—</span>
                  <span>{opt} (missed)</span>
                </li>
              ))}
            </ul>
          )}

          {/* Points earned (when less than possible) */}
          {pointsEarned < question.points && state !== 'time-expired' && (
            <p className="mt-2 text-sm text-muted-foreground">
              You earned {pointsEarned} of {question.points}{' '}
              {question.points === 1 ? 'point' : 'points'}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
