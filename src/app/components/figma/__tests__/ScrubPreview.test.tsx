/**
 * ScrubPreview — presentational component tests.
 * Mock useScrubPreview to isolate rendering from frame-extraction logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScrubPreview } from '../ScrubPreview'

// ---- mock useScrubPreview --------------------------------------------------
// vi.mock is hoisted — use vi.hoisted() so mock state is captured correctly.

const { mockRequestFrameAt, mockThumbnailAvailable } = vi.hoisted(() => ({
  mockRequestFrameAt: vi.fn(),
  mockThumbnailAvailable: { value: true },
}))

vi.mock('@/app/hooks/useScrubPreview', () => ({
  useScrubPreview: () => ({
    videoRef: vi.fn(),
    canvasRef: vi.fn(),
    requestFrameAt: mockRequestFrameAt,
    thumbnailAvailable: mockThumbnailAvailable.value,
  }),
}))

// ---- helpers ---------------------------------------------------------------

const defaultProps = {
  src: 'test-video.mp4',
  time: 42,
  x: 200,
  trackWidth: 400,
  duration: 120,
}

function renderPreview(
  overrides: Partial<React.ComponentProps<typeof ScrubPreview>> = {}
) {
  return render(<ScrubPreview {...defaultProps} {...overrides} />)
}

// ---- tests -----------------------------------------------------------------

describe('ScrubPreview', () => {
  beforeEach(() => {
    mockRequestFrameAt.mockClear()
    mockThumbnailAvailable.value = true
  })

  // ---- happy path ----------------------------------------------------------

  it('renders the timestamp at the hovered time', () => {
    renderPreview()
    expect(screen.getByText('0:42')).toBeInTheDocument()
  })

  it('requests a frame for the hovered time', () => {
    renderPreview()
    expect(mockRequestFrameAt).toHaveBeenCalledWith(42)
  })

  it('renders the chapter title when provided', () => {
    renderPreview({ chapterTitle: 'Introduction' })
    expect(screen.getByText('Introduction')).toBeInTheDocument()
  })

  it('does not render chapter title when not provided', () => {
    renderPreview({ chapterTitle: undefined })
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
  })

  // ---- edge case: clamping -------------------------------------------------

  it('clamps left position at track edges', () => {
    // x = 0 → should clamp to halfPreviewWidth (80px)
    const { container, rerender } = render(
      <ScrubPreview {...defaultProps} x={0} trackWidth={400} />
    )
    const el = container.querySelector('[data-testid="scrub-preview"]') as HTMLElement
    expect(el.style.left).toBe('80px')

    // x = trackWidth → should clamp to trackWidth - halfPreviewWidth
    rerender(
      <ScrubPreview {...defaultProps} x={400} trackWidth={400} />
    )
    expect(el.style.left).toBe('320px')
  })

  // ---- error path: thumbnail unavailable -----------------------------------

  it('renders placeholder when thumbnail is unavailable', () => {
    mockThumbnailAvailable.value = false

    renderPreview()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  // ---- a11y -----------------------------------------------------------------

  it('has aria-hidden on the tooltip container', () => {
    renderPreview()
    const el = screen.getByTestId('scrub-preview')
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders hidden offscreen video for frame extraction', () => {
    renderPreview()
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.getAttribute('crossorigin')).toBe('anonymous')
  })
})
