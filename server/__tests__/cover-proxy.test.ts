/**
 * Unit tests for the cover proxy route validation logic.
 *
 * Tests SSRF protection (protocol check, domain allowlist) and
 * content-type validation via the exported pure functions.
 */
import { describe, it, expect } from 'vitest'
import {
  validateCoverProxyUrl,
  isAllowedImageContentType,
} from '../routes/cover-proxy.js'

// ── validateCoverProxyUrl ─────────────────────────────────────────────────────

describe('validateCoverProxyUrl', () => {
  describe('valid URLs (approved CDN domains)', () => {
    it('allows books.google.com', () => {
      expect(validateCoverProxyUrl('https://books.google.com/books/content?id=abc&zoom=6')).toBeNull()
    })

    it('allows covers.openlibrary.org', () => {
      expect(validateCoverProxyUrl('https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg')).toBeNull()
    })

    it('allows *.mzstatic.com (iTunes CDN)', () => {
      expect(validateCoverProxyUrl('https://is5-ssl.mzstatic.com/image/thumb/Music/abc/cover.jpg')).toBeNull()
      expect(validateCoverProxyUrl('https://a1.mzstatic.com/us/r30/Music/cover.jpg')).toBeNull()
    })
  })

  describe('protocol checks (SSRF prevention)', () => {
    it('rejects http:// URLs', () => {
      expect(validateCoverProxyUrl('http://books.google.com/books/content?id=abc')).toMatch(/only https/i)
    })

    it('rejects ftp:// URLs', () => {
      expect(validateCoverProxyUrl('ftp://books.google.com/image.jpg')).toMatch(/only https/i)
    })

    it('rejects file:// URLs', () => {
      expect(validateCoverProxyUrl('file:///etc/passwd')).toMatch(/only https/i)
    })

    it('rejects invalid URL strings', () => {
      expect(validateCoverProxyUrl('not-a-url')).toMatch(/invalid url/i)
    })
  })

  describe('domain allowlist (SSRF prevention)', () => {
    it('rejects non-allowlisted domain', () => {
      expect(validateCoverProxyUrl('https://evil.com/image.jpg')).toMatch(/domain not in allowlist/i)
    })

    it('rejects IP address URLs', () => {
      expect(validateCoverProxyUrl('https://192.168.1.1/image.jpg')).toMatch(/domain not in allowlist/i)
    })

    it('rejects subdomain of allowlisted domain (not in allowlist)', () => {
      // books.google.com is allowed, but sub.books.google.com is not
      expect(validateCoverProxyUrl('https://sub.books.google.com/image.jpg')).toMatch(/domain not in allowlist/i)
    })

    it('rejects domain that only ends with allowlisted domain as a suffix attack', () => {
      // evil-books.google.com.evil.com should not match *.mzstatic.com
      expect(validateCoverProxyUrl('https://fakemzstatic.com/image.jpg')).toMatch(/domain not in allowlist/i)
    })
  })
})

// ── isAllowedImageContentType ─────────────────────────────────────────────────

describe('isAllowedImageContentType', () => {
  describe('allowed image types', () => {
    it('allows image/jpeg', () => {
      expect(isAllowedImageContentType('image/jpeg')).toBe(true)
    })

    it('allows image/jpeg with charset parameter', () => {
      expect(isAllowedImageContentType('image/jpeg; charset=utf-8')).toBe(true)
    })

    it('allows image/png', () => {
      expect(isAllowedImageContentType('image/png')).toBe(true)
    })

    it('allows image/webp', () => {
      expect(isAllowedImageContentType('image/webp')).toBe(true)
    })

    it('allows image/gif', () => {
      expect(isAllowedImageContentType('image/gif')).toBe(true)
    })
  })

  describe('rejected content types', () => {
    it('rejects image/svg+xml (SVG allows inline script)', () => {
      expect(isAllowedImageContentType('image/svg+xml')).toBe(false)
    })

    it('rejects text/html', () => {
      expect(isAllowedImageContentType('text/html')).toBe(false)
    })

    it('rejects application/json', () => {
      expect(isAllowedImageContentType('application/json')).toBe(false)
    })

    it('rejects empty content type', () => {
      expect(isAllowedImageContentType('')).toBe(false)
    })
  })
})
