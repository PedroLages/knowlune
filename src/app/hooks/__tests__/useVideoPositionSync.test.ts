/**
 * Tests for useVideoPositionSync hook.
 *
 * @module useVideoPositionSync.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVideoPositionSync } from '@/app/hooks/useVideoPositionSync'

// Mock db
const mockProgressFirst = vi.fn()
vi.mock('@/db/schema', () => ({
  db: {
    progress: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: mockProgressFirst,
        })),
      })),
    },
  },
}))

// Mock syncableWrite
const mockSyncableWrite = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: (...args: unknown[]) => mockSyncableWrite(...args),
}))

const DEFAULT_PARAMS = {
  courseId: 'course-1',
  lessonId: 'lesson-1',
  currentTime: 0,
  duration: 120,
  isPlaying: false,
}

beforeEach(() => {
  mockProgressFirst.mockResolvedValue(undefined)
  mockSyncableWrite.mockClear()
})

type PositionParams = {
  courseId: string
  lessonId: string
  currentTime: number
  duration: number
  isPlaying: boolean
}

function renderPositionSync(params: PositionParams) {
  return renderHook(
    (p: PositionParams) => useVideoPositionSync(p),
    { initialProps: params }
  )
}

describe('useVideoPositionSync', () => {
  // --- Happy path ---

  it('saves position when isPlaying transitions from true to false', async () => {
    const { rerender } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 30,
    })

    // Transition to paused — should trigger save
    rerender({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: 35,
    })

    // Flush microtasks
    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', {
        currentTime: 35,
        completionPercentage: 29,
        durationSeconds: 120,
        courseId: 'course-1',
        videoId: 'lesson-1',
      })
    })
  })

  it('saves position periodically during playback (every 5 seconds)', async () => {
    vi.useFakeTimers()

    renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 10,
      duration: 120,
    })

    expect(mockSyncableWrite).not.toHaveBeenCalled()

    // Advance 5 seconds — periodic save fires
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalledTimes(1)
    })

    expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', expect.objectContaining({
      currentTime: 10,
      completionPercentage: 8,
    }))

    vi.useRealTimers()
  })

  it('saves position on unmount', async () => {
    const { unmount } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 50,
      duration: 120,
    })

    mockSyncableWrite.mockClear()
    unmount()

    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', expect.objectContaining({
        currentTime: 50,
        completionPercentage: 42,
      }))
    })
  })

  // --- Edge cases ---

  it('saves position on visibilitychange when document becomes hidden', async () => {
    renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 50,
      duration: 120,
    })

    mockSyncableWrite.mockClear()

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', expect.objectContaining({
        currentTime: 50,
        completionPercentage: 42,
      }))
    })

    // Cleanup
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('does NOT save when currentTime is 0', () => {
    const { rerender } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 0,
    })

    rerender({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: 0,
    })

    expect(mockSyncableWrite).not.toHaveBeenCalled()
  })

  it('does NOT save when currentTime is NaN', () => {
    const { rerender } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: NaN,
    })

    rerender({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: NaN,
    })

    expect(mockSyncableWrite).not.toHaveBeenCalled()
  })

  it('preserves existing record fields (spread pattern) when saving video position', async () => {
    // Existing record has a currentPage
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 0,
      completionPercentage: 0,
      currentPage: 5,
    })

    const { rerender } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 45,
      duration: 120,
    })

    // Trigger save by pausing
    rerender({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: 45,
      duration: 120,
    })

    // Wait for async read-then-write to settle
    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalled()
    })

    const writeCall = mockSyncableWrite.mock.calls[0][2]
    expect(writeCall).toMatchObject({
      currentTime: 45,
      currentPage: 5, // preserved from existing record
      completionPercentage: 38,
      durationSeconds: 120,
    })
  })

  it('clamps completionPercentage to 100', async () => {
    const { rerender } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: true,
      currentTime: 120,
      duration: 100,
    })

    rerender({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: 120,
      duration: 100,
    })

    await vi.waitFor(() => {
      expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', expect.objectContaining({
        completionPercentage: 100,
      }))
    })
  })

  // --- Error path ---

  it('does not crash when Dexie write fails (silent-catch-ok)', () => {
    mockSyncableWrite.mockRejectedValue(new Error('DB write failed'))

    // Should not throw — error is caught silently
    expect(() => {
      renderPositionSync({
        ...DEFAULT_PARAMS,
        isPlaying: false,
        currentTime: 30,
        duration: 120,
      })
    }).not.toThrow()
  })

  // --- Generational cancel ---

  it('discards stale saves when courseId changes mid-save (generational cancel)', async () => {
    vi.useFakeTimers()

    // Make the read resolve after a delay to trigger a generation change
    mockProgressFirst.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve(undefined), 100)
        })
    )

    const { rerender, unmount } = renderPositionSync({
      ...DEFAULT_PARAMS,
      isPlaying: false,
      currentTime: 30,
      duration: 120,
    })

    // Change courseId while read is in flight — increments generation
    rerender({
      courseId: 'course-2',
      lessonId: 'lesson-2',
      isPlaying: false,
      currentTime: 50,
      duration: 120,
    })

    // Unmount while save is still pending (stale gen)
    mockSyncableWrite.mockClear()
    unmount()

    // Fast-forward to let the first promise resolve
    await act(() => vi.advanceTimersByTimeAsync(200))

    // All saves should be for course-2, not course-1
    const calls = mockSyncableWrite.mock.calls.filter(
      c => c[0] === 'progress' && c[1] === 'put'
    )

    for (const call of calls) {
      expect(call[2]).not.toMatchObject({ courseId: 'course-1' })
    }

    vi.useRealTimers()
  })
})
