// eslint-disable-next-line component-size/max-lines -- page orchestrator: study/quiz/ai tabs with multiple chart sections and per-section error handling
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { Target, WifiOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Progress } from '@/app/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { motion } from 'motion/react'
import { endOfDay, format, isSameDay, startOfDay, subDays } from 'date-fns'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import {
  getTotalCompletedLessons,
} from '@/lib/progress'
import { getActionsPerDay } from '@/lib/studyLog'
import {
  calculateCompletionRate,
  type CompletionRateResult,
} from '@/lib/analytics'
import {
  getCourseCompletionData,
  getCategoryColorMap,
  getCategoryCompletionForRadar,
  computeSkillsDimensions,
} from '@/lib/reportStats'
import { Button } from '@/app/components/ui/button'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { DateRangeFilter, type DateRange } from '@/app/components/reports/DateRangeFilter'
import { AIAnalyticsTab } from '@/app/components/reports/AIAnalyticsTab'
import { QuizAnalyticsDashboard } from '@/app/components/reports/QuizAnalyticsDashboard'
import { PathAnalyticsTab } from '@/app/components/reports/PathAnalyticsTab'
import { CategoryRadar } from '@/app/components/reports/CategoryRadar'
import { SkillsRadar } from '@/app/components/reports/SkillsRadar'
import { RecentActivityTimeline } from '@/app/components/reports/RecentActivityTimeline'
import { QuizExportCard } from '@/app/components/reports/QuizExportCard'
import { ReadingSection } from '@/app/components/reports/ReadingSection'
import { ThisWeekSection } from '@/app/components/reports/ThisWeekSection'
import { toast } from 'sonner'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { ReportsOverview } from '@/app/components/reports/ReportsOverview'
import { ReportsExportActions } from '@/app/components/reports/ReportsExportActions'

/* ------------------------------------------------------------------ */
/*  Chart configs                                                      */
/* ------------------------------------------------------------------ */

const barChartConfig = {
  completion: {
    label: 'Completion',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

const areaChartConfig = {
  activities: {
    label: 'Activities',
    color: 'var(--brand)',
  },
} satisfies ChartConfig

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const VALID_TABS = ['overview', 'study', 'quizzes', 'ai', 'paths'] as const

function defaultDateRange(): DateRange {
  const today = startOfDay(new Date())
  return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) }
}

function parseDateRange(params: URLSearchParams): DateRange {
  const today = startOfDay(new Date())
  const preset = params.get('range')
  if (preset === 'all') return { from: null, to: null }
  if (preset === '7d' || preset === '30d' || preset === '90d' || preset === '1y') {
    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : preset === '90d' ? 89 : 364
    return { from: startOfDay(subDays(today, days)), to: endOfDay(today) }
  }
  if (preset === 'custom') {
    const from = params.get('from')
    const to = params.get('to')
    const parsedFrom = from ? startOfDay(new Date(`${from}T00:00:00`)) : null
    const parsedTo = to ? endOfDay(new Date(`${to}T00:00:00`)) : null
    if (parsedFrom && parsedTo && parsedFrom <= parsedTo && parsedFrom <= today) {
      return { from: parsedFrom, to: parsedTo > endOfDay(today) ? endOfDay(today) : parsedTo }
    }
  }
  return defaultDateRange()
}

function rangeKey(range: DateRange): string {
  const today = startOfDay(new Date())
  if (!range.from && !range.to) return 'all'
  const presets = [
    ['7d', 6],
    ['30d', 29],
    ['90d', 89],
    ['1y', 364],
  ] as const
  for (const [key, days] of presets) {
    if (range.from && range.to && isSameDay(range.from, subDays(today, days)) && isSameDay(range.to, endOfDay(today))) return key
  }
  return 'custom'
}

