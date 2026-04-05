/**
 * ReadingStatsSection — displays book reading statistics in the Reports Study tab.
 *
 * Shows: time read today, books in progress, books finished, and a 14-day
 * reading time trend bar chart. Renders a zero-state gracefully when no
 * reading data exists.
 *
 * @module ReadingStatsSection
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  getReadingStats,
  formatReadingTime,
  type ReadingStats,
} from '@/services/ReadingStatsService'

const readingChartConfig = {
  minutes: {
    label: 'Reading (min)',
    color: 'var(--brand)',
  },
} satisfies ChartConfig

interface StatPillProps {
  icon: React.ReactNode
  label: string
  value: string | number
  'data-testid'?: string
}

function StatPill({ icon, label, value, 'data-testid': testId }: StatPillProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-brand-soft p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        data-testid={testId}
        className="text-2xl font-semibold tabular-nums text-brand-soft-foreground"
      >
        {value}
      </p>
    </div>
  )
}

export function ReadingStatsSection() {
  const [stats, setStats] = useState<ReadingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getReadingStats()
      setStats(data)
    } catch (err) {
      // silent-catch-ok: reading stats are non-critical — zero-state fallback shown instead of error toast
      console.error('[ReadingStatsSection] Failed to load reading stats:', err)
      setStats({
        timeReadTodayMinutes: 0,
        booksInProgress: 0,
        totalBooksFinished: 0,
        readingTrend: [],
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // No reading activity — render nothing (don't clutter the Reports page for new users)
  if (!isLoading && stats && stats.timeReadTodayMinutes === 0 && stats.booksInProgress === 0 && stats.totalBooksFinished === 0 && stats.readingTrend.every(p => p.minutes === 0)) {
    return null
  }

  const chartData = (stats?.readingTrend ?? []).map(p => ({
    date: format(new Date(p.date + 'T12:00:00'), 'MMM dd'),
    minutes: p.minutes,
    fullDate: p.date,
  }))

  return (
    <div className="space-y-4" data-testid="reading-stats-section">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
        Reading
      </h2>

      {/* Stat pills row */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatPill
            icon={<Clock className="size-3.5" aria-hidden="true" />}
            label="Read Today"
            value={formatReadingTime(stats?.timeReadTodayMinutes ?? 0)}
            data-testid="reading-stat-today"
          />
          <StatPill
            icon={<BookOpen className="size-3.5" aria-hidden="true" />}
            label="Books in Progress"
            value={stats?.booksInProgress ?? 0}
            data-testid="reading-stat-in-progress"
          />
          <StatPill
            icon={<BookOpen className="size-3.5" aria-hidden="true" />}
            label="Books Finished"
            value={stats?.totalBooksFinished ?? 0}
            data-testid="reading-stat-finished"
          />
        </div>
      )}

      {/* Reading trend chart */}
      {!isLoading && chartData.length > 0 && chartData.some(d => d.minutes > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                Reading Time (Last 14 Days)
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={readingChartConfig}
              className="h-[180px] w-full min-h-[1px]"
              data-testid="reading-trend-chart"
            >
              <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: number) => `${v}m`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const fullDate = payload?.[0]?.payload?.fullDate
                        if (typeof fullDate === 'string') {
                          return format(new Date(fullDate + 'T12:00:00'), 'EEEE, MMMM dd')
                        }
                        return String(_)
                      }}
                      formatter={(value: unknown) => [`${value} min`, 'Reading']}
                    />
                  }
                />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]} barSize={16} fill="var(--color-minutes)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
