import { cn } from '@/app/components/ui/utils'
import type { Question, Answer } from '@/types/quiz'

interface ReviewQuestionGridProps {
  questions: Question[]
  answers: Answer[]
  currentIndex: number
  onQuestionClick: (index: number) => void
}

export function ReviewQuestionGrid({
  questions,
  answers,
  currentIndex,
  onQuestionClick,
}: ReviewQuestionGridProps) {
  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Question navigation">
      {questions.map((q, i) => {
        const answer = answers.find(a => a.questionId === q.id)
        const isCurrent = i === currentIndex

        const statusLabel = answer ? (answer.isCorrect ? 'correct' : 'incorrect') : 'unanswered'

        return (
          <button
            key={q.id}
            onClick={() => onQuestionClick(i)}
            aria-label={`Question ${i + 1}, ${statusLabel}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center size-11 rounded-full text-sm font-medium',
              'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-opacity',
              isCurrent
                ? 'bg-brand text-brand-foreground dark:focus-visible:ring-white'
                : answer?.isCorrect
                  ? 'bg-success-soft text-success border border-success'
                  : answer
                    ? 'bg-warning/10 text-warning border border-warning'
                    : 'bg-card text-muted-foreground border border-border'
            )}
          >
            {i + 1}
            {answer && !isCurrent && (
              <span className="absolute -top-1 -right-1" aria-hidden="true">
                <span
                  className={cn(
                    'block size-3 rounded-full',
                    answer.isCorrect ? 'bg-success' : 'bg-warning'
                  )}
                />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
