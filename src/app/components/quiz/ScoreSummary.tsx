import { CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { formatDuration } from '@/lib/formatDuration'

interface ScoreSummaryProps {
  percentage: number
  score: number
  maxScore: number
  passed: boolean
  passingScore: number
  timeSpent: number
}

function getEncouragingMessage(percentage: number): string {
  if (percentage >= 90) return 'Excellent work! You\u2019ve mastered this material.'
  if (percentage >= 70) return 'Great job! You\u2019re on the right track.'
  if (percentage >= 50) return 'Good effort! Review the growth areas below.'
  return 'Keep practicing! Focus on the topics below.'
}

function ScoreRing({
  percentage,
  passed,
}: {
  percentage: number
  passed: boolean
}) {
  const size = 128
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center size-24 sm:size-32">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-accent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-500 motion-reduce:transition-none',
            passed ? 'text-success' : 'text-warning'
          )}
        />
      </svg>
      <span className="absolute text-3xl sm:text-5xl font-bold text-foreground">
        {Math.round(percentage)}%
      </span>
    </div>
  )
}

export function ScoreSummary({
  percentage,
  score,
  maxScore,
  passed,
  passingScore,
  timeSpent,
}: ScoreSummaryProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {`Quiz score: ${Math.round(percentage)} percent. ${score} of ${maxScore} correct. ${
          passed ? 'Passed' : 'Not passed'
        }.`}
      </div>

      <ScoreRing percentage={percentage} passed={passed} />

      <p className="text-muted-foreground text-sm">
        {score} of {maxScore} correct
      </p>

      <div className="flex items-center gap-2">
        {passed ? (
          <>
            <CheckCircle className="size-5 text-success" aria-hidden="true" />
            <span className="text-lg font-medium text-success">
              Congratulations! You passed!
            </span>
          </>
        ) : (
          <>
            <Circle className="size-5 text-warning" aria-hidden="true" />
            <span className="text-lg font-medium text-warning">
              Keep Going! You got {score} of {maxScore} correct.
            </span>
          </>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {passingScore}% required to pass
      </p>

      <p className="text-sm text-muted-foreground italic">
        {getEncouragingMessage(percentage)}
      </p>

      <p className="text-sm text-muted-foreground">
        Completed in {formatDuration(timeSpent)}
      </p>
    </div>
  )
}
