import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
vi.mock('date-fns', () => ({
  format: (date: Date, _fmt: string) => date.toISOString().slice(0, 10),
}))

// ── Mock courses data ──
vi.mock('@/data/courses', () => ({
  allCourses: [
    {
      id: 'c1',
      title: 'Test Course',
      shortTitle: 'Test',
      description: 'desc',
      category: 'Behavior Analysis',
      difficulty: 'Beginner',
      totalLessons: 3,
      totalVideos: 3,
      totalPDFs: 0,
      estimatedHours: 1,
      tags: [],
      modules: [
        {
          id: 'm1',
          title: 'Module 1',
          lessons: [{ id: 'l1', title: 'Lesson 1', type: 'video' }],
        },
      ],
      isSequential: false,
      basePath: '/test',
      instructorId: 'i1',
    },
  ],
}))

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

// ── Mock studyLog ──
vi.mock('@/lib/studyLog', () => ({
  getActionsPerDay: () => [],
  getRecentActions: () => [],
}))

// ── Mock reportStats ──
vi.mock('@/lib/reportStats', () => ({
  getCourseCompletionData: () => [{ name: 'Test Course', completion: 50, category: 'Behavior Analysis' }],
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
vi.mock('@/app/components/StatsCard', () => ({
  StatsCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid={`stat-${label}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}))

vi.mock('@/app/components/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('@/app/components/StudyTimeAnalytics', () => ({
  __esModule: true,
  default: () => <div data-testid="study-time-analytics">StudyTimeAnalytics</div>,
}))

vi.mock('@/app/components/reports/AIAnalyticsTab', () => ({
  AIAnalyticsTab: () => <div data-testid="ai-analytics-tab">AIAnalyticsTab</div>,
}))

vi.mock('@/app/components/reports/CategoryRadar', () => ({
  CategoryRadar: () => <div data-testid="category-radar">CategoryRadar</div>,
}))

vi.mock('@/app/components/reports/SkillsRadar', () => ({
  SkillsRadar: () => <div data-testid="skills-radar">SkillsRadar</div>,
}))

vi.mock('@/app/components/reports/WeeklyGoalRing', () => ({
  WeeklyGoalRing: () => <div data-testid="weekly-goal-ring">WeeklyGoalRing</div>,
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

describe('Reports page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Reports />)
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Reports"', () => {
    render(<Reports />)
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('renders stat labels', () => {
    render(<Reports />)
    expect(screen.getByText('Lessons Completed')).toBeInTheDocument()
    expect(screen.getByText('Courses In Progress')).toBeInTheDocument()
    expect(screen.getByText('Courses Completed')).toBeInTheDocument()
    expect(screen.getByText('Study Notes')).toBeInTheDocument()
  })

  it('renders chart section headings', () => {
    render(<Reports />)
    expect(screen.getByText('Course Completion')).toBeInTheDocument()
    expect(screen.getByText('Progress by Category')).toBeInTheDocument()
    expect(screen.getByText('Study Activity (Last 30 Days)')).toBeInTheDocument()
  })
})
