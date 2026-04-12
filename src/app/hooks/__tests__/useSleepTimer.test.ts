/**
 * Unit tests for useSleepTimer hook.
 *
 * Tests fadeOutAndPause utility and EOC event listener behavior.
 * Full integration (countdown timing, React state) covered by E2E tests.
 *
 * @since E111-S03
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { fadeOutAndPause, useSleepTimer, consumeSleepTimerEndedFlag } from '../useSleepTimer'

// --- fadeOutAndPause utility tests ---

describe('fadeOutAndPause', () => {
  it('calls requestAnimationFrame and eventually pauses audio', () => {
    const audio = {
      volume: 0.8,
      pause: vi.fn(),
    } as unknown as HTMLAudioElement

    const onDone = vi.fn()

    // Mock rAF to run callback immediately
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      // Simulate time elapsed past FADE_DURATION_MS (5000ms)
      vi.spyOn(performance, 'now').mockReturnValue(10_000)
      cb(10_000)
      return 0
    })

    fadeOutAndPause(audio, onDone)

    expect(audio.pause).toHaveBeenCalled()
    expect(audio.volume).toBe(0.8) // Volume restored after pause
    expect(onDone).toHaveBeenCalled()

    rafSpy.mockRestore()
  })
})

// --- consumeSleepTimerEndedFlag tests ---

describe('consumeSleepTimerEndedFlag', () => {
  beforeEach(() => localStorage.clear())

  it('returns false when no flag set', () => {
    expect(consumeSleepTimerEndedFlag()).toBe(false)
  })

  it('returns true and removes flag when set', () => {
    localStorage.setItem('knowlune:sleep-timer-ended', '1')
    expect(consumeSleepTimerEndedFlag()).toBe(true)
    // Second call returns false (consumed)
    expect(consumeSleepTimerEndedFlag()).toBe(false)
  })
})

// --- useSleepTimer hook tests ---

describe('useSleepTimer', () => {
  let mockAudio: HTMLAudioElement

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    mockAudio = document.createElement('audio')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null state initially', () => {
    const { result } = renderHook(() => useSleepTimer())
    expect(result.current.activeOption).toBeNull()
    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.badgeText).toBeNull()
  })

  it('EOC mode: sets activeOption to end-of-chapter with "EOC" badge', () => {
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer('end-of-chapter', audioRef, vi.fn())
    })

    expect(result.current.activeOption).toBe('end-of-chapter')
    expect(result.current.badgeText).toBe('EOC')
  })

  it('EOC mode: listens to chapterend event (not ended)', () => {
    const addSpy = vi.spyOn(mockAudio, 'addEventListener')
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer('end-of-chapter', audioRef, vi.fn())
    })

    // Should listen to chapterend
    const chapterendCalls = addSpy.mock.calls.filter(c => c[0] === 'chapterend')
    expect(chapterendCalls).toHaveLength(1)

    // Should NOT listen to ended (race condition fix)
    const endedCalls = addSpy.mock.calls.filter(c => c[0] === 'ended')
    expect(endedCalls).toHaveLength(0)
  })

  it('EOC mode: chapterend event calls preventDefault and triggers fade', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      vi.spyOn(performance, 'now').mockReturnValue(10_000)
      cb(10_000)
      return 0
    })

    const onPause = vi.fn()
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer('end-of-chapter', audioRef, onPause)
    })

    // Dispatch cancelable chapterend event
    const event = new CustomEvent('chapterend', {
      cancelable: true,
      detail: { fromIndex: 0, toIndex: 1 },
    })

    act(() => {
      mockAudio.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(onPause).toHaveBeenCalled()
    expect(localStorage.getItem('knowlune:sleep-timer-ended')).toBe('1')

    rafSpy.mockRestore()
  })

  it('EOC mode: cancelTimer removes chapterend listener', () => {
    const removeSpy = vi.spyOn(mockAudio, 'removeEventListener')
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer('end-of-chapter', audioRef, vi.fn())
    })

    act(() => {
      result.current.cancelTimer()
    })

    const chapterendRemovals = removeSpy.mock.calls.filter(c => c[0] === 'chapterend')
    expect(chapterendRemovals).toHaveLength(1)
    expect(result.current.activeOption).toBeNull()
  })

  it('countdown mode: sets remaining seconds and badge text', () => {
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer(30, audioRef, vi.fn())
    })

    expect(result.current.activeOption).toBe(30)
    expect(result.current.remainingSeconds).toBe(1800) // 30 * 60
    expect(result.current.badgeText).toBe('30m')
  })

  it('countdown mode: decrements remaining seconds', () => {
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer(15, audioRef, vi.fn())
    })

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.remainingSeconds).toBe(899) // 900 - 1
  })

  it('off option cancels any active timer', () => {
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer(30, audioRef, vi.fn())
    })

    act(() => {
      result.current.setTimer('off', audioRef, vi.fn())
    })

    expect(result.current.activeOption).toBeNull()
    expect(result.current.remainingSeconds).toBeNull()
  })

  it('cancelTimer during fade does not invoke onPause after cancellation', () => {
    // rAF that queues but does not immediately execute (simulates in-progress fade)
    const pendingCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      pendingCallbacks.push(cb)
      return pendingCallbacks.length
    })
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const onPause = vi.fn()
    const { result } = renderHook(() => useSleepTimer())
    const audioRef = { current: mockAudio }

    act(() => {
      result.current.setTimer('end-of-chapter', audioRef, onPause)
    })

    // Trigger chapterend — starts the fade rAF loop
    const event = new CustomEvent('chapterend', { cancelable: true })
    act(() => {
      mockAudio.dispatchEvent(event)
    })

    // Fade is now in-flight (rAF queued but not executed)
    expect(pendingCallbacks).toHaveLength(1)

    // Cancel the timer while fade is in-flight
    act(() => {
      result.current.cancelTimer()
    })

    expect(cafSpy).toHaveBeenCalled()

    // Simulate rAF firing anyway (e.g. browser already scheduled it)
    // onPause must NOT be called because cancelled=true guards the tick
    act(() => {
      vi.spyOn(performance, 'now').mockReturnValue(10_000)
      pendingCallbacks.forEach(cb => cb(10_000))
    })

    expect(onPause).not.toHaveBeenCalled()

    rafSpy.mockRestore()
    cafSpy.mockRestore()
  })
})
