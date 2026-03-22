// src/app/components/quiz/DiscriminationAnalysis.tsx
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { calculateDiscriminationIndices } from '@/lib/analytics'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'

interface DiscriminationAnalysisProps {
  quiz: Quiz
  attempts: QuizAttempt[]
}

export function DiscriminationAnalysis({ quiz, attempts }: DiscriminationAnalysisProps) {
  const results = calculateDiscriminationIndices(quiz, attempts)

  if (!results) {
    return (
      <p
        data-testid="discrimination-empty"
        className="text-sm text-muted-foreground"
      >
        Need at least 5 attempts for meaningful discrimination analysis.
      </p>
    )
  }

  return (
    <Card className="text-left" data-testid="discrimination-analysis">
      <CardHeader>
        <h2 className="leading-none text-base font-semibold">Question Discrimination Analysis</h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" aria-label="Questions ranked by discrimination index">
          {results.map(item => {
            const question = quiz.questions.find(q => q.id === item.questionId)
            const questionText = question?.text ?? item.questionId
            return (
              <li key={item.questionId}>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-medium truncate min-w-0 flex-1" title={questionText}>
                    {questionText}
                  </span>
                  <span
                    className="text-sm font-bold tabular-nums shrink-0"
                    data-testid={`discrimination-value-${item.questionId}`}
                  >
                    {item.discriminationIndex.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.interpretation}</p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
