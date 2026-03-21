import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { formatTime, useQuizTimer } from '../useQuizTimer'

// Mock useQuizStore to avoid Dexie/IndexedDB dependency
vi.mock('@/stores/useQuizStore', () => ({
  useQuizStore: {
    setState: vi.fn(),
  },
}))

describe('formatTime', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats seconds-only values', () => {
    expect(formatTime(45)).toBe('00:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(90)).toBe('01:30')
  })

  it('formats 15 minutes exactly', () => {
    expect(formatTime(900)).toBe('15:00')
  })

  it('pads single-digit minutes and seconds', () => {
    expect(formatTime(65)).toBe('01:05')
  })

  it('handles large values', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})

describe('useQuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial seconds on first render', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(900, onExpire))
    expect(result.current).toBe(900)
  })

  it('counts down after 1 second', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(900, onExpire))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(899)
  })

  it('counts down accurately over multiple seconds', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(900, onExpire))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(895)
  })

  it('fires onExpire when timer reaches 0', () => {
    const onExpire = vi.fn()
    renderHook(() => useQuizTimer(3, onExpire))

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('does not fire onExpire before timer reaches 0', () => {
    const onExpire = vi.fn()
    renderHook(() => useQuizTimer(5, onExpire))

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(onExpire).not.toHaveBeenCalled()
  })

  it('does not fire onExpire more than once', () => {
    const onExpire = vi.fn()
    renderHook(() => useQuizTimer(2, onExpire))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('never goes below 0', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(2, onExpire))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current).toBe(0)
  })

  it('does nothing when initialSeconds is 0', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(0, onExpire))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(0)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('uses latest onExpire callback via ref', () => {
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()
    const { rerender } = renderHook(
      ({ cb }) => useQuizTimer(3, cb),
      { initialProps: { cb: firstCallback } }
    )

    // Update callback before timer expires
    rerender({ cb: secondCallback })

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledTimes(1)
  })

  it('recalculates on visibilitychange', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useQuizTimer(900, onExpire))

    // Advance real time by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Simulate tab becoming visible
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current).toBe(890)
  })

  it('cleans up interval and listeners on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const onExpire = vi.fn()

    const { unmount } = renderHook(() => useQuizTimer(900, onExpire))

    // Should have added visibilitychange listeners
    const addCalls = addSpy.mock.calls.filter(c => c[0] === 'visibilitychange')
    expect(addCalls.length).toBeGreaterThan(0)

    unmount()

    // Should have removed visibilitychange listeners
    const removeCalls = removeSpy.mock.calls.filter(c => c[0] === 'visibilitychange')
    expect(removeCalls.length).toBeGreaterThan(0)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
