import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useCourseStore } from '@/stores/useCourseStore'

// Mock all heavy dependencies before importing the component

vi.mock('@/lib/progress', () => ({
  getCoursesInProgress: () => [],
  getCompletedCourses: () => [],
  getTotalCompletedLessons: () => 0,
  getTotalStudyNotes: () => Promise.resolve(0),
  getRecentActivity: () => [],
  getLast7DaysLessonCompletions: () => [0, 0, 0, 0, 0, 0, 0],
  getWeeklyChange: () => 0,
  getAllProgress: () => ({}),
  getCourseCompletionPercent: () => 0,
}))

vi.mock('@/lib/studyLog', () => ({
  getActionsPerDay: () => [],
}))

vi.mock('@/lib/motion', () => ({
  staggerContainer: {},
  fadeUp: {},
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({
    loadSessionStats: vi.fn(),
    getTotalStudyTime: () => 0,
  }),
}))

// Stub child components that do heavy lifting
vi.mock('@/app/components/AchievementBanner', () => ({
  AchievementBanner: () => <div data-testid="achievement-banner" />,
}))

vi.mock('@/app/components/ContinueLearning', () => ({
  ContinueLearning: () => <div data-testid="continue-learning" />,
}))

vi.mock('@/app/components/RecentActivity', () => ({
  RecentActivity: () => <div data-testid="recent-activity" />,
}))

vi.mock('@/app/components/StatsCard', () => ({
  StatsCard: ({ label }: { label: string }) => <div data-testid="stats-card">{label}</div>,
}))

vi.mock('@/app/components/QuickActions', () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}))

vi.mock('@/app/components/StudyStreakCalendar', () => ({
  StudyStreakCalendar: () => <div data-testid="study-streak" />,
}))

vi.mock('@/app/components/StudyGoalsWidget', () => ({
  StudyGoalsWidget: () => <div data-testid="study-goals" />,
}))

vi.mock('@/app/components/StudyHistoryCalendar', () => ({
  StudyHistoryCalendar: () => <div data-testid="study-history" />,
}))

vi.mock('@/app/components/figma/CourseCard', () => ({
  CourseCard: () => <div data-testid="course-card" />,
}))

vi.mock('@/app/components/charts/ProgressChart', () => ({
  ProgressChart: () => <div data-testid="progress-chart" />,
}))

vi.mock('@/app/components/RecommendedNext', () => ({
  RecommendedNext: () => <div data-testid="recommended-next" />,
  RecommendedNextSkeleton: () => <div data-testid="recommended-next-skeleton" />,
}))

vi.mock('@/app/components/StudyScheduleWidget', () => ({
  StudyScheduleWidget: () => <div data-testid="study-schedule-widget" />,
}))

// Mock motion/react to render children synchronously
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        // Return a simple component that renders children
        const Component = ({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) => {
          const tag = String(prop)
          const safeProps: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(props)) {
            if (['className', 'style', 'id', 'role', 'data-testid'].includes(k)) {
              safeProps[k] = v
            }
          }
          return React.createElement(tag, safeProps, children)
        }
        Component.displayName = `motion.${String(prop)}`
        return Component
      },
    }
  ),
  MotionConfig: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => false,
}))

import { Overview } from '../Overview'

beforeEach(() => {
  useCourseStore.setState({
    courses: [
      {
        id: 'test-course-1',
        title: 'Test Course',
        shortTitle: 'Test',
        description: 'A test course',
        category: 'behavioral-analysis',
        difficulty: 'beginner',
        totalLessons: 5,
        totalVideos: 5,
        totalPDFs: 0,
        estimatedHours: 2,
        tags: [],
        modules: [{ id: 'm1', title: 'Module 1', description: '', order: 1, lessons: [] }],
        isSequential: false,
        basePath: '/test',
        instructorId: 'i1',
      },
    ],
    isLoaded: true,
  })
})

afterEach(() => {
  useCourseStore.setState({ courses: [], isLoaded: false })
})

function renderOverview() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>
  )
}

describe('Overview page', () => {
  it('renders without crashing and includes RecommendedNext', async () => {
    renderOverview()
    expect(await screen.findByTestId('recommended-next')).toBeInTheDocument()
  })

  it('displays the page heading', async () => {
    renderOverview()
    // The loading state shows for 500ms, then the real content appears.
    // Use findByText which waits for the element.
    const heading = await screen.findByText('Your Learning Studio')
    expect(heading).toBeInTheDocument()
  })

  it('renders stats cards section', async () => {
    renderOverview()
    const statsCards = await screen.findAllByTestId('stats-card')
    expect(statsCards.length).toBe(5)
  })

  it('renders the "Your Library" section heading', async () => {
    renderOverview()
    const libraryHeading = await screen.findByText('Your Library')
    expect(libraryHeading).toBeInTheDocument()
  })
})
