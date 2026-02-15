import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Clock, Calendar, BookOpen, Play, ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { StatsCard } from '@/app/components/StatsCard'
import { PageLayout } from './_PageLayout'

const sessions = [
  {
    id: '1',
    date: '2026-02-15',
    course: 'The Ellipsis Manual',
    lessons: ['Nonverbal Deception Cues'],
    duration: 45,
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: '2',
    date: '2026-02-15',
    course: 'Body Language Mastery',
    lessons: ['Eye Movement Patterns'],
    duration: 28,
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: '3',
    date: '2026-02-14',
    course: 'The Ellipsis Manual',
    lessons: ['Verbal Indicators of Deception', 'Science of Deception'],
    duration: 62,
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: '4',
    date: '2026-02-14',
    course: 'NLP Mastery Program',
    lessons: ['Language Patterns'],
    duration: 35,
    color: 'from-violet-400 to-purple-600',
  },
  {
    id: '5',
    date: '2026-02-13',
    course: 'Body Language Mastery',
    lessons: ['Proxemics & Space Usage'],
    duration: 18,
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: '6',
    date: '2026-02-12',
    course: 'The Ellipsis Manual',
    lessons: ['Observational Techniques'],
    duration: 52,
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: '7',
    date: '2026-02-12',
    course: 'Research Methodologies',
    lessons: ['Data Collection', 'Analysis Frameworks'],
    duration: 40,
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: '8',
    date: '2026-02-11',
    course: 'Operative Field Guide',
    lessons: ['Fieldwork Basics'],
    duration: 30,
    color: 'from-orange-400 to-red-500',
  },
  {
    id: '9',
    date: '2026-02-10',
    course: 'NLP Mastery Program',
    lessons: ['Rapport Building'],
    duration: 25,
    color: 'from-violet-400 to-purple-600',
  },
  {
    id: '10',
    date: '2026-02-10',
    course: 'Body Language Mastery',
    lessons: ['Hand Gestures & Micro-expressions'],
    duration: 33,
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: '11',
    date: '2026-02-09',
    course: 'The Ellipsis Manual',
    lessons: ['Baseline Behavior'],
    duration: 48,
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: '12',
    date: '2026-02-08',
    course: 'Behavioral Table of Elements',
    lessons: ['Core Principles'],
    duration: 38,
    color: 'from-purple-400 to-pink-500',
  },
]

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date('2026-02-15')
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function SessionHistoryContent() {
  const [filterCourse, setFilterCourse] = useState('all')

  const courses = [...new Set(sessions.map(s => s.course))]
  const filtered =
    filterCourse === 'all' ? sessions : sessions.filter(s => s.course === filterCourse)
  const totalDuration = filtered.reduce((sum, s) => sum + s.duration, 0)

  // Group by date
  const grouped: Record<string, typeof sessions> = {}
  for (const s of filtered) {
    if (!grouped[s.date]) grouped[s.date] = []
    grouped[s.date].push(s)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Study Session History</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Total Sessions" value={filtered.length} icon={Play} />
        <StatsCard label="Total Study Time" value={formatDuration(totalDuration)} icon={Timer} />
        <StatsCard
          label="Avg Session"
          value={formatDuration(Math.round(totalDuration / filtered.length))}
          icon={Clock}
        />
        <StatsCard
          label="Active Courses"
          value={courses.length}
          icon={BookOpen}
          trend="up"
          trendValue="studying daily"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-muted-foreground">Filter by course:</span>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm flex-1 max-w-xs"
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, daySessions]) => {
          const dayTotal = daySessions.reduce((sum, s) => sum + s.duration, 0)
          return (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{formatDate(date)}</h3>
                <Badge variant="secondary" className="text-xs">
                  {formatDuration(dayTotal)} total
                </Badge>
              </div>
              <div className="space-y-2 ml-7">
                {daySessions.map(session => (
                  <Card key={session.id} className="rounded-xl hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${session.color} flex items-center justify-center shrink-0`}
                      >
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{session.course}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.lessons.join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Clock className="w-3 h-3" /> {formatDuration(session.duration)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {session.lessons.length} lesson{session.lessons.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button variant="outline" size="sm" disabled className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page 1 of 1</span>
        <Button variant="outline" size="sm" disabled className="gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function SessionHistoryPage() {
  return (
    <PageLayout activePath="/reports">
      <SessionHistoryContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Session History',
  component: SessionHistoryPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SessionHistoryPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyHistory: Story = {
  render: () => (
    <PageLayout activePath="/reports">
      <div>
        <h1 className="text-2xl font-bold mb-6">Study Session History</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Sessions" value={0} icon={Play} />
          <StatsCard label="Total Study Time" value="0m" icon={Timer} />
          <StatsCard label="Avg Session" value="—" icon={Clock} />
          <StatsCard label="Active Courses" value={0} icon={BookOpen} />
        </div>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No study sessions yet</h3>
            <p className="text-muted-foreground">
              Start watching a lesson to automatically log your study sessions.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
