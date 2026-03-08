import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Progress } from '@/app/components/ui/progress'
import { db } from '@/db/schema'
import type { StudySession } from '@/data/types'
import { toLocalDateString } from '@/lib/dateUtils'

/* ------------------------------------------------------------------ */
/*  Types & Config                                                     */
/* ------------------------------------------------------------------ */

type PeriodView = 'daily' | 'weekly' | 'monthly'

interface AggregatedData {
  period: string // Date label (e.g., "Jan 15", "Week 3", "March")
  studyTime: number // Total minutes
}

const chartConfig = {
  studyTime: {
    label: 'Study Time (minutes)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

const TARGET_STUDY_DAYS = 5 // Default weekly target

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StudyTimeAnalytics() {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [periodView, setPeriodView] = useState<PeriodView>('daily')
  const [showTable, setShowTable] = useState(false)
  const [loading, setLoading] = useState(true)

  /* ------------------------------------------------------------------ */
  /*  Load Sessions from IndexedDB                                      */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let ignore = false
    const loadSessions = async () => {
      try {
        const allSessions = await db.studySessions.toArray()
        if (!ignore) setSessions(allSessions)
      } catch (error) {
        console.error('Failed to load study sessions:', error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    // Listen for session changes (real-time updates)
    const handleSessionChange = () => {
      if (!ignore) {
        loadSessions()
      }
    }

    // Add event listener for study session updates
    window.addEventListener('study-session-recorded', handleSessionChange)
    window.addEventListener('study-session-updated', handleSessionChange)

    loadSessions()
    return () => {
      ignore = true
      window.removeEventListener('study-session-recorded', handleSessionChange)
      window.removeEventListener('study-session-updated', handleSessionChange)
    }
  }, [])

  /* ------------------------------------------------------------------ */
  /*  Derived State (computed from sessions/periodView)                */
  /* ------------------------------------------------------------------ */

  const chartData = useMemo(
    () => (sessions.length === 0 ? [] : aggregateSessionsByPeriod(sessions, periodView)),
    [sessions, periodView]
  )

  const weeklyAdherence = useMemo(() => calculateWeeklyAdherence(sessions), [sessions])

  const chartAltText = useMemo(
    () => generateChartAltText(chartData, periodView),
    [chartData, periodView]
  )

  /* ------------------------------------------------------------------ */
  /*  Loading State                                                      */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Study Time Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  Empty State                                                        */
  /* ------------------------------------------------------------------ */

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Study Time Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            data-testid="study-time-empty-state"
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <p className="text-muted-foreground">
              No study sessions recorded yet. Data will appear once study sessions are recorded.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  Main Content                                                       */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* Chart Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Study Time Analytics</CardTitle>
            <div className="flex gap-2" role="group" aria-label="Period selection">
              <Button
                variant={periodView === 'daily' ? 'default' : 'outline'}
                size="default"
                onClick={() => setPeriodView('daily')}
              >
                Daily
              </Button>
              <Button
                variant={periodView === 'weekly' ? 'default' : 'outline'}
                size="default"
                onClick={() => setPeriodView('weekly')}
              >
                Weekly
              </Button>
              <Button
                variant={periodView === 'monthly' ? 'default' : 'outline'}
                size="default"
                onClick={() => setPeriodView('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* View Toggle */}
          <div className="mb-4">
            <Button variant="outline" size="default" onClick={() => setShowTable(!showTable)}>
              {showTable ? 'View as Chart' : 'View as Table'}
            </Button>
          </div>

          {/* Chart or Table */}
          {!showTable ? (
            <div data-testid="study-time-chart" role="img" aria-label={chartAltText}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="studyTime"
                      fill="var(--color-studyTime)"
                      radius={[4, 4, 0, 0]}
                      aria-label="Study time in minutes"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table aria-label="Study time data" className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="p-2 text-left font-semibold">
                      Period
                    </th>
                    <th scope="col" className="p-2 text-right font-semibold">
                      Study Time (minutes)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chartData
                    .filter(row => row.studyTime > 0)
                    .map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{row.period}</td>
                        <td className="p-2 text-right">{row.studyTime}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Adherence Section */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Study Adherence</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="weekly-adherence" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Target: {TARGET_STUDY_DAYS} days per week
              </span>
              <span className="text-2xl font-bold">{weeklyAdherence}%</span>
            </div>
            <Progress
              data-testid="adherence-progress-indicator"
              value={weeklyAdherence}
              className="h-2"
              aria-label={`${weeklyAdherence}% weekly adherence`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Aggregate sessions by period (daily, weekly, monthly)
 */
function aggregateSessionsByPeriod(sessions: StudySession[], period: PeriodView): AggregatedData[] {
  // Find the most recent session date to use as reference
  const mostRecentSessionTime = Math.max(...sessions.map(s => new Date(s.startTime).getTime()))
  const referenceDate = new Date(mostRecentSessionTime)
  const data: Map<string, number> = new Map()

  if (period === 'daily') {
    // Last 7 days from most recent session
    for (let i = 6; i >= 0; i--) {
      const date = new Date(referenceDate)
      date.setDate(date.getDate() - i)
      const dateStr = toLocalDateString(date)
      data.set(dateStr, 0)
    }

    for (const session of sessions) {
      const sessionDate = toLocalDateString(new Date(session.startTime))
      if (data.has(sessionDate)) {
        const minutes = Math.round(session.duration / 60)
        data.set(sessionDate, (data.get(sessionDate) || 0) + minutes)
      }
    }

    return Array.from(data.entries()).map(([date, studyTime]) => ({
      period: formatDate(date),
      studyTime,
    }))
  } else if (period === 'weekly') {
    // Last 12 weeks from most recent session
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(referenceDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
      const weekLabel = `Week ${12 - i}`
      data.set(weekLabel, 0)
    }

    for (const session of sessions) {
      const sessionDate = new Date(session.startTime)
      const weeksDiff = Math.floor(
        (referenceDate.getTime() - sessionDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      if (weeksDiff >= 0 && weeksDiff < 12) {
        const weekLabel = `Week ${12 - weeksDiff}`
        const minutes = Math.round(session.duration / 60)
        data.set(weekLabel, (data.get(weekLabel) || 0) + minutes)
      }
    }

    return Array.from(data.entries()).map(([period, studyTime]) => ({
      period,
      studyTime,
    }))
  } else {
    // Last 12 months from most recent session
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(referenceDate)
      monthDate.setMonth(monthDate.getMonth() - i)
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' })
      data.set(`${monthLabel} ${monthDate.getFullYear()}`, 0)
    }

    for (const session of sessions) {
      const sessionDate = new Date(session.startTime)
      const monthLabel = sessionDate.toLocaleDateString('en-US', { month: 'short' })
      const yearLabel = sessionDate.getFullYear()
      const key = `${monthLabel} ${yearLabel}`
      if (data.has(key)) {
        const minutes = Math.round(session.duration / 60)
        data.set(key, (data.get(key) || 0) + minutes)
      }
    }

    return Array.from(data.entries()).map(([period, studyTime]) => ({
      period,
      studyTime,
    }))
  }
}

/**
 * Calculate weekly adherence percentage
 * Based on unique days studied in the last 7 days / target days
 * Anchored to current date (today), not most recent session
 */
function calculateWeeklyAdherence(sessions: StudySession[]): number {
  if (sessions.length === 0) return 0

  // Anchor to current date (today) - set to end of day to include all sessions today
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // Calculate 7 days before today (start of that day)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6) // -6 to include today itself (7 days total)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const uniqueDaysThisWeek = new Set<string>()

  for (const session of sessions) {
    const sessionDate = new Date(session.startTime)
    if (sessionDate >= sevenDaysAgo && sessionDate <= today) {
      uniqueDaysThisWeek.add(toLocalDateString(sessionDate))
    }
  }

  const daysStudied = uniqueDaysThisWeek.size
  const adherence = Math.round((daysStudied / TARGET_STUDY_DAYS) * 100)
  return Math.min(100, adherence)
}

/**
 * Generate descriptive alt text for chart accessibility
 */
function generateChartAltText(data: AggregatedData[], period: PeriodView): string {
  if (data.length === 0) {
    return 'Study time chart with no data'
  }

  const totalMinutes = data.reduce((sum, item) => sum + item.studyTime, 0)
  const avgMinutes = Math.round(totalMinutes / data.length)
  const periodLabel = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'

  return `Study time chart showing ${avgMinutes} minutes average per ${periodLabel} across ${data.length} periods`
}

/**
 * Format YYYY-MM-DD to "Mon 15" for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00') // Avoid timezone issues
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
