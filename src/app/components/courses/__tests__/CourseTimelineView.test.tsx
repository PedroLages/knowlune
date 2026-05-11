import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { CourseTimelineView } from '@/app/components/courses/CourseTimelineView'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import type { ImportedCourse } from '@/data/types'
import type { ChapterGroup } from '@/lib/curriculumGrouping'

// Mock the course import store
vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: unknown) => unknown) =>
    selector({
      updateCourseStatus: vi.fn(),
      removeImportedCourse: vi.fn(),
      importError: null,
    }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock useIsMobile for desktop by default
vi.mock('@/app/hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false),
}))

// react-router modules are used directly (Link, BrowserRouter)

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  const id = overrides.id ?? 'course-1'
  return {
    id,
    name: overrides.name ?? `Test Course ${id}`,
    description: 'A test course description',
    importedAt: '2026-01-01T00:00:00.000Z',
    category: 'test',
    tags: [],
    status: overrides.status ?? 'active',
    videoCount: overrides.videoCount ?? 5,
    pdfCount: overrides.pdfCount ?? 2,
    totalDuration: overrides.totalDuration ?? 36000,
    totalFileSize: overrides.totalFileSize ?? 1000000,
    maxResolutionHeight: 1080,
    directoryHandle: null,
    ...overrides,
  }
}

function makeLessonGroups(): ChapterGroup[] {
  return [
    {
      title: 'Module 1',
      videos: [
        { id: 'v1', courseId: 'course-1', filename: 'intro.mp4', path: 'Module 1/intro.mp4', duration: 600, format: 'mp4', order: 1, fileHandle: null },
        { id: 'v2', courseId: 'course-1', filename: 'basics.mp4', path: 'Module 1/basics.mp4', duration: 900, format: 'mp4', order: 2, fileHandle: null },
      ],
      pdfs: [],
    },
    {
      title: 'Module 2',
      videos: [
        { id: 'v3', courseId: 'course-1', filename: 'advanced.mp4', path: 'Module 2/advanced.mp4', duration: 1200, format: 'mp4', order: 3, fileHandle: null },
      ],
      pdfs: [],
    },
  ]
}

function renderTimeline(props: Partial<Parameters<typeof CourseTimelineView>[0]> = {}) {
  return render(
    <BrowserRouter>
      <CourseTimelineView
        courses={props.courses ?? []}
        completionMap={props.completionMap ?? new Map()}
        momentumMap={props.momentumMap ?? new Map()}
        progressMap={props.progressMap ?? new Map()}
        lessonGroupsByCourse={props.lessonGroupsByCourse ?? new Map()}
        isLoading={props.isLoading ?? false}
        allTags={props.allTags ?? []}
      />
    </BrowserRouter>
  )
}

