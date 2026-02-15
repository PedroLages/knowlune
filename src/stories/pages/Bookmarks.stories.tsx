import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Bookmark, Play, Trash2, Clock, BookOpen, ArrowUpDown } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { PageLayout } from './_PageLayout'

const bookmarks = [
  {
    id: '1',
    courseTitle: 'The Ellipsis Manual',
    lessonTitle: 'Baseline Behavior',
    timestamp: 134,
    label: 'Key definition of baseline',
    color: 'from-blue-400 to-indigo-500',
    date: '2026-02-15T14:30:00Z',
  },
  {
    id: '2',
    courseTitle: 'The Ellipsis Manual',
    lessonTitle: 'Observational Techniques',
    timestamp: 312,
    label: 'SCAN method overview',
    color: 'from-blue-400 to-indigo-500',
    date: '2026-02-15T10:00:00Z',
  },
  {
    id: '3',
    courseTitle: 'Body Language Mastery',
    lessonTitle: 'Facial Expressions',
    timestamp: 485,
    label: 'Micro-expression examples',
    color: 'from-emerald-400 to-teal-500',
    date: '2026-02-14T16:45:00Z',
  },
  {
    id: '4',
    courseTitle: 'Body Language Mastery',
    lessonTitle: 'Hand Gestures',
    timestamp: 210,
    label: 'Steepling gesture meaning',
    color: 'from-emerald-400 to-teal-500',
    date: '2026-02-14T09:20:00Z',
  },
  {
    id: '5',
    courseTitle: 'NLP Mastery Program',
    lessonTitle: 'Rapport Building',
    timestamp: 720,
    label: 'Mirror and match technique',
    color: 'from-violet-400 to-purple-600',
    date: '2026-02-13T11:30:00Z',
  },
  {
    id: '6',
    courseTitle: 'NLP Mastery Program',
    lessonTitle: 'Language Patterns',
    timestamp: 445,
    label: 'Milton Model examples',
    color: 'from-violet-400 to-purple-600',
    date: '2026-02-12T15:00:00Z',
  },
  {
    id: '7',
    courseTitle: 'Operative Field Guide',
    lessonTitle: 'Fieldwork Basics',
    timestamp: 180,
    label: 'Equipment checklist',
    color: 'from-orange-400 to-red-500',
    date: '2026-02-10T08:00:00Z',
  },
  {
    id: '8',
    courseTitle: 'Research Methodologies',
    lessonTitle: 'Data Collection',
    timestamp: 95,
    label: 'Template structure',
    color: 'from-cyan-400 to-blue-500',
    date: '2026-02-08T14:00:00Z',
  },
]

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const sortOptions = ['Most Recent', 'Course Name', 'A-Z']

function BookmarksContent() {
  const [items, setItems] = useState(bookmarks)
  const [sortBy, setSortBy] = useState(0)

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 0) return new Date(b.date).getTime() - new Date(a.date).getTime()
    if (sortBy === 1) return a.courseTitle.localeCompare(b.courseTitle)
    return a.label.localeCompare(b.label)
  })

  function handleRemove(id: string) {
    setItems(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookmarks</h1>
          <p className="text-muted-foreground text-sm mt-1">{items.length} saved bookmarks</p>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={e => setSortBy(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            {sortOptions.map((opt, i) => (
              <option key={opt} value={i}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map(bookmark => (
          <Card key={bookmark.id} className="rounded-[20px] hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div
                  className={`w-20 h-14 rounded-xl bg-gradient-to-br ${bookmark.color} flex items-center justify-center shrink-0 relative`}
                >
                  <Play className="w-5 h-5 text-white" />
                  <Badge className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[10px] px-1.5 py-0">
                    {formatTimestamp(bookmark.timestamp)}
                  </Badge>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{bookmark.label}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{bookmark.courseTitle}</span>
                    <span className="text-xs text-muted-foreground">&middot;</span>
                    <span className="text-xs text-muted-foreground">{bookmark.lessonTitle}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(bookmark.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-blue-600 hover:text-blue-700"
                  >
                    <Play className="w-3.5 h-3.5" /> Jump to
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => handleRemove(bookmark.id)}
                    aria-label="Remove bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function BookmarksPage() {
  return (
    <PageLayout activePath="/courses">
      <BookmarksContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Bookmarks',
  component: BookmarksPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof BookmarksPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyBookmarks: Story = {
  render: () => (
    <PageLayout activePath="/courses">
      <div>
        <h1 className="text-2xl font-bold mb-6">Bookmarks</h1>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <Bookmark className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Bookmark important moments in your video lessons to quickly revisit them later.
            </p>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium mx-auto transition-colors">
              <BookOpen className="w-4 h-4" /> Browse Courses
            </button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
