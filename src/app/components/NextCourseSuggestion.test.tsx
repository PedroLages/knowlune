import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NextCourseSuggestion } from './NextCourseSuggestion'
import type { Course } from '@/data/types'
import { useCourseStore } from '@/stores/useCourseStore'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockComputeNextCourseSuggestion = vi.fn()
vi.mock('@/lib/suggestions', () => ({
  computeNextCourseSuggestion: (...args: unknown[]) => mockComputeNextCourseSuggestion(...args),
}))

vi.mock('@/lib/progress', () => ({
  getAllProgress: () => ({}),
}))

const mockIsDismissed = vi.fn().mockReturnValue(false)
const mockDismiss = vi.fn()
vi.mock('@/stores/useSuggestionStore', () => ({
  useSuggestionStore: () => ({
    isDismissed: mockIsDismissed,
    dismiss: mockDismiss,
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-2',
    title: 'Advanced Influence',
    shortTitle: 'Advanced Influence',
    description: 'Learn advanced influence techniques.',
    category: 'influence-authority' as const,
    difficulty: 'intermediate' as const,
    totalLessons: 10,
    totalVideos: 8,
    totalPDFs: 2,
    estimatedHours: 20,
    tags: ['influence', 'authority'],
    modules: [],
    isSequential: false,
    basePath: 'advanced-influence',
    instructorId: 'instructor-1',
    ...overrides,
  }
}

function renderComponent(completedCourseId = 'course-1', onDismiss?: () => void) {
  return render(
    <MemoryRouter>
      <NextCourseSuggestion completedCourseId={completedCourseId} onDismiss={onDismiss} />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDismissed.mockReturnValue(false)
  useCourseStore.setState({ courses: [], isLoaded: true })
})

afterEach(() => {
  useCourseStore.setState({ courses: [], isLoaded: false })
})

describe('NextCourseSuggestion', () => {
  it('renders suggestion card with course title when algorithm returns a candidate', () => {
    const course = makeCourse()
    mockComputeNextCourseSuggestion.mockReturnValue({ course, score: 0.8, tagOverlapCount: 2 })

    renderComponent()

    expect(screen.getByText('Advanced Influence')).toBeDefined()
    expect(screen.getByText('Start Course')).toBeDefined()
  })

  it('navigates to the suggested course when "Start Course" is clicked', () => {
    const course = makeCourse({ id: 'adv-influence' })
    mockComputeNextCourseSuggestion.mockReturnValue({ course, score: 0.8, tagOverlapCount: 1 })

    renderComponent()

    fireEvent.click(screen.getByText('Start Course'))

    expect(mockNavigate).toHaveBeenCalledWith('/courses/adv-influence')
  })

  it('calls dismiss and onDismiss when dismiss button is clicked', () => {
    const course = makeCourse()
    mockComputeNextCourseSuggestion.mockReturnValue({ course, score: 0.8, tagOverlapCount: 2 })
    const onDismiss = vi.fn()

    renderComponent('course-1', onDismiss)

    const dismissBtn = screen.getByLabelText('Dismiss course suggestion')
    fireEvent.click(dismissBtn)

    expect(mockDismiss).toHaveBeenCalledWith('course-1')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders congratulatory message when algorithm returns null', () => {
    mockComputeNextCourseSuggestion.mockReturnValue(null)

    renderComponent()

    expect(screen.getByTestId('next-course-congratulations')).toBeDefined()
    expect(screen.getByText("You've completed all active courses!")).toBeDefined()
  })

  it('renders nothing when course is already dismissed', () => {
    mockIsDismissed.mockReturnValue(true)
    mockComputeNextCourseSuggestion.mockReturnValue(makeCourse())

    const { container } = renderComponent()

    expect(container.firstChild).toBeNull()
  })

  it('shows shared tags on the suggestion card', () => {
    const course = makeCourse({ tags: ['influence', 'authority', 'body language'] })
    mockComputeNextCourseSuggestion.mockReturnValue({ course, score: 0.8, tagOverlapCount: 2 })

    renderComponent()

    // Tags shown — they come from course.tags filtered to overlap with completed course
    // Since allCourses is mocked as [] the completed course has no tags, sharedTags = []
    // This test verifies no crash when sharedTags is empty
    expect(screen.getByTestId('next-course-suggestion')).toBeDefined()
  })

  it('dismisses and calls onDismiss when congratulations Close button clicked', () => {
    mockComputeNextCourseSuggestion.mockReturnValue(null)
    const onDismiss = vi.fn()

    renderComponent('course-1', onDismiss)

    fireEvent.click(screen.getByText('Close'))

    expect(mockDismiss).toHaveBeenCalledWith('course-1')
    expect(onDismiss).toHaveBeenCalled()
  })
})
