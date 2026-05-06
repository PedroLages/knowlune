import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ImportedCourseListRow } from '../ImportedCourseListRow'
import type { ImportedCourse } from '@/data/types'

const mockUpdateCourseStatus = vi.fn()
const mockRemoveImportedCourse = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn()
const mockOnToggleSelect = vi.fn()
let mockImportError: string | null = null

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        updateCourseStatus: mockUpdateCourseStatus,
        removeImportedCourse: mockRemoveImportedCourse,
        thumbnailUrls: {},
      }),
    {
      getState: () => ({ importError: mockImportError }),
    }
  ),
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authors: [],
      loadAuthors: vi.fn(),
    }),
}))

// EditCourseDialog has heavy dependencies; render a no-op shell.
vi.mock('@/app/components/figma/EditCourseDialog', () => ({
  EditCourseDialog: () => null,
}))

const baseCourse: ImportedCourse = {
  id: 'course-1',
  name: 'Test Course Title',
  importedAt: '2026-01-15T00:00:00.000Z',
  category: 'Development',
  tags: ['react', 'typescript', 'testing', 'a11y'],
  status: 'active',
  videoCount: 5,
  pdfCount: 2,
  directoryHandle: null,
  totalDuration: 3600,
}

function renderRow(overrides: Partial<Parameters<typeof ImportedCourseListRow>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ImportedCourseListRow
        course={baseCourse}
        allTags={['react', 'typescript']}
        completionPercent={42}
        {...overrides}
      />
    </MemoryRouter>
  )
}

describe('ImportedCourseListRow', () => {
  beforeEach(() => {
    mockUpdateCourseStatus.mockClear()
    mockRemoveImportedCourse.mockClear()
    mockNavigate.mockClear()
    mockImportError = null
  })

  it('renders title, author fallback, and status badge', () => {
    renderRow()
    expect(screen.getByTestId('course-list-row-title')).toHaveTextContent('Test Course Title')
    expect(screen.getByTestId('course-list-row-author')).toHaveTextContent('Unknown Author')
    expect(screen.getByTestId('course-list-row-status')).toBeInTheDocument()
  })

  it('renders progress bar when completionPercent > 0', () => {
    renderRow({ completionPercent: 42 })
    const bar = screen.getByTestId('course-list-row-progress')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '42')
  })

  it('omits progress bar when completionPercent is 0', () => {
    renderRow({ completionPercent: 0 })
    expect(screen.queryByTestId('course-list-row-progress')).not.toBeInTheDocument()
  })

  it('falls back to FolderOpen icon when no thumbnail URL', () => {
    renderRow()
    const thumb = screen.getByTestId('course-list-row-thumbnail')
    expect(thumb.querySelector('img')).toBeNull()
    expect(thumb.querySelector('svg')).not.toBeNull()
  })

  it('clicking the row navigates to course detail', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByTestId('imported-course-list-row'))
    expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/overview')
  })

  it('pressing Enter on focused row navigates to course detail', async () => {
    const user = userEvent.setup()
    renderRow()
    const row = screen.getByTestId('imported-course-list-row')
    row.focus()
    await user.keyboard('{Enter}')
    expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/overview')
  })

  it('pressing Space on focused row navigates to course detail', async () => {
    const user = userEvent.setup()
    renderRow()
    const row = screen.getByTestId('imported-course-list-row')
    row.focus()
    await user.keyboard(' ')
    expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/overview')
  })

  it('clicking the overflow trigger does not navigate', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByTestId('course-list-row-overflow-trigger'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('ImportedCourseListRow — selection mode (onToggleSelect)', () => {
  beforeEach(() => {
    mockOnToggleSelect.mockClear()
  })

  it('renders a checkbox when onToggleSelect is provided', () => {
    render(<ImportedCourseListRow course={baseCourse} allTags={[]} selected={false} onToggleSelect={mockOnToggleSelect} />, { wrapper: MemoryRouter })
    const checkbox = screen.getByRole('checkbox', { name: /Select Test Course Title/i })
    expect(checkbox).toBeInTheDocument()
  })

  it('does not render a checkbox when onToggleSelect is undefined', () => {
    renderRow()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('checkbox click calls onToggleSelect with the course ID', async () => {
    const user = userEvent.setup()
    render(<ImportedCourseListRow course={baseCourse} allTags={[]} selected={false} onToggleSelect={mockOnToggleSelect} />, { wrapper: MemoryRouter })
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    expect(mockOnToggleSelect).toHaveBeenCalledWith('course-1')
  })

  it('checkbox click does not trigger row navigation', async () => {
    const user = userEvent.setup()
    render(<ImportedCourseListRow course={baseCourse} allTags={[]} selected={false} onToggleSelect={mockOnToggleSelect} />, { wrapper: MemoryRouter })
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('renders checked checkbox when selected=true', () => {
    render(<ImportedCourseListRow course={baseCourse} allTags={[]} selected={true} onToggleSelect={mockOnToggleSelect} />, { wrapper: MemoryRouter })
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('data-state', 'checked')
  })

  it('renders unchecked checkbox when selected=false', () => {
    render(<ImportedCourseListRow course={baseCourse} allTags={[]} selected={false} onToggleSelect={mockOnToggleSelect} />, { wrapper: MemoryRouter })
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('data-state', 'unchecked')
  })
})
