import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle, Clock, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { allCourses } from '@/data/courses'
import {
  getCoursesInProgress,
  getCompletedCourses,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getCourseCompletionPercent,
} from '@/lib/progress'
import { getActionsPerDay, getRecentActions } from '@/lib/studyLog'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { useSessionStore } from '@/stores/useSessionStore'
import StudyTimeAnalytics from '@/app/components/StudyTimeAnalytics'
import { AIAnalyticsTab } from '@/app/components/reports/AIAnalyticsTab'

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
  count: {
    label: 'Activities',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

// Pie chart colors mapped to --chart-1 through --chart-5
const PIE_KEYS = ['slice1', 'slice2', 'slice3', 'slice4', 'slice5'] as const

const pieChartConfig = {
  value: { label: 'Avg Completion' },
  slice1: { label: 'Category 1', color: 'var(--chart-1)' },
  slice2: { label: 'Category 2', color: 'var(--chart-2)' },
  slice3: { label: 'Category 3', color: 'var(--chart-3)' },
  slice4: { label: 'Category 4', color: 'var(--chart-4)' },
  slice5: { label: 'Category 5', color: 'var(--chart-5)' },
} satisfies ChartConfig

export default function Reports() {
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

  const stats = [
    {
      label: 'Lessons Completed',
      value: getTotalCompletedLessons(),
      icon: CheckCircle,
    },
    {
      label: 'Courses In Progress',
      value: getCoursesInProgress(allCourses).length,
      icon: BookOpen,
    },
    {
      label: 'Courses Completed',
      value: getCompletedCourses(allCourses).length,
      icon: TrendingUp,
    },
    {
      label: 'Study Notes',
      value: studyNotes,
      icon: FileText,
    },
  ]

  const courseCompletionData = allCourses.map(c => ({
    name: c.title.length > 20 ? c.title.substring(0, 20) + '...' : c.title,
    completion: getCourseCompletionPercent(
      c.id,
      c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    ),
    category: c.category,
  }))

  const categoryData = Object.entries(
    allCourses.reduce<Record<string, { total: number; completed: number }>>((acc, c) => {
      const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      const completed = getCourseCompletionPercent(c.id, total)
      if (!acc[c.category]) acc[c.category] = { total: 0, completed: 0 }
      acc[c.category].total += total
      acc[c.category].completed += completed
      return acc
    }, {})
  ).map(([name, data]) => ({
    name,
    value: Math.round(data.completed / (allCourses.filter(c => c.category === name).length || 1)),
  }))

  // Dynamically update pieChartConfig labels to match real category names
  categoryData.forEach((cat, i) => {
    const key = PIE_KEYS[i % PIE_KEYS.length]
    if (pieChartConfig[key]) {
      ;(pieChartConfig[key] as { label: string; color: string }).label = cat.name
    }
  })

  const activityData = getActionsPerDay(30)
  const recentActions = getRecentActions(10)

  const totalLessons = getTotalCompletedLessons()
  const { getTotalStudyTime } = useSessionStore()
  const hasActivity = totalLessons > 0 || recentActions.length > 0 || getTotalStudyTime() > 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

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
        <Tabs defaultValue="study" className="mb-6">
          <TabsList>
            <TabsTrigger value="study">Study Analytics</TabsTrigger>
            <TabsTrigger value="ai">AI Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-6">
            <AIAnalyticsTab />
          </TabsContent>

          <TabsContent value="study" className="mt-6">
            {/* Study Time Analytics */}
            <div className="mb-6">
              <StudyTimeAnalytics />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {stats.map(stat => {
                const Icon = stat.icon
                return (
                  <Card key={stat.label}>
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="rounded-xl bg-primary/10 p-3">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Course Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                    <BarChart data={courseCompletionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="completion"
                        fill="var(--color-completion)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Progress by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        nameKey="name"
                        label={({
                          cx,
                          cy,
                          midAngle,
                          outerRadius,
                          name,
                          value,
                        }: {
                          cx: number
                          cy: number
                          midAngle?: number
                          outerRadius: number
                          name?: string | number
                          value: number
                        }) => {
                          const RADIAN = Math.PI / 180
                          const angle = midAngle ?? 0
                          const radius = outerRadius + 20
                          const x = cx + radius * Math.cos(-angle * RADIAN)
                          const y = cy + radius * Math.sin(-angle * RADIAN)
                          return (
                            <text
                              x={x}
                              y={y}
                              className="fill-muted-foreground"
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                              fontSize={12}
                            >
                              {`${name}: ${value}%`}
                            </text>
                          )
                        }}
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={`var(--color-${PIE_KEYS[i % PIE_KEYS.length]})`} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Activity chart + Recent activity */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Study Activity (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={areaChartConfig} className="h-[200px] w-full">
                    <AreaChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--color-count)"
                        fill="var(--color-count)"
                        fillOpacity={0.1}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No activity yet. Start studying to see your progress here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentActions.map((action, i) => {
                        const course = allCourses.find(c => c.id === action.courseId)
                        return (
                          <div key={`${action.courseId}-${action.timestamp}`} className="flex items-center gap-3 text-sm">
                            <div
                              className={cn('size-2 rounded-full', action.type === 'lesson_complete' ? 'bg-success' : 'bg-brand')}
                            />
                            <span className="text-muted-foreground">
                              {new Date(action.timestamp).toLocaleDateString()}
                            </span>
                            <span>
                              {action.type === 'lesson_complete'
                                ? 'Completed a lesson'
                                : 'Watched video'}
                              {course ? ` in ${course.title}` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
