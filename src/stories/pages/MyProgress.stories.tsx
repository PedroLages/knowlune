import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Clock, CheckCircle, PlayCircle, BookOpen, ArrowRight, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { StatsCard } from '@/app/components/StatsCard'
import { PageLayout } from './_PageLayout'

const courses = [
  {
    id: '1',
    title: 'The Ellipsis Manual',
    cat: 'Behavioral Analysis',
    pct: 65,
    lessons: 24,
    difficulty: 'Advanced',
    status: 'in-progress' as const,
    color: 'from-blue-400 to-indigo-500',
    lastAccessed: '2 hours ago',
  },
  {
    id: '2',
    title: 'Behavioral Table of Elements',
    cat: 'Influence & Authority',
    pct: 42,
    lessons: 18,
    difficulty: 'Intermediate',
    status: 'in-progress' as const,
    color: 'from-purple-400 to-pink-500',
    lastAccessed: '5 hours ago',
  },
  {
    id: '3',
    title: 'Body Language Mastery',
    cat: 'Confidence Mastery',
    pct: 88,
    lessons: 32,
    difficulty: 'Beginner',
    status: 'in-progress' as const,
    color: 'from-emerald-400 to-teal-500',
    lastAccessed: 'Yesterday',
  },
  {
    id: '4',
    title: 'Operative Field Guide',
    cat: 'Operative Training',
    pct: 15,
    lessons: 40,
    difficulty: 'Advanced',
    status: 'in-progress' as const,
    color: 'from-orange-400 to-red-500',
    lastAccessed: '3 days ago',
  },
  {
    id: '5',
    title: 'Research Methodologies',
    cat: 'Research Library',
    pct: 56,
    lessons: 14,
    difficulty: 'Intermediate',
    status: 'in-progress' as const,
    color: 'from-cyan-400 to-blue-500',
    lastAccessed: '1 week ago',
  },
  {
    id: '6',
    title: 'NLP Mastery Program',
    cat: 'Confidence Mastery',
    pct: 100,
    lessons: 22,
    difficulty: 'Intermediate',
    status: 'completed' as const,
    color: 'from-violet-400 to-purple-600',
    lastAccessed: '2 weeks ago',
  },
  {
    id: '7',
    title: 'Social Engineering 101',
    cat: 'Operative Training',
    pct: 100,
    lessons: 28,
    difficulty: 'Beginner',
    status: 'completed' as const,
    color: 'from-amber-400 to-orange-500',
    lastAccessed: '3 weeks ago',
  },
  {
    id: '8',
    title: 'Dark Psychology Insights',
    cat: 'Behavioral Analysis',
    pct: 100,
    lessons: 16,
    difficulty: 'Advanced',
    status: 'completed' as const,
    color: 'from-slate-500 to-gray-700',
    lastAccessed: '1 month ago',
  },
  {
    id: '9',
    title: 'Influence & Persuasion',
    cat: 'Influence & Authority',
    pct: 0,
    lessons: 20,
    difficulty: 'Beginner',
    status: 'not-started' as const,
    color: 'from-rose-400 to-pink-500',
    lastAccessed: '',
  },
]

const tabs = ['By Status', 'All Courses', 'By Category', 'By Difficulty']
const sortOptions = [
  'Recent Activity',
  'Progress (High)',
  'Progress (Low)',
  'A-Z',
  'Estimated Time',
]

function CourseCard({ course }: { course: (typeof courses)[0] }) {
  return (
    <Card className="group hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer rounded-[24px] overflow-hidden">
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center shrink-0`}
        >
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{course.title}</h3>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {course.difficulty}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{course.cat}</p>
          <div className="flex items-center gap-2">
            <Progress value={course.pct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground">{course.pct}%</span>
          </div>
        </div>
        {course.lastAccessed && (
          <span className="text-[10px] text-muted-foreground shrink-0">{course.lastAccessed}</span>
        )}
      </CardContent>
    </Card>
  )
}

function MyProgressContent() {
  const [activeTab, setActiveTab] = useState(0)
  const [sortBy, setSortBy] = useState(0)

  const inProgress = courses.filter(c => c.status === 'in-progress')
  const completed = courses.filter(c => c.status === 'completed')
  const notStarted = courses.filter(c => c.status === 'not-started')

  const categories = [...new Set(courses.map(c => c.cat))]
  const difficulties = ['Beginner', 'Intermediate', 'Advanced']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Progress</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Total Courses" value={9} icon={BookOpen} />
        <StatsCard label="In Progress" value={5} icon={Clock} />
        <StatsCard
          label="Completed"
          value={3}
          icon={CheckCircle}
          trend="up"
          trendValue="+1 this week"
        />
        <StatsCard
          label="Study Hours"
          value={47}
          icon={BarChart3}
          trend="up"
          trendValue="+6h this week"
          sparkline={[3, 5, 2, 7, 4, 6, 8]}
        />
      </div>

      {/* Tabs + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-card border border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm w-full sm:w-[200px]"
        >
          {sortOptions.map((opt, i) => (
            <option key={opt} value={i}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* By Status (default) */}
      {activeTab === 0 && (
        <>
          {inProgress.length > 0 && (
            <section className="mb-8">
              <div className="bg-blue-50 p-4 rounded-xl mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  In Progress ({inProgress.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgress.map(c => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section className="mb-8">
              <div className="bg-green-50 p-4 rounded-xl mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Completed ({completed.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map(c => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
          {notStarted.length > 0 && (
            <section>
              <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <PlayCircle className="w-6 h-6 text-muted-foreground" />
                  Not Started ({notStarted.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notStarted.map(c => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* All Courses */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}

      {/* By Category */}
      {activeTab === 2 && (
        <>
          {categories.map(cat => {
            const catCourses = courses.filter(c => c.cat === cat)
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-lg font-semibold mb-4">{cat}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catCourses.map(c => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      {/* By Difficulty */}
      {activeTab === 3 && (
        <>
          {difficulties.map(diff => {
            const diffCourses = courses.filter(c => c.difficulty === diff)
            if (diffCourses.length === 0) return null
            return (
              <section key={diff} className="mb-8">
                <h2 className="text-lg font-semibold mb-4">{diff}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {diffCourses.map(c => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function MyProgressPage() {
  return (
    <PageLayout activePath="/my-class">
      <MyProgressContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/My Progress',
  component: MyProgressPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof MyProgressPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyState: Story = {
  render: () => (
    <PageLayout activePath="/my-class">
      <div>
        <h1 className="text-2xl font-bold mb-6">My Progress</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Courses" value={0} icon={BookOpen} />
          <StatsCard label="In Progress" value={0} icon={Clock} />
          <StatsCard label="Completed" value={0} icon={CheckCircle} />
          <StatsCard label="Study Hours" value={0} icon={BarChart3} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PlayCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ready to start learning?</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Browse our course catalog to find the perfect course to kickstart your learning journey.
          </p>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium transition-colors">
            Browse All Courses <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </PageLayout>
  ),
}
