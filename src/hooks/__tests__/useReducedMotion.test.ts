import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockReduceMotion: 'system' | 'on' | 'off' = 'system'

vi.mock('@/lib/settings', () => ({
  getSettings: () => ({
    displayName: 'Student',
    bio: '',
    theme: 'system' as const,
    colorScheme: 'professional' as const,
    accessibilityFont: false,
    contentDensity: 'default' as const,
    reduceMotion: mockReduceMotion,
  }),
}))

// Import after mock is set up
import { useReducedMotion } from '../useReducedMotion'

// Helper to mock matchMedia
function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.push(handler)
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        const idx = listeners.indexOf(handler)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    }),
    dispatchChange(newMatches: boolean) {
      mql.matches = newMatches
      for (const listener of listeners) {
        listener({ matches: newMatches } as MediaQueryListEvent)
      }
    },
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return mql
}

describe('useReducedMotion', () => {
  let mql: ReturnType<typeof mockMatchMedia>

  beforeEach(() => {
    mockReduceMotion = 'system'
    mql = mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- All 3 states ---

  it('returns shouldReduceMotion: false when preference is "system" and OS has no preference', () => {
    mockReduceMotion = 'system'
    mql = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(false)
    expect(result.current.preference).toBe('system')
  })

  it('returns shouldReduceMotion: true when preference is "on"', () => {
    mockReduceMotion = 'on'
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(true)
    expect(result.current.preference).toBe('on')
  })

  it('returns shouldReduceMotion: false when preference is "off"', () => {
    mockReduceMotion = 'off'
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(false)
    expect(result.current.preference).toBe('off')
  })

  // --- OS media query interaction when 'system' is selected ---

  it('returns shouldReduceMotion: true when preference is "system" and OS prefers reduced motion', () => {
    mockReduceMotion = 'system'
    mql = mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(true)
    expect(result.current.preference).toBe('system')
  })

  it('responds to OS media query changes when preference is "system"', () => {
    mockReduceMotion = 'system'
    mql = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(false)

    // Simulate OS preference change
    act(() => {
      mql.dispatchChange(true)
    })
    expect(result.current.shouldReduceMotion).toBe(true)

    // Change back
    act(() => {
      mql.dispatchChange(false)
    })
    expect(result.current.shouldReduceMotion).toBe(false)
  })

  it('ignores OS media query changes when preference is "on"', () => {
    mockReduceMotion = 'on'
    mql = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(true)

    // OS change should not affect outcome
    act(() => {
      mql.dispatchChange(true)
    })
    expect(result.current.shouldReduceMotion).toBe(true)
  })

  it('ignores OS media query changes when preference is "off"', () => {
    mockReduceMotion = 'off'
    mql = mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(false)

    act(() => {
      mql.dispatchChange(false)
    })
    expect(result.current.shouldReduceMotion).toBe(false)
  })

  // --- settingsUpdated event triggers re-read ---

  it('responds to settingsUpdated event by re-reading settings', () => {
    mockReduceMotion = 'system'
    mql = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.shouldReduceMotion).toBe(false)
    expect(result.current.preference).toBe('system')

    // Simulate settings change
    mockReduceMotion = 'on'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })
    expect(result.current.shouldReduceMotion).toBe(true)
    expect(result.current.preference).toBe('on')
  })

  it('responds to storage event by re-reading settings', () => {
    mockReduceMotion = 'off'
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.preference).toBe('off')

    mockReduceMotion = 'system'
    act(() => {
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current.preference).toBe('system')
  })

  // --- Event listener cleanup on unmount ---

  it('removes all event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useReducedMotion())

    // Should have added settingsUpdated and storage listeners
    const addedEvents = addSpy.mock.calls.map(([event]) => event)
    expect(addedEvents).toContain('settingsUpdated')
    expect(addedEvents).toContain('storage')

    unmount()

    // Should have removed settingsUpdated and storage listeners
    const removedEvents = removeSpy.mock.calls.map(([event]) => event)
    expect(removedEvents).toContain('settingsUpdated')
    expect(removedEvents).toContain('storage')

    // matchMedia listener should also be cleaned up
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  // --- Default fallback ---

  it('defaults to "system" when reduceMotion is undefined in settings', () => {
    mockReduceMotion = undefined as unknown as 'system' | 'on' | 'off'
    mql = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current.preference).toBe('system')
    expect(result.current.shouldReduceMotion).toBe(false)
  })
})
