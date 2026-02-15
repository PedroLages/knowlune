import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckCircle, BookOpen, TrendingUp, FileText, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { StatsCard } from '@/app/components/StatsCard'
import { PageLayout } from './_PageLayout'

const courseData = [
  { name: 'Ellipsis', pct: 65 },
  { name: 'Behavioral', pct: 42 },
  { name: 'Body Lang', pct: 88 },
  { name: 'Operative', pct: 15 },
  { name: 'Influence', pct: 0 },
  { name: 'Dark Psych', pct: 23 },
  { name: 'Research', pct: 56 },
  { name: 'NLP', pct: 71 },
]

const activityDays = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  count: Math.floor(Math.random() * 8),
}))

function ReportsContent() {
  const maxBar = Math.max(...courseData.map(c => c.pct), 1)
  const maxActivity = Math.max(...activityDays.map(d => d.count), 1)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Lessons Completed"
          value={142}
          icon={CheckCircle}
          trend="up"
          trendValue="+8 this week"
          sparkline={[3, 5, 2, 7, 4, 6, 8]}
        />
        <StatsCard label="Courses In Progress" value={8} icon={BookOpen} />
        <StatsCard label="Courses Completed" value={3} icon={TrendingUp} />
        <StatsCard label="Study Notes" value={38} icon={FileText} />
      </div>

      {/* Charts Row: Bar (2/3) + Category breakdown (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bar Chart */}
        <Card className="col-span-1 lg:col-span-2 rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Course Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-64">
              {courseData.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">{c.pct}%</span>
                  <div className="w-full relative" style={{ height: '200px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t-md"
                      style={{
                        height: `${(c.pct / maxBar) * 100}%`,
                        minHeight: c.pct > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Pie / Breakdown */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Progress by Category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {/* Donut chart mockup */}
            <div className="relative w-40 h-40 mb-6">
              <svg viewBox="0 0 160 160" className="w-full h-full">
                <circle cx="80" cy="80" r="60" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="20"
                  strokeDasharray="377"
                  strokeDashoffset="130"
                  strokeLinecap="round"
                  className="transform -rotate-90 origin-center"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="20"
                  strokeDasharray="377"
                  strokeDashoffset="280"
                  strokeLinecap="round"
                  className="transform rotate-[75deg] origin-center"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">45%</span>
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2 w-full">
              {[
                { color: 'bg-blue-600', label: 'Behavioral', pct: '55%' },
                { color: 'bg-purple-600', label: 'Influence', pct: '21%' },
                { color: 'bg-emerald-600', label: 'Confidence', pct: '80%' },
                { color: 'bg-orange-500', label: 'Operative', pct: '8%' },
                { color: 'bg-cyan-500', label: 'Research', pct: '56%' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-muted-foreground">{item.pct}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Activity Chart */}
      <Card className="rounded-[24px] mb-6">
        <CardHeader>
          <CardTitle className="text-base">Study Activity (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {activityDays.map((d, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-500/70 hover:bg-blue-600 transition-colors rounded-t-sm"
                style={{
                  height: `${(d.count / maxActivity) * 100}%`,
                  minHeight: d.count > 0 ? '2px' : '0',
                }}
                title={`Day ${d.day}: ${d.count} actions`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </CardContent>
      </Card>

      {/* Velocity + Retention side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Learning Velocity */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Learning Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">8.5</span>
              <span className="text-muted-foreground">videos/week</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 mb-4">
              <TrendingUp className="w-4 h-4" />
              <span>12% vs last week</span>
            </div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-1 h-12">
              {[4, 6, 5, 8, 7, 9, 8, 10].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-200 rounded-t-sm"
                  style={{ height: `${v * 10}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>8 weeks ago</span>
              <span>This week</span>
            </div>
          </CardContent>
        </Card>

        {/* Retention Insights */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Retention Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {/* Mini donut */}
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="12"
                    strokeDasharray="239"
                    strokeDashoffset="60"
                    strokeLinecap="round"
                    className="transform -rotate-90 origin-center"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">75%</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                  <span className="text-sm">9 Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-sm" />
                  <span className="text-sm">3 Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                  <span className="text-sm">2 At Risk</span>
                  <Badge variant="secondary" className="text-xs ml-1">
                    needs attention
                  </Badge>
                </div>
              </div>
            </div>
            {/* At-risk courses */}
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="text-sm font-medium text-muted-foreground">At-risk courses:</p>
              {[
                { name: 'Influence & Persuasion', days: 18, pct: 0 },
                { name: 'Dark Psychology', days: 14, pct: 23 },
              ].map(c => (
                <div
                  key={c.name}
                  className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg text-sm"
                >
                  <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.days}d ago · {c.pct}%
                  </span>
                  <button className="text-xs text-blue-600 hover:underline font-medium">
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              type: 'complete',
              text: 'Completed "useEffect Basics" in React Patterns',
              time: '2 hours ago',
            },
            {
              type: 'watch',
              text: 'Watched "TypeScript Generics" in TypeScript Deep Dive',
              time: '5 hours ago',
            },
            {
              type: 'complete',
              text: 'Completed "Body Language Reading" lesson',
              time: 'Yesterday',
            },
            { type: 'start', text: 'Started "Operative Kit Introduction"', time: 'Yesterday' },
            { type: 'complete', text: 'Completed "Influence Fundamentals"', time: '2 days ago' },
            { type: 'note', text: 'Added 3 notes to NLP Mastery', time: '3 days ago' },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  a.type === 'complete'
                    ? 'bg-green-500'
                    : a.type === 'note'
                      ? 'bg-purple-500'
                      : a.type === 'start'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                }`}
              />
              <span className="flex-1">{a.text}</span>
              <span className="text-muted-foreground shrink-0">{a.time}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsPage() {
  return (
    <PageLayout activePath="/reports">
      <ReportsContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Reports',
  component: ReportsPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ReportsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyReports: Story = {
  render: () => (
    <PageLayout activePath="/reports">
      <div>
        <h1 className="text-2xl font-bold mb-6">Reports</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Lessons Completed" value={0} icon={CheckCircle} />
          <StatsCard label="Courses In Progress" value={0} icon={BookOpen} />
          <StatsCard label="Courses Completed" value={0} icon={TrendingUp} />
          <StatsCard label="Study Notes" value={0} icon={FileText} />
        </div>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground">Start studying to see your analytics here.</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
