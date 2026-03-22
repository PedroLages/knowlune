import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { Question } from '@/types/quiz'
import { calculatePointsForQuestion } from '@/lib/scoring'
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
  if (isTimerExpired && (userAnswer === undefined || userAnswer === '')) {
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

function formatCorrectAnswer(correctAnswer: string | string[]): string {
  if (Array.isArray(correctAnswer)) return correctAnswer.join(', ')
  return correctAnswer
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

  // Partial credit: compute per-option breakdown for multiple-select
  let partialTitle = config.title
  let correctCount = 0
  let totalCorrect = 0
  let selectedCorrectly: string[] = []
  let selectedIncorrectly: string[] = []
  let missedCorrect: string[] = []

  if (state === 'partial' && question.type === 'multiple-select' && Array.isArray(question.correctAnswer) && Array.isArray(userAnswer)) {
    const correctSet = new Set(question.correctAnswer)
    const userSet = new Set(userAnswer)
    totalCorrect = correctSet.size
    selectedCorrectly = [...userSet].filter(a => correctSet.has(a))
    selectedIncorrectly = [...userSet].filter(a => !correctSet.has(a))
    missedCorrect = [...correctSet].filter(a => !userSet.has(a))
    correctCount = selectedCorrectly.length
    partialTitle = `${correctCount} of ${totalCorrect} correct`
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mt-4 rounded-lg border-l-4 p-3 sm:p-4',
        'animate-in slide-in-from-bottom-2 fade-in duration-300',
        config.border,
        config.bg
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 sm:h-6 sm:w-6', config.iconColor)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-lg text-foreground">
            {state === 'partial' ? partialTitle : config.title}
          </h4>

          {/* Explanation */}
          {question.explanation && (
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
          {state === 'partial' && question.type === 'multiple-select' && (
            <ul aria-label="Answer breakdown" className="mt-2 space-y-1 text-sm">
              {selectedCorrectly.map(opt => (
                <li key={opt} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                  <span>{opt}</span>
                </li>
              ))}
              {selectedIncorrectly.map(opt => (
                <li key={opt} className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
                  <span>{opt}</span>
                </li>
              ))}
              {missedCorrect.map(opt => (
                <li key={opt} className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-4 w-4 shrink-0 text-center">—</span>
                  <span>{opt} (missed)</span>
                </li>
              ))}
            </ul>
          )}

          {/* Points earned (when less than possible) */}
          {pointsEarned < question.points && state !== 'time-expired' && (
            <p className="mt-2 text-sm text-muted-foreground">
              You earned {pointsEarned} of {question.points} {question.points === 1 ? 'point' : 'points'}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
