/**
 * ChapterProgressBar — geometry + hover handlers + ScrubPreview integration.
 * Mock ScrubPreview (tested separately) to isolate the geometry logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChapterProgressBar } from '../ChapterProgressBar'

// ---- mock ScrubPreview -----------------------------------------------------
// Renders minimal markup so we can assert its presence and props indirectly.

vi.mock('../ScrubPreview', () => ({
  ScrubPreview: ({ time, x, chapterTitle, visible }: { time: number; x: number; chapterTitle?: string; visible?: boolean }) => (
    <div data-testid="scrub-preview" data-time={time} data-x={x} data-chapter={chapterTitle ?? ''} data-visible={visible === false ? 'false' : 'true'} />
  ),
}))

// ---- helpers ---------------------------------------------------------------

const defaultProps = {
  progress: 50,
  duration: 120,
  src: 'test-video.mp4',
  onSeek: vi.fn(),
}

function renderBar(
  overrides: Partial<React.ComponentProps<typeof ChapterProgressBar>> = {}
) {
  return render(<ChapterProgressBar {...defaultProps} {...overrides} />)
}

/** Stub getBoundingClientRect for the track wrapper (ref is on the outer div). */
function stubTrackRect(width = 400, left = 0): () => void {
  const orig = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    // Only stub the track wrapper — check for the progress-bar class pattern
    if (this.classList.contains('group\\/progress') || this.className.includes('group/progress')) {
      return { left, right: left + width, width, top: 0, bottom: 20, height: 20, x: left, y: 0 } as DOMRect
    }
    return orig.call(this)
  })
  return () => {
    Element.prototype.getBoundingClientRect = orig
  }
}

// ---- tests -----------------------------------------------------------------

describe('ChapterProgressBar', () => {
  beforeEach(() => {
    defaultProps.onSeek = vi.fn()
  })

  // ---- happy path ----------------------------------------------------------

  it('shows scrub preview on mouse move at track midpoint', () => {
    const restore = stubTrackRect(400, 0)
    renderBar()

    const wrapper = document.querySelector('[class*="group/progress"]')!
    fireEvent.mouseMove(wrapper, { clientX: 200 }) // midpoint of 400px track

    const preview = screen.getByTestId('scrub-preview')
    expect(preview).toBeInTheDocument()
    // time ≈ duration/2 = 60
    expect(Number(preview.dataset.time)).toBeCloseTo(60, 0)
    expect(Number(preview.dataset.x)).toBe(200)

    restore()
  })

  it('passes chapter title to scrub preview', () => {
    const restore = stubTrackRect(400, 0)
    const chapters = [
      { time: 0, title: 'Intro' },
      { time: 30, title: 'Main' },
      { time: 90, title: 'Outro' },
    ]
    renderBar({ chapters })

    const wrapper = document.querySelector('[class*="group/progress"]')!
    // Hover at time=60s — should show "Main"
    fireEvent.mouseMove(wrapper, { clientX: 200 })

    const preview = screen.getByTestId('scrub-preview')
    expect(preview.dataset.chapter).toBe('Main')

    restore()
  })

  // ---- edge case: zero duration --------------------------------------------

  it('does not show preview when duration is 0', () => {
    const restore = stubTrackRect(400, 0)
    renderBar({ duration: 0 })

    const wrapper = document.querySelector('[class*="group/progress"]')!
    fireEvent.mouseMove(wrapper, { clientX: 200 })

    expect(screen.queryByTestId('scrub-preview')).not.toBeInTheDocument()

    restore()
  })

  // ---- edge case: clamp at edges -------------------------------------------

  it('clamps time to duration when mouse is past the right edge', () => {
    const restore = stubTrackRect(400, 0)
    renderBar({ duration: 120 })

    const wrapper = document.querySelector('[class*="group/progress"]')!
    fireEvent.mouseMove(wrapper, { clientX: 500 }) // past right edge

    const preview = screen.getByTestId('scrub-preview')
    expect(Number(preview.dataset.time)).toBeCloseTo(120, 0)

    restore()
  })

  // ---- interaction: mouse leave --------------------------------------------

  it('sets visible=false on mouse leave (preview stays mounted for warm video)', () => {
    const restore = stubTrackRect(400, 0)
    renderBar()

    const wrapper = document.querySelector('[class*="group/progress"]')!
    fireEvent.mouseMove(wrapper, { clientX: 200 })
    const previewOn = screen.getByTestId('scrub-preview')
    expect(previewOn).toBeInTheDocument()
    expect(previewOn.dataset.visible).toBe('true')

    fireEvent.mouseLeave(wrapper)
    // Preview stays in the DOM (offscreen video kept warm) but with visible=false
    const previewOff = screen.getByTestId('scrub-preview')
    expect(previewOff).toBeInTheDocument()
    expect(previewOff.dataset.visible).toBe('false')

    restore()
  })

  // ---- regression: seek still works ----------------------------------------

  it('calls onSeek when range input changes (regression check)', () => {
    const onSeek = vi.fn()
    renderBar({ onSeek })

    const input = screen.getByLabelText('Video progress')
    fireEvent.change(input, { target: { value: '75' } })
    expect(onSeek).toHaveBeenCalledWith(75)
  })

  // ---- buffered bar (Unit 5) -----------------------------------------------

  it('renders buffered range bars', () => {
    renderBar({
      buffered: [{ start: 0, end: 60 }],
      duration: 120,
    })

    const bars = screen.getAllByTestId('buffered-range')
    expect(bars).toHaveLength(1)
    expect(bars[0].style.width).toBe('50%')
  })

  it('renders multiple buffered ranges', () => {
    renderBar({
      buffered: [
        { start: 0, end: 30 },
        { start: 60, end: 90 },
      ],
      duration: 120,
    })

    expect(screen.getAllByTestId('buffered-range')).toHaveLength(2)
  })

  it('does not render buffered bars when duration is 0', () => {
    renderBar({
      buffered: [{ start: 0, end: 60 }],
      duration: 0,
    })

    expect(screen.queryByTestId('buffered-range')).not.toBeInTheDocument()
  })

  it('does not render buffered bars when buffered is undefined', () => {
    renderBar({ buffered: undefined, duration: 120 })
    expect(screen.queryByTestId('buffered-range')).not.toBeInTheDocument()
  })
})
