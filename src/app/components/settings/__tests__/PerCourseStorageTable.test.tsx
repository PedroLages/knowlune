import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CourseStorageEntry } from '@/lib/storageEstimate'

// ---------------------------------------------------------------------------
// Mocks (before imports)
// ---------------------------------------------------------------------------

const mockClearCourseThumbnail = vi.fn()
const mockDeleteCourseData = vi.fn()

vi.mock('@/lib/storageEstimate', () => ({
  clearCourseThumbnail: (...args: unknown[]) => mockClearCourseThumbnail(...args),
  deleteCourseData: (...args: unknown[]) => mockDeleteCourseData(...args),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import { PerCourseStorageTable } from '../PerCourseStorageTable'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(overrides: Partial<CourseStorageEntry> = {}): CourseStorageEntry {
  return {
    courseId: 'course-1',
    courseName: 'Introduction to React',
    totalBytes: 52_428_800, // 50 MB
    mediaBytes: 41_943_040, // 40 MB
    notesBytes: 5_242_880, // 5 MB
    thumbnailBytes: 5_242_880, // 5 MB
    ...overrides,
  }
}

function makeCourses(count: number): CourseStorageEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeCourse({
      courseId: `course-${i + 1}`,
      courseName: `Course ${i + 1}`,
      totalBytes: (count - i) * 1_000_000, // descending sizes
      mediaBytes: (count - i) * 800_000,
      notesBytes: (count - i) * 100_000,
      thumbnailBytes: (count - i) * 100_000,
    })
  )
}

const mockOnRefresh = vi.fn()

function renderTable(courses: CourseStorageEntry[] = [makeCourse()]) {
  return render(<PerCourseStorageTable courses={courses} onRefresh={mockOnRefresh} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PerCourseStorageTable', () => {
  // -------------------------------------------------------------------------
  // AC1: Renders sortable table with course data
  // -------------------------------------------------------------------------

  it('renders table with course name, total size, media, notes, thumbnails columns', () => {
    renderTable()

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Course Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sort by total size/i })).toBeInTheDocument()
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Thumbnails')).toBeInTheDocument()
  })

  it('renders course name and size values in table rows', () => {
    renderTable([makeCourse({ courseName: 'Introduction to React', totalBytes: 52_428_800 })])

    expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    // ~50 MB formatted
    expect(screen.getByText(/~50 MB/)).toBeInTheDocument()
  })

  it('renders table caption for accessibility', () => {
    renderTable()

    expect(screen.getByText(/storage usage per course/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC2: Sort cycling — desc → asc → default (desc)
  // -------------------------------------------------------------------------

  it('clicking Total Size header cycles sort: default (desc) → asc → desc', async () => {
    const courses = makeCourses(3)
    const user = userEvent.setup()
    renderTable(courses)

    const sortBtn = screen.getByRole('button', { name: /sort by total size/i })
    const th = sortBtn.closest('th')!

    // Initial state — default (descending)
    expect(th).toHaveAttribute('aria-sort', 'descending')

    // First click → ascending
    await user.click(sortBtn)
    expect(th).toHaveAttribute('aria-sort', 'ascending')

    // Second click → back to descending
    await user.click(sortBtn)
    expect(th).toHaveAttribute('aria-sort', 'descending')
  })

  it('ascending sort shows smallest course first', async () => {
    const courses = [
      makeCourse({ courseId: 'big', courseName: 'Big Course', totalBytes: 50_000_000 }),
      makeCourse({ courseId: 'small', courseName: 'Small Course', totalBytes: 1_000_000 }),
    ]
    const user = userEvent.setup()
    renderTable(courses)

    // Default is descending — Big Course first
    const rowsBefore = screen.getAllByRole('row').slice(1) // skip header
    expect(rowsBefore[0]).toHaveTextContent('Big Course')

    // Click once to sort ascending
    await user.click(screen.getByRole('button', { name: /sort by total size/i }))

    const rowsAfter = screen.getAllByRole('row').slice(1)
    expect(rowsAfter[0]).toHaveTextContent('Small Course')
  })

  // -------------------------------------------------------------------------
  // AC3: "Show more" pagination
  // -------------------------------------------------------------------------

  it('shows first 10 rows by default when more than 10 courses', () => {
    renderTable(makeCourses(15))

    const dataRows = screen.getAllByRole('row').slice(1) // skip header
    expect(dataRows).toHaveLength(10)
  })

  it('renders Show more button when there are more than 10 courses', () => {
    renderTable(makeCourses(15))

    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    expect(screen.getByText(/5 remaining/)).toBeInTheDocument()
  })

  it('clicking Show more reveals additional rows', async () => {
    const user = userEvent.setup()
    renderTable(makeCourses(15))

    await user.click(screen.getByRole('button', { name: /show more/i }))

    const dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows).toHaveLength(15)
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })

  it('does not show Show more button when 10 or fewer courses', () => {
    renderTable(makeCourses(10))

    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC4: Row dropdown menu items
  // -------------------------------------------------------------------------

  it('dropdown menu contains Clear thumbnails and Delete course data options', async () => {
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))

    await waitFor(() => {
      expect(screen.getByText('Clear thumbnails')).toBeInTheDocument()
      expect(screen.getByText('Delete course data')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC5: AlertDialog for destructive actions
  // -------------------------------------------------------------------------

  it('clicking Clear thumbnails opens confirmation dialog', async () => {
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Clear thumbnails')).toBeInTheDocument())
    await user.click(screen.getByText('Clear thumbnails'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText(/clear thumbnail\?/i)).toBeInTheDocument()
    })
  })

  it('clicking Delete course data opens confirmation dialog', async () => {
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Delete course data')).toBeInTheDocument())
    await user.click(screen.getByText('Delete course data'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText(/delete course data\?/i)).toBeInTheDocument()
    })
  })

  it('dialog shows course name in description', async () => {
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'Advanced TypeScript' })])

    await user.click(screen.getByRole('button', { name: /actions for advanced typescript/i }))
    await waitFor(() => expect(screen.getByText('Clear thumbnails')).toBeInTheDocument())
    await user.click(screen.getByText('Clear thumbnails'))

    await waitFor(() => {
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText(/advanced typescript/i)).toBeInTheDocument()
    })
  })

  it('canceling dialog closes it without calling the action', async () => {
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Clear thumbnails')).toBeInTheDocument())
    await user.click(screen.getByText('Clear thumbnails'))

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockClearCourseThumbnail).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC6: Toast notification after successful action
  // -------------------------------------------------------------------------

  it('shows success toast after confirming Clear thumbnails', async () => {
    mockClearCourseThumbnail.mockResolvedValue(5_242_880)
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Clear thumbnails')).toBeInTheDocument())
    await user.click(screen.getByText('Clear thumbnails'))

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /clear thumbnail/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/cleared thumbnail/i))
    })
    expect(mockOnRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows success toast after confirming Delete course data', async () => {
    mockDeleteCourseData.mockResolvedValue(52_428_800)
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Delete course data')).toBeInTheDocument())
    await user.click(screen.getByText('Delete course data'))

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete course data/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/deleted course data/i))
    })
    expect(mockOnRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows error toast when Clear thumbnails fails', async () => {
    mockClearCourseThumbnail.mockRejectedValue(new Error('IDB error'))
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Clear thumbnails')).toBeInTheDocument())
    await user.click(screen.getByText('Clear thumbnails'))

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /clear thumbnail/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/failed to clear thumbnail/i))
    })
    expect(mockOnRefresh).not.toHaveBeenCalled()
  })

  it('shows error toast when Delete course data fails', async () => {
    mockDeleteCourseData.mockRejectedValue(new Error('IDB error'))
    const user = userEvent.setup()
    renderTable([makeCourse({ courseName: 'My Course' })])

    await user.click(screen.getByRole('button', { name: /actions for my course/i }))
    await waitFor(() => expect(screen.getByText('Delete course data')).toBeInTheDocument())
    await user.click(screen.getByText('Delete course data'))

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete course data/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/failed to delete course data/i)
      )
    })
  })

  // -------------------------------------------------------------------------
  // AC7: Empty state
  // -------------------------------------------------------------------------

  it('shows empty state message when no courses provided', () => {
    renderTable([])

    expect(screen.getByText(/no courses imported yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('empty state has correct data-testid', () => {
    renderTable([])

    expect(screen.getByTestId('per-course-table-empty')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC8: Mobile responsive — media/notes/thumbnails columns hidden below 640px
  // -------------------------------------------------------------------------

  it('Media, Notes, Thumbnails headers have hidden sm:table-cell classes for mobile responsiveness', () => {
    renderTable()

    const headers = screen.getAllByRole('columnheader')
    const mediaHeader = headers.find(h => h.textContent === 'Media')
    const notesHeader = headers.find(h => h.textContent === 'Notes')
    const thumbsHeader = headers.find(h => h.textContent === 'Thumbnails')

    expect(mediaHeader).toHaveClass('hidden')
    expect(notesHeader).toHaveClass('hidden')
    expect(thumbsHeader).toHaveClass('hidden')
  })
})
