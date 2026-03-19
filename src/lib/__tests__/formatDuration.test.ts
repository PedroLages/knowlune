import { describe, it, expect } from 'vitest'
import { formatDuration } from '../formatDuration'

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45000)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(512000)).toBe('8m 32s')
  })

  it('formats minutes only (no remaining seconds)', () => {
    expect(formatDuration(120000)).toBe('2m')
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661000)).toBe('1h 1m 1s')
  })

  it('formats hours and minutes (no remaining seconds)', () => {
    expect(formatDuration(7200000)).toBe('2h')
  })

  it('returns "0s" for zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('returns "0s" for negative values', () => {
    expect(formatDuration(-1000)).toBe('0s')
  })

  it('handles 1 minute 5 seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s')
  })

  it('floors partial seconds', () => {
    expect(formatDuration(1500)).toBe('1s')
  })

  it('formats 30 seconds (common quiz duration)', () => {
    expect(formatDuration(30000)).toBe('30s')
  })
})
