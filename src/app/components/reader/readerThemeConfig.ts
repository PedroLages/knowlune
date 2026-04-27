/**
 * Shared reader theme configuration — single source of truth for EPUB reader colors.
 *
 * Defines the reader's independent Page Tone palette. Colors are resolved hex
 * values because epub.js renders in an isolated iframe where CSS custom
 * properties from the host document don't cascade.
 *
 * @module readerThemeConfig
 */
import { useState, useEffect } from 'react'
import { getSettings } from '@/lib/settings'
import type { ReaderTheme } from '@/stores/useReaderStore'

export type ColorScheme = 'professional' | 'vibrant' | 'clean'

const VALID_COLOR_SCHEMES = new Set<ColorScheme>(['professional', 'vibrant', 'clean'])

function resolveColorScheme(raw: unknown): ColorScheme {
  return typeof raw === 'string' && VALID_COLOR_SCHEMES.has(raw as ColorScheme)
    ? (raw as ColorScheme)
    : 'professional'
}

export interface ReaderColors {
  /** Resolved hex background for epub.js iframe injection */
  background: string
  /** Resolved hex foreground for epub.js iframe injection */
  foreground: string
}

/**
 * Static Page Tone map. The reader palette is intentionally independent from
 * the app-wide Professional/Vibrant/Clean color scheme.
 */
const THEME_COLORS: Record<ReaderTheme, ReaderColors> = {
  white: { background: '#ffffff', foreground: '#1c1d2b' },
  sepia: { background: '#f4ecd8', foreground: '#2d241e' },
  gray: { background: '#e5e5e5', foreground: '#1f2937' },
  dark: { background: '#383a56', foreground: '#f7f7fb' },
  black: { background: '#000000', foreground: '#f8fafc' },
}

/**
 * Returns resolved hex colors for a reader Page Tone.
 *
 * The optional colorScheme parameter is accepted for compatibility with older
 * call sites, but reader tones no longer vary by app color scheme.
 */
export function getReaderThemeColors(theme: ReaderTheme, _colorScheme?: ColorScheme): ReaderColors {
  return THEME_COLORS[theme] ?? THEME_COLORS.sepia
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
  '#ffffff': { bg: 'bg-[#ffffff]', bgOverlay: 'bg-[#ffffff]/60', bgBar: 'bg-[#ffffff]/98' },
  '#f4ecd8': { bg: 'bg-[#f4ecd8]', bgOverlay: 'bg-[#f4ecd8]/60', bgBar: 'bg-[#f4ecd8]/98' },
  '#e5e5e5': { bg: 'bg-[#e5e5e5]', bgOverlay: 'bg-[#e5e5e5]/60', bgBar: 'bg-[#e5e5e5]/98' },
  '#383a56': { bg: 'bg-[#383a56]', bgOverlay: 'bg-[#383a56]/60', bgBar: 'bg-[#383a56]/98' },
  '#000000': { bg: 'bg-[#000000]', bgOverlay: 'bg-[#000000]/60', bgBar: 'bg-[#000000]/98' },
}

const TEXT_CLASSES: Record<string, string> = {
  '#1c1d2b': 'text-[#1c1d2b]',
  '#2d241e': 'text-[#2d241e]',
  '#1f2937': 'text-[#1f2937]',
  '#f7f7fb': 'text-[#f7f7fb]',
  '#f8fafc': 'text-[#f8fafc]',
}

/**
 * Returns pre-computed Tailwind classes for reader chrome styling.
 */
export function getReaderChromeClasses(
  theme: ReaderTheme,
  colorScheme?: ColorScheme
): ReaderChromeClasses {
  const colors = getReaderThemeColors(theme, colorScheme)
  let bgClasses = BG_CLASSES[colors.background]
  if (!bgClasses) {
    console.warn(
      `Unknown background hex "${colors.background}", falling back to reader sepia (#f4ecd8)`
    )
    bgClasses = BG_CLASSES['#f4ecd8']
  }
  let textClass = TEXT_CLASSES[colors.foreground]
  if (!textClass) {
    console.warn(
      `Unknown foreground hex "${colors.foreground}", falling back to reader sepia (#2d241e)`
    )
    textClass = TEXT_CLASSES['#2d241e']
  }
  return { ...bgClasses, text: textClass }
}

/**
 * Hook that returns the app's current color scheme, reactive to settings changes.
 * Read-only — does not apply CSS classes (that's useColorScheme's job).
 */
export function useAppColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() => {
    return resolveColorScheme(getSettings().colorScheme)
  })

  useEffect(() => {
    const handler = () => {
      setScheme(resolveColorScheme(getSettings().colorScheme))
    }
    window.addEventListener('settingsUpdated', handler)
    return () => window.removeEventListener('settingsUpdated', handler)
  }, [])

  return scheme
}
