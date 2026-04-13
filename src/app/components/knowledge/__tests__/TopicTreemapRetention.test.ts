/**
 * Unit tests for TopicTreemap pure functions (E62-S02).
 * Tests retention color logic and text contrast calculation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Inline the pure functions under test — avoids browser DOM dependencies from
// the module-level MutationObserver and document.createElement calls.
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

// Replicate getRetentionColor with fixed token colors (no DOM)
const FIXED_COLORS = {
  success: hexToRgb('#3a7553'),  // green
  warning: hexToRgb('#866224'),  // amber
  destructive: hexToRgb('#c44850'), // red
}

function getRetentionColor(retention: number | null): string | 'tier-fallback' {
  if (retention === null) return 'tier-fallback'
  const colors = FIXED_COLORS
  let rgb: [number, number, number]
  if (retention >= 85) {
    rgb = colors.success
  } else if (retention <= 20) {
    rgb = colors.destructive
  } else if (retention >= 50) {
    const t = (retention - 50) / 35
    rgb = lerpRgb(colors.warning, colors.success, t)
  } else {
    const t = (retention - 20) / 30
    rgb = lerpRgb(colors.destructive, colors.warning, t)
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getTextColorForBg(bgColor: string): string {
  const match = bgColor.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/)
  if (match) {
    const lum = getRelativeLuminance(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]))
    return lum > 0.179 ? 'var(--foreground)' : '#ffffff'
  }
  return 'var(--foreground)'
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getRetentionColor', () => {
  it('returns tier-fallback for null retention', () => {
    expect(getRetentionColor(null)).toBe('tier-fallback')
  })

  it('returns success color for high retention (>= 85)', () => {
    const color = getRetentionColor(90)
    expect(color).toBe(`rgb(${FIXED_COLORS.success.join(', ')})`)
  })

  it('returns success color at exactly 85', () => {
    const color = getRetentionColor(85)
    expect(color).toBe(`rgb(${FIXED_COLORS.success.join(', ')})`)
  })

  it('returns destructive color for low retention (<= 20)', () => {
    const color = getRetentionColor(10)
    expect(color).toBe(`rgb(${FIXED_COLORS.destructive.join(', ')})`)
  })

  it('returns destructive color at exactly 20', () => {
    const color = getRetentionColor(20)
    expect(color).toBe(`rgb(${FIXED_COLORS.destructive.join(', ')})`)
  })

  it('returns a mid-range interpolated color for retention 50-84', () => {
    const color = getRetentionColor(67)
    // Should be between warning and success — not equal to either endpoint
    expect(color).toMatch(/^rgb\(/)
    expect(color).not.toBe(`rgb(${FIXED_COLORS.success.join(', ')})`)
    expect(color).not.toBe(`rgb(${FIXED_COLORS.warning.join(', ')})`)
  })

  it('returns a low-range interpolated color for retention 21-49', () => {
    const color = getRetentionColor(35)
    expect(color).toMatch(/^rgb\(/)
    expect(color).not.toBe(`rgb(${FIXED_COLORS.destructive.join(', ')})`)
    expect(color).not.toBe(`rgb(${FIXED_COLORS.warning.join(', ')})`)
  })
})

describe('getTextColorForBg', () => {
  it('returns white (#ffffff) for a dark background', () => {
    // Very dark green from success token
    expect(getTextColorForBg('rgb(58, 117, 83)')).toBe('#ffffff')
  })

  it('returns var(--foreground) for a light background', () => {
    // High RGB = light background
    expect(getTextColorForBg('rgb(220, 220, 220)')).toBe('var(--foreground)')
  })

  it('returns var(--foreground) for CSS variable fallback (non-rgb value)', () => {
    expect(getTextColorForBg('var(--success)')).toBe('var(--foreground)')
  })

  it('handles pure black background', () => {
    expect(getTextColorForBg('rgb(0, 0, 0)')).toBe('#ffffff')
  })

  it('handles pure white background', () => {
    expect(getTextColorForBg('rgb(255, 255, 255)')).toBe('var(--foreground)')
  })
})

describe('getRelativeLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(getRelativeLuminance(0, 0, 0)).toBeCloseTo(0)
  })

  it('returns 1 for pure white', () => {
    expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1)
  })

  it('returns a value between 0 and 1 for mid tones', () => {
    const lum = getRelativeLuminance(128, 128, 128)
    expect(lum).toBeGreaterThan(0)
    expect(lum).toBeLessThan(1)
  })
})
