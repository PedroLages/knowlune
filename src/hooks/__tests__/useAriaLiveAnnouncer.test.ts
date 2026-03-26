import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAriaLiveAnnouncer } from '../useAriaLiveAnnouncer'

describe('useAriaLiveAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty announcement', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer())
    expect(result.current[0]).toBe('')
  })

  it('sets announcement when announce is called', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer())
    act(() => result.current[1]('Hello'))
    expect(result.current[0]).toBe('Hello')
  })

  it('auto-clears after clearMs', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer(3000))
    act(() => result.current[1]('Will clear'))
    expect(result.current[0]).toBe('Will clear')

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current[0]).toBe('')
  })

  it('appends zero-width space for consecutive identical messages', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer())
    act(() => result.current[1]('Same'))
    const first = result.current[0]
    expect(first).toBe('Same')

    act(() => result.current[1]('Same'))
    const second = result.current[0]
    expect(second).toBe('Same\u200B')
    expect(second).not.toBe(first)
  })

  it('does not append zero-width space for different messages', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer())
    act(() => result.current[1]('First'))
    act(() => result.current[1]('Second'))
    expect(result.current[0]).toBe('Second')
  })

  it('resets clear timer when new announcement arrives', () => {
    const { result } = renderHook(() => useAriaLiveAnnouncer(5000))
    act(() => result.current[1]('First'))

    // Advance 4s (before auto-clear)
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current[0]).toBe('First')

    // New announcement resets the timer
    act(() => result.current[1]('Second'))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current[0]).toBe('Second')

    // After 5s from second announcement, it clears
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current[0]).toBe('')
  })
})
