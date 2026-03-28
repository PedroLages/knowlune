import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockContentDensity: 'default' | 'spacious' = 'default'

vi.mock('@/lib/settings', () => ({
  getSettings: () => ({
    displayName: 'Student',
    bio: '',
    theme: 'system' as const,
    colorScheme: 'professional' as const,
    accessibilityFont: false,
    contentDensity: mockContentDensity,
    reduceMotion: 'system' as const,
  }),
}))

// Import after mock is set up
import { useContentDensity } from '../useContentDensity'

describe('useContentDensity', () => {
  beforeEach(() => {
    mockContentDensity = 'default'
    document.documentElement.classList.remove('spacious')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove('spacious')
  })

  // --- Core class toggling ---

  it('adds .spacious class to <html> when contentDensity is "spacious"', () => {
    mockContentDensity = 'spacious'
    renderHook(() => useContentDensity())
    expect(document.documentElement.classList.contains('spacious')).toBe(true)
  })

  it('removes .spacious class from <html> when contentDensity is "default"', () => {
    // Start with spacious, then switch to default
    mockContentDensity = 'spacious'
    const { unmount } = renderHook(() => useContentDensity())
    expect(document.documentElement.classList.contains('spacious')).toBe(true)
    unmount()

    mockContentDensity = 'default'
    renderHook(() => useContentDensity())
    expect(document.documentElement.classList.contains('spacious')).toBe(false)
  })

  // --- Event listener cleanup on unmount ---

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useContentDensity())

    // Should have added settingsUpdated listener
    const addedEvents = addSpy.mock.calls.map(([event]) => event)
    expect(addedEvents).toContain('settingsUpdated')

    unmount()

    // Should have removed settingsUpdated listener
    const removedEvents = removeSpy.mock.calls.map(([event]) => event)
    expect(removedEvents).toContain('settingsUpdated')

    // .spacious class should be cleaned up
    expect(document.documentElement.classList.contains('spacious')).toBe(false)
  })

  // --- settingsUpdated event triggers re-read ---

  it('responds to settingsUpdated event by re-reading settings', () => {
    mockContentDensity = 'default'
    renderHook(() => useContentDensity())
    expect(document.documentElement.classList.contains('spacious')).toBe(false)

    // Simulate settings change
    mockContentDensity = 'spacious'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })
    expect(document.documentElement.classList.contains('spacious')).toBe(true)
  })

  // --- Default fallback ---

  it('defaults to "default" when contentDensity is undefined in settings', () => {
    mockContentDensity = undefined as unknown as 'default' | 'spacious'
    const { result } = renderHook(() => useContentDensity())
    expect(result.current).toBe('default')
    expect(document.documentElement.classList.contains('spacious')).toBe(false)
  })
})
