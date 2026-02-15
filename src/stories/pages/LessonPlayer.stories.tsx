import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  Maximize,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Tag,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { PageLayout } from './_PageLayout'

function LessonPlayerContent() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [expandedModule, setExpandedModule] = useState(0)

  const modules = [
    {
      title: 'Module 1: React Fundamentals',
      lessons: [
        { title: 'Introduction to React', duration: '12:30', status: 'completed' as const },
        { title: 'JSX Deep Dive', duration: '18:45', status: 'completed' as const },
        { title: 'Components & Props', duration: '22:10', status: 'completed' as const },
        { title: 'State Management', duration: '35:20', status: 'current' as const },
      ],
    },
    {
      title: 'Module 2: Advanced Patterns',
      lessons: [
        { title: 'useEffect Basics', duration: '28:15', status: 'upcoming' as const },
        { title: 'Custom Hooks', duration: '31:40', status: 'upcoming' as const },
        { title: 'Context API', duration: '25:55', status: 'upcoming' as const },
        { title: 'Performance Optimization', duration: '40:20', status: 'upcoming' as const },
        { title: 'Error Boundaries', duration: '15:30', status: 'upcoming' as const },
        { title: 'React Suspense', duration: '33:10', status: 'upcoming' as const },
      ],
    },
    {
      title: 'Module 3: Real-World Applications',
      lessons: [
        { title: 'Project Setup', duration: '20:00', status: 'upcoming' as const },
        { title: 'Building a Dashboard', duration: '45:30', status: 'upcoming' as const },
        { title: 'Testing Strategies', duration: '35:15', status: 'upcoming' as const },
      ],
    },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground mb-4">
        <span className="hover:text-foreground cursor-pointer">Courses</span>
        <span className="mx-2">&gt;</span>
        <span className="hover:text-foreground cursor-pointer">React Patterns</span>
        <span className="mx-2">&gt;</span>
        <span className="text-foreground">State Management</span>
      </div>

      {/* Main Content: Video + Notes side by side */}
      <div className="flex gap-6 mb-6">
        {/* Video Player (60%) */}
        <div className="flex-[3] min-w-0">
          {/* Video Area */}
          <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-2">
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" />
                )}
              </button>
            </div>
            {/* Video title overlay */}
            <div className="absolute top-4 left-4">
              <h2 className="text-white font-semibold text-lg">State Management</h2>
              <p className="text-white/60 text-sm">React Patterns — Module 1</p>
            </div>
            {/* Time display */}
            <div className="absolute bottom-4 right-4 text-white/80 text-sm font-mono">
              12:34 / 35:20
            </div>
          </div>

          {/* Controls Bar */}
          <Card className="rounded-xl">
            <CardContent className="p-3 flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded-lg hover:bg-accent"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              {/* Progress bar */}
              <div className="flex-1 relative group cursor-pointer">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '35%' }} />
                </div>
                {/* Bookmark marker */}
                <div
                  className="absolute top-0 h-2 w-1.5 bg-orange-500 rounded-sm"
                  style={{ left: '20%' }}
                />
                <div
                  className="absolute top-0 h-2 w-1.5 bg-orange-500 rounded-sm"
                  style={{ left: '55%' }}
                />
              </div>

              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                12:34 / 35:20
              </span>

              <div className="flex items-center gap-1 border-l border-border pl-3">
                <button className="px-2 py-1 text-xs bg-muted rounded-md hover:bg-accent font-medium">
                  1.5x
                </button>
                <button className="p-1.5 rounded-lg hover:bg-accent" aria-label="Captions">
                  <span className="text-xs font-bold text-muted-foreground">CC</span>
                </button>
                <button className="p-1.5 rounded-lg hover:bg-accent" aria-label="Volume">
                  <Volume2 className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-accent" aria-label="Fullscreen">
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors">
              <Bookmark className="w-4 h-4" /> Bookmark
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors">
              <SkipForward className="w-4 h-4" /> Next Lesson
            </button>
          </div>
        </div>

        {/* Notes Panel (40%) */}
        <div className="flex-[2] min-w-0">
          <Card className="rounded-2xl h-full flex flex-col">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Notes</h3>
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Saved
                </span>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-1 p-2 bg-muted rounded-lg mb-3">
                <button className="p-1.5 rounded hover:bg-accent">
                  <Bold className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent">
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent">
                  <Heading1 className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent">
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent">
                  <List className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent">
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent">
                  <Code className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button
                  className="p-1.5 rounded hover:bg-accent text-blue-600"
                  title="Insert timestamp (Alt+T)"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>

              {/* Note content */}
              <div className="flex-1 bg-background border border-border rounded-lg p-4 text-sm space-y-3 overflow-auto min-h-[300px]">
                <h2 className="text-base font-bold">State Management</h2>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>React state is local by default — each component manages its own</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>useState for simple values, useReducer for complex state logic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Lifting state up enables sharing between siblings</span>
                  </li>
                </ul>
                <div className="space-y-1">
                  <button className="text-blue-600 hover:underline cursor-pointer text-xs">
                    [2:34] Side effects explained
                  </button>
                  <br />
                  <button className="text-blue-600 hover:underline cursor-pointer text-xs">
                    [5:12] Cleanup patterns
                  </button>
                  <br />
                  <button className="text-blue-600 hover:underline cursor-pointer text-xs">
                    [8:45] Dependency array rules
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 mt-3">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">
                  React
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Hooks
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  State
                </Badge>
                <button className="text-xs text-muted-foreground hover:text-foreground">
                  + Add
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course Structure */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Course Structure</h2>
        <Card className="rounded-[24px]">
          <CardContent className="p-4 space-y-2">
            {modules.map((mod, mi) => (
              <div key={mi}>
                <button
                  onClick={() => setExpandedModule(expandedModule === mi ? -1 : mi)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    expandedModule === mi ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                >
                  {expandedModule === mi ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  <span className="font-medium text-sm flex-1">
                    {mod.title} ({mod.lessons.length} lessons)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {mod.lessons.filter(l => l.status === 'completed').length}/{mod.lessons.length}
                  </span>
                </button>
                {expandedModule === mi && (
                  <div className="ml-7 mt-1 space-y-1">
                    {mod.lessons.map((lesson, li) => (
                      <div
                        key={li}
                        className={`flex items-center gap-3 p-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                          lesson.status === 'current'
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        {lesson.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        ) : lesson.status === 'current' ? (
                          <Play className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span
                          className={`flex-1 ${lesson.status === 'completed' ? 'text-muted-foreground' : ''}`}
                        >
                          {lesson.title}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {lesson.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function LessonPlayer() {
  return (
    <PageLayout activePath="/courses">
      <LessonPlayerContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Lesson Player',
  component: LessonPlayer,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof LessonPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MobileStacked: Story = {
  render: () => (
    <PageLayout activePath="/courses" hideSidebar showBottomNav>
      <div className="max-w-lg mx-auto">
        {/* Video */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video mb-3">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-0.5" />
            </div>
          </div>
          <div className="absolute top-3 left-3">
            <p className="text-white font-medium text-sm">State Management</p>
          </div>
        </div>
        {/* Controls */}
        <Card className="rounded-lg mb-3">
          <CardContent className="p-2 flex items-center gap-2">
            <Play className="w-4 h-4" />
            <div className="flex-1 h-1.5 bg-muted rounded-full">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '35%' }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">12:34/35:20</span>
          </CardContent>
        </Card>
        {/* Toggle tabs */}
        <div className="flex gap-2 mb-3">
          {['Video', 'Notes', 'Structure'].map((t, i) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                i === 1 ? 'bg-blue-600 text-white' : 'bg-card border border-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Notes (shown) */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Notes</h3>
            <div className="bg-background border border-border rounded-lg p-3 text-sm min-h-[200px]">
              <h4 className="font-bold mb-2">State Management</h4>
              <p className="text-muted-foreground">- React state is local by default</p>
              <p className="text-muted-foreground">- useState for simple values</p>
              <p className="text-muted-foreground">- Lifting state up for sharing</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
