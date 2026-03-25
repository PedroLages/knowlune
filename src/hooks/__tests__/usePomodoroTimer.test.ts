import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePomodoroTimer } from '../usePomodoroTimer'

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- Initial state ---

  it('returns idle phase with default 25-minute focus duration', () => {
    const { result } = renderHook(() => usePomodoroTimer())
    expect(result.current.phase).toBe('idle')
    expect(result.current.status).toBe('stopped')
    expect(result.current.timeRemaining).toBe(25 * 60)
    expect(result.current.completedSessions).toBe(0)
  })

  it('accepts custom focus and break durations', () => {
    const { result } = renderHook(() =>
      usePomodoroTimer({ focusDuration: 10 * 60, breakDuration: 3 * 60 })
    )
    expect(result.current.timeRemaining).toBe(10 * 60)
  })

  // --- Start ---

  it('start transitions to focus/running phase', () => {
    const { result } = renderHook(() => usePomodoroTimer())
    act(() => result.current.start())
    expect(result.current.phase).toBe('focus')
    expect(result.current.status).toBe('running')
  })

  it('countdown decrements after 1 second', () => {
    const { result } = renderHook(() => usePomodoroTimer({ focusDuration: 60 }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.timeRemaining).toBe(59)
  })

  // --- Pause / Resume ---

  it('pause freezes the countdown', () => {
    const { result } = renderHook(() => usePomodoroTimer({ focusDuration: 60 }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.pause())

    const pausedTime = result.current.timeRemaining
    expect(result.current.status).toBe('paused')

    // Advance time — should NOT change
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.timeRemaining).toBe(pausedTime)
  })

  it('resume continues countdown from paused time', () => {
    const { result } = renderHook(() => usePomodoroTimer({ focusDuration: 60 }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(3000)) // 57s remaining

    act(() => result.current.pause())
    const pausedTime = result.current.timeRemaining

    act(() => vi.advanceTimersByTime(5000)) // 5s pass while paused (no effect)
    act(() => result.current.resume())
    expect(result.current.status).toBe('running')

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.timeRemaining).toBe(pausedTime - 2)
  })

  // --- Phase transitions ---

  it('focus -> break transition fires onFocusComplete and auto-starts break', () => {
    const onFocusComplete = vi.fn()
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 3,
        breakDuration: 2,
        onFocusComplete,
        autoStartBreak: true,
      })
    )
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(3000))

    expect(onFocusComplete).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('break')
    expect(result.current.status).toBe('running')
    expect(result.current.timeRemaining).toBe(2)
  })

  it('break -> idle transition increments session counter', () => {
    const onBreakComplete = vi.fn()
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 2,
        breakDuration: 2,
        onBreakComplete,
        autoStartBreak: true,
        autoStartFocus: false,
      })
    )
    act(() => result.current.start())
    // Focus completes at 2s, break auto-starts
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.phase).toBe('break')
    // Break completes at 4s
    act(() => vi.advanceTimersByTime(2000))

    expect(onBreakComplete).toHaveBeenCalledTimes(1)
    expect(result.current.completedSessions).toBe(1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.status).toBe('stopped')
  })

  // --- Auto-start behavior ---

  it('auto-start break disabled: stops at break phase without running', () => {
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 2,
        breakDuration: 5,
        autoStartBreak: false,
      })
    )
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(2000))

    expect(result.current.phase).toBe('break')
    expect(result.current.status).toBe('stopped')
    expect(result.current.timeRemaining).toBe(5)
  })

  it('auto-start focus enabled: restarts focus after break completes', () => {
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 2,
        breakDuration: 2,
        autoStartBreak: true,
        autoStartFocus: true,
      })
    )
    act(() => result.current.start())
    // Focus (2s) + break (2s) = 4s → auto-start new focus
    act(() => vi.advanceTimersByTime(4000))

    expect(result.current.completedSessions).toBe(1)
    expect(result.current.phase).toBe('focus')
    expect(result.current.status).toBe('running')
  })

  // --- Reset ---

  it('reset returns to idle with full duration and clears sessions', () => {
    const { result } = renderHook(() =>
      usePomodoroTimer({ focusDuration: 10, breakDuration: 5, autoStartBreak: true })
    )
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(10000)) // complete focus, auto-start break
    act(() => vi.advanceTimersByTime(5000)) // complete break

    expect(result.current.completedSessions).toBe(1)

    act(() => result.current.reset())
    expect(result.current.phase).toBe('idle')
    expect(result.current.status).toBe('stopped')
    expect(result.current.timeRemaining).toBe(10)
    expect(result.current.completedSessions).toBe(0)
  })

  // --- Skip phase ---

  it('skip advances from focus to break', () => {
    const onFocusComplete = vi.fn()
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 300,
        breakDuration: 60,
        onFocusComplete,
        autoStartBreak: true,
      })
    )
    act(() => result.current.start())
    act(() => result.current.skip())

    expect(onFocusComplete).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('break')
    expect(result.current.status).toBe('running')
  })

  it('skip advances from break to idle (no auto-start focus)', () => {
    const { result } = renderHook(() =>
      usePomodoroTimer({
        focusDuration: 2,
        breakDuration: 60,
        autoStartBreak: true,
        autoStartFocus: false,
      })
    )
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(2000)) // focus done -> auto break
    act(() => result.current.skip()) // skip break

    expect(result.current.completedSessions).toBe(1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.status).toBe('stopped')
  })

  // --- Duration change while idle ---

  it('updates timeRemaining when focusDuration changes while idle', () => {
    const { result, rerender } = renderHook(
      ({ focusDuration }) => usePomodoroTimer({ focusDuration }),
      { initialProps: { focusDuration: 25 * 60 } }
    )
    expect(result.current.timeRemaining).toBe(25 * 60)

    rerender({ focusDuration: 20 * 60 })
    expect(result.current.timeRemaining).toBe(20 * 60)
  })

  // --- Cleanup ---

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { result, unmount } = renderHook(() => usePomodoroTimer({ focusDuration: 60 }))
    act(() => result.current.start())
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
