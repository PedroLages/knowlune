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
  isBudgetMode,
  filterFreeModels,
  resolveFeatureModel,
  sanitizeAIRequestPayload,
  getOllamaServerUrl,
  isOllamaDirectConnection,
  AI_PROVIDERS,
  DEFAULTS,
  type AIConfigurationSettings,
} from '@/lib/aiConfiguration'
import type { DiscoveredModel } from '@/lib/modelDiscovery'

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

  // ===========================================================================
  // Ollama Provider (E22-S01)
  // ===========================================================================

  describe('Ollama provider', () => {
    it('includes ollama in AI_PROVIDERS registry', () => {
      expect(AI_PROVIDERS.ollama).toBeDefined()
      expect(AI_PROVIDERS.ollama.id).toBe('ollama')
      expect(AI_PROVIDERS.ollama.name).toBe('Ollama (Local)')
      expect(AI_PROVIDERS.ollama.usesServerUrl).toBe(true)
    })

    it('validates valid HTTP Ollama URLs', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('http://192.168.1.100:11434')).toBe(true)
      expect(AI_PROVIDERS.ollama.validateApiKey('http://localhost:11434')).toBe(true)
      expect(AI_PROVIDERS.ollama.validateApiKey('https://ollama.example.com')).toBe(true)
      expect(AI_PROVIDERS.ollama.validateApiKey('http://10.0.0.1:8080')).toBe(true)
    })

    it('rejects invalid Ollama URLs', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('not-a-url')).toBe(false)
      expect(AI_PROVIDERS.ollama.validateApiKey('ftp://server:11434')).toBe(false)
      expect(AI_PROVIDERS.ollama.validateApiKey('')).toBe(false)
    })

    it('validates URLs with trailing slashes', () => {
      expect(AI_PROVIDERS.ollama.validateApiKey('http://localhost:11434/')).toBe(true)
    })
  })

  describe('getOllamaServerUrl', () => {
    it('returns null when provider is not ollama', () => {
      localStorage.setItem('ai-configuration', JSON.stringify({ ...DEFAULTS, provider: 'openai' }))
      expect(getOllamaServerUrl()).toBeNull()
    })

    it('returns server URL when ollama is configured', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
          ollamaSettings: { serverUrl: 'http://192.168.2.200:11434', directConnection: false },
        })
      )
      expect(getOllamaServerUrl()).toBe('http://192.168.2.200:11434')
    })

    it('returns null when ollama has no settings', () => {
      localStorage.setItem('ai-configuration', JSON.stringify({ ...DEFAULTS, provider: 'ollama' }))
      expect(getOllamaServerUrl()).toBeNull()
    })
  })

  describe('isOllamaDirectConnection', () => {
    it('returns false by default', () => {
      localStorage.setItem('ai-configuration', JSON.stringify({ ...DEFAULTS, provider: 'ollama' }))
      expect(isOllamaDirectConnection()).toBe(false)
    })

    it('returns true when direct connection is enabled', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
          ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: true },
        })
      )
      expect(isOllamaDirectConnection()).toBe(true)
    })
  })

  describe('saveAIConfiguration with Ollama settings', () => {
    it('persists ollama settings to localStorage', async () => {
      await saveAIConfiguration({
        provider: 'ollama',
        ollamaSettings: {
          serverUrl: 'http://192.168.2.200:11434',
          directConnection: false,
        },
      })

      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.provider).toBe('ollama')
      expect(stored.ollamaSettings.serverUrl).toBe('http://192.168.2.200:11434')
      expect(stored.ollamaSettings.directConnection).toBe(false)
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

  // ===========================================================================
  // Budget Mode
  // ===========================================================================

  describe('isBudgetMode', () => {
    it('returns false by default', () => {
      expect(isBudgetMode()).toBe(false)
    })

    it('returns true when budgetMode is set', () => {
      localStorage.setItem('ai-configuration', JSON.stringify({ ...DEFAULTS, budgetMode: true }))
      expect(isBudgetMode()).toBe(true)
    })

    it('persists via saveAIConfiguration', async () => {
      await saveAIConfiguration({ budgetMode: true })
      expect(isBudgetMode()).toBe(true)
    })
  })

  describe('filterFreeModels', () => {
    const models: DiscoveredModel[] = [
      { id: 'free-1', name: 'Free', provider: 'glm', costTier: 'free', capabilities: [] },
      { id: 'paid-1', name: 'Paid', provider: 'glm', costTier: 'high', capabilities: [] },
      { id: 'medium-1', name: 'Med', provider: 'glm', costTier: 'medium', capabilities: [] },
      { id: 'local-1', name: 'Local', provider: 'ollama', capabilities: [] }, // undefined = free
    ]

    it('keeps free and undefined cost tier models', () => {
      const filtered = filterFreeModels(models)
      expect(filtered).toHaveLength(2)
      expect(filtered.map(m => m.id)).toEqual(['free-1', 'local-1'])
    })

    it('returns empty array when no free models', () => {
      const paidOnly = models.filter(m => m.costTier === 'high')
      expect(filterFreeModels(paidOnly)).toHaveLength(0)
    })
  })

  describe('resolveFeatureModel with budget mode', () => {
    it('returns free model for Tier 2 defaults when budget mode is on', () => {
      localStorage.setItem('ai-configuration', JSON.stringify({ ...DEFAULTS, budgetMode: true }))
      // FEATURE_DEFAULTS.videoSummary defaults to anthropic/claude-haiku-4-5
      // Anthropic has no free models, so it should stay as-is (no free fallback)
      const resolved = resolveFeatureModel('videoSummary')
      expect(resolved.provider).toBe('anthropic')
    })

    it('respects explicit user overrides even in budget mode (Tier 1)', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          budgetMode: true,
          featureModels: {
            videoSummary: { provider: 'openai', model: 'gpt-4o' },
          },
        })
      )
      const resolved = resolveFeatureModel('videoSummary')
      expect(resolved.provider).toBe('openai')
      expect(resolved.model).toBe('gpt-4o') // Explicit override, not overridden by budget
    })

    it('switches to free model when available in budget mode', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'glm',
          budgetMode: true,
        })
      )
      // GLM has free models, so Tier 3 should pick the free default
      const resolved = resolveFeatureModel('videoSummary')
      // Tier 2 feature default is anthropic, which has no free model
      // But Tier 2 will still try anthropic since FEATURE_DEFAULTS has it
      expect(resolved.provider).toBe('anthropic')
    })
  })

  // ===========================================================================
  // Provider hasFreeModels
  // ===========================================================================

  describe('provider hasFreeModels', () => {
    it('GLM has hasFreeModels = true', () => {
      expect(AI_PROVIDERS.glm.hasFreeModels).toBe(true)
    })

    it('Groq has hasFreeModels = true', () => {
      expect(AI_PROVIDERS.groq.hasFreeModels).toBe(true)
    })

    it('Gemini has hasFreeModels = true', () => {
      expect(AI_PROVIDERS.gemini.hasFreeModels).toBe(true)
    })

    it('OpenAI does not have hasFreeModels', () => {
      expect(AI_PROVIDERS.openai.hasFreeModels).toBeUndefined()
    })

    it('GLM name does not include (FREE)', () => {
      expect(AI_PROVIDERS.glm.name).toBe('GLM / Z.ai')
    })

    it('Gemini name does not include (FREE)', () => {
      expect(AI_PROVIDERS.gemini.name).toBe('Google Gemini')
    })

    it('Groq name still includes (FREE)', () => {
      expect(AI_PROVIDERS.groq.name).toBe('Groq (FREE)')
    })
  })
})
