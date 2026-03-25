import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Badge } from '@/app/components/ui/badge'
import { useIsMobile, useMediaQuery } from '@/app/hooks/useMediaQuery'
import { detectLearningTrajectory, type TrajectoryResult } from '@/lib/analytics'
import type { QuizAttempt } from '@/types/quiz'

const chartConfig = {
  percentage: {
    label: 'Score',
    color: 'var(--color-brand)',
  },
} satisfies ChartConfig

interface ImprovementChartProps {
  attempts: QuizAttempt[]
}

/**
 * Displays a learning trajectory chart with pattern detection.
 *
 * Requires at least 3 attempts. Shows a line chart of scores over attempts
 * with a pattern label (linear, exponential, logarithmic, declining, plateau)
 * and confidence percentage derived from R².
 */
export function ImprovementChart({ attempts }: ImprovementChartProps) {
  const isMobile = useIsMobile()

  const trajectory: TrajectoryResult | null = useMemo(
    () => detectLearningTrajectory(attempts),
    [attempts]
  )

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  if (!trajectory) return null

  const { pattern, interpretation, confidence, dataPoints } = trajectory
  const confidencePercent = Math.round(confidence * 100)
  const chartHeight = isMobile ? 200 : 280

  const patternBadgeVariant =
    pattern === 'declining' ? 'destructive' : pattern === 'plateau' ? 'secondary' : 'default'

  const ariaDescription = `Learning trajectory: ${interpretation}. Pattern: ${pattern} with ${confidencePercent}% confidence across ${dataPoints.length} attempts.`

  return (
    <section
      aria-label={ariaDescription}
      data-testid="improvement-chart"
      className="mt-6 text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-muted-foreground">Learning Trajectory</h2>
        <div className="flex items-center gap-2">
          <Badge variant={patternBadgeVariant} data-testid="trajectory-pattern">
            {interpretation}
          </Badge>
          <span className="text-xs text-muted-foreground" data-testid="trajectory-confidence">
            {confidencePercent}% confidence
          </span>
        </div>
      </div>

      {/* Inline style required: chartHeight is computed dynamically from isMobile breakpoint */}
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
        <LineChart
          data={dataPoints}
          margin={{ top: 8, right: 16, left: 0, bottom: 20 }}
          aria-hidden="true"
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="attemptNumber"
            label={{
              value: 'Attempt',
              position: 'insideBottom',
              offset: -10,
              fill: 'var(--color-muted-foreground)',
            }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={[0, 100]}
            label={{
              value: 'Score %',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: 'var(--color-muted-foreground)',
            }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={value => [`${value}%`, 'Score']}
                labelFormatter={label => `Attempt ${label}`}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-brand)', stroke: 'var(--color-card)', strokeWidth: 2 }}
            activeDot={{ r: 7 }}
            isAnimationActive={!prefersReducedMotion}
          />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
