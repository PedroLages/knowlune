import { cn } from '@/app/components/ui/utils'

interface QuestionGridProps {
  total: number
  answers: Record<string, string | string[]>
  questionOrder: string[]
  currentIndex: number
  onQuestionClick: (index: number) => void
}

export function QuestionGrid({
  total,
  answers,
  questionOrder,
  currentIndex,
  onQuestionClick,
}: QuestionGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }, (_, i) => {
        const questionId = questionOrder[i]
        const isAnswered = questionId
          ? answers[questionId] !== undefined && answers[questionId] !== ''
          : false
        const isCurrent = i === currentIndex

        return (
          <button
            key={i}
            onClick={() => onQuestionClick(i)}
            aria-label={`Question ${i + 1}`}
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
              'min-w-[44px] min-h-[44px]',
              isCurrent
                ? 'bg-brand text-brand-foreground'
                : isAnswered
                  ? 'bg-brand-soft text-brand border border-brand'
                  : 'bg-card text-muted-foreground border border-border'
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
