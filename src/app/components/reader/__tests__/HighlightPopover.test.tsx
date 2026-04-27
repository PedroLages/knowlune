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

  it('right-side action icons are clickable and show pointer cursor styling', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    const onNote = vi.fn()
    const onFlashcard = vi.fn()
    const onVocabulary = vi.fn()
    const onClose = vi.fn()

    render(
      <HighlightPopover
        position={{ top: 200, left: 100, width: 200 }}
        onColorSelect={vi.fn()}
        onNote={onNote}
        onFlashcard={onFlashcard}
        onVocabulary={onVocabulary}
        onClose={onClose}
      />
    )

    const note = screen.getByTestId('highlight-note-button')
    const flashcard = screen.getByTestId('highlight-flashcard-button')
    const vocabulary = screen.getByTestId('highlight-vocabulary-button')
    const close = screen.getByTestId('highlight-close-button')

    expect(note).toHaveClass('cursor-pointer')
    expect(flashcard).toHaveClass('cursor-pointer')
    expect(vocabulary).toHaveClass('cursor-pointer')
    expect(close).toHaveClass('cursor-pointer')

    await user.click(note)
    await user.click(flashcard)
    await user.click(vocabulary)
    await user.click(close)

    expect(onNote).toHaveBeenCalledTimes(1)
    expect(onFlashcard).toHaveBeenCalledTimes(1)
    expect(onVocabulary).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
