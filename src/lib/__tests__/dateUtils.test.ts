import { describe, it, expect } from 'vitest'
import { toLocalDateString } from '../dateUtils'

describe('toLocalDateString', () => {
  describe('with explicit date argument', () => {
    it('formats date to YYYY-MM-DD (ISO format)', () => {
      const date = new Date('2025-01-15T10:00:00.000Z')
      const result = toLocalDateString(date)

      // Swedish locale formats dates as YYYY-MM-DD
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('handles January dates correctly', () => {
      const date = new Date('2025-01-05T12:00:00Z')
      const result = toLocalDateString(date)

      expect(result).toContain('2025-01')
      expect(result).toMatch(/2025-01-\d{2}/)
    })

    it('handles December dates correctly', () => {
      const date = new Date('2024-12-25T12:00:00Z')
      const result = toLocalDateString(date)

      expect(result).toContain('2024-12')
      expect(result).toMatch(/2024-12-\d{2}/)
    })

    it('handles leap year dates correctly', () => {
      const date = new Date('2024-02-29T12:00:00Z') // Leap year
      const result = toLocalDateString(date)

      expect(result).toContain('2024-02')
      expect(result).toMatch(/2024-02-\d{2}/)
    })

    it('handles non-leap year February correctly', () => {
      const date = new Date('2025-02-28T12:00:00Z') // Non-leap year
      const result = toLocalDateString(date)

      expect(result).toContain('2025-02')
      expect(result).toMatch(/2025-02-\d{2}/)
    })
  })

  describe('with default date (current date)', () => {
    it('returns string in YYYY-MM-DD format when no argument provided', () => {
      const result = toLocalDateString()

      // Should match YYYY-MM-DD format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns valid date when called without arguments', () => {
      const result = toLocalDateString()

      // Should be parseable back to a valid date
      const parsedDate = new Date(result)
      expect(parsedDate).toBeInstanceOf(Date)
      expect(isNaN(parsedDate.getTime())).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles epoch date (1970-01-01)', () => {
      const date = new Date(0)
      const result = toLocalDateString(date)

      expect(result).toMatch(/197\d-01-01/)
    })

    it('handles year 2000 boundary', () => {
      const date = new Date('2000-01-01T00:00:00Z')
      const result = toLocalDateString(date)

      expect(result).toMatch(/2000-01-01/)
    })

    it('handles far future dates', () => {
      const date = new Date('2100-12-31T12:00:00Z')
      const result = toLocalDateString(date)

      // Should match 2100-12-31 in most timezones (using midday to avoid timezone edge cases)
      expect(result).toMatch(/2100-12-3[01]/)
    })

    it('handles single-digit days with leading zero', () => {
      const date = new Date('2025-03-05T12:00:00Z')
      const result = toLocalDateString(date)

      // Swedish locale should add leading zero
      expect(result).toMatch(/2025-03-0\d/)
    })

    it('handles single-digit months with leading zero', () => {
      const date = new Date('2025-05-15T12:00:00Z')
      const result = toLocalDateString(date)

      // Swedish locale should add leading zero
      expect(result).toMatch(/2025-0\d-15/)
    })
  })

  describe('consistency', () => {
    it('returns same format for same date called multiple times', () => {
      const date = new Date('2025-06-15T12:00:00Z')
      const result1 = toLocalDateString(date)
      const result2 = toLocalDateString(date)

      expect(result1).toBe(result2)
    })

    it('returns different dates for different Date objects', () => {
      const date1 = new Date('2025-01-01T12:00:00Z')
      const date2 = new Date('2025-12-31T12:00:00Z')

      const result1 = toLocalDateString(date1)
      const result2 = toLocalDateString(date2)

      expect(result1).not.toBe(result2)
    })
  })

  describe('return value structure', () => {
    it('always returns a string', () => {
      const date = new Date('2025-01-15T12:00:00Z')
      const result = toLocalDateString(date)

      expect(typeof result).toBe('string')
    })

    it('returns string of expected length (10 characters)', () => {
      const date = new Date('2025-01-15T12:00:00Z')
      const result = toLocalDateString(date)

      // YYYY-MM-DD is exactly 10 characters
      expect(result.length).toBe(10)
    })
  })
})
