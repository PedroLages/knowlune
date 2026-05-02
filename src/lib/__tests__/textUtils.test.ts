/**
 * Tests for text utility functions
 */
import { describe, it, expect } from 'vitest'
import { getInitials, stripHtml, sanitizeDescriptionHtml } from '../textUtils'

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

  describe('sanitizeDescriptionHtml', () => {
    it('preserves minimal inline formatting and maps b/i', () => {
      expect(sanitizeDescriptionHtml('<p>Hello <b>World</b> and <i>you</i>.</p>')).toBe(
        'Hello <strong>World</strong> and <em>you</em>.'
      )
    })

    it('converts block containers into <br /> boundaries', () => {
      expect(sanitizeDescriptionHtml('<p>One</p><p>Two</p>')).toBe('One<br /><br />Two')
      expect(sanitizeDescriptionHtml('<div>One</div><div>Two</div>')).toBe('One<br /><br />Two')
    })

    it('removes scripts, styles, and all attributes', () => {
      const input =
        '<p onclick="alert(1)">Hello <img src=x onerror="alert(2)" /> <strong style="color:red">X</strong></p>' +
        '<script>alert(3)</script><style>body{}</style>'
      const out = sanitizeDescriptionHtml(input)

      expect(out).toBe('Hello  <strong>X</strong>')
      expect(out).not.toMatch(/onerror|onclick|script|style|img/i)
      expect(out).not.toMatch(/style=/i)
    })

    it('escapes text content', () => {
      expect(sanitizeDescriptionHtml('<p>1 < 2 & 3 > 2</p>')).toBe('1 &lt; 2 &amp; 3 &gt; 2')
    })
  })
})
