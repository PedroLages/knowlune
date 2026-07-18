import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OverviewDashboardModel } from '@/hooks/useOverviewDashboardModel'
import type { ImportedCourse } from '@/data/types'

const mocks = vi.hoisted(() => ({
  model: null as OverviewDashboardModel | null,
  retry: vi.fn(),
  updateCourseStatus: vi.fn(),
  getLastWatchedLesson: vi.fn(),
  getFirstLesson: vi.fn(),
}))

vi.mock('@/hooks/useOverviewDashboardModel', () => ({
  useOverviewDashboardModel: () => mocks.model,
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (
    selector: (state: { updateCourseStatus: typeof mocks.updateCourseStatus }) => unknown
  ) => selector({ updateCourseStatus: mocks.updateCourseStatus }),
}))

vi.mock('@/lib/progress', () => ({
  getLastWatchedLesson: mocks.getLastWatchedLesson,
  getFirstLesson: mocks.getFirstLesson,
}))

vi.mock('@/app/components/figma/ImportedCourseCard', () => ({
  ImportedCourseCard: ({ course }: { course: ImportedCourse }) => (
    <div data-testid={`imported-course-${course.id}`}>{course.name}</div>
  ),
}))

vi.mock('@/app/components/figma/ImportWizardDialog', () => ({
  ImportWizardDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Import wizard</div> : null,
}))

import { Overview } from '../Overview'

const course: ImportedCourse = {
  id: 'course-1',
  name: 'Decision Science',
  importedAt: '2025-01-01T12:00:00.000Z',
  category: 'Psychology',
  tags: ['thinking'],
  status: 'not-started',
  videoCount: 1,
  pdfCount: 0,
  directoryHandle: null,
}

function readyModel(overrides: Partial<Extract<OverviewDashboardModel, { status: 'ready' }>> = {}) {
  return {
    status: 'ready' as const,
    learnerState: 'early' as const,
    learningFocus: {
      courseId: course.id,
      courseName: course.name,
      courseStatus: course.status,
      category: course.category,
      completionPercent: 0,
      completedItems: 0,
      totalItems: 1,
      variant: 'start' as const,
      lessonId: 'lesson-1',
      lessonTitle: 'Introduction',
      lessonOptions: [{ id: 'lesson-1', title: 'Introduction', type: 'video' as const }],
      lastActivityAt: course.importedAt,
    },
    today: { dueReviews: 0, nextSchedule: null, focusArea: null },
    metrics: {
      studyMinutes: { value: 0, previousValue: 0, deltaPercent: 0 },
      activeDays: { value: 0, previousValue: 0, deltaPercent: 0 },
      currentStreak: 0,
      reviewsDue: 0,
    },
    studyTrend: { sevenDays: [], thirtyDays: [] },
    activeCourses: [],
    heatmap: [],
    recentActivity: [],
    insights: { mastery: [], assessment: null, reading: null },
    library: [{ course, completionPercent: 0 }],
    allTags: course.tags,
    retry: mocks.retry,
    ...overrides,
  }
}

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <Routes>
        <Route path="/overview" element={<Overview />} />
        <Route path="/courses/:courseId/lessons/:lessonId" element={<div>Lesson opened</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  mocks.model = readyModel()
  mocks.retry.mockReset()
  mocks.updateCourseStatus.mockReset().mockResolvedValue(undefined)
  mocks.getLastWatchedLesson.mockReset().mockResolvedValue(null)
  mocks.getFirstLesson.mockReset().mockResolvedValue({
    lessonId: 'lesson-1',
    lessonTitle: 'Introduction',
  })
})

describe('Overview page', () => {
  it('shows one activation experience for a new learner', async () => {
    mocks.model = readyModel({ learnerState: 'new', learningFocus: null, library: [] })
    renderOverview()

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByTestId('overview-new-learner')).toBeInTheDocument()
    expect(screen.queryByTestId('section-pulse')).not.toBeInTheDocument()
    expect(screen.queryByTestId('section-library')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('overview-import-course'))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Import wizard')
  })

  it('leads an early learner with focus, today, truthful KPIs, and library', () => {
    renderOverview()

    expect(screen.getByTestId('overview-learning-focus')).toBeInTheDocument()
    expect(screen.getByTestId('overview-today')).toBeInTheDocument()
    expect(screen.getByTestId('metric-study-minutes')).toHaveTextContent('0')
    expect(screen.getByTestId('imported-course-course-1')).toHaveTextContent('Decision Science')
    expect(screen.queryByTestId('section-progress')).not.toBeInTheDocument()
    expect(screen.queryByTestId('section-consistency')).not.toBeInTheDocument()
  })

  it('marks a new course active and navigates directly to its first lesson', async () => {
    renderOverview()
    fireEvent.click(screen.getByTestId('overview-primary-action'))

    await waitFor(() => {
      expect(mocks.updateCourseStatus).toHaveBeenCalledWith('course-1', 'active')
    })
    expect(await screen.findByText('Lesson opened')).toBeInTheDocument()
  })

  it('persists explicit section customization across reloads', () => {
    const firstRender = renderOverview()
    fireEvent.click(screen.getByTestId('customize-dashboard-toggle'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Library' }))

    expect(screen.queryByTestId('section-library')).not.toBeInTheDocument()
    expect(
      JSON.parse(localStorage.getItem('knowlune-dashboard-preferences-v2') ?? '{}')
    ).toMatchObject({
      version: 2,
      preset: 'custom',
      hidden: ['library'],
    })

    firstRender.unmount()
    renderOverview()
    expect(screen.queryByTestId('section-library')).not.toBeInTheDocument()
  })

  it('renders a visible retry state when dashboard loading fails', () => {
    mocks.model = { status: 'error', error: 'IndexedDB is unavailable', retry: mocks.retry }
    renderOverview()

    expect(screen.getByRole('alert')).toHaveTextContent('IndexedDB is unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.retry).toHaveBeenCalledOnce()
  })
})
