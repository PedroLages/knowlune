/**
 * WCAG 2.1 Relative Luminance & Contrast Ratio Helpers
 *
 * Pure functions for computing contrast ratios in test assertions.
 * Works in any test context (vitest, Playwright Node.js side).
 * For inside page.evaluate(), inline the functions to avoid serialization issues.
 *
 * Usage:
 *   import { linearize, relativeLuminance, hexLuminance, luminanceContrast, hexContrast } from '../utils/wcag-contrast'
 *
 * @module wcag-contrast
 */

/**
 * Linearize an sRGB channel (0-255 -> 0-1) per WCAG 2.1.
 * The `**` operator is used for readability; the result is identical to Math.pow.
 */
export function linearize(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * Relative luminance from raw 0-255 sRGB channel values.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Relative luminance of a hex color string (e.g. "#ffffff").
 */
export function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return relativeLuminance(r, g, b)
}

/**
 * WCAG 2.1 contrast ratio between two relative luminance values.
 */
export function luminanceContrast(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG 2.1 contrast ratio between two hex color strings.
 */
export function hexContrast(fgHex: string, bgHex: string): number {
  return luminanceContrast(hexLuminance(fgHex), hexLuminance(bgHex))
}
