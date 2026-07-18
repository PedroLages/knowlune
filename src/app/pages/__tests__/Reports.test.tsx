import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useCourseStore } from '@/stores/useCourseStore'

// ── Mock motion/react ──
vi.mock('motion/react', () => {
  const Passthrough = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>
  return {
    MotionConfig: Passthrough,
    motion: new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop !== 'string') return undefined
          // Return a forwardRef component for any HTML element (div, h1, etc.)
          const MotionComponent = ({
            children,
            variants: _variants,
            initial: _initial,
            animate: _animate,
            ...rest
          }: React.PropsWithChildren<Record<string, unknown>>) => {
            const Tag = prop as keyof React.JSX.IntrinsicElements
            // Filter out non-DOM props
            const domProps: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(rest)) {
              if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                domProps[k] = v
              }
            }
            return <Tag {...domProps}>{children}</Tag>
          }
          MotionComponent.displayName = `motion.${prop}`
          return MotionComponent
        },
      }
    ),
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

// ── Mock @/lib/motion ──
vi.mock('@/lib/motion', () => ({
  staggerContainer: {},
  fadeUp: {},
  scaleIn: {},
}))

// ── Mock date-fns ──
vi.mock('date-fns', async importOriginal => {
  const actual = await importOriginal<typeof import('date-fns')>()
  return {
    ...actual,
    format: (date: Date, _fmt: string) => date.toISOString().slice(0, 10),
  }
})

// ── Course store setup (replaces vi.mock('@/data/courses')) ──

// ── Mock progress lib ──
// Return non-zero completedLessons so hasActivity = true and the full UI renders
vi.mock('@/lib/progress', () => ({
  getCoursesInProgress: () => [],
  getCompletedCourses: () => [],
  getTotalCompletedLessons: () => 5,
  getTotalStudyNotes: () => Promise.resolve(2),
  getCourseCompletionPercent: () => 0,
  getLast7DaysLessonCompletions: () => [0, 1, 0, 2, 1, 0, 1],
  getWeeklyChange: () => 3,
}))

// ── Mock analytics ──
vi.mock('@/lib/analytics', () => ({
  calculateCompletionRate: () =>
    Promise.resolve({ completionRate: 0, completedCount: 0, startedCount: 0 }),
  calculateQuizAnalytics: () =>
    Promise.resolve({
      totalQuizzesCompleted: 0,
      averageScore: 0,
      completionRate: 0,
      averageRetakeFrequency: 0,
      recentAttempts: [],
      topPerforming: [],
      needsImprovement: [],
    }),
  calculateRetakeFrequency: () =>
    Promise.resolve({ averageRetakes: 0, totalAttempts: 0, uniqueQuizzes: 0 }),
  interpretRetakeFrequency: () => 'No retakes yet — each quiz taken once.',
}))

// ── Mock @/db ──
vi.mock('@/db', () => ({
  db: {
    quizAttempts: {
      count: () => Promise.resolve(0),
    },
    studySessions: {
      where: () => ({
        above: () => ({
          toArray: () => Promise.resolve([]),
        }),
      }),
    },
  },
}))

// ── Mock studyLog ──
vi.mock('@/lib/studyLog', () => ({
  getActionsPerDay: () => [],
  getRecentActions: () => [],
  getCurrentStreak: () => 0,
  getLongestStreak: () => 0,
}))

// ── Mock reportStats ──
vi.mock('@/lib/reportStats', () => ({
  getCourseCompletionData: () => [
    { name: 'Test Course', completion: 50, category: 'Behavior Analysis' },
  ],
  getCategoryColorMap: () => ({ 'Behavior Analysis': 'var(--chart-1)' }),
  getCategoryCompletionForRadar: () => [],
  computeSkillsDimensions: () => [],
}))

// ── Mock useSessionStore ──
vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({
    getTotalStudyTime: () => 0,
  }),
}))

// ── Mock child components ──
vi.mock('@/lib/insights', () => ({
  generateStudyInsight: () => 'Test insight message.',
}))

vi.mock('@/app/components/reports/ThisWeekSection', () => ({
  ThisWeekSection: () => <div data-testid="this-week-section">ThisWeekSection</div>,
}))

vi.mock('@/app/components/reports/ReadingSection', () => ({
  ReadingSection: () => <div data-testid="reading-section">ReadingSection</div>,
}))

vi.mock('@/app/components/reports/AIAnalyticsTab', () => ({
  AIAnalyticsTab: () => <div data-testid="ai-analytics-tab">AIAnalyticsTab</div>,
}))

vi.mock('@/app/components/reports/QuizAnalyticsDashboard', () => ({
  QuizAnalyticsDashboard: () => (
    <div data-testid="quiz-analytics-dashboard">QuizAnalyticsDashboard</div>
  ),
}))

vi.mock('@/app/components/reports/CategoryRadar', () => ({
  CategoryRadar: () => <div data-testid="category-radar">CategoryRadar</div>,
}))

vi.mock('@/app/components/reports/SkillsRadar', () => ({
  SkillsRadar: () => <div data-testid="skills-radar">SkillsRadar</div>,
}))

vi.mock('@/app/components/reports/RecentActivityTimeline', () => ({
  RecentActivityTimeline: () => (
    <div data-testid="recent-activity-timeline">RecentActivityTimeline</div>
  ),
}))

// Mock recharts — use importOriginal so chart.tsx namespace access works
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  return {
    ...actual,
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    AreaChart: Passthrough,
    Area: () => null,
    PieChart: Passthrough,
    Pie: () => null,
    Cell: () => null,
    ResponsiveContainer: Passthrough,
  }
})

import Reports from '../Reports'

beforeEach(() => {
  useCourseStore.setState({
    courses: [
      {
        id: 'c1',
        title: 'Test Course',
        shortTitle: 'Test',
        description: 'desc',
        category: 'behavioral-analysis',
        difficulty: 'beginner',
        totalLessons: 3,
        totalVideos: 3,
        totalPDFs: 0,
        estimatedHours: 1,
        tags: [],
        modules: [
          {
            id: 'm1',
            title: 'Module 1',
            description: '',
            order: 1,
            lessons: [
              {
                id: 'l1',
                title: 'Lesson 1',
                description: '',
                order: 1,
                resources: [],
                keyTopics: [],
              },
            ],
          },
        ],
        isSequential: false,
        basePath: '/test',
        authorId: 'i1',
      },
    ],
    isLoaded: true,
  })
})

afterEach(() => {
  useCourseStore.setState({ courses: [], isLoaded: false })
})

describe('Reports page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Reports"', () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('renders stat labels in the hero', () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByText('Lessons')).toBeInTheDocument()
    const coursesElements = screen.getAllByText('Courses')
    expect(coursesElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('Quiz Avg')).toBeInTheDocument()
  })

  it('renders section headers', () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'This Week', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Courses', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Learning Behavior', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reading', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Activity', level: 2 })).toBeInTheDocument()
  })

  it('mounts QuizAnalyticsDashboard when navigating to ?tab=quizzes', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=quizzes']}>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByTestId('quiz-analytics-dashboard')).toBeInTheDocument()
  })

  it('defaults to study tab for unknown ?tab= values', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=unknown']}>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByText('Course Completion')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-analytics-dashboard')).not.toBeInTheDocument()
  })

  it('renders the insight headline', () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    )
    expect(screen.getByText('Test insight message.')).toBeInTheDocument()
  })
})