function InlineSectionError({
  error,
  isOnline,
  onRetry,
}: {
  error: string
  isOnline: boolean
  onRetry: () => void
}) {
  return (
    <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
      {!isOnline && <WifiOff className="mx-auto mb-2 size-5 text-destructive" aria-hidden="true" />}
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  )
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = VALID_TABS.includes(rawTab as (typeof VALID_TABS)[number])
    ? (rawTab as string)
    : 'overview'

  const [dateRange, setDateRange] = useState<DateRange>(() => parseDateRange(searchParams))
  const [hasInteracted, setHasInteracted] = useState(false)

  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const isOnline = useOnlineStatus()

  const [completionData, setCompletionData] = useState<CompletionRateResult>({
    completionRate: 0,
    completedCount: 0,
    startedCount: 0,
  })

  // Per-section error states
  const [completionError, setCompletionError] = useState<string | null>(null)

  const offlineMsg = "You're offline. Please check your connection and try again."

  const loadCompletionRate = useCallback(async () => {
    setCompletionError(null)
    try {
      const data = await calculateCompletionRate()
      setCompletionData(data)
    } catch (err) {
      console.error('Failed to load completion rate:', err)
      toast.error('Failed to load quiz completion data')
      setCompletionError(isOnline ? 'Failed to load quiz completion data.' : offlineMsg)
    }
  }, [isOnline])

  useEffect(() => {
    void loadCompletionRate()
  }, [loadCompletionRate])

  // ── Memoized data ──
  const courseCompletionData = useMemo(() => getCourseCompletionData(), [])
  const categoryColorMap = useMemo(() => getCategoryColorMap(), [])
  const categoryRadarData = useMemo(() => getCategoryCompletionForRadar(), [])
  const skillsData = useMemo(() => computeSkillsDimensions(), [])

  const activityData = useMemo(() => {
    const raw = getActionsPerDay(30)
    return raw.map(item => ({
      date: format(new Date(item.date + 'T12:00:00'), 'MMM dd'),
      activities: item.count,
      fullDate: item.date,
    }))
  }, [])

  const completedLessons = useMemo(() => getTotalCompletedLessons(), [])
  const inProgressCount = useMemo(
    () => importedCourses.filter(course => course.status === 'active').length,
    [importedCourses]
  )

  // ── Dynamic height for horizontal bar chart ──
  const barChartHeight = Math.max(250, courseCompletionData.length * 36)

  const roundedCompletionRate = Math.round(completionData.completionRate)

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Learning intelligence
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            See what is moving, what needs attention, and where to focus next.
          </p>
        </div>
        <ReportsExportActions range={dateRange} />
      </header>

      {/* Live region for tab/filter change announcements */}
      <span role="status" aria-live="polite" className="sr-only">
        {hasInteracted
          ? activeTab === 'study'
            ? `Study Analytics: ${completedLessons} lessons completed, ${inProgressCount} in progress`
            : activeTab === 'quizzes'
              ? 'Quiz Analytics displayed'
              : 'AI Analytics displayed'
          : ''}
      </span>

      {/* Date Range Filter */}
      <div className="mb-4">
        <DateRangeFilter
          value={dateRange}
          onChange={nextRange => {
            setDateRange(nextRange)
            const nextParams = new URLSearchParams(searchParams)
            nextParams.set('tab', activeTab)
            const nextKey = rangeKey(nextRange)
            nextParams.set('range', nextKey)
            if (nextKey === 'custom') {
              if (nextRange.from) nextParams.set('from', format(nextRange.from, 'yyyy-MM-dd'))
              else nextParams.delete('from')
              if (nextRange.to) nextParams.set('to', format(nextRange.to, 'yyyy-MM-dd'))
              else nextParams.delete('to')
            } else {
              nextParams.delete('from')
              nextParams.delete('to')
            }
            setSearchParams(nextParams, { replace: true })
          }}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={value => {
          setHasInteracted(true)
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tab', value)
          setSearchParams(nextParams, { replace: true })
        }}
        className="mb-6"
      >
        <motion.div variants={fadeUp}>
          <TabsList className="min-h-11 max-w-full justify-start overflow-x-auto" aria-label="Reports navigation">
            <TabsTrigger value="overview" className="min-h-11 shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="study">Study Analytics</TabsTrigger>
            <TabsTrigger value="quizzes">Quiz Analytics</TabsTrigger>
            <TabsTrigger value="ai">AI Analytics</TabsTrigger>
            <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="overview" className="mt-6">
          <ReportsOverview />
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6">
          <QuizAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <AIAnalyticsTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="paths" className="mt-6">
          <PathAnalyticsTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="study" className="mt-6">
          <h2 className="sr-only">Study Analytics</h2>

          {/* ── Section 1: This Week ── */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            This Week
          </h2>
          <motion.div variants={fadeUp} className="mt-3">
            <ThisWeekSection />
          </motion.div>

          {/* ── Section 2: Courses ── */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-6">
            Courses
          </h2>
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Course Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  data-testid="bar-chart-scroll-container"
                  className="overflow-x-auto -mx-2 px-2"
                >
                  <ChartContainer
                    data-testid="bar-chart-inner"
                    config={barChartConfig}
                    className="min-w-[480px] w-full min-h-[1px]"
                    style={{ height: barChartHeight }}
                  >
                    <BarChart
                      data={courseCompletionData}
                      layout="vertical"
                      margin={{ left: 8, right: 40 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={160}
                        tick={{ fontSize: 12 }}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent formatter={value => [`${value}%`, 'Completion']} />
                        }
                      />
                      <Bar
                        dataKey="completion"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        shape={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ((props: any) => {
                            const { x, y, width, height, payload } = props as {
                              x: number
                              y: number
                              width: number
                              height: number
                              payload: { category: string }
                            }
                            const color = categoryColorMap[payload.category] || 'var(--chart-1)'
                            return (
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                rx={4}
                                fill={color}
                                className="opacity-80 hover:opacity-100 motion-safe:transition-opacity"
                              />
                            )
                          }) as never
                        }
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progress by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryRadar data={categoryRadarData} />
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Section 3: Learning Behavior ── */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-6">
            Learning Behavior
          </h2>
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Study Activity (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={areaChartConfig} className="h-[240px] w-full min-h-[1px]">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="activityGradientReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
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
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="activities"
                      fill="url(#activityGradientReports)"
                      stroke="var(--color-activities)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: 'var(--brand)',
                        stroke: 'var(--background)',
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Learning Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <SkillsRadar data={skillsData} />
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Section 4: Reading ── */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-6">
            Reading
          </h2>
          <motion.div variants={fadeUp} className="mt-3">
            <ReadingSection />
          </motion.div>

          {/* ── Section 5: Activity ── */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-6">
            Activity
          </h2>
          <motion.div variants={fadeUp} className="mt-3 space-y-4">
            <Card data-testid="quiz-completion-rate-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="size-4 text-muted-foreground" aria-hidden="true" />
                  Quiz Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completionError ? (
                  <InlineSectionError
                    error={completionError}
                    isOnline={isOnline}
                    onRetry={loadCompletionRate}
                  />
                ) : completionData.startedCount === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="quiz-completion-empty">
                    No quizzes started yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Progress
                        value={completionData.completionRate}
                        className="flex-1"
                        labelFormat={() => `Quiz completion rate: ${roundedCompletionRate}%`}
                      />
                      <span
                        className="text-2xl font-bold tabular-nums"
                        data-testid="quiz-completion-percentage"
                      >
                        {roundedCompletionRate}%
                      </span>
                    </div>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="quiz-completion-summary"
                    >
                      {completionData.completedCount} of {completionData.startedCount} started
                      quizzes completed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <QuizExportCard />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentActivityTimeline limit={8} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
