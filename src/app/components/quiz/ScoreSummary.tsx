import { Trophy } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { formatDuration } from '@/lib/formatDuration'
import type { ImprovementData } from '@/lib/analytics'

interface ScoreSummaryProps {
  percentage: number
  score: number
  maxScore: number
  passed: boolean
  passingScore: number
  timeSpent: number
  improvementData?: ImprovementData
  normalizedGain?: number | null
  showTimeSpent?: boolean
  previousAttemptTimeSpent?: number
}

type ScoreTier = {
  label: string
  message: string
  ringClass: string
  textClass: string
}

function getScoreTier(percentage: number, passed: boolean): ScoreTier {
  if (percentage >= 90)
    return {
      label: 'EXCELLENT',
      message: 'Outstanding! You\u2019ve mastered this material.',
      ringClass: 'text-success',
      textClass: 'text-success',
    }
  if (passed)
    return {
      label: 'PASSED',
      message: 'Great job! You\u2019re on the right track.',
      ringClass: 'text-brand',
      textClass: 'text-brand',
    }
  if (percentage >= 50)
    return {
      label: 'NEEDS REVIEW',
      message: 'Good effort! Review the growth areas below.',
      ringClass: 'text-warning',
      textClass: 'text-warning',
    }
  return {
    label: 'NEEDS WORK',
    message: 'Keep practicing! Focus on the topics below.',
    ringClass: 'text-destructive',
    textClass: 'text-destructive',
  }
}

function ScoreRing({ percentage, tier }: { percentage: number; tier: ScoreTier }) {
  const size = 180
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedPct = Math.min(100, Math.max(0, percentage))
  const offset = circumference - (clampedPct / 100) * circumference

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
          className="text-muted-foreground/30"
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
            'transition-[stroke-dashoffset,color] duration-700 ease-out motion-reduce:transition-none',
            tier.ringClass
          )}
        />
      </svg>
      {/* Center content */}
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl sm:text-5xl font-bold text-foreground leading-none tabular-nums">
          {Math.round(clampedPct)}
          <span className="text-xl sm:text-2xl">%</span>
        </span>
        <span className={cn('text-xs font-semibold tracking-widest mt-1', tier.textClass)}>
          {tier.label}
        </span>
      </div>
    </div>
  )
}

function ScoreImprovementPanel({ data }: { data: ImprovementData }) {
  // First attempt: no comparison available
  if (data.improvement === null) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="improvement-summary">
        First attempt complete! Retake to track improvement.
      </p>
    )
  }

  const roundedFirst = Math.round(data.firstScore ?? 0)
  const roundedCurrent = Math.round(data.currentScore)
  const roundedImprovement = Math.round(data.improvement)
  const sign = roundedImprovement >= 0 ? '+' : ''

  return (
    <div
      className="bg-surface-sunken rounded-lg p-4 mt-4 w-full max-w-xs text-sm"
      data-testid="improvement-summary"
    >
      {data.isNewBest && (
        <div className="flex items-center gap-1.5 mb-3 justify-center">
          <Trophy className="size-4 text-success" aria-hidden="true" />
          <span className="text-success font-semibold">New personal best!</span>
        </div>
      )}

      <div className="space-y-1 tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted-foreground">First attempt:</span>
          <span className="font-medium">{roundedFirst}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current attempt:</span>
          <span className="font-medium">{roundedCurrent}%</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 mt-1">
          <span className="text-muted-foreground">Improvement:</span>
          <span
            className={cn(
              'font-semibold',
              data.isNewBest ? 'text-success' : 'text-muted-foreground'
            )}
          >
            {sign}
            {roundedImprovement}%
          </span>
        </div>
      </div>

      {!data.isNewBest && data.bestScore !== null && (
        <p className="text-muted-foreground text-xs mt-3 text-center">
          Your best: {Math.round(data.bestScore)}% (attempt #{data.bestAttemptNumber}) &middot; Keep
          practicing to beat your best!
        </p>
      )}
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
  improvementData,
  normalizedGain,
  showTimeSpent = true,
  previousAttemptTimeSpent,
}: ScoreSummaryProps) {
  const tier = getScoreTier(percentage, passed)
  const roundedPct = Math.round(Math.min(100, Math.max(0, percentage)))

  const improvementSrText = improvementData
    ? improvementData.improvement === null
      ? ' First attempt complete.'
      : improvementData.isNewBest
        ? ` New personal best! Improved by ${Math.round(improvementData.improvement)} percentage points from first attempt of ${Math.round(improvementData.firstScore ?? 0)} percent.`
        : ` Current: ${Math.round(improvementData.currentScore)} percent. Best: ${Math.round(improvementData.bestScore ?? 0)} percent (attempt ${improvementData.bestAttemptNumber}).`
    : ''

  return (
    <div className="flex flex-col items-center gap-4">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {`Quiz score: ${roundedPct} percent. ${score} of ${maxScore} correct. ${
          passed ? 'Passed' : 'Not passed'
        }.${improvementSrText}`}
      </div>

      <ScoreRing percentage={percentage} tier={tier} />

      <p className="text-muted-foreground text-sm tabular-nums">
        {score} of {maxScore} correct &middot; {passingScore}% to pass
      </p>

      <p className={cn('text-lg font-medium', tier.textClass)}>{tier.message}</p>

      {showTimeSpent && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-muted-foreground tabular-nums">
            Completed in {formatDuration(Math.max(timeSpent, 1000))}
          </p>
          {previousAttemptTimeSpent != null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Previous: {formatDuration(Math.max(previousAttemptTimeSpent, 1000))}
            </p>
          )}
        </div>
      )}

      {improvementData && <ScoreImprovementPanel data={improvementData} />}

      {normalizedGain != null && (
        <p className="text-xs text-muted-foreground tabular-nums" data-testid="normalized-gain">
          Hake&apos;s normalized gain: {normalizedGain.toFixed(2)}
        </p>
      )}
    </div>
  )
}
