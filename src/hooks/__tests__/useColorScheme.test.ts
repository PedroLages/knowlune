import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockColorScheme: 'professional' | 'vibrant' | 'clean' | 'apple' | undefined = undefined

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
    document.documentElement.classList.remove('vibrant', 'clean', 'apple')
  })

  afterEach(() => {
    document.documentElement.classList.remove('vibrant', 'clean', 'apple')
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

  // ── Clean scheme tests ─────────────────────────────────────────────────

  it('returns "clean" when settings have colorScheme: "clean"', () => {
    mockColorScheme = 'clean'
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe('clean')
  })

  it('adds .clean class to <html> when clean is active', () => {
    mockColorScheme = 'clean'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('clean')).toBe(true)
  })

  it('removes .clean class on unmount', () => {
    mockColorScheme = 'clean'
    const { unmount } = renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('clean')).toBe(true)

    unmount()
    expect(document.documentElement.classList.contains('clean')).toBe(false)
  })

  // ── Apple scheme tests ─────────────────────────────────────────────────

  it('returns "apple" when settings have colorScheme: "apple"', () => {
    mockColorScheme = 'apple'
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe('apple')
  })

  it('adds .apple class to <html> when apple is active', () => {
    mockColorScheme = 'apple'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('apple')).toBe(true)
  })

  it('removes .apple class on unmount', () => {
    mockColorScheme = 'apple'
    const { unmount } = renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('apple')).toBe(true)

    unmount()
    expect(document.documentElement.classList.contains('apple')).toBe(false)
  })

  it('responds to settingsUpdated event by switching to apple', () => {
    mockColorScheme = 'professional'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('apple')).toBe(false)

    mockColorScheme = 'apple'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    expect(document.documentElement.classList.contains('apple')).toBe(true)
  })

  it('only one scheme class is active at a time when switching to apple', () => {
    mockColorScheme = 'vibrant'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('vibrant')).toBe(true)

    mockColorScheme = 'apple'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    expect(document.documentElement.classList.contains('apple')).toBe(true)
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
    expect(document.documentElement.classList.contains('clean')).toBe(false)
  })

  it('switches from apple back to professional on settingsUpdated', () => {
    mockColorScheme = 'apple'
    renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('apple')).toBe(true)

    mockColorScheme = 'professional'
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    expect(document.documentElement.classList.contains('apple')).toBe(false)
    expect(document.documentElement.classList.contains('vibrant')).toBe(false)
  })
})
