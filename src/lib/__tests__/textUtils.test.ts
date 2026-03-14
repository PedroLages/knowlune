/**
 * Tests for text utility functions
 */
import { describe, it, expect } from 'vitest'
import { stripHtml } from '../textUtils'

describe('textUtils', () => {
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
