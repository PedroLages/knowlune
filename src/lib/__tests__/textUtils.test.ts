/**
 * Tests for text utility functions
 */
import { describe, it, expect } from 'vitest'
import { getInitials, stripHtml } from '../textUtils'

describe('textUtils', () => {
  describe('getInitials', () => {
    it('extracts first letter of each word, max 2', () => {
      expect(getInitials('John Doe')).toBe('JD')
    })

    it('returns single initial for single-word name', () => {
      expect(getInitials('Alice')).toBe('A')
    })

    it('takes only first two words for three-word names', () => {
      expect(getInitials('John Michael Doe')).toBe('JM')
    })

    it('uppercases initials', () => {
      expect(getInitials('jane doe')).toBe('JD')
    })

    it('returns empty string for empty input', () => {
      expect(getInitials('')).toBe('')
    })

    it('returns empty string for non-string input', () => {
      expect(getInitials(null as unknown as string)).toBe('')
      expect(getInitials(undefined as unknown as string)).toBe('')
    })

    it('trims whitespace and handles multiple spaces', () => {
      expect(getInitials('  Bob    Smith  ')).toBe('BS')
    })
  })

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).toBe('Hello')
      expect(stripHtml('<div><span>Test</span></div>')).toBe('Test')
    })

    it('should decode HTML entities', () => {
      expect(stripHtml('&amp;')).toBe('&')
      expect(stripHtml('&lt;')).toBe('<')
      expect(stripHtml('&gt;')).toBe('>')
      expect(stripHtml('&quot;')).toBe('"')
      expect(stripHtml('&#39;')).toBe("'")
    })

    it('should handle mixed HTML and entities', () => {
      expect(stripHtml('<p>Hello &amp; goodbye</p>')).toBe('Hello & goodbye')
      expect(stripHtml('<div>&lt;code&gt; example</div>')).toBe('<code> example')
    })

    it('should trim whitespace', () => {
      expect(stripHtml('  <p>  Test  </p>  ')).toBe('Test')
    })

    it('should handle empty string', () => {
      expect(stripHtml('')).toBe('')
    })

    it('should handle plain text without HTML', () => {
      expect(stripHtml('Hello world')).toBe('Hello world')
    })
  })
})
