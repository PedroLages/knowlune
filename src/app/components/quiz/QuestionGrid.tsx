import { cn } from '@/app/components/ui/utils'

interface QuestionGridProps {
  total: number
  answers: Record<string, string | string[]>
  questionOrder: string[]
  currentIndex: number
  markedForReview: string[]
  onQuestionClick: (index: number) => void
}

export function QuestionGrid({
  total,
  answers,
  questionOrder,
  currentIndex,
  markedForReview,
  onQuestionClick,
}: QuestionGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }, (_, i) => {
        const questionId = questionOrder[i]
        const answer = questionId ? answers[questionId] : undefined
        const isAnswered = Array.isArray(answer)
          ? answer.length > 0
          : answer !== undefined && answer !== ''
        const isCurrent = i === currentIndex
        const isMarked = questionId ? markedForReview.includes(questionId) : false

        return (
          <button
            key={i}
            onClick={() => onQuestionClick(i)}
            aria-label={`Question ${i + 1}${isMarked ? ', marked for review' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center size-11 rounded-full text-sm font-medium',
              'hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isCurrent
                ? 'bg-brand text-brand-foreground'
                : isAnswered
                  ? 'bg-brand-soft text-brand border border-brand'
                  : 'bg-card text-muted-foreground border border-border'
            )}
          >
            {i + 1}
            {isMarked && (
              <span className="absolute -top-1 -right-1" aria-hidden="true">
                <span className="size-3 rounded-full bg-warning" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
