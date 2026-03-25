import { describe, it, expect } from 'vitest'
import { isAllowedOllamaUrl } from '../index.js'

describe('isAllowedOllamaUrl', () => {
  describe('valid URLs (private network / LAN servers)', () => {
    it('allows 192.168.x.x private IPs', () => {
      expect(isAllowedOllamaUrl('http://192.168.1.100:11434')).toBe(true)
    })

    it('allows 10.x.x.x private IPs', () => {
      expect(isAllowedOllamaUrl('http://10.0.0.5:11434')).toBe(true)
    })

    it('allows 172.16-31.x.x private IPs', () => {
      expect(isAllowedOllamaUrl('http://172.16.0.1:11434')).toBe(true)
      expect(isAllowedOllamaUrl('http://172.31.255.255:11434')).toBe(true)
    })

    it('allows public IP addresses', () => {
      expect(isAllowedOllamaUrl('http://203.0.113.50:11434')).toBe(true)
    })

    it('allows hostnames', () => {
      expect(isAllowedOllamaUrl('http://my-ollama-server.local:11434')).toBe(true)
    })

    it('allows https URLs', () => {
      expect(isAllowedOllamaUrl('https://192.168.1.100:11434')).toBe(true)
    })
  })

  describe('blocked loopback addresses (SSRF prevention)', () => {
    it('blocks localhost', () => {
      expect(isAllowedOllamaUrl('http://localhost:11434')).toBe(false)
    })

    it('blocks 127.0.0.1', () => {
      expect(isAllowedOllamaUrl('http://127.0.0.1:11434')).toBe(false)
    })

    it('blocks 0.0.0.0', () => {
      expect(isAllowedOllamaUrl('http://0.0.0.0:11434')).toBe(false)
    })

    it('blocks IPv6 loopback [::1]', () => {
      expect(isAllowedOllamaUrl('http://[::1]:11434')).toBe(false)
    })

    it('blocks 127.x.x.x range', () => {
      expect(isAllowedOllamaUrl('http://127.0.0.2:11434')).toBe(false)
      expect(isAllowedOllamaUrl('http://127.255.255.255:11434')).toBe(false)
    })
  })

  describe('blocked protocols', () => {
    it('blocks file:// protocol', () => {
      expect(isAllowedOllamaUrl('file:///etc/passwd')).toBe(false)
    })

    it('blocks ftp:// protocol', () => {
      expect(isAllowedOllamaUrl('ftp://192.168.1.100:11434')).toBe(false)
    })

    it('blocks javascript: protocol', () => {
      expect(isAllowedOllamaUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('rejects missing protocol', () => {
      expect(isAllowedOllamaUrl('192.168.1.100:11434')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isAllowedOllamaUrl('')).toBe(false)
    })

    it('rejects malformed URLs', () => {
      expect(isAllowedOllamaUrl('not a url at all')).toBe(false)
    })

    it('blocks cloud metadata IP 169.254.169.254', () => {
      // AWS/GCP/Azure metadata endpoint — blocked as defense-in-depth against SSRF
      expect(isAllowedOllamaUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    })

    it('blocks entire link-local range 169.254.0.0/16', () => {
      expect(isAllowedOllamaUrl('http://169.254.0.1:11434')).toBe(false)
      expect(isAllowedOllamaUrl('http://169.254.255.255:11434')).toBe(false)
    })
  })
})
