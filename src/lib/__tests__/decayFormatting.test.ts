import { describe, it, expect } from 'vitest'
import { formatDecayLabel, daysUntilDecay } from '../decayFormatting'

// Helper: ISO string for a date N days from a reference
function daysFrom(ref: Date, n: number): string {
  const d = new Date(ref.getTime() + n * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

const NOW = new Date('2026-01-15T12:00:00Z')

describe('daysUntilDecay', () => {
  it('returns positive days for a future date', () => {
    expect(daysUntilDecay(daysFrom(NOW, 10), NOW)).toBe(10)
  })

  it('returns negative days for a past date', () => {
    const result = daysUntilDecay(daysFrom(NOW, -3), NOW)
    expect(result).toBeLessThan(0)
  })

  it('returns 1 for a date exactly 1 day in the future', () => {
    expect(daysUntilDecay(daysFrom(NOW, 1), NOW)).toBe(1)
  })
})

describe('formatDecayLabel', () => {
  it('returns null when predictedDecayDate is null', () => {
    expect(formatDecayLabel(null, NOW)).toBeNull()
  })

  it('returns "Already fading" with destructive class for past dates', () => {
    const result = formatDecayLabel(daysFrom(NOW, -1), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Already fading')
    expect(result!.colorClass).toBe('text-destructive')
  })

  it('returns "Fading today" when decay date is today (days === 0)', () => {
    const result = formatDecayLabel(NOW.toISOString(), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Fading today')
    expect(result!.colorClass).toBe('text-destructive')
  })

  it('returns singular "day" for exactly 1 day away', () => {
    const result = formatDecayLabel(daysFrom(NOW, 1), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Fading in 1 day')
    expect(result!.colorClass).toBe('text-destructive')
  })

  it('returns plural "days" for 3 days away (< 7 threshold)', () => {
    const result = formatDecayLabel(daysFrom(NOW, 3), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Fading in 3 days')
    expect(result!.colorClass).toBe('text-destructive')
  })

  it('returns "Fading in 6 days" for 6 days (still < 7 threshold)', () => {
    const result = formatDecayLabel(daysFrom(NOW, 6), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toMatch(/^Fading in 6 days$/)
    expect(result!.colorClass).toBe('text-destructive')
  })

  it('returns "Fading by Mon Day" with warning class for 7-30 days range', () => {
    const result = formatDecayLabel(daysFrom(NOW, 7), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toMatch(/^Fading by /)
    expect(result!.colorClass).toBe('text-warning')
  })

  it('returns warning class for 30 days (boundary)', () => {
    const result = formatDecayLabel(daysFrom(NOW, 30), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toMatch(/^Fading by /)
    expect(result!.colorClass).toBe('text-warning')
  })

  it('returns "Stable until Mon Day" with success class for > 30 days', () => {
    const result = formatDecayLabel(daysFrom(NOW, 31), NOW)
    expect(result).not.toBeNull()
    expect(result!.label).toMatch(/^Stable until /)
    expect(result!.colorClass).toBe('text-success')
  })

  it('uses current date when now is not provided', () => {
    // Date far in the future should be "Stable"
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const result = formatDecayLabel(farFuture)
    expect(result).not.toBeNull()
    expect(result!.colorClass).toBe('text-success')
  })
})
