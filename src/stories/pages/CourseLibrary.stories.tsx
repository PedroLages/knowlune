import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Search, BookOpen, Flame, Sun, Snowflake } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { PageLayout } from './_PageLayout'

const courses = [
  {
    id: '1',
    title: 'The Ellipsis Manual',
    category: 'behavioral-analysis',
    cat: 'Behavioral',
    pct: 65,
    lessons: 24,
    momentum: 'hot' as const,
    color: 'from-blue-400 to-indigo-500',
    tags: ['body language', 'deception'],
  },
  {
    id: '2',
    title: 'Behavioral Table of Elements',
    category: 'influence-authority',
    cat: 'Influence',
    pct: 42,
    lessons: 18,
    momentum: 'warm' as const,
    color: 'from-purple-400 to-pink-500',
    tags: ['persuasion', 'authority'],
  },
  {
    id: '3',
    title: 'Body Language Mastery',
    category: 'confidence-mastery',
    cat: 'Confidence',
    pct: 88,
    lessons: 32,
    momentum: 'hot' as const,
    color: 'from-emerald-400 to-teal-500',
    tags: ['nonverbal', 'confidence'],
  },
  {
    id: '4',
    title: 'Operative Field Guide',
    category: 'operative-training',
    cat: 'Operative',
    pct: 15,
    lessons: 40,
    momentum: 'warm' as const,
    color: 'from-orange-400 to-red-500',
    tags: ['fieldwork', 'tactics'],
  },
  {
    id: '5',
    title: 'Influence & Persuasion',
    category: 'influence-authority',
    cat: 'Influence',
    pct: 0,
    lessons: 20,
    momentum: 'cold' as const,
    color: 'from-rose-400 to-pink-500',
    tags: ['influence', 'psychology'],
  },
  {
    id: '6',
    title: 'Dark Psychology Insights',
    category: 'behavioral-analysis',
    cat: 'Behavioral',
    pct: 23,
    lessons: 16,
    momentum: 'cold' as const,
    color: 'from-slate-500 to-gray-700',
    tags: ['psychology', 'manipulation'],
  },
  {
    id: '7',
    title: 'Social Engineering 101',
    category: 'operative-training',
    cat: 'Operative',
    pct: 0,
    lessons: 28,
    momentum: 'cold' as const,
    color: 'from-amber-400 to-orange-500',
    tags: ['social', 'engineering'],
  },
  {
    id: '8',
    title: 'Research Methodologies',
    category: 'research-library',
    cat: 'Research',
    pct: 56,
    lessons: 14,
    momentum: 'warm' as const,
    color: 'from-cyan-400 to-blue-500',
    tags: ['research', 'methods'],
  },
  {
    id: '9',
    title: 'NLP Mastery Program',
    category: 'confidence-mastery',
    cat: 'Confidence',
    pct: 71,
    lessons: 22,
    momentum: 'hot' as const,
    color: 'from-violet-400 to-purple-600',
    tags: ['nlp', 'language'],
  },
]

const tabs = ['All Courses', 'Behavioral', 'Influence', 'Confidence', 'Operative', 'Research']

function MomentumBadge({ momentum }: { momentum: 'hot' | 'warm' | 'cold' }) {
  if (momentum === 'hot')
    return (
      <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1">
        <Flame className="w-3 h-3" /> Active
      </Badge>
    )
  if (momentum === 'warm')
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
        <Sun className="w-3 h-3" /> Recent
      </Badge>
    )
  return (
    <Badge className="bg-gray-100 text-gray-500 border-gray-200 gap-1">
      <Snowflake className="w-3 h-3" /> Paused
    </Badge>
  )
}

function CourseLibraryContent() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(0)

  const filtered = courses.filter(c => {
    if (activeTab > 0) {
      const tabCat = tabs[activeTab].toLowerCase()
      if (!c.cat.toLowerCase().startsWith(tabCat.slice(0, 4))) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.title.toLowerCase().includes(q) || c.tags.some(t => t.includes(q))
    }
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">All Courses</h1>
        <p className="text-muted-foreground">
          Chase Hughes — The Operative Kit ({courses.length} courses)
        </p>
      </div>

      {/* Search */}
      <Card className="rounded-3xl border-0 shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for courses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-muted border-0"
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSearch('')}>
            {search ? 'Clear' : 'Search'}
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
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

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No courses match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(course => (
            <Card
              key={course.id}
              className="group hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer rounded-[24px] overflow-hidden"
            >
              <div
                className={`h-36 bg-gradient-to-br ${course.color} flex items-center justify-center relative`}
              >
                <BookOpen className="w-12 h-12 text-white/50" />
                {/* Momentum badge */}
                <div className="absolute top-3 right-3">
                  <MomentumBadge momentum={course.momentum} />
                </div>
                {/* Category badge */}
                <Badge className="absolute top-3 left-3 bg-white/90 text-foreground text-xs">
                  {course.cat}
                </Badge>
              </div>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-1 group-hover:text-blue-600 transition-colors">
                  {course.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-1">{course.lessons} lessons</p>
                {/* Tags */}
                <div className="flex gap-1.5 mb-3">
                  {course.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {/* Progress */}
                <div className="flex items-center gap-2">
                  <Progress value={course.pct} className="h-2 flex-1" />
                  <span className="text-sm font-medium text-muted-foreground">{course.pct}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CourseLibrary() {
  return (
    <PageLayout activePath="/courses">
      <CourseLibraryContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Course Library',
  component: CourseLibrary,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof CourseLibrary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyLibrary: Story = {
  render: () => (
    <PageLayout activePath="/courses">
      <div>
        <h1 className="text-3xl font-bold mb-6">All Courses</h1>
        <Card className="rounded-[24px]">
          <CardContent className="p-16 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No courses imported</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Import a course folder from your file system to get started. Supported formats: MP4,
              MKV, AVI, WEBM, and PDF.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-3">
              Import Your First Course
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
