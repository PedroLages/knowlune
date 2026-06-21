/**
 * EmbeddingModelProgressToast Tests
 *
 * The component renders null but sets up a window event listener for
 * 'model-download-progress'. We mock `toast` from 'sonner' and
 * dispatch synthetic CustomEvent objects to verify the component's behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { EmbeddingModelProgressToast } from '../EmbeddingModelProgressToast'

// ─── Mocks — vi.hoisted ensures they are available before vi.mock runs ───────

const { mockToast, mockToastDismiss, mockToastError, mockToastSuccess, resetNextId } = vi.hoisted(
  () => {
    let nextId = 1
    // Must return a truthy ID so the component can track/reference toasts
    const mockToast = vi.fn((_message: string, options?: { id?: string | number }) => {
      // If called with an id, return it (update path)
      if (options?.id) return options.id
      // Otherwise return a new unique ID (creation path)
      return `toast-${nextId++}`
    })

    const mockToastDismiss = vi.fn()
    const mockToastError = vi.fn()
    const mockToastSuccess = vi.fn()

    function resetNextId() {
      nextId = 1
    }

    return { mockToast, mockToastDismiss, mockToastError, mockToastSuccess, resetNextId }
  }
)

vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    dismiss: mockToastDismiss,
    error: mockToastError,
    success: mockToastSuccess,
    loading: vi.fn(),
    info: vi.fn(),
  }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dispatchProgress(detail: {
  progress: number
  status: 'download' | 'progress' | 'done'
  file?: string
}): void {
  window.dispatchEvent(new CustomEvent('model-download-progress', { detail }))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EmbeddingModelProgressToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockToast.mockClear()
    mockToastDismiss.mockClear()
    mockToastError.mockClear()
    mockToastSuccess.mockClear()
    resetNextId()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast on first progress event', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 25, status: 'progress', file: 'model.onnx' })

    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith('Downloading AI Model', {
      description: 'Loading semantic search model... 25%',
      duration: Infinity,
      closeButton: true,
    })
  })

  it('shows indeterminate message when progress < 0', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: -1, status: 'progress', file: 'model.onnx' })

    expect(mockToast).toHaveBeenCalledWith('Downloading AI Model', {
      description: 'Loading semantic search model...',
      duration: Infinity,
      closeButton: true,
    })
  })

  it('updates the existing toast on subsequent progress events (after debounce)', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 25, status: 'progress' })
    expect(mockToast).toHaveBeenCalledTimes(1)

    // Advance past debounce period (500ms)
    vi.advanceTimersByTime(600)

    dispatchProgress({ progress: 50, status: 'progress' })

    expect(mockToast).toHaveBeenCalledTimes(2)
    expect(mockToast).toHaveBeenLastCalledWith('Downloading AI Model', {
      id: expect.any(String),
      description: 'Loading semantic search model... 50%',
    })
  })

  it('debounces rapid progress updates and only shows the first one', () => {
    render(<EmbeddingModelProgressToast />)

    // Multiple rapid events within debounce window (500ms)
    dispatchProgress({ progress: 10, status: 'progress' })
    dispatchProgress({ progress: 20, status: 'progress' })
    dispatchProgress({ progress: 30, status: 'progress' })

    // Only one toast call for the first event (the rest are debounced)
    expect(mockToast).toHaveBeenCalledTimes(1)
  })

  it('shows success toast on completion and dismisses progress toast', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 50, status: 'progress' })
    expect(mockToast).toHaveBeenCalledTimes(1)

    dispatchProgress({ progress: 100, status: 'done' })

    // Progress toast should be dismissed
    expect(mockToastDismiss).toHaveBeenCalledTimes(1)
    // Success toast should be shown
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('AI search ready!', {
      description: 'The semantic search model has been loaded.',
      duration: 4000,
    })
  })

  it('does not show a new toast if one already completed (cache hit on re-mount)', () => {
    render(<EmbeddingModelProgressToast />)

    // First lifecycle: download completes
    dispatchProgress({ progress: 50, status: 'progress' })
    expect(mockToast).toHaveBeenCalledTimes(1)

    dispatchProgress({ progress: 100, status: 'done' })
    expect(mockToastDismiss).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)

    // Simulate a new lifecycle where model is already cached
    dispatchProgress({ progress: 50, status: 'progress' })

    // Should NOT create a new toast
    expect(mockToast).toHaveBeenCalledTimes(1)
  })

  it('shows error toast when fallback timer fires (no done event within 120s)', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 50, status: 'progress' })

    // Advance past fallback timeout (120s)
    vi.advanceTimersByTime(121_000)

    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError).toHaveBeenCalledWith('Semantic search unavailable', {
      id: expect.any(String),
      description:
        'The AI model could not be downloaded. Check your connection and reload the page.',
      duration: 8000,
    })
  })

  it('cancels fallback timer if done event arrives within timeout', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 50, status: 'progress' })

    // Done arrives before fallback timer fires
    dispatchProgress({ progress: 100, status: 'done' })

    // Advance past fallback timeout — should not have called error
    vi.advanceTimersByTime(121_000)

    expect(mockToastError).not.toHaveBeenCalled()
    expect(mockToastDismiss).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
  })

  it('cleans up event listener and dismisses toast on unmount', () => {
    const { unmount } = render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 50, status: 'progress' })
    expect(mockToast).toHaveBeenCalledTimes(1)

    unmount()

    // Toast should be dismissed on unmount
    expect(mockToastDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders null (no DOM output)', () => {
    const { container } = render(<EmbeddingModelProgressToast />)
    expect(container.innerHTML).toBe('')
  })
})
