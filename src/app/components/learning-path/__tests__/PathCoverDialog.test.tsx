import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathCoverDialog } from '../PathCoverDialog'
import { toast } from 'sonner'
import { uploadPathCover, deletePathCover } from '@/lib/pathCoverUpload'
import type { LearningPath } from '@/data/types'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/pathCoverUpload', () => ({
  uploadPathCover: vi.fn(),
  deletePathCover: vi.fn(),
}))

const mockUploadPathCover = vi.mocked(uploadPathCover)
const mockDeletePathCover = vi.mocked(deletePathCover)

const mockUpdatePathCover = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        updatePathCover: mockUpdatePathCover,
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({ updatePathCover: mockUpdatePathCover }),
    }
  ),
}))

const testPath: LearningPath = {
  id: 'path-1',
  name: 'My Path',
  description: 'Test',
  isAIGenerated: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function renderDialog(open = true, pathOverrides: Partial<LearningPath> = {}) {
  const onOpenChange = vi.fn()
  const path = { ...testPath, ...pathOverrides }
  render(<PathCoverDialog open={open} onOpenChange={onOpenChange} path={path} />)
  return { onOpenChange, path }
}

describe('PathCoverDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all gradient preset buttons when open', async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Cyan → Blue gradient')).toBeInTheDocument()
    expect(screen.getByLabelText('Rose → Red gradient')).toBeInTheDocument()
  })

  it('sets aria-pressed on the selected preset after click', async () => {
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const cyan = screen.getByLabelText('Cyan → Blue gradient')
    await user.click(cyan)
    expect(cyan).toHaveAttribute('aria-pressed', 'true')
    expect(cyan.className).toMatch(/ring-inset/)
  })

  it('selects last preset (rose-red) and enables Save', async () => {
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const roseRed = screen.getByLabelText('Rose → Red gradient')
    await user.click(roseRed)
    expect(roseRed).toHaveAttribute('aria-pressed', 'true')

    const save = screen.getByRole('button', { name: /save/i })
    expect(save).not.toBeDisabled()
  })

  it('calls updatePathCover with preset when Save after preset selection', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Emerald → Green gradient'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdatePathCover).toHaveBeenCalledWith('path-1', {
        coverImageUrl: undefined,
        coverPreset: 'emerald-green',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('Cover preset updated')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes dialog after successful image upload', async () => {
    const user = userEvent.setup()
    mockUploadPathCover.mockResolvedValue('https://example.com/cover.jpg')
    const { onOpenChange } = renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Upload a file via the hidden input
    const file = new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText('Choose a cover image file')
    await user.upload(fileInput, file)

    // Wait for preview to appear, then click Save
    await waitFor(() => {
      expect(screen.getByAltText('Cover preview')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUploadPathCover).toHaveBeenCalledWith(file, 'path-1')
      expect(mockUpdatePathCover).toHaveBeenCalledWith('path-1', {
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: undefined,
      })
      expect(toast.success).toHaveBeenCalledWith('Cover image updated')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('closes dialog after successful cover removal', async () => {
    const user = userEvent.setup()
    mockDeletePathCover.mockResolvedValue(undefined)
    const { onOpenChange } = renderDialog(true, {
      coverImageUrl: 'https://example.com/old-cover.jpg',
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const removeBtn = screen.getByRole('button', { name: /remove cover/i })
    await user.click(removeBtn)

    await waitFor(() => {
      expect(mockUpdatePathCover).toHaveBeenCalledWith('path-1', {
        coverImageUrl: undefined,
        coverPreset: undefined,
      })
      expect(mockDeletePathCover).toHaveBeenCalledWith('path-1')
      expect(toast.success).toHaveBeenCalledWith('Cover removed')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('disables Save button when path already has the selected preset', async () => {
    const user = userEvent.setup()
    renderDialog(true, { coverPreset: 'cyan-blue' })
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const save = screen.getByRole('button', { name: /save/i })
    expect(save).toBeDisabled()

    // Selecting a different preset should enable Save
    const emerald = screen.getByLabelText('Emerald → Green gradient')
    await user.click(emerald)
    expect(save).not.toBeDisabled()
  })

  it('shows error toast when file exceeds max size', async () => {
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Create a file that exceeds 10 MB
    const largeFile = new File(
      [new ArrayBuffer(11 * 1024 * 1024)],
      'large.jpg',
      { type: 'image/jpeg' }
    )
    const fileInput = screen.getByLabelText('Choose a cover image file')
    await user.upload(fileInput, largeFile)

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('too large')
    )
    // No preview should appear
    expect(screen.queryByAltText('Cover preview')).not.toBeInTheDocument()
  })

  it('does not close dialog when upload fails', async () => {
    const user = userEvent.setup()
    mockUploadPathCover.mockRejectedValue(new Error('Network error'))
    const { onOpenChange } = renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const file = new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText('Choose a cover image file')
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByAltText('Cover preview')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    // Dialog should NOT have been closed on failure
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
