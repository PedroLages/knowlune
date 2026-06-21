import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditPathDialog } from '../EditPathDialog'
import { toast } from 'sonner'
import type { LearningPath } from '@/data/types'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const testPath: LearningPath = {
  id: 'path-1',
  name: 'Web Development',
  description: 'Learn web dev',
  isAIGenerated: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const mockRenamePath = vi.fn().mockResolvedValue(undefined)
const mockUpdateDescription = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        renamePath: mockRenamePath,
        updateDescription: mockUpdateDescription,
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({ renamePath: mockRenamePath, updateDescription: mockUpdateDescription }),
    }
  ),
}))

function renderDialog(open = true) {
  const onOpenChange = vi.fn()
  const result = render(<EditPathDialog open={open} onOpenChange={onOpenChange} path={testPath} />)
  return { onOpenChange, result }
}

describe('EditPathDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with pre-filled title and description', async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('Learn web dev')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderDialog(false)
    expect(screen.queryByDisplayValue('Web Development')).not.toBeInTheDocument()
  })

  it('calls renamePath and updateDescription on save', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })

    // Change title
    const titleInput = screen.getByLabelText('Path title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Path')

    // Change description
    const descInput = screen.getByLabelText('Path description')
    await user.clear(descInput)
    await user.type(descInput, 'Updated description')

    // Click Save
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockRenamePath).toHaveBeenCalledWith('path-1', 'Updated Path')
    })
    expect(mockUpdateDescription).toHaveBeenCalledWith('path-1', 'Updated description')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange with false on Cancel', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables Save button when title is empty', async () => {
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })

    const titleInput = screen.getByLabelText('Path title')
    await user.clear(titleInput)

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
  })

  it('only calls renamePath when description is unchanged', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })

    // Only change title, keep description same
    const titleInput = screen.getByLabelText('Path title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Path')

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockRenamePath).toHaveBeenCalledWith('path-1', 'Updated Path')
    })
    // updateDescription should NOT have been called since description didn't change
    expect(mockUpdateDescription).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error toast when renamePath fails', async () => {
    const user = userEvent.setup()
    mockRenamePath.mockRejectedValueOnce(new Error('Network error'))

    const { onOpenChange } = renderDialog()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Web Development')).toBeInTheDocument()
    })

    // Change title
    const titleInput = screen.getByLabelText('Path title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Path')

    // Save
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockRenamePath).toHaveBeenCalledWith('path-1', 'Updated Path')
    })

    // Verify error toast was shown and dialog did not close
    expect(toast.error).toHaveBeenCalledWith('Failed to update path')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
