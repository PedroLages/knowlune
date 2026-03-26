import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useCourseStore } from '@/stores/useCourseStore'

vi.mock('@/lib/progress', () => ({
  getCoursesInProgress: () => [],
  getCompletedCourses: () => [],
  getNotStartedCourses: (courses: unknown[]) => courses,
}))

vi.mock('@/app/components/ProgressStats', () => ({
  ProgressStats: () => <div data-testid="progress-stats" />,
}))

vi.mock('@/app/components/figma/CourseCard', () => ({
  CourseCard: ({ course }: { course: { title: string } }) => (
    <div data-testid="course-card">{course.title}</div>
  ),
}))

vi.mock('@/app/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}))

import MyClass from '../MyClass'

beforeEach(() => {
  vi.useFakeTimers()
  useCourseStore.setState({
    courses: [
      {
        id: 'c1',
        title: 'Test Course Alpha',
        shortTitle: 'Alpha',
        description: 'First test course',
        category: 'behavioral-analysis',
        difficulty: 'beginner',
        totalLessons: 4,
        totalVideos: 4,
        totalPDFs: 0,
        estimatedHours: 2,
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
              {
                id: 'l2',
                title: 'Lesson 2',
                description: '',
                order: 2,
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
  vi.useRealTimers()
  useCourseStore.setState({ courses: [], isLoaded: false })
})

function renderMyClass() {
  const result = render(
    <MemoryRouter>
      <MyClass />
    </MemoryRouter>
  )
  // Advance past the 500ms loading timer so the real content renders
  act(() => {
    vi.advanceTimersByTime(600)
  })
  return result
}

describe('MyClass page', () => {
  it('renders without crashing', () => {
    renderMyClass()
    expect(screen.getByRole('heading', { name: 'My Courses', level: 1 })).toBeInTheDocument()
  })

  it('displays the page heading "My Courses"', () => {
    renderMyClass()
    expect(screen.getByRole('heading', { name: 'My Courses', level: 1 })).toBeInTheDocument()
  })

  it('renders tab triggers for status, all, category, and difficulty views', () => {
    renderMyClass()
    expect(screen.getByText('By Status')).toBeInTheDocument()
    expect(screen.getByText('All Courses')).toBeInTheDocument()
    expect(screen.getByText('By Category')).toBeInTheDocument()
    expect(screen.getByText('By Difficulty')).toBeInTheDocument()
  })

  it('renders the "Not Started" section when no courses are in progress', () => {
    renderMyClass()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })
})
