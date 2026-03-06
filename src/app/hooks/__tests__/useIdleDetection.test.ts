import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleDetection } from '../useIdleDetection'

describe('useIdleDetection', () => {
  let onIdle: ReturnType<typeof vi.fn<() => void>>
  let onActive: ReturnType<typeof vi.fn<() => void>>
  let onActivity: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    onIdle = vi.fn()
    onActive = vi.fn()
    onActivity = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should call onActivity on initial mount', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    expect(onActivity).toHaveBeenCalledTimes(1)
    expect(onIdle).not.toHaveBeenCalled()
    expect(onActive).not.toHaveBeenCalled()
  })

  it('should call onIdle after 5 minutes of inactivity', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    // Clear initial onActivity call
    onActivity.mockClear()

    // Fast-forward 5 minutes (300000ms)
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onActivity).not.toHaveBeenCalled()
  })

  it('should call onActive when event fires after idle period', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    // Trigger idle
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(onIdle).toHaveBeenCalledTimes(1)

    // Clear mocks
    onIdle.mockClear()
    onActivity.mockClear()

    // Trigger activity
    window.dispatchEvent(new MouseEvent('mousedown'))

    expect(onActive).toHaveBeenCalledTimes(1)
    expect(onActivity).toHaveBeenCalledTimes(1)
  })

  it('should reset timer on mousedown', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    // Advance 4 minutes (not idle yet)
    vi.advanceTimersByTime(4 * 60 * 1000)

    // Trigger mousedown (resets timer)
    window.dispatchEvent(new MouseEvent('mousedown'))
    expect(onActivity).toHaveBeenCalledTimes(1)

    onActivity.mockClear()

    // Advance another 4 minutes (total 8 min, but timer was reset at 4min)
    vi.advanceTimersByTime(4 * 60 * 1000)

    // Should not be idle yet (only 4 min since last activity)
    expect(onIdle).not.toHaveBeenCalled()

    // Advance 1 more minute (now 5 min since reset)
    vi.advanceTimersByTime(1 * 60 * 1000)

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('should reset timer on keydown', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new KeyboardEvent('keydown'))

    expect(onActivity).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('should reset timer on touchstart', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new TouchEvent('touchstart'))

    expect(onActivity).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('should reset timer on scroll', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('scroll'))

    expect(onActivity).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('should reset timer on wheel', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new WheelEvent('wheel'))

    expect(onActivity).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    unmount()

    // After unmount, events should not trigger callbacks
    window.dispatchEvent(new MouseEvent('mousedown'))

    expect(onActivity).not.toHaveBeenCalled()
  })

  it('should clear timeout on unmount', () => {
    const { unmount } = renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    unmount()

    // Advance time after unmount
    vi.advanceTimersByTime(5 * 60 * 1000)

    // onIdle should not be called after unmount
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('should call onActivity on every user interaction', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActivity.mockClear()

    // Trigger multiple events
    window.dispatchEvent(new MouseEvent('mousedown'))
    window.dispatchEvent(new KeyboardEvent('keydown'))
    window.dispatchEvent(new Event('scroll'))

    expect(onActivity).toHaveBeenCalledTimes(3)
  })

  it('should not call onActive if not previously idle', () => {
    renderHook(() => useIdleDetection({ onIdle, onActive, onActivity }))

    onActive.mockClear()
    onActivity.mockClear()

    // Trigger activity before going idle
    window.dispatchEvent(new MouseEvent('mousedown'))

    // onActivity should be called, but not onActive (wasn't idle)
    expect(onActivity).toHaveBeenCalledTimes(1)
    expect(onActive).not.toHaveBeenCalled()
  })

  it('should handle callback updates without re-registering listeners', () => {
    const { rerender } = renderHook(
      ({ onIdle, onActive, onActivity }) => useIdleDetection({ onIdle, onActive, onActivity }),
      {
        initialProps: { onIdle, onActive, onActivity },
      }
    )

    onActivity.mockClear()

    // Update callbacks
    const newOnActivity = vi.fn()
    rerender({ onIdle, onActive, onActivity: newOnActivity })

    // Trigger activity
    window.dispatchEvent(new MouseEvent('mousedown'))

    // New callback should be called
    expect(newOnActivity).toHaveBeenCalledTimes(1)
    // Old callback should not be called
    expect(onActivity).not.toHaveBeenCalled()
  })
})
