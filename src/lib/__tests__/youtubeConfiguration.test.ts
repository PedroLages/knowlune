/**
 * Unit Tests: youtubeConfiguration.ts
 *
 * Tests YouTube configuration management:
 * - getYouTubeConfiguration: Defaults, parsing, corruption handling
 * - saveYouTubeConfiguration: Persistence, encryption, events
 * - validateYouTubeApiKey: Format validation
 * - clearYouTubeApiKey: Key removal
 * - getCacheTtlMs: TTL conversion
 * - isYouTubeConfigured: Configuration status
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getYouTubeConfiguration,
  saveYouTubeConfiguration,
  validateYouTubeApiKey,
  clearYouTubeApiKey,
  getCacheTtlMs,
  isYouTubeConfigured,
  YOUTUBE_DEFAULTS,
  DEFAULT_CACHE_TTL_DAYS,
  MIN_CACHE_TTL_DAYS,
  MAX_CACHE_TTL_DAYS,
} from '@/lib/youtubeConfiguration'

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  encryptData: vi.fn(async (data: string) => ({
    iv: 'mock-iv',
    encryptedData: `encrypted:${data}`,
  })),
  decryptData: vi.fn(async (_iv: string, encrypted: string) => {
    if (encrypted.startsWith('encrypted:')) {
      return encrypted.replace('encrypted:', '')
    }
    throw new Error('Invalid encrypted data')
  }),
}))

describe('youtubeConfiguration.ts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('getYouTubeConfiguration', () => {
    it('returns defaults when localStorage is empty', () => {
      const config = getYouTubeConfiguration()
      expect(config).toEqual(YOUTUBE_DEFAULTS)
      expect(config.cacheTtlDays).toBe(DEFAULT_CACHE_TTL_DAYS)
    })

    it('parses valid configuration from localStorage', () => {
      localStorage.setItem(
        'youtube-configuration',
        JSON.stringify({
          cacheTtlDays: 14,
          ytDlpServerUrl: 'http://192.168.1.100:5000',
        })
      )
      const config = getYouTubeConfiguration()
      expect(config.cacheTtlDays).toBe(14)
      expect(config.ytDlpServerUrl).toBe('http://192.168.1.100:5000')
    })

    it('returns defaults for corrupted localStorage', () => {
      localStorage.setItem('youtube-configuration', '{invalid json')
      const config = getYouTubeConfiguration()
      expect(config).toEqual(YOUTUBE_DEFAULTS)
    })

    it('clamps TTL below minimum to MIN_CACHE_TTL_DAYS', () => {
      localStorage.setItem(
        'youtube-configuration',
        JSON.stringify({ cacheTtlDays: 0 })
      )
      const config = getYouTubeConfiguration()
      expect(config.cacheTtlDays).toBe(MIN_CACHE_TTL_DAYS)
    })

    it('clamps TTL above maximum to MAX_CACHE_TTL_DAYS', () => {
      localStorage.setItem(
        'youtube-configuration',
        JSON.stringify({ cacheTtlDays: 99 })
      )
      const config = getYouTubeConfiguration()
      expect(config.cacheTtlDays).toBe(MAX_CACHE_TTL_DAYS)
    })
  })

  describe('saveYouTubeConfiguration', () => {
    it('persists settings to localStorage', async () => {
      await saveYouTubeConfiguration({ cacheTtlDays: 10 })
      const raw = localStorage.getItem('youtube-configuration')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw!)
      expect(parsed.cacheTtlDays).toBe(10)
    })

    it('encrypts API key before storage', async () => {
      const result = await saveYouTubeConfiguration({}, 'AIzaTestKey1234567890123456789012345AB')
      expect(result.apiKeyEncrypted).toBeDefined()
      expect(result.apiKeyEncrypted?.encryptedData).toContain('encrypted:')
    })

    it('dispatches youtube-configuration-updated event', async () => {
      const listener = vi.fn()
      window.addEventListener('youtube-configuration-updated', listener)
      await saveYouTubeConfiguration({ cacheTtlDays: 5 })
      window.removeEventListener('youtube-configuration-updated', listener)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('merges with existing configuration', async () => {
      await saveYouTubeConfiguration({
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      })
      await saveYouTubeConfiguration({ cacheTtlDays: 14 })
      const config = getYouTubeConfiguration()
      expect(config.ytDlpServerUrl).toBe('http://192.168.1.100:5000')
      expect(config.cacheTtlDays).toBe(14)
    })

    it('clamps TTL to valid range on save', async () => {
      await saveYouTubeConfiguration({ cacheTtlDays: 50 })
      const config = getYouTubeConfiguration()
      expect(config.cacheTtlDays).toBe(MAX_CACHE_TTL_DAYS)
    })
  })

  describe('validateYouTubeApiKey', () => {
    it('accepts valid API key format (AIza + 35 chars)', () => {
      // AIza + 35 chars = 39 total
      expect(validateYouTubeApiKey('AIzaSyA12345678901234567890123456789ABC')).toBe(true)
    })

    it('rejects key without AIza prefix', () => {
      expect(validateYouTubeApiKey('sk-1234567890123456789012345678901234')).toBe(false)
    })

    it('rejects key that is too short', () => {
      expect(validateYouTubeApiKey('AIza123')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(validateYouTubeApiKey('')).toBe(false)
    })

    it('accepts key with dashes and underscores', () => {
      // AIza + 35 chars (with dashes and underscores) = 39 total
      expect(validateYouTubeApiKey('AIzaSyA-_234567890123456789012345678ABC')).toBe(true)
    })
  })

  describe('clearYouTubeApiKey', () => {
    it('removes encrypted key from configuration', async () => {
      await saveYouTubeConfiguration({}, 'AIzaTestKey1234567890123456789012345AB')
      expect(getYouTubeConfiguration().apiKeyEncrypted).toBeDefined()

      await clearYouTubeApiKey()
      expect(getYouTubeConfiguration().apiKeyEncrypted).toBeUndefined()
    })

    it('preserves other settings when clearing key', async () => {
      await saveYouTubeConfiguration({
        cacheTtlDays: 14,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      }, 'AIzaTestKey1234567890123456789012345AB')

      await clearYouTubeApiKey()
      const config = getYouTubeConfiguration()
      expect(config.cacheTtlDays).toBe(14)
      expect(config.ytDlpServerUrl).toBe('http://192.168.1.100:5000')
    })
  })

  describe('isYouTubeConfigured', () => {
    it('returns false when no key is configured', () => {
      expect(isYouTubeConfigured()).toBe(false)
    })

    it('returns true when API key is encrypted and stored', async () => {
      await saveYouTubeConfiguration({}, 'AIzaTestKey1234567890123456789012345AB')
      expect(isYouTubeConfigured()).toBe(true)
    })
  })

  describe('getCacheTtlMs', () => {
    it('converts default TTL to milliseconds', () => {
      const ms = getCacheTtlMs()
      expect(ms).toBe(DEFAULT_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
    })

    it('converts custom TTL to milliseconds', async () => {
      await saveYouTubeConfiguration({ cacheTtlDays: 14 })
      const ms = getCacheTtlMs()
      expect(ms).toBe(14 * 24 * 60 * 60 * 1000)
    })
  })
})
