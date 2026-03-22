import { useId, useMemo } from 'react'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import { analyzeTopicPerformance } from '@/lib/analytics'
import type { Question, Answer } from '@/types/quiz'

interface PerformanceInsightsProps {
  questions: Question[]
  answers: Answer[]
}

export function PerformanceInsights({ questions, answers }: PerformanceInsightsProps) {
  const strengthsHeadingId = useId()
  const growthHeadingId = useId()

  const analysis = useMemo(() => analyzeTopicPerformance(questions, answers), [questions, answers])

  const { correctCount, incorrectCount, skippedCount, strengths, growthAreas, hasMultipleTopics } =
    analysis

  const showTopicSections = hasMultipleTopics && (strengths.length > 0 || growthAreas.length > 0)

  return (
    <div data-testid="performance-insights" className="space-y-4">
      {/* Correctness summary bar */}
      <p className="text-sm text-muted-foreground text-center tabular-nums">
        <span className="text-success font-medium">{correctCount} correct</span>
        {' · '}
        <span className="text-warning font-medium">{incorrectCount} incorrect</span>
        {skippedCount > 0 && (
          <>
            {' · '}
            <span>{skippedCount} skipped</span>
          </>
        )}
      </p>

      {/* Topic-based strengths and growth areas */}
      {showTopicSections && (
        <div className="sm:grid sm:grid-cols-2 sm:gap-4 space-y-4 sm:space-y-0">
          {strengths.length > 0 && (
            <section
              aria-labelledby={strengthsHeadingId}
              className="bg-muted rounded-xl p-5 sm:p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                <h3 id={strengthsHeadingId} className="text-lg font-semibold text-foreground">
                  Your Strengths
                </h3>
              </div>

              <ul className="space-y-2">
                {strengths.map(topic => (
                  <li key={topic.name} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{topic.name}</span>
                    <span className="text-sm font-semibold text-success tabular-nums">
                      {topic.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {growthAreas.length > 0 && (
            <section
              aria-labelledby={growthHeadingId}
              className="bg-muted rounded-xl p-5 sm:p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-warning" aria-hidden="true" />
                <h3 id={growthHeadingId} className="text-lg font-semibold text-foreground">
                  Growth Opportunities
                </h3>
              </div>

              <ul className="space-y-2">
                {growthAreas.map(topic => (
                  <li key={topic.name} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground">{topic.name}</span>
                      <span className="text-sm font-semibold text-warning tabular-nums">
                        {topic.percentage}%
                      </span>
                    </div>
                    {topic.questionNumbers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Review questions {topic.questionNumbers.join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
