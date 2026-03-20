import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'

interface QuestionBreakdownProps {
  answers: Array<{
    questionId: string
    isCorrect: boolean
    pointsEarned: number
    pointsPossible: number
  }>
  questions: Array<{
    id: string
    text: string
    order: number
  }>
}

export function QuestionBreakdown({ answers, questions }: QuestionBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (answers.length === 0) {
    return null
  }

  // Match questions to answers and sort by canonical question order.
  // This intentionally shows the original authoring order, not any
  // per-attempt shuffle order. Threading shuffle order through
  // QuizAttempt would be a larger change suited for a future story.
  const rows = questions
    .map(question => {
      const answer = answers.find(a => a.questionId === question.id)
      return answer ? { question, answer } : null
    })
    .filter(
      (row): row is { question: (typeof questions)[0]; answer: (typeof answers)[0] } => row !== null
    )
    .sort((a, b) => a.question.order - b.question.order)

  const correctCount = rows.filter(r => r.answer.isCorrect).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full text-left">
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between rounded-xl px-4 min-h-[44px]',
          'bg-muted hover:bg-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <span className="text-sm font-medium text-foreground">Question Breakdown</span>
        <span className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {correctCount}/{rows.length} correct
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="mt-2 space-y-1" role="list">
          {rows.map(row => (
            <li
              key={row.question.id}
              className={cn('flex items-center gap-3 rounded-xl px-4 py-2 min-h-[44px]', 'bg-card')}
            >
              <span className="text-sm font-medium text-muted-foreground w-8 shrink-0">
                Q{row.question.order}
              </span>
              <span className="text-sm text-foreground flex-1 truncate" title={row.question.text}>
                {row.question.text}
              </span>
              {row.answer.isCorrect ? (
                <CheckCircle2
                  className="size-5 text-success shrink-0"
                  role="img"
                  aria-label="Correct"
                />
              ) : (
                <XCircle
                  className="size-5 text-destructive shrink-0"
                  role="img"
                  aria-label="Incorrect"
                />
              )}
              <span className="text-sm text-muted-foreground shrink-0 w-12 text-right">
                {`${row.answer.pointsEarned}/${row.answer.pointsPossible}`}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
