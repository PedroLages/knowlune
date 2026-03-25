import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, CheckCircle, FileText, TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { MotionConfig, motion } from 'motion/react'
import { format } from 'date-fns'
import { useCourseStore } from '@/stores/useCourseStore'
import {
  getCoursesInProgress,
  getCompletedCourses,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getLast7DaysLessonCompletions,
  getWeeklyChange,
} from '@/lib/progress'
import { getActionsPerDay } from '@/lib/studyLog'
import {
  getCourseCompletionData,
  getCategoryColorMap,
  getCategoryCompletionForRadar,
  computeSkillsDimensions,
} from '@/lib/reportStats'
import { StatsCard } from '@/app/components/StatsCard'
import { EmptyState } from '@/app/components/EmptyState'
import StudyTimeAnalytics from '@/app/components/StudyTimeAnalytics'
import { AIAnalyticsTab } from '@/app/components/reports/AIAnalyticsTab'
import { QuizAnalyticsTab } from '@/app/components/reports/QuizAnalyticsTab'
import { CategoryRadar } from '@/app/components/reports/CategoryRadar'
import { SkillsRadar } from '@/app/components/reports/SkillsRadar'
import { WeeklyGoalRing } from '@/app/components/reports/WeeklyGoalRing'
import { RecentActivityTimeline } from '@/app/components/reports/RecentActivityTimeline'
import { staggerContainer, fadeUp } from '@/lib/motion'

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

const VALID_TABS = ['study', 'quizzes', 'ai'] as const

export default function Reports() {
  const allCourses = useCourseStore(s => s.courses)
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = VALID_TABS.includes(rawTab as (typeof VALID_TABS)[number])
    ? (rawTab as string)
    : 'study'

  const [studyNotes, setStudyNotes] = useState(0)

  useEffect(() => {
    let ignore = false
    getTotalStudyNotes()
      .then(notes => {
        if (!ignore) setStudyNotes(notes)
      })
      .catch(err => console.error('Failed to load study notes:', err))
    return () => {
      ignore = true
    }
  }, [])

  // ── Memoized data ──
  const lessonsChange = useMemo(() => getWeeklyChange('lessons'), [])
  const notesChange = useMemo(() => getWeeklyChange('notes'), [])
  const sparkline = useMemo(() => getLast7DaysLessonCompletions(), [])
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
  const inProgressCount = useMemo(() => getCoursesInProgress(allCourses).length, [allCourses])
  const completedCount = useMemo(() => getCompletedCourses(allCourses).length, [allCourses])

  // ── Stats cards (reuse StatsCard component from Overview) ──
  const statsCards = useMemo(
    () => [
      {
        label: 'Lessons Completed',
        value: completedLessons,
        icon: CheckCircle,
        trend: lessonsChange >= 0 ? ('up' as const) : ('down' as const),
        trendValue: `${Math.abs(lessonsChange)} this week`,
        sparkline,
      },
      {
        label: 'Courses In Progress',
        value: inProgressCount,
        icon: BookOpen,
      },
      {
        label: 'Courses Completed',
        value: completedCount,
        icon: TrendingUp,
      },
      {
        label: 'Study Notes',
        value: studyNotes,
        icon: FileText,
        trend: notesChange >= 0 ? ('up' as const) : ('down' as const),
        trendValue: `${Math.abs(notesChange)} this week`,
      },
    ],
    [
      completedLessons,
      lessonsChange,
      sparkline,
      inProgressCount,
      completedCount,
      studyNotes,
      notesChange,
    ]
  )

  // ── Dynamic height for horizontal bar chart ──
  const barChartHeight = Math.max(250, courseCompletionData.length * 36)

  const hasActivity =
    completedLessons > 0 ||
    studyNotes > 0 ||
    activityData.some(d => d.activities > 0)

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} className="text-2xl font-bold mb-6">
          Reports
        </motion.h1>

        {!hasActivity ? (
          <EmptyState
            data-testid="empty-state-sessions"
            icon={Clock}
            title="Start studying to see your analytics"
            description="Your study time, completion rates, and insights will appear here"
            actionLabel="Browse Courses"
            actionHref="/courses"
          />
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
            className="mb-6"
          >
            <motion.div variants={fadeUp}>
              <TabsList className="h-11">
                <TabsTrigger value="study" className="h-9">
                  Study Analytics
                </TabsTrigger>
                <TabsTrigger value="quizzes" className="h-9">
                  Quiz Analytics
                </TabsTrigger>
                <TabsTrigger value="ai" className="h-9">
                  AI Analytics
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <TabsContent value="ai" className="mt-6">
              <AIAnalyticsTab />
            </TabsContent>

            <TabsContent value="quizzes" className="mt-6">
              <QuizAnalyticsTab />
            </TabsContent>

            <TabsContent value="study" className="mt-6 space-y-6">
              <h2 className="sr-only">Study Analytics</h2>
              {/* ── Row 1: Hero Stat Cards ── */}
              <motion.div
                variants={fadeUp}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {statsCards.map(stat => (
                  <StatsCard key={stat.label} {...stat} />
                ))}
              </motion.div>

              {/* ── Row 2: Weekly Goal Ring + Study Time ── */}
              <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                      Weekly Study Goal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WeeklyGoalRing />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardContent className="p-0">
                    <StudyTimeAnalytics />
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Row 3: Course Completion (horizontal bars) + Category Radar ── */}
              <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Course Completion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto -mx-2 px-2">
                      <ChartContainer
                        config={barChartConfig}
                        className={`min-w-[480px] w-full min-h-[1px]`}
                        style={{ height: barChartHeight }}
                      >
                        <BarChart
                          data={courseCompletionData}
                          layout="vertical"
                          margin={{ left: 8, right: 40 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                            strokeOpacity={0.3}
                          />
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
                              <ChartTooltipContent
                                formatter={value => [`${value}%`, 'Completion']}
                              />
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

              {/* ── Row 4: Study Activity (gradient area) + Skills Radar ── */}
              <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Study Activity (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={areaChartConfig}
                      className="h-[240px] w-full min-h-[1px]"
                    >
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

              {/* ── Row 5: Recent Activity Timeline ── */}
              <motion.div variants={fadeUp}>
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
        )}
      </motion.div>
    </MotionConfig>
  )
}
