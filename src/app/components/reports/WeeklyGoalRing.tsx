import { useState, useEffect } from 'react'
import { ChartContainer, type ChartConfig } from '@/app/components/ui/chart'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { computeWeeklyGoalProgress, type WeeklyGoalProgress } from '@/lib/reportStats'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'

const chartConfig = {
  progress: {
    label: 'Weekly Progress',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return 'var(--success)'
  if (percentage >= 40) return 'var(--warning)'
  return 'var(--destructive)'
}

function getProgressTextClass(percentage: number): string {
  if (percentage >= 80) return 'text-success'
  if (percentage >= 40) return 'text-warning'
  return 'text-destructive'
}

export function WeeklyGoalRing() {
  const [goal, setGoal] = useState<WeeklyGoalProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    computeWeeklyGoalProgress()
      .then(data => {
        if (!ignore) setGoal(data)
      })
      .catch(err => {
        // silent-catch-ok — error state handled by component (goal stays null)
        console.error('Failed to load weekly goal:', err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    const handler = () => {
      computeWeeklyGoalProgress()
        .then(setGoal)
        .catch(() => {
          // silent-catch-ok — non-critical background refresh
        })
    }
    window.addEventListener('study-session-recorded', handler)
    window.addEventListener('study-session-updated', handler)
    return () => {
      ignore = true
      window.removeEventListener('study-session-recorded', handler)
      window.removeEventListener('study-session-updated', handler)
    }
  }, [])

  if (loading) {
    return <Skeleton className="h-[220px] w-full rounded-xl" />
  }

  if (!goal) return null

  const displayPercent = Math.min(goal.percentage, 100)
  const hours = (goal.currentMinutes / 60).toFixed(1)
  const goalHours = (goal.goalMinutes / 60).toFixed(0)
  const color = getProgressColor(goal.percentage)

  const chartData = [{ name: 'progress', value: displayPercent, fill: color }]

  return (
    <div
      className="relative"
      role="img"
      aria-label={`Weekly study goal: ${hours} of ${goalHours} hours (${goal.percentage}%)`}
    >
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[220px] w-full min-h-[1px]"
        aria-hidden="true"
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={-270}
          innerRadius="70%"
          outerRadius="90%"
          barSize={12}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--muted)' }}
            cornerRadius={6}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </RadialBarChart>
      </ChartContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className={cn('text-3xl font-bold tabular-nums', getProgressTextClass(goal.percentage))}
        >
          {goal.percentage}%
        </span>
        <span className="text-xs text-muted-foreground mt-0.5">
          {hours}h / {goalHours}h
        </span>
      </div>
    </div>
  )
}
