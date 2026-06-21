/**
 * EmbeddingModelProgressToast Tests
 *
 * The component renders null but uses the useModelDownloadProgress hook and
 * reacts to its state via useEffect. We mock `toast` from 'sonner' and
 * dispatch synthetic CustomEvent objects to verify the component's behavior.
 *
 * Important: all window.dispatchEvent calls must be wrapped in act() because
 * the hook updates React state, and React 18 batches state updates
 * asynchronously. Without act(), the component's effects won't flush before
 * assertions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { EmbeddingModelProgressToast } from '../EmbeddingModelProgressToast'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

// ─── Mocks — vi.hoisted ensures they are available before vi.mock runs ───────

const {
  mockToast,
  mockToastDismiss,
  mockToastError,
  mockToastSuccess,
  mockToastLoading,
  resetNextId,
} = vi.hoisted(() => {
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
  const mockToastLoading = vi.fn((_message: string) => {
    return `toast-${nextId++}`
  })

  function resetNextId() {
    nextId = 1
  }

  return {
    mockToast,
    mockToastDismiss,
    mockToastError,
    mockToastSuccess,
    mockToastLoading,
    resetNextId,
  }
})

vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    dismiss: mockToastDismiss,
    error: mockToastError,
    success: mockToastSuccess,
    loading: mockToastLoading,
    info: vi.fn(),
  }),
}))

// Mock workerCapabilities so we can control supportsWorkers() in tests
vi.mock('@/ai/lib/workerCapabilities', () => ({
  supportsWorkers: vi.fn(() => true),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dispatchProgress(detail: {
  progress: number
  status: 'download' | 'progress' | 'done'
  file?: string
}): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('model-download-progress', { detail }))
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EmbeddingModelProgressToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockToast.mockClear()
    mockToastDismiss.mockClear()
    mockToastError.mockClear()
    mockToastSuccess.mockClear()
    mockToastLoading.mockClear()
    resetNextId()

    // Default: supportsWorkers returns true
    vi.mocked(supportsWorkers).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast with progress bar on first determinate progress event', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 25, status: 'progress', file: 'model.onnx' })

    const callArgs = mockToast.mock.calls[0]
    expect(callArgs[0]).toBe('Downloading AI Model')
    expect(callArgs[1].duration).toBe(Infinity)
    // Should have an action button labelled "Skip" instead of a bare close button
    expect(callArgs[1].action).toEqual({ label: 'Skip', onClick: expect.any(Function) })
    // Description should be a ReactNode (not a plain string)
    expect(callArgs[1].description).toBeDefined()
    // The description should contain the progress percentage text
    const desc = JSON.stringify(callArgs[1].description)
    expect(desc).toContain('Downloading AI model')
    expect(desc).toContain('25')
    expect(desc).toContain('%')
    // Should include the progress bar (Progress component props visible)
    expect(desc).toContain('"value":25')
    expect(desc).toContain('"showLabel":false')
    // Should include fallback info text
    expect(desc).toContain('Keyword search available')
  })

  it('shows loading toast for indeterminate progress (< 0)', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: -1, status: 'progress', file: 'model.onnx' })

    expect(mockToastLoading).toHaveBeenCalledTimes(1)
    expect(mockToastLoading).toHaveBeenCalledWith('Downloading AI Model', {
      description: 'Downloading AI model...',
      duration: Infinity,
    })
  })

  it('transitions from loading to progress bar when determinate progress arrives', () => {
    render(<EmbeddingModelProgressToast />)

    // First event: indeterminate — creates a loading toast (debounce baseline set)
    dispatchProgress({ progress: -1, status: 'progress' })
    expect(mockToastLoading).toHaveBeenCalledTimes(1)
    const loadingId = mockToastLoading.mock.results[0]?.value

    // Advance past the 500ms debounce window so the next update goes through
    act(() => vi.advanceTimersByTime(600))

    // Second event: determinate — updates the loading toast with a progress bar
    dispatchProgress({ progress: 25, status: 'progress' })

    // Should have called toast() with the same ID to update the loading toast
    expect(mockToast).toHaveBeenCalledTimes(1)
    const updateCallArgs = mockToast.mock.calls[0]
    expect(updateCallArgs[0]).toBe('Downloading AI Model')
    expect(updateCallArgs[1].id).toBe(loadingId)
  })

  it('updates the existing toast on subsequent progress events (after debounce)', () => {
    render(<EmbeddingModelProgressToast />)

    dispatchProgress({ progress: 25, status: 'progress' })
    expect(mockToast).toHaveBeenCalledTimes(1)

    // Advance past debounce period (500ms)
    act(() => vi.advanceTimersByTime(600))

    dispatchProgress({ progress: 50, status: 'progress' })

    expect(mockToast).toHaveBeenCalledTimes(2)
    const lastCall = mockToast.mock.calls[1]
    expect(lastCall[0]).toBe('Downloading AI Model')
    expect(lastCall[1].id).toBeDefined()
    // Updated description should reflect new progress
    expect(JSON.stringify(lastCall[1].description)).toContain('50')
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
    act(() => vi.advanceTimersByTime(121_000))

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

    // Done arrives before fallback timer fires (120s)
    dispatchProgress({ progress: 100, status: 'done' })

    // Advance past fallback timeout — should not have called error
    act(() => vi.advanceTimersByTime(121_000))

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

  // ─── New tests for Round 2 fixes ─────────────────────────────────────────

  it('does not set first-progress timeout when warm-up is skipped (no workers)', () => {
    vi.mocked(supportsWorkers).mockReturnValue(false)

    render(<EmbeddingModelProgressToast />)

    // Advance past the first-progress timeout
    act(() => vi.advanceTimersByTime(20_000))

    // Should NOT show an error toast (warm-up was not attempted)
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('does not set first-progress timeout when deviceMemory < 4GB', () => {
    // Set deviceMemory to 2GB (below the 4GB threshold)
    Object.defineProperty(navigator, 'deviceMemory', {
      value: 2,
      writable: true,
      configurable: true,
    })

    render(<EmbeddingModelProgressToast />)

    act(() => vi.advanceTimersByTime(20_000))

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('does not show first-progress timeout error when model completes quickly', () => {
    render(<EmbeddingModelProgressToast />)

    // Model completes before the first-progress timeout (15s)
    dispatchProgress({ progress: 100, status: 'done' })

    // Advance past the first-progress timeout
    act(() => vi.advanceTimersByTime(20_000))

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('shows error when worker-crash event fires during download', () => {
    render(<EmbeddingModelProgressToast />)

    // Start download
    dispatchProgress({ progress: 50, status: 'progress' })
    expect(mockToast).toHaveBeenCalled()

    // Fire worker crash
    act(() => {
      window.dispatchEvent(
        new CustomEvent('worker-crash', {
          detail: { workerId: 'embed-worker', error: 'OOM' },
        })
      )
    })

    expect(mockToastError).toHaveBeenCalledTimes(1)
    const errorCall = mockToastError.mock.calls[0]
    expect(errorCall[0]).toBe('Semantic search unavailable')
    expect(errorCall[1].description).toContain('OOM')
    // Should reuse the existing toast ID
    expect(errorCall[1].id).toBeDefined()
  })

  it('ignores worker-crash when no download was in progress', () => {
    render(<EmbeddingModelProgressToast />)

    // Fire worker crash without any download progress
    act(() => {
      window.dispatchEvent(
        new CustomEvent('worker-crash', {
          detail: { workerId: 'embed-worker', error: 'OOM' },
        })
      )
    })

    expect(mockToast).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })
})
