import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { useIsMobile } from '@/app/hooks/useMediaQuery'

interface ScoreTrajectoryChartProps {
  attempts: Array<{ attemptNumber: number; percentage: number }>
  passingScore: number
}

const chartConfig = {
  percentage: {
    label: 'Score',
    color: 'var(--color-brand)',
  },
} satisfies ChartConfig

/**
 * Custom dot renderer: green for at/above passing, brand color for below.
 * Receives recharts DotProps plus our custom passingScore via closure.
 */
function makeCustomDot(passingScore: number) {
  return function CustomDot(props: {
    cx?: number
    cy?: number
    payload?: { percentage?: number }
  }) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const pct = payload?.percentage ?? 0
    const color = pct >= passingScore ? 'var(--color-success)' : 'var(--color-brand)'
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--color-card)" strokeWidth={2} />
  }
}

export function ScoreTrajectoryChart({ attempts, passingScore }: ScoreTrajectoryChartProps) {
  const isMobile = useIsMobile()
  // Memoize to avoid creating a new function reference on every render,
  // which would cause recharts to re-mount all dot elements unnecessarily.
  const customDot = useMemo(() => makeCustomDot(passingScore), [passingScore])

  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // AC3: Require at least 2 data points
  if (attempts.length < 2) return null

  const chartHeight = isMobile ? 200 : 300

  return (
    <section aria-label="Score trajectory chart" className="mt-6 text-left">
      <h2 className="font-semibold text-sm text-muted-foreground mb-3">Score Trajectory</h2>
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
        <LineChart
          data={attempts}
          margin={{ top: 8, right: 16, left: 0, bottom: 20 }}
          aria-label="Score trajectory across attempts"
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
          <ReferenceLine
            y={passingScore}
            stroke="var(--color-success)"
            strokeDasharray="5 5"
            label={{
              value: `Passing: ${passingScore}%`,
              fill: 'var(--color-success)',
              fontSize: 11,
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={customDot}
            activeDot={{ r: 7 }}
            isAnimationActive={!prefersReducedMotion}
          />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
