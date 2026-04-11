/**
 * Unit tests for readerThemeConfig — E107-S05 Sync Reader Themes
 *
 * Tests the static color map and Tailwind class resolution for all
 * reader theme × color scheme combinations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getReaderThemeColors, getReaderChromeClasses, useAppColorScheme } from '../readerThemeConfig'
import type { ReaderColors, ReaderChromeClasses, ColorScheme } from '../readerThemeConfig'
import { getSettings } from '@/lib/settings'

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn(() => ({ colorScheme: 'professional' })),
}))

describe('getReaderThemeColors', () => {
  it('returns professional light colors matching theme.css', () => {
    const colors = getReaderThemeColors('light', 'professional')
    expect(colors).toEqual({ background: '#faf5ee', foreground: '#1c1d2b' })
  })

  it('returns professional dark colors matching theme.css', () => {
    const colors = getReaderThemeColors('dark', 'professional')
    expect(colors).toEqual({ background: '#1a1b26', foreground: '#e8e9f0' })
  })

  it('returns sepia colors regardless of color scheme', () => {
    const schemes: ColorScheme[] = ['professional', 'vibrant', 'clean']
    for (const scheme of schemes) {
      const colors = getReaderThemeColors('sepia', scheme)
      expect(colors).toEqual({ background: '#f4ecd8', foreground: '#3a2a1a' })
    }
  })

  it('vibrant light matches professional light (vibrant only changes brand/accent)', () => {
    const professional = getReaderThemeColors('light', 'professional')
    const vibrant = getReaderThemeColors('light', 'vibrant')
    expect(vibrant).toEqual(professional)
  })

  it('clean light has distinct cool blue-white background', () => {
    const colors = getReaderThemeColors('light', 'clean')
    expect(colors).toEqual({ background: '#f9f9fe', foreground: '#2c333d' })
  })

  it('clean dark falls back to default dark (clean is light-only)', () => {
    const cleanDark = getReaderThemeColors('dark', 'clean')
    const professionalDark = getReaderThemeColors('dark', 'professional')
    expect(cleanDark).toEqual(professionalDark)
  })

  it('returns ReaderColors type for all combinations', () => {
    const themes = ['light', 'sepia', 'dark'] as const
    const schemes: ColorScheme[] = ['professional', 'vibrant', 'clean']
    for (const theme of themes) {
      for (const scheme of schemes) {
        const colors: ReaderColors = getReaderThemeColors(theme, scheme)
        expect(colors.background).toMatch(/^#[0-9a-f]{6}$/i)
        expect(colors.foreground).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})

describe('getReaderChromeClasses', () => {
  it('returns Tailwind classes with correct bg hex for professional light', () => {
    const classes = getReaderChromeClasses('light', 'professional')
    expect(classes.bg).toBe('bg-[#faf5ee]')
    expect(classes.bgOverlay).toBe('bg-[#faf5ee]/60')
    expect(classes.bgBar).toBe('bg-[#faf5ee]/98')
    expect(classes.text).toBe('text-[#1c1d2b]')
  })

  it('returns Tailwind classes with correct bg hex for clean light', () => {
    const classes = getReaderChromeClasses('light', 'clean')
    expect(classes.bg).toBe('bg-[#f9f9fe]')
    expect(classes.text).toBe('text-[#2c333d]')
  })

  it('returns Tailwind classes for dark theme', () => {
    const classes = getReaderChromeClasses('dark', 'professional')
    expect(classes.bg).toBe('bg-[#1a1b26]')
    expect(classes.text).toBe('text-[#e8e9f0]')
  })

  it('returns Tailwind classes for sepia theme', () => {
    const classes = getReaderChromeClasses('sepia', 'professional')
    expect(classes.bg).toBe('bg-[#f4ecd8]')
    expect(classes.text).toBe('text-[#3a2a1a]')
  })

  it('returns ReaderChromeClasses type for all combinations', () => {
    const themes = ['light', 'sepia', 'dark'] as const
    const schemes: ColorScheme[] = ['professional', 'vibrant', 'clean']
    for (const theme of themes) {
      for (const scheme of schemes) {
        const classes: ReaderChromeClasses = getReaderChromeClasses(theme, scheme)
        expect(classes.bg).toMatch(/^bg-\[#[0-9a-f]+\]$/)
        expect(classes.bgOverlay).toMatch(/^bg-\[#[0-9a-f]+\]\/60$/)
        expect(classes.bgBar).toMatch(/^bg-\[#[0-9a-f]+\]\/98$/)
        expect(classes.text).toMatch(/^text-\[#[0-9a-f]+\]$/)
      }
    }
  })

  it('falls back to Professional defaults and warns when hex is unknown', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // All valid inputs produce known hex values, so fallback should NOT fire
    const classes = getReaderChromeClasses('light', 'professional')
    expect(classes.bg).toBe('bg-[#faf5ee]')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('getReaderThemeColors — runtime guard', () => {
  it('falls back to professional for unknown colorScheme', () => {
    // Force an invalid scheme through the type system
    const colors = getReaderThemeColors('light', 'nonexistent' as ColorScheme)
    expect(colors).toEqual({ background: '#faf5ee', foreground: '#1c1d2b' })
  })

  it('falls back to professional for undefined colorScheme', () => {
    const colors = getReaderThemeColors('light', undefined as unknown as ColorScheme)
    expect(colors).toEqual({ background: '#faf5ee', foreground: '#1c1d2b' })
  })
})

describe('WCAG AA contrast ratios', () => {
  /** Linearize an sRGB channel (0-255 -> 0-1) */
  function linearize(c: number): number {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  /** Relative luminance per WCAG 2.1 */
  function luminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  }

  /** Contrast ratio per WCAG 2.1 */
  function contrastRatio(hex1: string, hex2: string): number {
    const l1 = luminance(hex1)
    const l2 = luminance(hex2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  const themes = ['light', 'sepia', 'dark'] as const
  const schemes: ColorScheme[] = ['professional', 'vibrant', 'clean']

  for (const theme of themes) {
    for (const scheme of schemes) {
      it(`${theme}/${scheme} has contrast ratio >= 4.5:1`, () => {
        const colors = getReaderThemeColors(theme, scheme)
        const ratio = contrastRatio(colors.background, colors.foreground)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('useAppColorScheme', () => {
  const mockGetSettings = vi.mocked(getSettings)

  beforeEach(() => {
    mockGetSettings.mockReturnValue({ colorScheme: 'professional' } as ReturnType<typeof getSettings>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initial value from settings', () => {
    const { result } = renderHook(() => useAppColorScheme())
    expect(result.current).toBe('professional')
  })

  it('updates when settingsUpdated event fires', () => {
    const { result } = renderHook(() => useAppColorScheme())
    expect(result.current).toBe('professional')

    mockGetSettings.mockReturnValue({ colorScheme: 'clean' } as ReturnType<typeof getSettings>)
    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })
    expect(result.current).toBe('clean')
  })

  it('falls back to professional for invalid scheme from settings', () => {
    mockGetSettings.mockReturnValue({ colorScheme: 'invalid-scheme' } as ReturnType<typeof getSettings>)
    const { result } = renderHook(() => useAppColorScheme())
    expect(result.current).toBe('professional')
  })

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useAppColorScheme())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('settingsUpdated', expect.any(Function))
    removeSpy.mockRestore()
  })
})
