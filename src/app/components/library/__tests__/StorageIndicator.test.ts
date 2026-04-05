/**
 * Unit tests for StorageIndicator threshold logic.
 *
 * Tests the color-coded progress bar thresholds and warning message visibility
 * without rendering the component (pure logic validation).
 *
 * @since E83-S07
 */
import { describe, it, expect } from 'vitest'

/**
 * Extracted threshold logic from StorageIndicator.tsx lines 68-75.
 * This mirrors the component's inline logic for testability.
 */
function getBarColor(percent: number): string {
  if (percent > 0.95) return 'bg-destructive'
  if (percent >= 0.8) return 'bg-warning'
  return 'bg-brand'
}

function shouldShowWarning(percent: number): boolean {
  return percent > 0.9
}

describe('StorageIndicator threshold logic', () => {
  describe('getBarColor', () => {
    it('returns bg-brand below 80%', () => {
      expect(getBarColor(0)).toBe('bg-brand')
      expect(getBarColor(0.5)).toBe('bg-brand')
      expect(getBarColor(0.79)).toBe('bg-brand')
    })

    it('returns bg-warning at exactly 80%', () => {
      expect(getBarColor(0.8)).toBe('bg-warning')
    })

    it('returns bg-warning between 80% and 95%', () => {
      expect(getBarColor(0.85)).toBe('bg-warning')
      expect(getBarColor(0.9)).toBe('bg-warning')
      expect(getBarColor(0.95)).toBe('bg-warning')
    })

    it('returns bg-destructive above 95%', () => {
      expect(getBarColor(0.951)).toBe('bg-destructive')
      expect(getBarColor(0.96)).toBe('bg-destructive')
      expect(getBarColor(1.0)).toBe('bg-destructive')
    })

    it('handles boundary at 95% (inclusive warning)', () => {
      expect(getBarColor(0.95)).toBe('bg-warning')
      expect(getBarColor(0.9500001)).toBe('bg-destructive')
    })
  })

  describe('shouldShowWarning', () => {
    it('does not show warning at or below 90%', () => {
      expect(shouldShowWarning(0.5)).toBe(false)
      expect(shouldShowWarning(0.9)).toBe(false)
    })

    it('shows warning above 90%', () => {
      expect(shouldShowWarning(0.91)).toBe(true)
      expect(shouldShowWarning(0.95)).toBe(true)
      expect(shouldShowWarning(1.0)).toBe(true)
    })
  })
})
