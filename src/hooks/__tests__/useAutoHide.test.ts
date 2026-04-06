import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoHide } from '../useAutoHide'

describe('useAutoHide', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts visible', () => {
    const { result } = renderHook(() => useAutoHide())
    expect(result.current.isVisible).toBe(true)
  })

  it('hides after default timeout (3000ms)', () => {
    const { result } = renderHook(() => useAutoHide())
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('hides after custom timeout', () => {
    const { result } = renderHook(() => useAutoHide(1000))
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.isVisible).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('resets timer on mouse move', () => {
    const { result } = renderHook(() => useAutoHide(1000))
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(result.current.isVisible).toBe(true)

    // Simulate mouse move to reset timer
    act(() => {
      window.dispatchEvent(new Event('mousemove'))
    })

    act(() => {
      vi.advanceTimersByTime(800)
    })
    // Should still be visible because timer was reset
    expect(result.current.isVisible).toBe(true)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('resets timer on touch start', () => {
    const { result } = renderHook(() => useAutoHide(1000))
    act(() => {
      vi.advanceTimersByTime(800)
    })

    act(() => {
      window.dispatchEvent(new Event('touchstart'))
    })

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.isVisible).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('always stays visible when disabled', () => {
    const { result } = renderHook(() => useAutoHide(1000, true))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.isVisible).toBe(true)
  })

  it('show() makes element visible and restarts timer', () => {
    const { result } = renderHook(() => useAutoHide(1000))
    // Let it hide
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isVisible).toBe(false)

    // Call show()
    act(() => {
      result.current.show()
    })
    expect(result.current.isVisible).toBe(true)

    // Should hide again after timeout
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('show() does not start timer when disabled', () => {
    const { result } = renderHook(() => useAutoHide(1000, true))
    act(() => {
      result.current.show()
    })
    expect(result.current.isVisible).toBe(true)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.isVisible).toBe(true)
  })

  it('resetTimer is a no-op when disabled', () => {
    const { result } = renderHook(() => useAutoHide(1000, true))
    act(() => {
      result.current.resetTimer()
    })
    expect(result.current.isVisible).toBe(true)
  })

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useAutoHide())
    unmount()
    const removedEvents = removeSpy.mock.calls.map(([event]) => event)
    expect(removedEvents).toContain('mousemove')
    expect(removedEvents).toContain('touchstart')
  })

  it('returns containerRef for focus management', () => {
    const { result } = renderHook(() => useAutoHide())
    expect(result.current.containerRef).toBeDefined()
    expect(result.current.containerRef.current).toBeNull()
  })
})
