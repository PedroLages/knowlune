import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}))

// Mock useAriaLiveAnnouncer
const mockAnnounce = vi.fn()
vi.mock('@/hooks/useAriaLiveAnnouncer', () => ({
  useAriaLiveAnnouncer: () => ['', mockAnnounce],
}))

import { useReadingMode } from '../useReadingMode'
import { toast } from 'sonner'

describe('useReadingMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.classList.remove('reading-mode')
  })

  afterEach(() => {
    document.documentElement.classList.remove('reading-mode')
  })

  it('starts with reading mode off', () => {
    const { result } = renderHook(() => useReadingMode(true))
    expect(result.current.isReadingMode).toBe(false)
  })

  it('toggleReadingMode activates reading mode on a lesson page', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(true)
    expect(document.documentElement.classList.contains('reading-mode')).toBe(true)
  })

  it('toggleReadingMode shows toast when not on a lesson page', () => {
    const { result } = renderHook(() => useReadingMode(false))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(false)
    expect(toast.info).toHaveBeenCalledWith('Reading mode is available on lesson pages')
  })

  it('toggleReadingMode deactivates reading mode', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(true)

    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(false)
    expect(document.documentElement.classList.contains('reading-mode')).toBe(false)
  })

  it('announces activation and deactivation', () => {
    const { result } = renderHook(() => useReadingMode(true))

    act(() => {
      result.current.toggleReadingMode()
    })
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Reading mode activated. Press Escape to exit.'
    )

    act(() => {
      result.current.toggleReadingMode()
    })
    expect(mockAnnounce).toHaveBeenCalledWith('Reading mode deactivated.')
  })

  it('exitReadingMode exits if active', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(true)

    act(() => {
      result.current.exitReadingMode()
    })
    expect(result.current.isReadingMode).toBe(false)
  })

  it('exitReadingMode is no-op if not active', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.exitReadingMode()
    })
    expect(result.current.isReadingMode).toBe(false)
    // announce should not be called when exiting from non-active state
  })

  it('Escape key exits reading mode', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(true)

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' })
      )
    })
    expect(result.current.isReadingMode).toBe(false)
  })

  it('Cmd+Alt+R toggles reading mode', () => {
    const { result } = renderHook(() => useReadingMode(true))

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'r',
          metaKey: true,
          altKey: true,
        })
      )
    })
    expect(result.current.isReadingMode).toBe(true)
  })

  it('cleans up .reading-mode class on unmount', () => {
    const { result, unmount } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(document.documentElement.classList.contains('reading-mode')).toBe(true)
    unmount()
    expect(document.documentElement.classList.contains('reading-mode')).toBe(false)
  })

  it('responds to exit-reading-mode custom event', () => {
    const { result } = renderHook(() => useReadingMode(true))
    act(() => {
      result.current.toggleReadingMode()
    })
    expect(result.current.isReadingMode).toBe(true)

    act(() => {
      window.dispatchEvent(new CustomEvent('exit-reading-mode'))
    })
    expect(result.current.isReadingMode).toBe(false)
  })
})
