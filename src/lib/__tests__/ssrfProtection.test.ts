/**
 * Unit Tests: ssrfProtection.ts
 *
 * Tests SSRF protection for proxy URL validation:
 * - Blocks loopback addresses (localhost, 127.x, ::1)
 * - Blocks cloud metadata (169.254.x)
 * - Allows private LAN ranges (192.168.x, 10.x, 172.16-31.x)
 * - Allows public internet addresses
 * - Rejection reason messages
 */

import { describe, it, expect } from 'vitest'
import { isAllowedProxyUrl, getProxyUrlRejectionReason } from '@/lib/ssrfProtection'

describe('ssrfProtection.ts', () => {
  describe('isAllowedProxyUrl', () => {
    // Allowed URLs
    it('allows private LAN 192.168.x.x', () => {
      expect(isAllowedProxyUrl('http://192.168.1.100:5000')).toBe(true)
    })

    it('allows private LAN 10.x.x.x', () => {
      expect(isAllowedProxyUrl('http://10.0.0.50:9000')).toBe(true)
    })

    it('allows private LAN 172.16-31.x.x', () => {
      expect(isAllowedProxyUrl('http://172.16.0.1:8080')).toBe(true)
      expect(isAllowedProxyUrl('http://172.31.255.255:8080')).toBe(true)
    })

    it('allows public internet addresses', () => {
      expect(isAllowedProxyUrl('https://api.example.com')).toBe(true)
    })

    it('allows HTTPS URLs', () => {
      expect(isAllowedProxyUrl('https://192.168.1.100:5000')).toBe(true)
    })

    // Blocked URLs
    it('blocks localhost', () => {
      expect(isAllowedProxyUrl('http://localhost:5000')).toBe(false)
    })

    it('blocks 127.0.0.1', () => {
      expect(isAllowedProxyUrl('http://127.0.0.1:5000')).toBe(false)
    })

    it('blocks 127.x.x.x range', () => {
      expect(isAllowedProxyUrl('http://127.1.2.3:5000')).toBe(false)
    })

    it('blocks 0.0.0.0', () => {
      expect(isAllowedProxyUrl('http://0.0.0.0:5000')).toBe(false)
    })

    it('blocks IPv6 loopback [::1]', () => {
      expect(isAllowedProxyUrl('http://[::1]:5000')).toBe(false)
    })

    it('blocks cloud metadata 169.254.169.254', () => {
      expect(isAllowedProxyUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    })

    it('blocks 169.254.x.x range', () => {
      expect(isAllowedProxyUrl('http://169.254.0.1:80')).toBe(false)
    })

    it('blocks non-HTTP protocols (ftp)', () => {
      expect(isAllowedProxyUrl('ftp://192.168.1.100:5000')).toBe(false)
    })

    it('blocks non-HTTP protocols (file)', () => {
      expect(isAllowedProxyUrl('file:///etc/passwd')).toBe(false)
    })

    it('returns false for invalid URL', () => {
      expect(isAllowedProxyUrl('not-a-url')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isAllowedProxyUrl('')).toBe(false)
    })
  })

  describe('getProxyUrlRejectionReason', () => {
    it('returns null for valid URLs', () => {
      expect(getProxyUrlRejectionReason('http://192.168.1.100:5000')).toBeNull()
    })

    it('returns loopback message for localhost', () => {
      const reason = getProxyUrlRejectionReason('http://localhost:5000')
      expect(reason).toContain('Loopback')
    })

    it('returns metadata message for 169.254.x', () => {
      const reason = getProxyUrlRejectionReason('http://169.254.169.254')
      expect(reason).toContain('metadata')
    })

    it('returns protocol message for ftp', () => {
      const reason = getProxyUrlRejectionReason('ftp://example.com')
      expect(reason).toContain('HTTP')
    })

    it('returns format message for invalid URL', () => {
      const reason = getProxyUrlRejectionReason('not-a-url')
      expect(reason).toContain('Invalid')
    })
  })
})
