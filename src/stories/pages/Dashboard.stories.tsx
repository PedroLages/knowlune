import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpen, CheckCircle, FileText, TrendingUp, Flame, Play } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Badge } from '@/app/components/ui/badge'
import { StatsCard } from '@/app/components/StatsCard'
import { PageLayout } from './_PageLayout'

function DashboardContent() {
  const courses = [
    {
      id: '1',
      title: 'React Patterns',
      category: 'Behavioral Analysis',
      pct: 65,
      color: 'from-blue-400 to-indigo-500',
    },
    {
      id: '2',
      title: 'TypeScript Deep Dive',
      category: 'Influence & Authority',
      pct: 42,
      color: 'from-purple-400 to-pink-500',
    },
    {
      id: '3',
      title: 'Body Language Reading',
      category: 'Confidence Mastery',
      pct: 88,
      color: 'from-emerald-400 to-teal-500',
    },
    {
      id: '4',
      title: 'Operative Kit Basics',
      category: 'Operative Training',
      pct: 15,
      color: 'from-orange-400 to-red-500',
    },
    {
      id: '5',
      title: 'Influence 101',
      category: 'Influence & Authority',
      pct: 0,
      color: 'from-rose-400 to-pink-500',
    },
    {
      id: '6',
      title: 'Dark Psychology',
      category: 'Behavioral Analysis',
      pct: 23,
      color: 'from-slate-400 to-gray-600',
    },
    {
      id: '7',
      title: 'Social Engineering',
      category: 'Operative Training',
      pct: 0,
      color: 'from-amber-400 to-orange-500',
    },
    {
      id: '8',
      title: 'Research Methods',
      category: 'Research Library',
      pct: 56,
      color: 'from-cyan-400 to-blue-500',
    },
  ]

  const streakDays = Array.from({ length: 30 }, () =>
    Math.random() > 0.35 ? Math.floor(Math.random() * 90) + 10 : 0
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Courses Started" value={12} icon={BookOpen} />
        <StatsCard
          label="Lessons Completed"
          value={142}
          icon={CheckCircle}
          trend="up"
          trendValue="+8 this week"
          sparkline={[3, 5, 2, 7, 4, 6, 8]}
        />
        <StatsCard label="Study Notes" value={38} icon={FileText} />
        <StatsCard label="Courses Completed" value={3} icon={TrendingUp} />
      </div>

      {/* Achievement Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 rounded-[24px] mb-8">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">
              Achievement Unlocked! 100 lessons completed!
            </h3>
            <p className="text-sm text-blue-700">
              Keep up the momentum — next milestone: 250 lessons
            </p>
          </div>
          <Badge className="ml-auto bg-blue-600 text-white shrink-0">100</Badge>
        </CardContent>
      </Card>

      {/* Study Streak */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Study Streak</h2>
        <Card className="rounded-[24px]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Flame className="w-6 h-6 text-orange-500" />
              <span className="text-xl font-bold text-orange-600">16 day streak!</span>
              <span className="text-sm text-muted-foreground ml-auto">Best: 24 days</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-muted-foreground font-medium">
                  {d}
                </div>
              ))}
              {streakDays.map((mins, i) => (
                <div
                  key={i}
                  className={`h-5 rounded-sm ${
                    mins === 0
                      ? 'bg-gray-100'
                      : mins < 30
                        ? 'bg-green-200'
                        : mins < 60
                          ? 'bg-green-400'
                          : 'bg-green-600'
                  }`}
                  title={`${mins} min`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card className="rounded-[24px]">
          <CardContent className="p-6 space-y-3">
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
              { type: 'note', text: 'Added 3 notes to Operative Kit Basics', time: 'Yesterday' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    a.type === 'complete'
                      ? 'bg-green-500'
                      : a.type === 'note'
                        ? 'bg-purple-500'
                        : 'bg-blue-500'
                  }`}
                />
                <span className="flex-1">{a.text}</span>
                <span className="text-muted-foreground shrink-0">{a.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Quick Actions */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-4 font-medium transition-colors">
            <Play className="w-5 h-5" /> Continue Learning
          </button>
          <button className="flex items-center justify-center gap-3 bg-card hover:bg-accent border border-border rounded-xl px-6 py-4 font-medium transition-colors">
            <BookOpen className="w-5 h-5" /> Browse Courses
          </button>
          <button className="flex items-center justify-center gap-3 bg-card hover:bg-accent border border-border rounded-xl px-6 py-4 font-medium transition-colors">
            <FileText className="w-5 h-5" /> My Notes
          </button>
        </div>
      </section>

      {/* Progress Chart */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Progress Chart</h2>
        <Card className="rounded-[24px]">
          <CardContent className="p-6">
            <div className="h-48 flex items-end gap-2">
              {[3, 5, 2, 7, 4, 6, 8, 3, 5, 9, 6, 7, 4, 8].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500/80 rounded-t-sm hover:bg-blue-600 transition-colors"
                    style={{ height: `${v * 10}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i % 7]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Continue Studying */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Continue Studying</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses
            .filter(c => c.pct > 0 && c.pct < 100)
            .slice(0, 2)
            .map(course => (
              <Card
                key={course.id}
                className="group hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer rounded-[24px]"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-lg bg-gradient-to-br ${course.color} flex items-center justify-center shrink-0`}
                  >
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{course.title}</h3>
                    <p className="text-sm text-muted-foreground">{course.category}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={course.pct} className="h-2 flex-1" />
                      <span className="text-sm font-medium">{course.pct}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* All Courses */}
      <section>
        <h2 className="text-lg font-semibold mb-4">All Courses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map(course => (
            <Card
              key={course.id}
              className="group hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer rounded-[24px] overflow-hidden"
            >
              <div
                className={`h-32 bg-gradient-to-br ${course.color} flex items-center justify-center relative`}
              >
                <BookOpen className="w-10 h-10 text-white/60" />
                <Badge className="absolute top-3 left-3 bg-white/90 text-foreground text-xs">
                  {course.category.split(' ')[0]}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-1 truncate">{course.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">24 lessons</p>
                <div className="flex items-center gap-2">
                  <Progress value={course.pct} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{course.pct}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function Dashboard() {
  return (
    <PageLayout activePath="/">
      <DashboardContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Dashboard',
  component: Dashboard,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof Dashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyState: Story = {
  render: () => (
    <PageLayout activePath="/">
      <div>
        <h1 className="text-2xl font-bold mb-6">Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard label="Courses Started" value={0} icon={BookOpen} />
          <StatsCard label="Lessons Completed" value={0} icon={CheckCircle} />
          <StatsCard label="Study Notes" value={0} icon={FileText} />
          <StatsCard label="Courses Completed" value={0} icon={TrendingUp} />
        </div>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-6">
              Import your first course to start your learning journey!
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-3 font-medium transition-colors">
              Import Your First Course
            </button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
