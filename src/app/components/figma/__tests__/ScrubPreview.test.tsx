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

function renderPreview(overrides: Partial<React.ComponentProps<typeof ScrubPreview>> = {}) {
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
    rerender(<ScrubPreview {...defaultProps} x={400} trackWidth={400} />)
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
    // With the conditional crossOrigin logic, a relative URL like 'test-video.mp4'
    // is treated as same-origin, so crossOrigin should be omitted.
    expect(video?.hasAttribute('crossorigin')).toBe(false)
  })

  it('sets crossOrigin="anonymous" for blob URLs', () => {
    render(
      <ScrubPreview {...defaultProps} src="blob:http://localhost/some-uuid" />
    )
    const video = document.querySelector('video')
    expect(video?.getAttribute('crossorigin')).toBe('anonymous')
  })

  it('sets crossOrigin="anonymous" for cross-origin HTTP URLs', () => {
    // Simulate a cross-origin URL by using an origin different from the
    // current window.location.origin (e.g. http://localhost:3000 in tests).
    const crossOriginSrc = 'http://other-origin.example/video.mp4'
    render(
      <ScrubPreview {...defaultProps} src={crossOriginSrc} />
    )
    const video = document.querySelector('video')
    // Cross-origin URLs should still get crossOrigin="anonymous" so that
    // CORS-enabled servers remain supported.
    expect(video?.getAttribute('crossorigin')).toBe('anonymous')
  })
})
