import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clampMiniPopoverPosition } from '../highlightMiniPopoverPosition'
import { HighlightMiniPopover } from '../HighlightMiniPopover'
import type { BookHighlight } from '@/data/types'

const baseHighlight: BookHighlight = {
  id: 'hl-1',
  bookId: 'book-1',
  textAnchor: 'Sample passage for the highlight menu.',
  color: 'yellow',
  position: { type: 'cfi', value: 'epubcfi(/6/4)' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const linkedHighlight: BookHighlight = {
  ...baseHighlight,
  flashcardId: 'card-1',
}

describe('clampMiniPopoverPosition', () => {
  const vw = 400
  const vh = 600

  it('clamps left when centered popover would overflow the left edge', () => {
    const pos = clampMiniPopoverPosition(
      { centerX: 40, top: 200, bottom: 220 },
      { width: 200, height: 80 },
      { viewportWidth: vw, viewportHeight: vh, margin: 8, headerReserve: 48, gap: 8 }
    )
    expect(pos.left).toBe(8)
  })

  it('clamps left when centered popover would overflow the right edge', () => {
    const pos = clampMiniPopoverPosition(
      { centerX: 360, top: 200, bottom: 220 },
      { width: 200, height: 80 },
      { viewportWidth: vw, viewportHeight: vh, margin: 8, headerReserve: 48, gap: 8 }
    )
    expect(pos.left).toBe(vw - 200 - 8)
  })

  it('prefers below the highlight when above would sit under the header reserve', () => {
    const pos = clampMiniPopoverPosition(
      { centerX: 200, top: 50, bottom: 65 },
      { width: 200, height: 120 },
      { viewportWidth: vw, viewportHeight: vh, margin: 8, headerReserve: 48, gap: 8 }
    )
    // First tries above: 50 - 8 - 120 < 48 → place below: 65 + 8 = 73
    expect(pos.top).toBeGreaterThanOrEqual(48)
    expect(pos.top + 120 + 8).toBeLessThanOrEqual(vh)
  })

  it('clamps vertically when the popover is taller than the remaining viewport', () => {
    const pos = clampMiniPopoverPosition(
      { centerX: 200, top: 20, bottom: 40 },
      { width: 100, height: 520 },
      { viewportWidth: vw, viewportHeight: vh, margin: 8, headerReserve: 48, gap: 8 }
    )
    expect(pos.top).toBe(48)
    expect(pos.top + 520 + 8).toBeLessThanOrEqual(vh)
  })
})

describe('HighlightMiniPopover (sheet layout)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: typeof query === 'string' && query.includes('639px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses fixed bottom sheet placement on narrow viewports (ignores floating anchor)', () => {
    const anchor = { centerX: 12, top: 12, bottom: 20 }
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={anchor}
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={vi.fn()}
        onViewFlashcard={vi.fn()}
      />
    )
    const root = screen.getByTestId('highlight-mini-popover')
    expect(root).toHaveClass('bottom-0')
    expect(root).toHaveClass('left-0')
    expect(root).toHaveClass('right-0')
  })
})

describe('HighlightMiniPopover (integrated toolbar)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('recolors from the toolbar without opening edit or closing the popover', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={vi.fn()}
        onViewFlashcard={vi.fn()}
      />
    )

    await user.click(screen.getByTestId('mini-popover-color-blue'))

    expect(onUpdate).toHaveBeenCalledWith({ color: 'blue' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByTestId('mini-popover-note-input')).not.toBeInTheDocument()
  })

  it('shows delete as an icon action in the toolbar', () => {
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={vi.fn()}
        onViewFlashcard={vi.fn()}
        onVocabulary={vi.fn()}
      />
    )

    expect(screen.getByTestId('mini-popover-delete')).toBeInTheDocument()
    expect(screen.getByTestId('mini-popover-vocabulary')).toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('trash icon opens delete confirmation; onDelete only runs after confirm', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
        onCreateFlashcard={vi.fn()}
        onViewFlashcard={vi.fn()}
      />
    )

    await user.click(screen.getByTestId('mini-popover-delete'))
    expect(screen.getByText('Delete this highlight?')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('mini-popover-confirm-delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('can open directly in edit mode for note actions', () => {
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        initialMode="edit"
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={vi.fn()}
        onViewFlashcard={vi.fn()}
      />
    )

    expect(screen.getByTestId('mini-popover-note-input')).toBeInTheDocument()
  })

  it('uses the stack icon to view a linked flashcard when one exists', async () => {
    const user = userEvent.setup()
    const onViewFlashcard = vi.fn()
    const onCreateFlashcard = vi.fn()
    render(
      <HighlightMiniPopover
        highlight={linkedHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={onCreateFlashcard}
        onViewFlashcard={onViewFlashcard}
      />
    )

    await user.click(screen.getByTestId('mini-popover-view-flashcard'))

    expect(onViewFlashcard).toHaveBeenCalledTimes(1)
    expect(onCreateFlashcard).not.toHaveBeenCalled()
    expect(screen.getByLabelText('View linked flashcard')).toBeInTheDocument()
  })

  it('uses the stack icon to create a flashcard when no link exists', async () => {
    const user = userEvent.setup()
    const onViewFlashcard = vi.fn()
    const onCreateFlashcard = vi.fn()
    render(
      <HighlightMiniPopover
        highlight={baseHighlight}
        anchor={{ centerX: 200, top: 200, bottom: 220 }}
        onClose={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCreateFlashcard={onCreateFlashcard}
        onViewFlashcard={onViewFlashcard}
      />
    )

    const createButton = screen.getByTestId('mini-popover-create-flashcard')
    expect(createButton).toHaveClass('cursor-pointer')
    expect(screen.getByLabelText('Create flashcard from highlight')).toBeInTheDocument()

    await user.click(createButton)

    expect(onCreateFlashcard).toHaveBeenCalledTimes(1)
    expect(onViewFlashcard).not.toHaveBeenCalled()
  })
})
