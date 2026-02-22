import { useTheme } from 'next-themes'
import { BookOpen, CheckCircle, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

// Chart colors using CSS custom properties and Tailwind theme
const getChartColors = (isDark: boolean) => ({
  primary: isDark ? 'rgb(96, 165, 250)' : 'rgb(37, 99, 235)', // blue-400 : blue-600
  purple: isDark ? 'rgb(192, 132, 252)' : 'rgb(124, 58, 237)', // purple-400 : purple-600
  green: isDark ? 'rgb(34, 197, 94)' : 'rgb(5, 150, 105)', // green-500 : green-600
  amber: isDark ? 'rgb(251, 191, 36)' : 'rgb(217, 119, 6)', // amber-400 : amber-600
  red: isDark ? 'rgb(248, 113, 113)' : 'rgb(220, 38, 38)', // red-400 : red-600
  tickColor: isDark ? 'rgb(161, 161, 170)' : 'rgb(113, 113, 130)', // zinc-400 : zinc-500
  tooltipBg: isDark ? 'rgb(39, 39, 42)' : 'rgb(255, 255, 255)', // zinc-800 : white
  tooltipBorder: isDark ? 'rgb(63, 63, 70)' : 'rgb(228, 228, 231)', // zinc-700 : zinc-200
})

export default function Reports() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = getChartColors(isDark)
  const COLORS = [colors.primary, colors.purple, colors.green, colors.amber, colors.red]
  const { tickColor, tooltipBg, tooltipBorder } = colors

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
      value: getTotalStudyNotes(),
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

  const activityData = getActionsPerDay(30)
  const recentActions = getRecentActions(10)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Icon className="h-5 w-5 text-primary" />
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={courseCompletionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: tickColor }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: tickColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="completion" fill={colors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
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
                        fill={tickColor}
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
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: tickColor }} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={colors.primary}
                  fill={colors.primary}
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
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
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          action.type === 'lesson_complete' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                      />
                      <span className="text-muted-foreground">
                        {new Date(action.timestamp).toLocaleDateString()}
                      </span>
                      <span>
                        {action.type === 'lesson_complete' ? 'Completed a lesson' : 'Watched video'}
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
    </div>
  )
}
