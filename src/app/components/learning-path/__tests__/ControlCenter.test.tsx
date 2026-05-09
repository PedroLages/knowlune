import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ControlCenter } from '@/app/components/learning-path/ControlCenter'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

// --- Mocks ---

vi.mock('@/app/components/learning-path/PlanMyWeekButton', () => ({
  PlanMyWeekButton: () => <div data-testid="plan-my-week-button" />,
}))

vi.mock('@/app/components/learning-path/PathScheduleList', () => ({
  PathScheduleList: () => <div data-testid="path-schedule-list" />,
}))

vi.mock('@/ai/learningPath/suggestOrder', () => ({
  isOrderSuggestionAvailable: () => true,
}))

vi.mock('@/lib/focusModeEvents', () => ({
  dispatchFocusRequest: vi.fn(),
}))

// --- Helpers ---

function makeEntry(overrides: Partial<LearningPathEntry> = {}): LearningPathEntry {
  return {
    id: `entry-${Math.random()}`,
    pathId: 'path-1',
    courseId: 'course-1',
    courseType: 'catalog',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

function makeCourseInfo(overrides: Partial<PathCourseInfo> = {}): PathCourseInfo {
  return {
    name: 'Test Course',
    type: 'catalog',
    authorName: 'Test Author',
    completionPct: 0,
    ...overrides,
  }
}

function makeProgress(overrides: Partial<PathProgressSummary> = {}): PathProgressSummary {
  return {
    completionPct: 0,
    completedLessons: 0,
    totalLessons: 10,
    completedCourses: 0,
    totalCourses: 5,
    estimatedRemainingHours: 20,
    courseProgress: new Map(),
    ...overrides,
  }
}

const baseProps = {
  pathId: 'path-1',
  pathName: 'Test Path',
  entries: [] as LearningPathEntry[],
  courseInfoMap: new Map<string, PathCourseInfo>(),
  courseNames: {} as Record<string, string>,
  progress: makeProgress(),
  isSuggesting: false,
  onSuggestOrder: vi.fn(),
  onToggleCurriculum: vi.fn(),
  showCurriculum: false,
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// --- Tests ---

describe('ControlCenter', () => {
  it('renders Up Next section when there are upcoming entries', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([['c1', makeCourseInfo({ name: 'Upcoming Course' })]])
    renderWithRouter(
      <ControlCenter {...baseProps} entries={entries} courseInfoMap={infoMap} />
    )
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getByText('Upcoming Course')).toBeInTheDocument()
  })

  it('shows remaining count in Up Next section', () => {
    const entries = [
      makeEntry({ courseId: 'c1' }),
      makeEntry({ courseId: 'c2' }),
    ]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ name: 'Course 1' })],
      ['c2', makeCourseInfo({ name: 'Course 2' })],
    ])
    renderWithRouter(
      <ControlCenter {...baseProps} entries={entries} courseInfoMap={infoMap} />
    )
    expect(screen.getByText('2 remaining')).toBeInTheDocument()
  })

  it('renders commitment selector buttons', () => {
    renderWithRouter(<ControlCenter {...baseProps} />)
    expect(screen.getByText('Casual')).toBeInTheDocument()
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Intense')).toBeInTheDocument()
  })

  it('renders AI course ordering toggle when available', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ControlCenter {...baseProps} entries={[makeEntry(), makeEntry()]} />)
    expect(screen.getByText('AI Course Ordering')).toBeInTheDocument()
    // Open the collapsible to reveal the toggle
    await user.click(screen.getByText('AI Course Ordering'))
    expect(screen.getByLabelText('Toggle AI course ordering')).toBeInTheDocument()
  })

  it('renders study tip section', () => {
    renderWithRouter(<ControlCenter {...baseProps} />)
    // Study tip text should appear (one of the random tips)
    expect(screen.getByText('Study Tip')).toBeInTheDocument()
  })

  it('renders Path Complete state when all courses are done', () => {
    const progress = makeProgress({ completionPct: 100, completedCourses: 5, totalCourses: 5 })
    const entries = [makeEntry({ courseId: 'c1' })]
    renderWithRouter(
      <ControlCenter {...baseProps} entries={entries} progress={progress} />
    )
    expect(screen.getByText('Path Complete!')).toBeInTheDocument()
    expect(screen.getByText('Explore More Paths')).toBeInTheDocument()
  })

  it('renders Start focus session button when not completed', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ControlCenter {...baseProps} />)
    // Open the collapsible to reveal the focus session button
    await user.click(screen.getByText('Focus Session'))
    expect(screen.getByText('Start focus session')).toBeInTheDocument()
  })

  it('does not render Start focus session when path is complete', () => {
    const progress = makeProgress({ completionPct: 100, completedCourses: 5, totalCourses: 5 })
    const entries = [makeEntry({ courseId: 'c1' })]
    renderWithRouter(
      <ControlCenter {...baseProps} entries={entries} progress={progress} />
    )
    expect(screen.queryByText('Start focus session')).not.toBeInTheDocument()
  })

  it('renders PlanMyWeekButton and PathScheduleList', () => {
    renderWithRouter(<ControlCenter {...baseProps} />)
    expect(screen.getByTestId('plan-my-week-button')).toBeInTheDocument()
    expect(screen.getByTestId('path-schedule-list')).toBeInTheDocument()
  })
})
