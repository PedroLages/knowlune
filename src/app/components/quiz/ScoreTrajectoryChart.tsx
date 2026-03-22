import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  type DotProps,
} from 'recharts'
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
  return function CustomDot(props: DotProps & { payload?: { percentage?: number } }) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const pct = payload?.percentage ?? 0
    const color =
      pct >= passingScore ? 'var(--color-success)' : 'var(--color-brand)'
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
  }
}

export function ScoreTrajectoryChart({ attempts, passingScore }: ScoreTrajectoryChartProps) {
  const isMobile = useIsMobile()

  // AC3: Require at least 2 data points
  if (attempts.length < 2) return null

  const chartHeight = isMobile ? 200 : 300

  return (
    <section aria-label="Score trajectory chart" className="mt-6 text-left">
      <h4 className="font-semibold text-sm text-muted-foreground mb-3">Score Trajectory</h4>
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
        <LineChart data={attempts} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="attemptNumber"
            label={{ value: 'Attempt', position: 'insideBottom', offset: -10 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={[0, 100]}
            label={{ value: 'Score %', angle: -90, position: 'insideLeft', offset: 10 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${value}%`, 'Score']}
                labelFormatter={(label) => `Attempt ${label}`}
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
            dot={makeCustomDot(passingScore)}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
