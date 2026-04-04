import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// ---------------------------------------------------------------------------
// Mocks (before imports)
// ---------------------------------------------------------------------------

const mockEstimateThumbnailCacheSize = vi.fn()
const mockEstimateOrphanedEmbeddingsSize = vi.fn()
const mockClearThumbnailCache = vi.fn()
const mockRemoveOrphanedEmbeddings = vi.fn()
const mockDeleteCourseDataWithCount = vi.fn()

vi.mock('@/lib/storageEstimate', () => ({
  estimateThumbnailCacheSize: (...args: unknown[]) => mockEstimateThumbnailCacheSize(...args),
  estimateOrphanedEmbeddingsSize: (...args: unknown[]) =>
    mockEstimateOrphanedEmbeddingsSize(...args),
  clearThumbnailCache: (...args: unknown[]) => mockClearThumbnailCache(...args),
  removeOrphanedEmbeddings: (...args: unknown[]) => mockRemoveOrphanedEmbeddings(...args),
  deleteCourseDataWithCount: (...args: unknown[]) => mockDeleteCourseDataWithCount(...args),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockDbImportedCoursesToArray = vi.fn()
vi.mock('@/db', () => ({
  db: {
    importedCourses: { toArray: (...args: unknown[]) => mockDbImportedCoursesToArray(...args) },
  },
}))

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import { CleanupActionsSection } from '../CleanupActionsSection'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockOnRefresh = vi.fn()

function renderComponent() {
  return render(<CleanupActionsSection onRefresh={mockOnRefresh} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: nothing estimated, no courses
  mockEstimateThumbnailCacheSize.mockResolvedValue(0)
  mockEstimateOrphanedEmbeddingsSize.mockResolvedValue({ count: 0, bytes: 0 })
  mockDbImportedCoursesToArray.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CleanupActionsSection', () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders all three cleanup action cards', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Clear Thumbnail Cache')).toBeInTheDocument()
    })
    expect(screen.getByText('Remove Unused AI Search Data')).toBeInTheDocument()
    expect(screen.getByText('Delete Course Data')).toBeInTheDocument()
  })

  it('renders with id="cleanup-actions" for scroll anchor', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Clear Thumbnail Cache')).toBeInTheDocument()
    })

    expect(document.getElementById('cleanup-actions')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Clear Thumbnail Cache — confirmation flow
  // -------------------------------------------------------------------------

  it('shows AlertDialog when Clear Cache button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear cache/i }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/clear thumbnail cache\?/i)).toBeInTheDocument()
  })

  it('cancels Clear Cache dialog without calling clearThumbnailCache', async () => {
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear cache/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockClearThumbnailCache).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('calls clearThumbnailCache and shows success toast on confirm', async () => {
    mockClearThumbnailCache.mockResolvedValue({ bytesFreed: 1_048_576 })
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear cache/i }))
    // Confirm via AlertDialogAction (the "Clear Cache" button inside the dialog)
    const confirmButton = screen
      .getByRole('alertdialog')
      .querySelector('[data-slot="alert-dialog-action"]')
    if (confirmButton) {
      await user.click(confirmButton)
    } else {
      // Fallback: find button inside alertdialog
      const dialogButtons = screen.getByRole('alertdialog').querySelectorAll('button')
      const confirmBtn = Array.from(dialogButtons).find(
        btn => btn.textContent?.toLowerCase().includes('clear')
      )
      if (confirmBtn) await user.click(confirmBtn)
    }

    await waitFor(() => {
      expect(mockClearThumbnailCache).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith(expect.stringContaining('thumbnail cache'))
    })
    expect(mockOnRefresh).toHaveBeenCalled()
  })

  it('shows error toast when clearThumbnailCache throws', async () => {
    mockClearThumbnailCache.mockRejectedValue(new Error('disk full'))
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear cache/i }))
    const dialogButtons = screen.getByRole('alertdialog').querySelectorAll('button')
    const confirmBtn = Array.from(dialogButtons).find(
      btn => btn.textContent?.toLowerCase().includes('clear')
    )
    if (confirmBtn) await user.click(confirmBtn)

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith(expect.stringContaining('thumbnail cache'))
    })
  })

  // -------------------------------------------------------------------------
  // Remove Orphaned Embeddings — confirmation flow
  // -------------------------------------------------------------------------

  it('shows AlertDialog when Remove Orphaned button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove orphaned/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /remove orphaned/i }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/remove orphaned embeddings\?/i)).toBeInTheDocument()
  })

  it('cancels Remove Orphaned dialog without calling removeOrphanedEmbeddings', async () => {
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove orphaned/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /remove orphaned/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockRemoveOrphanedEmbeddings).not.toHaveBeenCalled()
  })

  it('calls removeOrphanedEmbeddings and shows success toast on confirm', async () => {
    mockEstimateOrphanedEmbeddingsSize.mockResolvedValue({ count: 3, bytes: 512_000 })
    mockRemoveOrphanedEmbeddings.mockResolvedValue({ count: 3, bytesFreed: 512_000 })
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove orphaned/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /remove orphaned/i }))
    const dialogButtons = screen.getByRole('alertdialog').querySelectorAll('button')
    const confirmBtn = Array.from(dialogButtons).find(btn =>
      btn.textContent?.toLowerCase().includes('remove')
    )
    if (confirmBtn) await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockRemoveOrphanedEmbeddings).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith(
        expect.stringContaining('orphaned embeddings')
      )
    })
    expect(mockOnRefresh).toHaveBeenCalled()
  })

  it('shows error toast when removeOrphanedEmbeddings throws', async () => {
    mockRemoveOrphanedEmbeddings.mockRejectedValue(new Error('write error'))
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove orphaned/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /remove orphaned/i }))
    const dialogButtons = screen.getByRole('alertdialog').querySelectorAll('button')
    const confirmBtn = Array.from(dialogButtons).find(btn =>
      btn.textContent?.toLowerCase().includes('remove')
    )
    if (confirmBtn) await user.click(confirmBtn)

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith(
        expect.stringContaining('orphaned embeddings')
      )
    })
  })

  // -------------------------------------------------------------------------
  // Delete Course Data — dialog with course list
  // -------------------------------------------------------------------------

  it('opens Delete Course Data dialog and shows "No imported courses" when empty', async () => {
    mockDbImportedCoursesToArray.mockResolvedValue([])
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select courses/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /select courses/i }))

    await waitFor(() => {
      expect(screen.getByText(/no imported courses found/i)).toBeInTheDocument()
    })
  })

  it('lists courses in Delete Course Data dialog', async () => {
    mockDbImportedCoursesToArray.mockResolvedValue([
      { id: 'c1', name: 'Course Alpha' },
      { id: 'c2', name: 'Course Beta' },
    ])
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select courses/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /select courses/i }))

    await waitFor(() => {
      expect(screen.getByText('Course Alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('Course Beta')).toBeInTheDocument()
  })

  it('calls deleteCourseDataWithCount and shows success toast for selected courses', async () => {
    mockDbImportedCoursesToArray.mockResolvedValue([{ id: 'c1', name: 'Course Alpha' }])
    mockDeleteCourseDataWithCount.mockResolvedValue({ count: 1, bytesFreed: 200_000 })
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select courses/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /select courses/i }))

    await waitFor(() => {
      expect(screen.getByText('Course Alpha')).toBeInTheDocument()
    })

    // Select the course via checkbox label
    await user.click(screen.getByText('Course Alpha'))

    // Delete button should now be enabled
    const deleteBtn = screen.getByRole('button', { name: /delete selected/i })
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(mockDeleteCourseDataWithCount).toHaveBeenCalledWith(['c1'])
    })
    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith(expect.stringContaining('course'))
    })
    expect(mockOnRefresh).toHaveBeenCalled()
  })

  it('shows error toast when deleteCourseDataWithCount throws', async () => {
    mockDbImportedCoursesToArray.mockResolvedValue([{ id: 'c1', name: 'Course Alpha' }])
    mockDeleteCourseDataWithCount.mockRejectedValue(new Error('delete failed'))
    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select courses/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /select courses/i }))

    await waitFor(() => {
      expect(screen.getByText('Course Alpha')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Course Alpha'))
    await user.click(screen.getByRole('button', { name: /delete selected/i }))

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith(
        expect.stringContaining('course data')
      )
    })
  })
})
