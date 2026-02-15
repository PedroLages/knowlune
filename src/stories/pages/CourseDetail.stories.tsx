import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import {
  ArrowLeft,
  Clock,
  Video,
  FileText,
  BookOpen,
  Play,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { PageLayout } from './_PageLayout'

const course = {
  title: 'The Ellipsis Manual',
  description:
    'A comprehensive guide to behavioral analysis and reading people. Learn to decode nonverbal cues, detect deception, and understand the psychology behind human behavior.',
  category: 'Behavioral Analysis',
  difficulty: 'Advanced',
  totalLessons: 24,
  totalVideos: 20,
  totalPDFs: 4,
  estimatedHours: 18,
  completionPercent: 65,
  completedLessons: 16,
  tags: ['body language', 'deception', 'behavioral analysis', 'nonverbal', 'psychology'],
  color: 'from-blue-400 to-indigo-500',
  modules: [
    {
      title: 'Module 1: Foundations of Behavioral Analysis',
      lessons: [
        {
          title: 'Introduction to Behavioral Science',
          duration: '12:30',
          status: 'completed' as const,
        },
        { title: 'The Behavioral Framework', duration: '18:45', status: 'completed' as const },
        { title: 'Baseline Behavior', duration: '22:10', status: 'completed' as const },
        { title: 'Observational Techniques', duration: '15:20', status: 'completed' as const },
      ],
    },
    {
      title: 'Module 2: Reading Nonverbal Cues',
      lessons: [
        { title: 'Facial Expressions Decoded', duration: '28:15', status: 'completed' as const },
        { title: 'Body Positioning & Posture', duration: '31:40', status: 'completed' as const },
        {
          title: 'Hand Gestures & Micro-expressions',
          duration: '25:55',
          status: 'completed' as const,
        },
        { title: 'Eye Movement Patterns', duration: '20:30', status: 'completed' as const },
        { title: 'Voice Tone Analysis', duration: '18:45', status: 'completed' as const },
        { title: 'Proxemics & Space Usage', duration: '16:20', status: 'completed' as const },
      ],
    },
    {
      title: 'Module 3: Deception Detection',
      lessons: [
        { title: 'Science of Deception', duration: '35:20', status: 'completed' as const },
        {
          title: 'Verbal Indicators of Deception',
          duration: '28:10',
          status: 'completed' as const,
        },
        { title: 'Nonverbal Deception Cues', duration: '32:45', status: 'current' as const },
        { title: 'Statement Analysis', duration: '40:20', status: 'upcoming' as const },
        { title: 'Interview Techniques', duration: '45:30', status: 'upcoming' as const },
        { title: 'Case Studies', duration: '25:00', status: 'upcoming' as const },
      ],
    },
    {
      title: 'Module 4: Advanced Applications',
      lessons: [
        { title: 'Profiling Individuals', duration: '38:00', status: 'upcoming' as const },
        { title: 'Group Dynamics Analysis', duration: '42:15', status: 'upcoming' as const },
        { title: 'Real-World Scenarios', duration: '35:30', status: 'upcoming' as const },
        { title: 'Building Your Skills', duration: '20:00', status: 'upcoming' as const },
        {
          title: 'Assessment & Certification',
          duration: '15:00',
          status: 'upcoming' as const,
          type: 'pdf' as const,
        },
        {
          title: 'Supplementary Materials',
          duration: '—',
          status: 'upcoming' as const,
          type: 'pdf' as const,
        },
      ],
    },
  ],
}

function CourseDetailContent() {
  const [expandedModule, setExpandedModule] = useState(2)

  return (
    <div>
      {/* Breadcrumb */}
      <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </button>

      {/* Course Header */}
      <div className="bg-card rounded-3xl shadow-sm p-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                {course.category}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {course.difficulty}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
            <p className="text-muted-foreground mb-5">{course.description}</p>

            <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {course.totalLessons} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {course.totalVideos} videos
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {course.totalPDFs} documents
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />~{course.estimatedHours} hours
              </span>
            </div>

            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium transition-colors">
              <Play className="h-4 w-4" />
              Continue Learning
            </button>
          </div>

          {/* Progress sidebar */}
          <div className="w-full lg:w-64 bg-muted rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Your Progress</h3>
            <div className="text-3xl font-bold text-blue-600 mb-1">{course.completionPercent}%</div>
            <Progress value={course.completionPercent} className="mb-3" />
            <p className="text-xs text-muted-foreground">
              {course.completedLessons} of {course.totalLessons} lessons completed
            </p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {course.tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs bg-accent">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="border-t border-border mb-6" />

      {/* Course Content */}
      <h2 className="text-lg font-semibold mb-4">Course Content</h2>
      <Card className="rounded-[24px]">
        <CardContent className="p-4 space-y-2">
          {course.modules.map((mod, mi) => (
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
                      {'type' in lesson && lesson.type === 'pdf' ? (
                        <Badge variant="secondary" className="text-[10px]">
                          PDF
                        </Badge>
                      ) : null}
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
    </div>
  )
}

function CourseDetailPage() {
  return (
    <PageLayout activePath="/courses">
      <CourseDetailContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Course Detail',
  component: CourseDetailPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof CourseDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NotStarted: Story = {
  render: () => (
    <PageLayout activePath="/courses">
      <div>
        <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </button>
        <div className="bg-card rounded-3xl shadow-sm p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">
                  Influence & Authority
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Beginner
                </Badge>
              </div>
              <h1 className="text-2xl font-bold mb-2">Influence & Persuasion</h1>
              <p className="text-muted-foreground mb-5">
                Master the art and science of influence. Learn ethical persuasion techniques used by
                top negotiators and leaders worldwide.
              </p>
              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" /> 20 lessons
                </span>
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4" /> 18 videos
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> 2 documents
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> ~12 hours
                </span>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium transition-colors">
                <Play className="h-4 w-4" /> Start Course
              </button>
            </div>
            <div className="w-full lg:w-64 bg-muted rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3">Your Progress</h3>
              <div className="text-3xl font-bold text-muted-foreground mb-1">0%</div>
              <Progress value={0} className="mb-3" />
              <p className="text-xs text-muted-foreground">Not started yet</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  ),
}

export const NotFound: Story = {
  render: () => (
    <PageLayout activePath="/courses">
      <div className="flex flex-col items-center justify-center py-24">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The course you&apos;re looking for doesn&apos;t exist.
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium transition-colors">
          Back to Courses
        </button>
      </div>
    </PageLayout>
  ),
}
