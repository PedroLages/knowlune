import { describe, it, expect } from 'vitest'
import { calculateNormalizedGain, interpretNormalizedGain } from './analytics'

describe('calculateNormalizedGain', () => {
  it('returns correct gain for standard improvement', () => {
    // (85 - 60) / (100 - 60) = 25 / 40 = 0.625
    expect(calculateNormalizedGain(60, 85)).toBeCloseTo(0.625)
  })

  it('returns null when initialScore is exactly 100', () => {
    expect(calculateNormalizedGain(100, 100)).toBeNull()
  })

  it('returns null when initialScore exceeds 100 (guard)', () => {
    expect(calculateNormalizedGain(101, 101)).toBeNull()
  })

  it('returns negative value for score regression', () => {
    // (50 - 80) / (100 - 80) = -30 / 20 = -1.5
    expect(calculateNormalizedGain(80, 50)).toBeCloseTo(-1.5)
  })

  it('returns 0 when scores are identical', () => {
    expect(calculateNormalizedGain(70, 70)).toBe(0)
  })

  it('returns 1 for perfect improvement from 0 to 100', () => {
    expect(calculateNormalizedGain(0, 100)).toBe(1)
  })

  it('high initial score amplifies small improvements (correct behavior)', () => {
    // (97 - 95) / (100 - 95) = 2 / 5 = 0.4 → medium gain
    expect(calculateNormalizedGain(95, 97)).toBeCloseTo(0.4)
  })
})

describe('interpretNormalizedGain', () => {
  it('returns regression for negative gain', () => {
    expect(interpretNormalizedGain(-0.5).level).toBe('regression')
  })

  it('returns low for gain in [0, 0.3)', () => {
    expect(interpretNormalizedGain(0).level).toBe('low')
    expect(interpretNormalizedGain(0.1).level).toBe('low')
    expect(interpretNormalizedGain(0.299).level).toBe('low')
  })

  it('returns medium for gain in [0.3, 0.7)', () => {
    expect(interpretNormalizedGain(0.3).level).toBe('medium')
    expect(interpretNormalizedGain(0.5).level).toBe('medium')
    expect(interpretNormalizedGain(0.699).level).toBe('medium')
  })

  it('returns high for gain >= 0.7', () => {
    expect(interpretNormalizedGain(0.7).level).toBe('high')
    expect(interpretNormalizedGain(1.0).level).toBe('high')
  })

  it('includes non-empty messages for all levels', () => {
    for (const gain of [-0.1, 0.1, 0.5, 0.9]) {
      expect(interpretNormalizedGain(gain).message.length).toBeGreaterThan(0)
    }
  })
})