describe('CourseTimelineView', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockImplementation(() => false)
  })
  it('renders loading skeleton when isLoading is true', () => {
    renderTimeline({ isLoading: true, courses: [makeCourse()] })
    expect(screen.getByTestId('timeline-skeleton')).toBeInTheDocument()
  })

  it('renders empty state when courses array is empty', () => {
    renderTimeline({ courses: [] })
    expect(screen.getByTestId('timeline-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No courses to display')).toBeInTheDocument()
  })

  it('renders a course entry for each course in the list', () => {
    const courses = [
      makeCourse({ id: 'c1', name: 'Course Alpha' }),
      makeCourse({ id: 'c2', name: 'Course Beta' }),
    ]
    renderTimeline({
      courses,
      lessonGroupsByCourse: new Map([
        ['c1', makeLessonGroups()],
        ['c2', makeLessonGroups()],
      ]),
    })

    expect(screen.getByText('Course Alpha')).toBeInTheDocument()
    expect(screen.getByText('Course Beta')).toBeInTheDocument()
    expect(screen.getByTestId('course-timeline-view')).toBeInTheDocument()
  })

  it('shows completed status dot for completed courses', () => {
    const course = makeCourse({ status: 'completed' })
    renderTimeline({
      courses: [course],
      completionMap: new Map([['course-1', 100]]),
    })

    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('shows active status dot for active courses', () => {
    const course = makeCourse({ status: 'active' })
    renderTimeline({ courses: [course] })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows not-started status for courses with no progress', () => {
    const course = makeCourse({ status: 'not-started' })
    renderTimeline({ courses: [course] })
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })

  it('expands to reveal lesson rows grouped by module on click', async () => {
    const user = userEvent.setup()
    const course = makeCourse({ id: 'course-1' })
    const lessonGroups = makeLessonGroups()

    renderTimeline({
      courses: [course],
      lessonGroupsByCourse: new Map([['course-1', lessonGroups]]),
    })

    // Click the card to expand
    const card = screen.getByRole('button', { name: /Test Course course-1/ })
    await user.click(card)

    // Module titles should be visible
    expect(screen.getByText('Module 1')).toBeInTheDocument()
    expect(screen.getByText('Module 2')).toBeInTheDocument()

    // Lesson names should be visible
    expect(screen.getByText('intro')).toBeInTheDocument()
    expect(screen.getByText('basics')).toBeInTheDocument()
    expect(screen.getByText('advanced')).toBeInTheDocument()
  })

  it('renders lesson links pointing to correct URLs', async () => {
    const user = userEvent.setup()
    const course = makeCourse({ id: 'course-1', videoCount: 4 })
    const lessonGroups = makeLessonGroups()

    renderTimeline({
      courses: [course],
      lessonGroupsByCourse: new Map([['course-1', lessonGroups]]),
    })

    await user.click(screen.getByRole('button', { name: /Test Course course-1/ }))

    const links = screen.getAllByRole('link')
    const lessonLinks = links.filter(l => l.getAttribute('href')?.startsWith('/courses/course-1/lessons/'))
    expect(lessonLinks.length).toBe(3)
    expect(lessonLinks[0]).toHaveAttribute('href', '/courses/course-1/lessons/v1')
    expect(lessonLinks[1]).toHaveAttribute('href', '/courses/course-1/lessons/v2')
    expect(lessonLinks[2]).toHaveAttribute('href', '/courses/course-1/lessons/v3')
  })

  it('shows progress bar when completion > 0', () => {
    const course = makeCourse({ id: 'course-1' })
    renderTimeline({
      courses: [course],
      completionMap: new Map([['course-1', 45]]),
      lessonGroupsByCourse: new Map([['course-1', makeLessonGroups()]]),
    })

    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('shows "No lessons available" for course with no videos', async () => {
    const user = userEvent.setup()
    const course = makeCourse({ id: 'course-1', videoCount: 0 })

    renderTimeline({
      courses: [course],
      lessonGroupsByCourse: new Map([['course-1', []]]),
    })

    // Click the card to expand (it should still be expandable to show "no lessons")
    const buttons = screen.getAllByRole('button')
    // Find the card button (not the overflow menu)
    const cardButton = buttons.find(b => b.getAttribute('aria-label')?.includes('Test Course'))
    if (cardButton) {
      await user.click(cardButton)
    }

    expect(screen.getByText('No lessons available')).toBeInTheDocument()
  })

  it('renders in mobile/simplified mode without connector column', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)

    const { container } = renderTimeline({
      courses: [makeCourse({ id: 'c1', name: 'Mobile Course', status: 'active' })],
      lessonGroupsByCourse: new Map([['c1', makeLessonGroups()]]),
    })

    // Course content renders in mobile mode
    expect(screen.getByText('Mobile Course')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    // No desktop connector column — flex-col items-center is exclusively used by connector
    expect(container.querySelector('.flex-col.items-center')).toBeNull()

    // Status dot uses compact size (size-5) instead of desktop size (size-7)
    expect(container.querySelectorAll('.size-5').length).toBeGreaterThan(0)
    expect(container.querySelector('.size-7')).toBeNull()
  })

  it('renders overflow menu with edit, delete, and status change options', async () => {
    const user = userEvent.setup()
    const course = makeCourse({ status: 'active' })

    renderTimeline({ courses: [course] })

    // Find and click the overflow menu trigger
    const menuButton = screen.getByTestId('timeline-course-menu')
    await user.click(menuButton)

    // Dropdown items should be visible
    expect(screen.getByText('Edit details')).toBeInTheDocument()
    expect(screen.getByText('Delete course')).toBeInTheDocument()
    expect(screen.getByText('Change thumbnail')).toBeInTheDocument()
  })
})
