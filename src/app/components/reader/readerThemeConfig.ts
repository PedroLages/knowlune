/**
 * Shared reader theme configuration — single source of truth for EPUB reader colors.
 *
 * Bridges the app's color scheme (Professional/Vibrant/Clean) with the reader's
 * independent theme selector (Light/Sepia/Dark). Colors are resolved hex values
 * because epub.js renders in an isolated iframe where CSS custom properties
 * from the host document don't cascade.
 *
 * @module readerThemeConfig
 */
import { useState, useEffect } from 'react'
import { getSettings } from '@/lib/settings'
import type { ReaderTheme } from '@/stores/useReaderStore'

export type ColorScheme = 'professional' | 'vibrant' | 'clean'

export interface ReaderColors {
  /** Resolved hex background for epub.js iframe injection */
  background: string
  /** Resolved hex foreground for epub.js iframe injection */
  foreground: string
}

/**
 * Static color map: reader theme x color scheme -> resolved hex values.
 * Values sourced from CSS custom properties in theme.css.
 *
 * - Vibrant only overrides brand/accent colors, not background/foreground
 * - Clean has a distinct light bg (#f9f9fe) but shares dark mode with default
 * - Sepia is reader-only and ignores the app color scheme entirely
 */
const THEME_COLORS: Record<ReaderTheme, Record<ColorScheme, ReaderColors>> = {
  light: {
    professional: { background: '#faf5ee', foreground: '#1c1d2b' },
    vibrant: { background: '#faf5ee', foreground: '#1c1d2b' },
    clean: { background: '#f9f9fe', foreground: '#2c333d' },
  },
  dark: {
    professional: { background: '#1a1b26', foreground: '#e8e9f0' },
    vibrant: { background: '#1a1b26', foreground: '#e8e9f0' },
    clean: { background: '#1a1b26', foreground: '#e8e9f0' },
  },
  sepia: {
    professional: { background: '#f4ecd8', foreground: '#3a2a1a' },
    vibrant: { background: '#f4ecd8', foreground: '#3a2a1a' },
    clean: { background: '#f4ecd8', foreground: '#3a2a1a' },
  },
}

/**
 * Returns resolved hex colors for a reader theme + app color scheme combination.
 */
export function getReaderThemeColors(theme: ReaderTheme, colorScheme: ColorScheme): ReaderColors {
  return THEME_COLORS[theme][colorScheme]
}

/**
 * Pre-computed Tailwind arbitrary-value classes for reader chrome (header, footer, TTS bar).
 * All class strings are literal in source code for Tailwind v4 JIT scanning.
 */
export interface ReaderChromeClasses {
  /** Solid background (epub container) */
  bg: string
  /** 60% opacity background (header/footer overlays) */
  bgOverlay: string
  /** 98% opacity background (TTS control bar) */
  bgBar: string
  /** Foreground text color */
  text: string
}

// Map from hex background to Tailwind classes — literal strings for Tailwind scanning
const BG_CLASSES: Record<string, { bg: string; bgOverlay: string; bgBar: string }> = {
  '#faf5ee': { bg: 'bg-[#faf5ee]', bgOverlay: 'bg-[#faf5ee]/60', bgBar: 'bg-[#faf5ee]/98' },
  '#f9f9fe': { bg: 'bg-[#f9f9fe]', bgOverlay: 'bg-[#f9f9fe]/60', bgBar: 'bg-[#f9f9fe]/98' },
  '#1a1b26': { bg: 'bg-[#1a1b26]', bgOverlay: 'bg-[#1a1b26]/60', bgBar: 'bg-[#1a1b26]/98' },
  '#f4ecd8': { bg: 'bg-[#f4ecd8]', bgOverlay: 'bg-[#f4ecd8]/60', bgBar: 'bg-[#f4ecd8]/98' },
}

const TEXT_CLASSES: Record<string, string> = {
  '#1c1d2b': 'text-[#1c1d2b]',
  '#2c333d': 'text-[#2c333d]',
  '#e8e9f0': 'text-[#e8e9f0]',
  '#3a2a1a': 'text-[#3a2a1a]',
}

/**
 * Returns pre-computed Tailwind classes for reader chrome styling.
 */
export function getReaderChromeClasses(
  theme: ReaderTheme,
  colorScheme: ColorScheme
): ReaderChromeClasses {
  const colors = getReaderThemeColors(theme, colorScheme)
  const bgClasses = BG_CLASSES[colors.background] ?? BG_CLASSES['#faf5ee']
  const textClass = TEXT_CLASSES[colors.foreground] ?? TEXT_CLASSES['#1c1d2b']
  return { ...bgClasses, text: textClass }
}

/**
 * Hook that returns the app's current color scheme, reactive to settings changes.
 * Read-only — does not apply CSS classes (that's useColorScheme's job).
 */
export function useAppColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() => {
    return (getSettings().colorScheme as ColorScheme) ?? 'professional'
  })

  useEffect(() => {
    const handler = () => {
      setScheme((getSettings().colorScheme as ColorScheme) ?? 'professional')
    }
    window.addEventListener('settingsUpdated', handler)
    return () => window.removeEventListener('settingsUpdated', handler)
  }, [])

  return scheme
}
