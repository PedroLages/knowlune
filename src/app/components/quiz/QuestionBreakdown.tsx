import { useState } from 'react'
import { CheckCircle2, AlertCircle, Clock, ChevronDown } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { MarkdownRenderer } from '@/app/components/quiz/MarkdownRenderer'
import { isUnanswered, formatCorrectAnswer } from '@/lib/scoring'
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
    userAnswer: string | string[]
  }>
  questions: Array<{
    id: string
    text: string
    order: number
    explanation?: string
    correctAnswer?: string | string[]
  }>
}

export function QuestionBreakdown({ answers, questions }: QuestionBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

  if (answers.length === 0) {
    return null
  }

  // Match questions to answers and sort by canonical question order.
  // This intentionally shows the original authoring order, not any
  // per-attempt shuffle order. Threading shuffle order through
  // QuizAttempt would be a larger change suited for a future story.
  const answerMap = new Map(answers.map(a => [a.questionId, a]))
  const rows = questions
    .map(question => {
      const answer = answerMap.get(question.id)
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
          'flex w-full items-center justify-between rounded-xl px-4 py-2 min-h-[44px]',
          'bg-muted hover:bg-accent transition-colors motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
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
          {rows.map(row => {
            const unanswered = isUnanswered(row.answer.userAnswer)
            const isExpanded = expandedQuestion === row.question.id
            const hasDetails = row.question.explanation || unanswered || !row.answer.isCorrect

            const rowContent = (
              <>
                <span className="text-sm font-medium text-muted-foreground w-8 shrink-0">
                  Q{row.question.order}
                </span>
                <span
                  className="text-sm text-foreground flex-1 min-w-0 truncate"
                  title={row.question.text}
                >
                  {row.question.text}
                </span>
                {unanswered ? (
                  <Clock
                    className="size-5 text-muted-foreground shrink-0"
                    role="img"
                    aria-label="Not answered in time"
                  />
                ) : row.answer.isCorrect ? (
                  <CheckCircle2
                    className="size-5 text-success shrink-0"
                    role="img"
                    aria-label="Correct"
                  />
                ) : (
                  <AlertCircle
                    className="size-5 text-warning shrink-0"
                    role="img"
                    aria-label="Incorrect"
                  />
                )}
                <span className="text-sm text-muted-foreground shrink-0 w-12 text-right tabular-nums">
                  {`${row.answer.pointsEarned}/${row.answer.pointsPossible}`}
                </span>
              </>
            )

            return (
              <li key={row.question.id} className="rounded-xl bg-card">
                {hasDetails ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-2 min-h-[44px] text-left cursor-pointer hover:bg-accent/50 transition-colors motion-reduce:transition-none"
                    onClick={() => setExpandedQuestion(isExpanded ? null : row.question.id)}
                    aria-expanded={isExpanded}
                    aria-label={`Question ${row.question.order}: ${row.answer.isCorrect ? 'correct' : unanswered ? 'not answered' : 'incorrect'}, ${row.answer.pointsEarned} of ${row.answer.pointsPossible} points`}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-3 rounded-xl px-4 py-2 min-h-[44px] text-left">
                    {rowContent}
                  </div>
                )}

                {/* Expanded details: explanation + correct answer */}
                {isExpanded && hasDetails && (
                  <div
                    role="region"
                    aria-label={`Details for question ${row.question.order}`}
                    className={cn(
                      'px-4 pb-3 pt-1 ml-8 border-l-2',
                      unanswered
                        ? 'border-l-muted'
                        : row.answer.isCorrect
                          ? 'border-l-success'
                          : 'border-l-warning'
                    )}
                  >
                    {unanswered && (
                      <p className="text-sm text-muted-foreground mb-2">
                        This question was not answered in time.
                      </p>
                    )}
                    {(unanswered || !row.answer.isCorrect) &&
                      row.question.correctAnswer != null && (
                        <p className="text-sm text-foreground mb-2">
                          <strong>Correct answer:</strong>{' '}
                          {formatCorrectAnswer(row.question.correctAnswer)}
                        </p>
                      )}
                    {row.question.explanation && (
                      <div className="text-sm text-foreground">
                        <MarkdownRenderer content={row.question.explanation} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
