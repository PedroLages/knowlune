import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clampHighlightToolbarStyle,
  HIGHLIGHT_TOOLBAR_SELECTION_GAP_PX,
  HighlightPopover,
} from '../HighlightPopover'

describe('clampHighlightToolbarStyle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clamps left when the toolbar would overflow the right edge', () => {
    vi.stubGlobal('innerWidth', 400)
    vi.stubGlobal('innerHeight', 800)
    const position = { top: 200, left: 350, width: 10, below: false }
    const style = clampHighlightToolbarStyle(position, 300, 48)
    expect(style.left).toBe(400 - 300 - 8)
  })

  it('clamps top below the header reserve', () => {
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    const position = { top: 10, left: 100, width: 10, below: false }
    const style = clampHighlightToolbarStyle(position, 300, 48)
    expect(style.top).toBeGreaterThanOrEqual(56)
  })

  it('places toolbar below the selection with a visible gap when below is true', () => {
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    const position = { top: 300, left: 100, width: 10, below: true }
    const style = clampHighlightToolbarStyle(position, 300, 48)
    expect(style.top).toBe(position.top + HIGHLIGHT_TOOLBAR_SELECTION_GAP_PX)
  })
})

describe('HighlightPopover delete action', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a delete icon when an existing highlight delete handler is provided', () => {
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)

    render(
      <HighlightPopover
        position={{ top: 200, left: 100, width: 200 }}
        onColorSelect={vi.fn()}
        onNote={vi.fn()}
        onFlashcard={vi.fn()}
        onVocabulary={vi.fn()}
        onDeleteHighlight={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId('highlight-delete-button')).toBeInTheDocument()
  })

  it('requires a confirmation click before deleting from the selection toolbar', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    const onDeleteHighlight = vi.fn()

    render(
      <HighlightPopover
        position={{ top: 200, left: 100, width: 200 }}
        onColorSelect={vi.fn()}
        onNote={vi.fn()}
        onFlashcard={vi.fn()}
        onDeleteHighlight={onDeleteHighlight}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByTestId('highlight-delete-button'))
    expect(onDeleteHighlight).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Confirm delete highlight')).toBeInTheDocument()

    await user.click(screen.getByTestId('highlight-delete-button'))
    expect(onDeleteHighlight).toHaveBeenCalledTimes(1)
  })
})
