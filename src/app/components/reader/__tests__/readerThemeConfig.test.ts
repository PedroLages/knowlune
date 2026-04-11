/**
 * Unit tests for readerThemeConfig — E107-S05 Sync Reader Themes
 *
 * Tests the static color map and Tailwind class resolution for all
 * reader theme × color scheme combinations.
 */
import { describe, it, expect } from 'vitest'
import { getReaderThemeColors, getReaderChromeClasses } from '../readerThemeConfig'
import type { ReaderColors, ReaderChromeClasses, ColorScheme } from '../readerThemeConfig'

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
})
