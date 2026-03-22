/**
 * Unit Tests: aiConfiguration.ts
 *
 * Tests core AI configuration management functions:
 * - getAIConfiguration: Default values, localStorage parsing, corruption handling
 * - saveAIConfiguration: Persistence, encryption, event dispatch
 * - isFeatureEnabled: Consent checks
 * - isAIAvailable: Connection status validation (AC5)
 * - sanitizeAIRequestPayload: PII stripping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAIConfiguration,
  saveAIConfiguration,
  isFeatureEnabled,
  isAIAvailable,
  sanitizeAIRequestPayload,
  getDecryptedApiKey,
  applyOllamaCSP,
  AI_PROVIDERS,
  DEFAULTS,
  type AIConfigurationSettings,
} from '@/lib/aiConfiguration'

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  encryptData: vi.fn(async (data: string) => `encrypted:${data}`),
  decryptData: vi.fn(async (encrypted: string) => {
    if (encrypted.startsWith('encrypted:')) {
      return encrypted.replace('encrypted:', '')
    }
    throw new Error('Invalid encrypted data')
  }),
}))

describe('aiConfiguration.ts', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('getAIConfiguration', () => {
    it('returns defaults when localStorage is empty', () => {
      const config = getAIConfiguration()
      expect(config).toEqual(DEFAULTS)
    })

    it('parses valid configuration from localStorage', () => {
      const storedConfig: AIConfigurationSettings = {
        provider: 'anthropic',
        connectionStatus: 'connected',
        consentSettings: {
          videoSummary: true,
          noteQA: false,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: false,
          analytics: true,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(storedConfig))

      const config = getAIConfiguration()
      expect(config).toEqual(storedConfig)
    })

    it('handles corrupted JSON gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem('ai-configuration', '{invalid json')

      const config = getAIConfiguration()
      expect(config).toEqual(DEFAULTS)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse AI configuration'),
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })

    it('merges partial consent settings with defaults', () => {
      const partialConfig = {
        provider: 'openai' as const,
        connectionStatus: 'disconnected' as const,
        consentSettings: {
          videoSummary: false,
          // Missing other consent fields
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(partialConfig))

      const config = getAIConfiguration()
      // Should have provider and status from storage
      expect(config.provider).toBe('openai')
      expect(config.connectionStatus).toBe('disconnected')
      // Should have complete consent settings (merged with defaults)
      expect(config.consentSettings).toEqual(
        expect.objectContaining({
          videoSummary: false,
          noteQA: expect.any(Boolean),
          learningPath: expect.any(Boolean),
          knowledgeGaps: expect.any(Boolean),
          noteOrganization: expect.any(Boolean),
          analytics: expect.any(Boolean),
        })
      )
    })
  })

  describe('saveAIConfiguration', () => {
    it('persists configuration to localStorage without API key', async () => {
      const newConfig: Partial<AIConfigurationSettings> = {
        provider: 'anthropic',
        connectionStatus: 'connected',
      }

      await saveAIConfiguration(newConfig)

      const stored = localStorage.getItem('ai-configuration')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.provider).toBe('anthropic')
      expect(parsed.connectionStatus).toBe('connected')
    })

    it('encrypts API key when provided', async () => {
      const config: Partial<AIConfigurationSettings> = {
        provider: 'openai',
        connectionStatus: 'connected',
      }
      const apiKey = 'sk-test-1234567890'

      await saveAIConfiguration(config, apiKey)

      const stored = localStorage.getItem('ai-configuration')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.apiKeyEncrypted).toBe(`encrypted:${apiKey}`)
    })

    it('dispatches ai-configuration-updated event', async () => {
      const eventListener = vi.fn()
      window.addEventListener('ai-configuration-updated', eventListener)

      await saveAIConfiguration({ provider: 'anthropic' })

      expect(eventListener).toHaveBeenCalledTimes(1)

      window.removeEventListener('ai-configuration-updated', eventListener)
    })

    it('merges new configuration with existing', async () => {
      // Set initial config
      const initialConfig: AIConfigurationSettings = {
        provider: 'openai',
        connectionStatus: 'connected',
        consentSettings: {
          videoSummary: true,
          noteQA: true,
          learningPath: false,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: false,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(initialConfig))

      // Update only connection status
      await saveAIConfiguration({ connectionStatus: 'error' })

      const stored = localStorage.getItem('ai-configuration')
      const parsed = JSON.parse(stored!)
      expect(parsed.provider).toBe('openai') // Preserved
      expect(parsed.connectionStatus).toBe('error') // Updated
      expect(parsed.consentSettings.videoSummary).toBe(true) // Preserved
    })
  })

  describe('isFeatureEnabled', () => {
    it('returns consent setting for valid feature', () => {
      const config: AIConfigurationSettings = {
        provider: 'anthropic',
        connectionStatus: 'connected',
        consentSettings: {
          videoSummary: true,
          noteQA: false,
          learningPath: true,
          knowledgeGaps: false,
          noteOrganization: true,
          analytics: false,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      expect(isFeatureEnabled('videoSummary')).toBe(true)
      expect(isFeatureEnabled('noteQA')).toBe(false)
      expect(isFeatureEnabled('learningPath')).toBe(true)
      expect(isFeatureEnabled('knowledgeGaps')).toBe(false)
    })

    it('returns false when feature consent disabled', () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        consentSettings: {
          videoSummary: false,
          noteQA: false,
          learningPath: false,
          knowledgeGaps: false,
          noteOrganization: false,
          analytics: false,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      expect(isFeatureEnabled('videoSummary')).toBe(false)
      expect(isFeatureEnabled('analytics')).toBe(false)
    })

    it('returns default consent when localStorage empty', () => {
      // With empty localStorage, should return defaults (all true)
      expect(isFeatureEnabled('videoSummary')).toBe(DEFAULTS.consentSettings.videoSummary)
    })
  })

  describe('isAIAvailable (AC5 - Graceful Degradation)', () => {
    it('returns true when connectionStatus is connected', () => {
      const config: AIConfigurationSettings = {
        provider: 'anthropic',
        connectionStatus: 'connected',
        consentSettings: DEFAULTS.consentSettings,
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      expect(isAIAvailable()).toBe(true)
    })

    it('returns false when connectionStatus is unconfigured', () => {
      const config: AIConfigurationSettings = {
        provider: 'openai',
        connectionStatus: 'unconfigured',
        consentSettings: DEFAULTS.consentSettings,
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      expect(isAIAvailable()).toBe(false)
    })

    it('returns false when connectionStatus is error', () => {
      const config: AIConfigurationSettings = {
        provider: 'anthropic',
        connectionStatus: 'error',
        consentSettings: DEFAULTS.consentSettings,
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      expect(isAIAvailable()).toBe(false)
    })

    it('returns false when localStorage is empty (unconfigured)', () => {
      localStorage.removeItem('ai-configuration')

      expect(isAIAvailable()).toBe(false)
    })
  })

  describe('sanitizeAIRequestPayload', () => {
    it('wraps content string in payload object', () => {
      const content = 'Test prompt'
      const sanitized = sanitizeAIRequestPayload(content)

      expect(sanitized).toEqual({ content: 'Test prompt' })
    })

    it('returns only content field (AC7 - no metadata)', () => {
      // Function accepts only string content, not metadata
      // Caller's responsibility to pass only content, not whole objects
      const content = 'Analyze this video'
      const sanitized = sanitizeAIRequestPayload(content)

      expect(sanitized).toEqual({ content: 'Analyze this video' })
      expect(Object.keys(sanitized)).toEqual(['content'])
    })

    it('handles empty content', () => {
      const sanitized = sanitizeAIRequestPayload('')

      expect(sanitized).toEqual({ content: '' })
    })

    it('preserves content with user data (caller must strip PII before passing)', () => {
      // This test verifies the function doesn't modify content
      // PII stripping happens at call site, not in this function
      const content = 'My name is John and my email is john@example.com'
      const sanitized = sanitizeAIRequestPayload(content)

      expect(sanitized.content).toBe('My name is John and my email is john@example.com')
    })
  })

  describe('Ollama provider (AC1, AC2)', () => {
    it("'ollama' is a valid AIProviderId in AI_PROVIDERS", () => {
      expect(AI_PROVIDERS.ollama).toBeDefined()
      expect(AI_PROVIDERS.ollama.id).toBe('ollama')
      expect(AI_PROVIDERS.ollama.name).toBe('Ollama (Local)')
      expect(AI_PROVIDERS.ollama.requiresApiKey).toBe(false)
    })

    it('validateApiKey accepts valid http URL', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('http://192.168.1.100:11434')).toBe(true)
    })

    it('validateApiKey accepts valid https URL', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('https://ollama.example.com')).toBe(true)
    })

    it('validateApiKey accepts URL with non-standard port', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('http://localhost:11435')).toBe(true)
    })

    it('validateApiKey rejects non-URL strings (API key format)', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('sk-not-a-url')).toBe(false)
    })

    it('validateApiKey rejects empty string', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('')).toBe(false)
    })

    it('testConnection returns true for valid URL', async () => {
      const result = await AI_PROVIDERS.ollama.testConnection('http://localhost:11434')
      expect(result).toBe(true)
    })
  })

  describe('getDecryptedApiKey for Ollama', () => {
    it('returns ollamaBaseUrl for Ollama provider without decryption', async () => {
      const config: AIConfigurationSettings = {
        provider: 'ollama',
        ollamaBaseUrl: 'http://192.168.1.100:11434',
        connectionStatus: 'connected',
        consentSettings: DEFAULTS.consentSettings,
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      const key = await getDecryptedApiKey()
      expect(key).toBe('http://192.168.1.100:11434')
    })

    it('returns null for Ollama provider with no URL configured', async () => {
      const config: AIConfigurationSettings = {
        provider: 'ollama',
        connectionStatus: 'unconfigured',
        consentSettings: DEFAULTS.consentSettings,
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      const key = await getDecryptedApiKey()
      expect(key).toBeNull()
    })
  })

  describe('applyOllamaCSP (AC5)', () => {
    it('adds Ollama URL to connect-src in meta CSP tag', () => {
      // Create a mock meta CSP tag
      const meta = document.createElement('meta')
      meta.setAttribute('http-equiv', 'Content-Security-Policy')
      meta.setAttribute('content', "default-src 'self'; connect-src 'self' ws: wss:")
      document.head.appendChild(meta)

      applyOllamaCSP('http://192.168.1.100:11434')

      const content = meta.getAttribute('content') ?? ''
      expect(content).toContain('http://192.168.1.100:11434')
      expect(content).toMatch(/connect-src http:\/\/192\.168\.1\.100:11434/)

      document.head.removeChild(meta)
    })

    it('does not duplicate URL if already present', () => {
      const url = 'http://192.168.1.100:11434'
      const meta = document.createElement('meta')
      meta.setAttribute('http-equiv', 'Content-Security-Policy')
      meta.setAttribute('content', `default-src 'self'; connect-src 'self' ${url}`)
      document.head.appendChild(meta)

      applyOllamaCSP(url)

      const content = meta.getAttribute('content') ?? ''
      // Should appear exactly once
      expect(content.split(url).length - 1).toBe(1)

      document.head.removeChild(meta)
    })

    it('is a no-op when no meta CSP tag exists', () => {
      // Should not throw
      expect(() => applyOllamaCSP('http://localhost:11434')).not.toThrow()
    })

    it('is a no-op for empty URL', () => {
      expect(() => applyOllamaCSP('')).not.toThrow()
    })
  })
})
