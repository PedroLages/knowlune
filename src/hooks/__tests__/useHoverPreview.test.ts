import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoverPreview } from '../useHoverPreview'

describe('useHoverPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    const { result } = renderHook(() => useHoverPreview())
    expect(result.current.active).toBe(false)
  })

  it('activates after delay on mouse enter', () => {
    const { result } = renderHook(() => useHoverPreview(500))

    act(() => {
      result.current.handlers.onMouseEnter()
    })

    expect(result.current.active).toBe(false)

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.active).toBe(true)
  })

  it('uses default delay of 1000ms', () => {
    const { result } = renderHook(() => useHoverPreview())

    act(() => {
      result.current.handlers.onMouseEnter()
    })

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.active).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.active).toBe(true)
  })

  it('deactivates on mouse leave', () => {
    const { result } = renderHook(() => useHoverPreview(100))

    act(() => {
      result.current.handlers.onMouseEnter()
      vi.advanceTimersByTime(100)
    })
    expect(result.current.active).toBe(true)

    act(() => {
      result.current.handlers.onMouseLeave()
    })
    expect(result.current.active).toBe(false)
  })

  it('cancels pending activation on mouse leave', () => {
    const { result } = renderHook(() => useHoverPreview(500))

    act(() => {
      result.current.handlers.onMouseEnter()
    })

    act(() => {
      vi.advanceTimersByTime(200)
      result.current.handlers.onMouseLeave()
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Should still be inactive since mouse left before delay
    expect(result.current.active).toBe(false)
  })

  it('clears timer on unmount', () => {
    const { result, unmount } = renderHook(() => useHoverPreview(500))

    act(() => {
      result.current.handlers.onMouseEnter()
    })

    unmount()

    // No error should occur when timer fires after unmount
    act(() => {
      vi.advanceTimersByTime(500)
    })
  })
})
