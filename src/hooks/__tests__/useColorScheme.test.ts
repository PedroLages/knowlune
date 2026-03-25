import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockColorScheme: 'professional' | 'vibrant' | undefined = undefined

vi.mock('@/lib/settings', () => ({
  getSettings: () => ({
    displayName: 'Student',
    bio: '',
    theme: 'system' as const,
    colorScheme: mockColorScheme,
  }),
}))

// Import after mock is set up
import { useColorScheme } from '../useColorScheme'

describe('useColorScheme', () => {
  beforeEach(() => {
    mockColorScheme = undefined
    document.documentElement.classList.remove('vibrant')
  })

  afterEach(() => {
    document.documentElement.classList.remove('vibrant')
  })

  it('returns "professional" by default when colorScheme is not set', () => {
    mockColorScheme = undefined
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe('professional')
  })

  it('does not add .vibrant class for professional scheme', () => {
    mockColorScheme = 'professional'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
  })

  it('returns "vibrant" when settings have colorScheme: "vibrant"', () => {
    mockColorScheme = 'vibrant'
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe('vibrant')
  })

  it('adds .vibrant class to <html> when vibrant is active', () => {
    mockColorScheme = 'vibrant'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(true)
  })

  it('removes .vibrant class on unmount', () => {
    mockColorScheme = 'vibrant'
    const { unmount } = renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(true)

    unmount()
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
  })

  it('responds to settingsUpdated event by re-reading settings', () => {
    mockColorScheme = 'professional'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)

    // Simulate settings change from Settings page
    mockColorScheme = 'vibrant'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    expect(document.documentElement.classList.contains('vibrant')).toBe(true)
  })

  it('switches back to professional on settingsUpdated', () => {
    mockColorScheme = 'vibrant'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(true)

    // Switch back
    mockColorScheme = 'professional'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
  })

  it('defaults to professional when colorScheme is undefined (legacy settings)', () => {
    mockColorScheme = undefined
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe('professional')
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
  })
})
