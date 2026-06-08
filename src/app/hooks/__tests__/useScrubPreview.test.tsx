/**
 * useScrubPreview — offscreen video seek + canvas extraction with throttling.
 *
 * jsdom can't decode video frames, so we stub canvas.getContext() to return
 * a mock context and fire synthetic 'seeked' events on the hidden video.
 * Frame *content* is verified manually (Unit 6); these tests prove the
 * throttling logic, error handling, and lifecycle behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useScrubPreview } from '../useScrubPreview'

// ---- helpers ---------------------------------------------------------------

/** Standard HTMLMediaElement stubs (mirrors VideoPlayer.test.tsx pattern) */
function installMediaStubs() {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: vi.fn(),
  })
}

function uninstallMediaStubs() {
  // Restore original descriptors — jsdom provides "not implemented" stubs
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).play
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).pause
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).load
}

/** Minimal component that wires useScrubPreview to DOM elements */
function ScrubPreviewHarness({
  src,
  onApi,
}: {
  src: string
  onApi: (api: ReturnType<typeof useScrubPreview>) => void
}) {
  const api = useScrubPreview(src)
  onApi(api)
  return (
    <>
      <video ref={api.videoRef} muted preload="auto" data-testid="preview-video" />
      <canvas ref={api.canvasRef} data-testid="preview-canvas" width={160} height={90} />
    </>
  )
}

// ---- tests -----------------------------------------------------------------

describe('useScrubPreview', () => {
  let canvasCtx: CanvasRenderingContext2D

  beforeEach(() => {
    installMediaStubs()

    // Stub canvas context so we can spy on drawImage and simulate failures
    canvasCtx = {
      drawImage: vi.fn(),
      getContextAttributes: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    const origGetContext = HTMLCanvasElement.prototype.getContext
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d') return canvasCtx as unknown as RenderingContext
      return origGetContext.call(this, contextId)
    })
  })

  afterEach(() => {
    uninstallMediaStubs()
    vi.restoreAllMocks()
  })

  // ---- happy path ----------------------------------------------------------

  it('seeks the video when requestFrameAt is called and paints frame on seeked', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement

    // Simulate metadata loaded
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 360 })

    act(() => {
      apiRef.current?.requestFrameAt(30)
    })

    expect(video.currentTime).toBe(30)

    // Fire seeked — should paint
    act(() => {
      video.dispatchEvent(new Event('seeked'))
    })

    expect(canvasCtx.drawImage).toHaveBeenCalledTimes(1)
    expect(apiRef.current?.thumbnailAvailable).toBe(true)
  })

  // ---- throttle: latest-target-wins ----------------------------------------

  it('stores pending target when a seek is in flight and consumes it on seeked', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 360 })

    // Start first seek
    act(() => {
      apiRef.current?.requestFrameAt(10)
    })
    expect(video.currentTime).toBe(10)

    // While "seeking", request a different time — should replace pending
    act(() => {
      apiRef.current?.requestFrameAt(40)
    })
    // currentTime should still be 10 (seek in flight)
    expect(video.currentTime).toBe(10)

    // Fire seeked → should paint, then seek to 40
    act(() => {
      video.dispatchEvent(new Event('seeked'))
    })
    expect(canvasCtx.drawImage).toHaveBeenCalledTimes(1)
    expect(video.currentTime).toBe(40)

    // Fire second seeked → should paint again, no more pending
    ;(canvasCtx.drawImage as ReturnType<typeof vi.fn>).mockClear()
    act(() => {
      video.dispatchEvent(new Event('seeked'))
    })
    expect(canvasCtx.drawImage).toHaveBeenCalledTimes(1)
    // No third seek (pending was consumed)
    expect(video.currentTime).toBe(40)
  })

  // ---- not ready -----------------------------------------------------------

  it('does not seek when readyState < HAVE_METADATA', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_NOTHING,
    })

    act(() => {
      apiRef.current?.requestFrameAt(30)
    })

    // currentTime should not have been set
    expect(video.currentTime).toBe(0)
  })

  it('does not seek when duration is 0', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 0 })

    act(() => {
      apiRef.current?.requestFrameAt(30)
    })

    expect(video.currentTime).toBe(0)
  })

  // ---- error path: drawImage throws ----------------------------------------

  it('sets thumbnailAvailable to false when drawImage throws and does not propagate', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 360 })

    // Make drawImage throw (simulates tainted canvas)
    ;(canvasCtx.drawImage as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Tainted canvas')
    })

    act(() => {
      apiRef.current?.requestFrameAt(30)
    })

    // Should not throw
    expect(() => {
      act(() => {
        video.dispatchEvent(new Event('seeked'))
      })
    }).not.toThrow()

    expect(apiRef.current?.thumbnailAvailable).toBe(false)
  })

  // ---- cleanup -------------------------------------------------------------

  it('removes seeked listener on unmount', () => {
    const apiRef: { current: ReturnType<typeof useScrubPreview> | null } = { current: null }
    const { unmount } = render(
      <ScrubPreviewHarness
        src="test-video.mp4"
        onApi={api => {
          apiRef.current = api
        }}
      />
    )

    const video = document.querySelector('[data-testid="preview-video"]') as HTMLVideoElement
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 360 })

    act(() => {
      apiRef.current?.requestFrameAt(30)
    })

    unmount()

    // Fire seeked after unmount — should not throw or call drawImage
    ;(canvasCtx.drawImage as ReturnType<typeof vi.fn>).mockClear()
    expect(() => {
      act(() => {
        video.dispatchEvent(new Event('seeked'))
      })
    }).not.toThrow()
    expect(canvasCtx.drawImage).not.toHaveBeenCalled()
  })
})
