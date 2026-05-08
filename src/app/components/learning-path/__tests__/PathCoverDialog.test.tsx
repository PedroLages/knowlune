import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathCoverDialog } from '../PathCoverDialog'
import { toast } from 'sonner'
import type { LearningPath } from '@/data/types'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/pathCoverUpload', () => ({
  uploadPathCover: vi.fn(),
  deletePathCover: vi.fn(),
}))

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
  render(
    <PathCoverDialog open={open} onOpenChange={onOpenChange} path={path} />
  )
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
})
