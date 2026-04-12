/**
 * Unit tests for useSilenceDetection hook utilities.
 *
 * Tests the pure calculateRms function in isolation. The full hook (Web Audio API,
 * requestAnimationFrame) is covered by E2E tests in story-e111-s02.spec.ts.
 */
import { describe, it, expect } from 'vitest'
import { calculateRms } from '../useSilenceDetection'

describe('calculateRms', () => {
  it('returns 0 for all-128 array (pure silence)', () => {
    const data = new Uint8Array(2048).fill(128)
    expect(calculateRms(data)).toBe(0)
  })

  it('returns non-zero for non-128 values', () => {
    const data = new Uint8Array(2048).fill(128)
    data[0] = 255 // max positive deviation
    expect(calculateRms(data)).toBeGreaterThan(0)
  })

  it('returns ~1 for max-deviation signal (all 0 or all 255)', () => {
    // All 0: normalized = (0 - 128) / 128 = -1, rms = 1
    const allMin = new Uint8Array(2048).fill(0)
    expect(calculateRms(allMin)).toBeCloseTo(1.0, 5)

    // All 255: normalized = (255 - 128) / 128 ≈ 0.992, rms ≈ 0.992
    const allMax = new Uint8Array(2048).fill(255)
    expect(calculateRms(allMax)).toBeCloseTo(0.992, 2)
  })

  it('returns value below SILENCE_THRESHOLD (0.015) for near-silent data', () => {
    // Slight deviation from 128 — below the threshold
    const data = new Uint8Array(2048).fill(128)
    // Single sample at 130: normalized = 2/128 ≈ 0.0156; rms = 0.0156 / sqrt(2048) ≈ 0.00034
    data[0] = 130
    const rms = calculateRms(data)
    expect(rms).toBeLessThan(0.015)
  })

  it('handles single-element array without division by zero', () => {
    const data = new Uint8Array(1).fill(128)
    expect(calculateRms(data)).toBe(0)
  })

  it('returns value above SILENCE_THRESHOLD (0.015) for audible signal', () => {
    // Alternating 100/156 — normalized = ±28/128 ≈ ±0.219; rms ≈ 0.219
    const data = new Uint8Array(2048)
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 2 === 0 ? 100 : 156
    }
    const rms = calculateRms(data)
    expect(rms).toBeGreaterThan(0.015)
  })
})
