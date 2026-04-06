import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { mockGetSettings } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(() => ({
    fontSize: 'medium' as const,
  })),
}))

vi.mock('@/lib/settings', () => ({
  getSettings: () => mockGetSettings(),
  FONT_SIZE_PX: {
    small: 14,
    medium: 16,
    large: 18,
    'extra-large': 20,
  },
}))

import { useFontScale } from '../useFontScale'

describe('useFontScale', () => {
  beforeEach(() => {
    mockGetSettings.mockReturnValue({ fontSize: 'medium' })
  })

  afterEach(() => {
    document.documentElement.style.removeProperty('--font-size')
    vi.restoreAllMocks()
  })

  it('sets --font-size on mount', () => {
    renderHook(() => useFontScale())
    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('16px')
  })

  it('applies correct px for different font sizes', () => {
    mockGetSettings.mockReturnValue({ fontSize: 'large' })
    renderHook(() => useFontScale())
    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('18px')
  })

  it('responds to settingsUpdated event', () => {
    renderHook(() => useFontScale())

    mockGetSettings.mockReturnValue({ fontSize: 'small' })
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })
    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('14px')
  })

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useFontScale())
    unmount()

    const removed = removeSpy.mock.calls.map(([event]) => event)
    expect(removed).toContain('settingsUpdated')
    expect(removed).toContain('storage')
  })

  it('defaults to 16px when fontSize is undefined', () => {
    mockGetSettings.mockReturnValue({})
    renderHook(() => useFontScale())
    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('16px')
  })
})
