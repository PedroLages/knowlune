import { useState, useEffect, useMemo } from 'react'
import { ChartContainer, type ChartConfig } from '@/app/components/ui/chart'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { db } from '@/db'
import { getProgressColor, getProgressTextClass } from '@/lib/progress-colors'

const DEFAULT_WEEKLY_GOAL_MINUTES = 5 * 60

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DailyBar {
  label: string
  minutes: number
  pct: number
}

export function ThisWeekSection() {
  const [loading, setLoading] = useState(true)
  const [currentMinutes, setCurrentMinutes] = useState(0)
  const [dailyData, setDailyData] = useState<DailyBar[]>([])
  const [activeDays, setActiveDays] = useState(0)
  const [bestDay, setBestDay] = useState<{ label: string; hours: number } | null>(null)

  useEffect(() => {
    let ignore = false

    const load = async () => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(now)
      monday.setDate(monday.getDate() - mondayOffset)
      monday.setHours(0, 0, 0, 0)

      try {
        const sessions = await db.studySessions
          .where('startTime')
          .aboveOrEqual(monday.toISOString())
          .toArray()

        // Aggregate per-day minutes (Mon-Sun)
        const dayMinutes = new Array(7).fill(0)
        let totalMin = 0

        for (const s of sessions) {
          const d = new Date(s.startTime)
          const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0, Sun=6
          const min = s.endTime
            ? Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)
            : 0
          dayMinutes[dayIdx] += min
          totalMin += min
        }

        const maxMin = Math.max(...dayMinutes)
        const maxIdx = dayMinutes.indexOf(maxMin)
        const daysActive = dayMinutes.filter(m => m > 0).length

        const bars: DailyBar[] = dayMinutes.map((m, i) => ({
          label: DAY_SHORT[i],
          minutes: m,
          pct: maxMin > 0 ? Math.round((m / maxMin) * 100) : 0,
        }))

        if (!ignore) {
          setCurrentMinutes(totalMin)
          setDailyData(bars)
          setActiveDays(daysActive)
          setBestDay(maxMin > 0 ? { label: DAY_SHORT[maxIdx], hours: maxMin / 60 } : null)
          setLoading(false)
        }
      } catch (err) {
        console.error('[ThisWeekSection] Failed to load sessions:', err)
        if (!ignore) setLoading(false)
      }
    }

    void load()

    const handler = () => {
      void load()
    }
    window.addEventListener('study-session-recorded', handler)
    window.addEventListener('study-session-updated', handler)
    return () => {
      ignore = true
      window.removeEventListener('study-session-recorded', handler)
      window.removeEventListener('study-session-updated', handler)
    }
  }, [])

  const goalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES
  const percentage = goalMinutes > 0 ? Math.round((currentMinutes / goalMinutes) * 100) : 0
  const displayPercent = Math.min(percentage, 100)
  const color = getProgressColor(percentage)
  const hours = (currentMinutes / 60).toFixed(1)
  const goalHours = (goalMinutes / 60).toFixed(0)

  const chartData = useMemo(
    () => [{ name: 'progress', value: displayPercent, fill: color }],
    [displayPercent, color]
  )

  const ringConfig = useMemo(
    () =>
      ({
        progress: { label: 'Weekly Progress', color: 'var(--chart-1)' },
      }) satisfies ChartConfig,
    []
  )

  if (loading) {
    return <Skeleton className="h-[220px] w-full rounded-xl" />
  }

  return (
    <div
      className="rounded-[24px] border border-border/50 bg-card p-6"
      role="region"
      aria-label={`This week: ${hours} of ${goalHours} hours studied`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ring — 2/5 width */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center">
          <div className="relative" role="img" aria-label={`${percentage}% of weekly goal`}>
            <ChartContainer config={ringConfig} className="mx-auto h-[180px] w-full min-h-[1px]" aria-hidden="true">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={cn('text-3xl font-bold tabular-nums', getProgressTextClass(percentage))}>
                {percentage}%
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {hours}h / {goalHours}h
              </span>
            </div>
          </div>
        </div>

        {/* Daily bars — 3/5 width */}
        <div className="lg:col-span-3 flex flex-col justify-end">
          <div className="flex items-end gap-1.5 h-28 mb-2">
            {dailyData.map(day => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic bar height from percentage
                  className="w-full bg-brand rounded-t-[3px] motion-safe:transition-[height] motion-safe:duration-300 min-h-[2px]"
                  style={{ height: day.pct > 0 ? `${Math.max(day.pct, 4)}%` : '0px' }}
                  title={`${day.label}: ${day.minutes} min`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {dailyData.map(day => (
              <div key={day.label} className="flex-1 text-center">
                <span className="text-[10px] text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center mt-3">
            {activeDays} of 7 days{bestDay ? ` · Best: ${bestDay.label} ${bestDay.hours.toFixed(1)}h` : ' · No activity yet'}
          </p>
        </div>
      </div>
    </div>
  )
}
