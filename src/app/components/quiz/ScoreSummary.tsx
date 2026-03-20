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

type ScoreTier = {
  label: string
  ringClass: string
  textClass: string
}

function getScoreTier(percentage: number, passed: boolean): ScoreTier {
  if (percentage >= 90)
    return { label: 'EXCELLENT', ringClass: 'text-success', textClass: 'text-success' }
  if (passed) return { label: 'PASSED', ringClass: 'text-brand', textClass: 'text-brand' }
  if (percentage >= 50)
    return { label: 'NEEDS REVIEW', ringClass: 'text-warning', textClass: 'text-warning' }
  return { label: 'NEEDS WORK', ringClass: 'text-destructive', textClass: 'text-destructive' }
}

function getEncouragingMessage(percentage: number): string {
  if (percentage >= 90) return 'Outstanding! You\u2019ve mastered this material.'
  if (percentage >= 70) return 'Great job! You\u2019re on the right track.'
  if (percentage >= 50) return 'Good effort! Review the growth areas below.'
  return 'Keep practicing! Focus on the topics below.'
}

function ScoreRing({ percentage, passed }: { percentage: number; passed: boolean }) {
  const size = 180
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  const tier = getScoreTier(percentage, passed)

  return (
    <div className="relative inline-flex items-center justify-center size-40 sm:size-44">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress arc */}
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
            'transition-all duration-700 ease-out motion-reduce:transition-none',
            tier.ringClass
          )}
        />
      </svg>
      {/* Center content */}
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl sm:text-5xl font-bold text-foreground leading-none">
          {Math.round(percentage)}
          <span className="text-xl sm:text-2xl">%</span>
        </span>
        <span
          className={cn(
            'text-[10px] sm:text-xs font-semibold tracking-widest mt-1',
            tier.textClass
          )}
        >
          {tier.label}
        </span>
      </div>
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
  const tier = getScoreTier(percentage, passed)

  return (
    <div className="flex flex-col items-center gap-4">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {`Quiz score: ${Math.round(percentage)} percent. ${score} of ${maxScore} correct. ${
          passed ? 'Passed' : 'Not passed'
        }.`}
      </div>

      <ScoreRing percentage={percentage} passed={passed} />

      <p className="text-muted-foreground text-sm">
        {score} of {maxScore} correct &middot; {passingScore}% to pass
      </p>

      <p className={cn('text-lg font-medium', tier.textClass)}>
        {getEncouragingMessage(percentage)}
      </p>

      <p className="text-sm text-muted-foreground">Completed in {formatDuration(timeSpent)}</p>
    </div>
  )
}
