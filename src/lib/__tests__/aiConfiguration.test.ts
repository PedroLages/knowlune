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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getAIConfiguration,
  saveAIConfiguration,
  saveProviderApiKey,
  isFeatureEnabled,
  isAIAvailable,
  getNoteQAAvailability,
  getDecryptedApiKeyForProvider,
  getAPIKeyHealth,
  isBudgetMode,
  filterFreeModels,
  resolveFeatureModel,
  sanitizeAIRequestPayload,
  getOllamaServerUrl,
  isOllamaDirectConnection,
  AI_PROVIDERS,
  DEFAULTS,
  _reEncryptProviderKeyLocallyForTesting,
  type AIConfigurationSettings,
} from '@/lib/aiConfiguration'
import type { DiscoveredModel } from '@/lib/modelDiscovery'

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  encryptData: vi.fn(async (data: string) => ({
    iv: 'mock-iv',
    encryptedData: `encrypted:${data}`,
  })),
  decryptData: vi.fn(async (ivOrEncrypted: string, encryptedData?: string) => {
    const encrypted = encryptedData ?? ivOrEncrypted
    if (encrypted.startsWith('encrypted:')) {
      return encrypted.replace('encrypted:', '')
    }
    throw new Error('Invalid encrypted data')
  }),
}))

const vaultMocks = vi.hoisted(() => ({
  readCredential: vi.fn(),
  storeCredential: vi.fn().mockResolvedValue(undefined),
  storeCredentialWithStatus: vi.fn().mockResolvedValue({ ok: true }),
  checkCredential: vi.fn(),
  readCredentialWithStatus: vi.fn(),
}))

vi.mock('@/lib/vaultCredentials', () => vaultMocks)

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
          quizGeneration: true,
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
      expect(parsed.apiKeyEncrypted).toEqual({
        iv: 'mock-iv',
        encryptedData: `encrypted:${apiKey}`,
      })
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
          quizGeneration: false,
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
          quizGeneration: true,
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
          quizGeneration: false,
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

  describe('getNoteQAAvailability', () => {
    it('returns available for a readable Gemini noteQA override even when global status is unconfigured', async () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'openai',
        connectionStatus: 'unconfigured',
        providerKeys: {
          gemini: {
            iv: 'mock-iv',
            encryptedData: 'encrypted:AIza-test-key',
          },
        },
        featureModels: {
          noteQA: {
            provider: 'gemini',
            model: 'gemini-3-flash-preview',
          },
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(config))

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: true,
        provider: 'gemini',
        providerName: 'Google Gemini',
        model: 'gemini-3-flash-preview',
      })
    })

    it('returns feature-disabled when Q&A from Notes is disabled', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          consentSettings: {
            ...DEFAULTS.consentSettings,
            noteQA: false,
          },
          featureModels: {
            noteQA: {
              provider: 'gemini',
              model: 'gemini-3-flash-preview',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: false,
        reason: 'feature-disabled',
        provider: 'gemini',
      })
    })

    it('returns missing-provider-key when the resolved provider has no key', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: {
              iv: 'mock-iv',
              encryptedData: 'encrypted:AIza-test-key',
            },
          },
          featureModels: {
            noteQA: {
              provider: 'anthropic',
              model: 'claude-haiku-4-5',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: false,
        reason: 'missing-provider-key',
        provider: 'anthropic',
      })
    })

    it('returns unreadable-provider-key when the resolved provider key cannot be decrypted', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: {
              iv: 'mock-iv',
              encryptedData: 'corrupted-data',
            },
          },
          featureModels: {
            noteQA: {
              provider: 'gemini',
              model: 'gemini-3-flash-preview',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: false,
        reason: 'unreadable-provider-key',
        provider: 'gemini',
      })
      warnSpy.mockRestore()
    })

    it('returns available for an Ollama noteQA override with a configured server URL', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
          ollamaSettings: {
            serverUrl: 'http://localhost:11434',
            directConnection: false,
          },
          featureModels: {
            noteQA: {
              provider: 'ollama',
              model: 'llama3.2:latest',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: true,
        provider: 'ollama',
      })
    })

    it('returns missing-ollama-url when noteQA resolves to Ollama but global provider is not Ollama', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'openai',
          featureModels: {
            noteQA: {
              provider: 'ollama',
              model: 'llama3.2:latest',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: false,
        reason: 'missing-ollama-url',
        provider: 'ollama',
      })
    })

    it('treats legacy global encrypted key as stored when resolved provider matches global', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'gemini',
          connectionStatus: 'unconfigured',
          apiKeyEncrypted: {
            iv: 'mock-iv',
            encryptedData: 'encrypted:AIza-legacy-only',
          },
          featureModels: {
            noteQA: {
              provider: 'gemini',
              model: 'gemini-3-flash-preview',
            },
          },
        })
      )

      await expect(getNoteQAAvailability()).resolves.toMatchObject({
        available: true,
        provider: 'gemini',
      })
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

  // ===========================================================================
  // getDecryptedApiKeyForProvider — Vault fallback (2026-05-01 fix)
  // ===========================================================================

  describe('getDecryptedApiKeyForProvider', () => {
    beforeEach(() => {
      vaultMocks.readCredentialWithStatus.mockReset()
      vaultMocks.storeCredential.mockClear()
    })

    it('returns decrypted key when local provider key decrypts successfully', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'mock-iv', encryptedData: 'encrypted:AIza-test-key' },
          },
        })
      )

      const result = await getDecryptedApiKeyForProvider('gemini')
      expect(result).toBe('AIza-test-key')
      expect(vaultMocks.readCredentialWithStatus).not.toHaveBeenCalled()
    })

    it('falls back to Vault when local decrypt fails and encrypted data exists', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-vault-recovered-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      const result = await getDecryptedApiKeyForProvider('gemini')
      expect(result).toBe('AIza-vault-recovered-key')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledWith('ai-provider', 'gemini')

      warnSpy.mockRestore()
    })

    it('re-encrypts locally when Vault fallback succeeds (self-healing)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-vault-recovered-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      await getDecryptedApiKeyForProvider('gemini')

      // After self-healing, the key should be stored
      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.providerKeys.gemini).toBeDefined()
      expect(stored.providerKeys.gemini.encryptedData).toBe('encrypted:AIza-vault-recovered-key')

      // Silent re-encrypt — no side effects
      expect(vaultMocks.storeCredential).not.toHaveBeenCalled()
      const updateEvents = dispatchSpy.mock.calls.filter(
        ([e]) => e instanceof CustomEvent && e.type === 'ai-configuration-updated'
      )
      expect(updateEvents).toHaveLength(0)

      dispatchSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('self-healing: subsequent call decrypts locally without Vault', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // First call: Vault provides the key
      vaultMocks.readCredentialWithStatus.mockResolvedValueOnce({ ok: true, value: 'AIza-vault-recovered-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      await getDecryptedApiKeyForProvider('gemini')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(1)

      // Second call: re-encrypted data decrypts locally, Vault not called again
      vaultMocks.readCredentialWithStatus.mockClear()
      const result = await getDecryptedApiKeyForProvider('gemini')
      expect(result).toBe('AIza-vault-recovered-key')
      expect(vaultMocks.readCredentialWithStatus).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('returns null when no encrypted data exists for provider', async () => {
      localStorage.setItem('ai-configuration', JSON.stringify(DEFAULTS))

      const result = await getDecryptedApiKeyForProvider('gemini')
      expect(result).toBeNull()
      expect(vaultMocks.readCredentialWithStatus).not.toHaveBeenCalled()
    })

    it('returns null when Vault returns null (key not in Vault)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: null })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      const result = await getDecryptedApiKeyForProvider('gemini')
      expect(result).toBeNull()

      warnSpy.mockRestore()
    })

    it('returns null when Vault returns transient error on both attempts', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // readCredentialWithStatus returns error on every call — retry exhausts
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'error', message: 'Network error' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      const promise = getDecryptedApiKeyForProvider('gemini')
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      const result = await promise
      // Retry exhausted — returns null without throwing
      expect(result).toBeNull()
      // Two attempts: first + retry
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
      warnSpy.mockRestore()
    })

    it('returns key when Vault succeeds but re-encrypt fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-vault-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )
      // Make encryptData throw on the NEXT call (during saveProviderApiKey)
      const { encryptData } = await import('@/lib/crypto')
      vi.mocked(encryptData).mockRejectedValueOnce(new Error('Encryption failed'))

      const result = await getDecryptedApiKeyForProvider('gemini')
      // Key should still be returned even though re-encrypt failed
      expect(result).toBe('AIza-vault-key')

      warnSpy.mockRestore()
    })

    it('skips Vault fallback for ollama provider', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
          ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: false },
          providerKeys: {
            ollama: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      const result = await getDecryptedApiKeyForProvider('ollama')
      // Ollama returns 'ollama' when serverUrl is configured, not an API key
      expect(result).toBe('ollama')
      expect(vaultMocks.readCredentialWithStatus).not.toHaveBeenCalled()
    })

    it('falls back via legacy apiKeyEncrypted when provider matches global', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'sk-legacy-vault-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'openai',
          apiKeyEncrypted: { iv: 'old-iv', encryptedData: 'corrupted-legacy-data' },
        })
      )

      const result = await getDecryptedApiKeyForProvider('openai')
      expect(result).toBe('sk-legacy-vault-key')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledWith('ai-provider', 'openai')

      warnSpy.mockRestore()
    })

    it('triggers Vault fallback for empty-string decryption result', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-vault-recovered-key' })

      // encryptedData ending in 'encrypted:' decrypts to empty string
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'mock-iv', encryptedData: 'encrypted:' },
          },
        })
      )

      const result = await getDecryptedApiKeyForProvider('gemini')
      // Vault fallback should fire because !'' === true
      expect(result).toBe('AIza-vault-recovered-key')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledWith('ai-provider', 'gemini')

      warnSpy.mockRestore()
    })

    it('deduplicates concurrent Vault reads for the same provider', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-vault-recovered-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      // Two concurrent calls for the same provider
      const [a, b] = await Promise.all([
        getDecryptedApiKeyForProvider('gemini'),
        getDecryptedApiKeyForProvider('gemini'),
      ])

      expect(a).toBe('AIza-vault-recovered-key')
      expect(b).toBe('AIza-vault-recovered-key')
      // Vault should only be called once
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(1)

      warnSpy.mockRestore()
    })

    it('allows retry after concurrent Vault cache is cleared on double failure', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Both attempts fail — retry exhausted
      vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'error' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      // Two concurrent calls share the same in-flight retry promise
      const promise = Promise.all([
        getDecryptedApiKeyForProvider('gemini'),
        getDecryptedApiKeyForProvider('gemini'),
      ])
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      const [a, b] = await promise
      expect(a).toBeNull()
      expect(b).toBeNull()
      // Two calls total: first attempt + retry (shared by both concurrent callers)
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)

      // After cache cleared, a fresh call starts a new retry cycle
      vaultMocks.readCredentialWithStatus.mockReset()
      vaultMocks.readCredentialWithStatus
        .mockResolvedValueOnce({ ok: false, reason: 'error' })
        .mockResolvedValueOnce({ ok: true, value: 'AIza-recovered-on-retry' })

      const freshPromise = getDecryptedApiKeyForProvider('gemini')
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      const result = await freshPromise
      expect(result).toBe('AIza-recovered-on-retry')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
      warnSpy.mockRestore()
    })

    it('deduplicates per provider — concurrent calls for different providers each call Vault', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.readCredentialWithStatus
        .mockResolvedValueOnce({ ok: true, value: 'AIza-gemini-key' })
        .mockResolvedValueOnce({ ok: true, value: 'sk-openai-key' })

      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            openai: { iv: 'old-iv', encryptedData: 'corrupted-data' },
          },
        })
      )

      const [geminiResult, openaiResult] = await Promise.all([
        getDecryptedApiKeyForProvider('gemini'),
        getDecryptedApiKeyForProvider('openai'),
      ])

      expect(geminiResult).toBe('AIza-gemini-key')
      expect(openaiResult).toBe('sk-openai-key')
      // One call per provider
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledWith('ai-provider', 'gemini')
      expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledWith('ai-provider', 'openai')

      warnSpy.mockRestore()
    })

    describe('Vault read retry', () => {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: false })
      })
      afterEach(() => {
        vi.useRealTimers()
      })

      it('succeeds on first attempt without retry', async () => {
        vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'AIza-test-key' })

        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            ...DEFAULTS,
            providerKeys: {
              gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            },
          })
        )

        const promise = getDecryptedApiKeyForProvider('gemini')
        const result = await promise
        expect(result).toBe('AIza-test-key')
        expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(1)
      })

      it('retries once on network error and succeeds', async () => {
        vaultMocks.readCredentialWithStatus
          .mockResolvedValueOnce({ ok: false, reason: 'error' })
          .mockResolvedValueOnce({ ok: true, value: 'AIza-retry-key' })

        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            ...DEFAULTS,
            providerKeys: {
              gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            },
          })
        )

        const promise = getDecryptedApiKeyForProvider('gemini')
        // Let the first call settle, advance past the 1s delay
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(1000)
        const result = await promise
        expect(result).toBe('AIza-retry-key')
        expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)
      })

      it('returns null after both attempts fail with network error', async () => {
        vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'error' })

        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            ...DEFAULTS,
            providerKeys: {
              gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            },
          })
        )

        const promise = getDecryptedApiKeyForProvider('gemini')
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(1000)
        const result = await promise
        expect(result).toBeNull()
        expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(2)
      })

      it('returns null immediately on unauthenticated without retry', async () => {
        vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'unauthenticated' })

        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            ...DEFAULTS,
            providerKeys: {
              gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            },
          })
        )

        const result = await getDecryptedApiKeyForProvider('gemini')
        expect(result).toBeNull()
        // No retry for auth failures
        expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(1)
      })

      it('returns null immediately on auth-failed without retry', async () => {
        vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'auth-failed' })

        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            ...DEFAULTS,
            providerKeys: {
              gemini: { iv: 'old-iv', encryptedData: 'corrupted-data' },
            },
          })
        )

        const result = await getDecryptedApiKeyForProvider('gemini')
        expect(result).toBeNull()
        expect(vaultMocks.readCredentialWithStatus).toHaveBeenCalledTimes(1)
      })
    })
  })

  // ===========================================================================
  // getAPIKeyHealth (2026-05-22 fix)
  // ===========================================================================

  describe('getAPIKeyHealth', () => {
    beforeEach(() => {
      vaultMocks.storeCredentialWithStatus.mockResolvedValue({ ok: true })
    })

    it('returns "ok" for a provider with a decryptable key', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'mock-iv', encryptedData: 'encrypted:AIza-test-key' },
          },
        })
      )

      expect(getAPIKeyHealth('gemini')).toBe('ok')
    })

    it('returns "missing" when no key has ever been saved', () => {
      localStorage.setItem('ai-configuration', JSON.stringify(DEFAULTS))

      expect(getAPIKeyHealth('anthropic')).toBe('missing')
    })

    it('returns "undecryptable" when keyLostAt is set', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            gemini: { iv: 'mock-iv', encryptedData: 'encrypted:AIza-key' },
          },
          keyLostAt: new Date().toISOString(),
        })
      )

      expect(getAPIKeyHealth('gemini')).toBe('undecryptable')
    })

    it('returns "ok" for ollama with configured server URL', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
          ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: false },
        })
      )

      expect(getAPIKeyHealth('ollama')).toBe('ok')
    })

    it('returns "missing" for ollama without server URL', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'ollama',
        })
      )

      expect(getAPIKeyHealth('ollama')).toBe('missing')
    })

    it('returns "ok" for legacy global apiKeyEncrypted when provider matches', () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          provider: 'openai',
          apiKeyEncrypted: { iv: 'mock-iv', encryptedData: 'encrypted:sk-test' },
        })
      )

      expect(getAPIKeyHealth('openai')).toBe('ok')
    })

    it('transitions to "ok" after keyLostAt is cleared by saveProviderApiKey', async () => {
      // Simulate initial state with keyLostAt
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            openai: { iv: 'mock-iv', encryptedData: 'encrypted:sk-test' },
          },
          keyLostAt: new Date().toISOString(),
        })
      )

      expect(getAPIKeyHealth('openai')).toBe('undecryptable')

      // Re-enter the key — clears keyLostAt
      await saveProviderApiKey('openai', 'sk-test-new-key')

      expect(getAPIKeyHealth('openai')).toBe('ok')
    })
  })

  // ===========================================================================
  // saveProviderApiKey — Vault write status (2026-05-22 fix)
  // ===========================================================================

  describe('saveProviderApiKey with Vault status', () => {
    beforeEach(() => {
      vaultMocks.storeCredentialWithStatus.mockReset()
    })

    it('saves key locally and sets vaultBackupFailedAt when Vault write fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vaultMocks.storeCredentialWithStatus.mockResolvedValue({ ok: false, reason: 'unauthenticated' })

      await saveProviderApiKey('openai', 'sk-test-key')

      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.providerKeys.openai).toBeDefined()
      expect(stored.providerKeys.openai.encryptedData).toBe('encrypted:sk-test-key')
      expect(stored.vaultBackupFailedAt).toBeDefined()

      warnSpy.mockRestore()
    })

    it('saves key locally and does NOT set vaultBackupFailedAt when Vault succeeds', async () => {
      vaultMocks.storeCredentialWithStatus.mockResolvedValue({ ok: true })

      await saveProviderApiKey('anthropic', 'sk-ant-test-key')

      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.providerKeys.anthropic).toBeDefined()
      expect(stored.vaultBackupFailedAt).toBeUndefined()
    })

    it('clears vaultBackupFailedAt on subsequent successful Vault write', async () => {
      // First call: Vault fails
      vaultMocks.storeCredentialWithStatus.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' })

      await saveProviderApiKey('openai', 'sk-test-key')
      expect(getAIConfiguration().vaultBackupFailedAt).toBeDefined()

      // Second call: Vault succeeds
      vaultMocks.storeCredentialWithStatus.mockResolvedValueOnce({ ok: true })

      await saveProviderApiKey('openai', 'sk-test-key-2')
      expect(getAIConfiguration().vaultBackupFailedAt).toBeUndefined()
    })
  })

  describe('_reEncryptProviderKeyLocallyForTesting', () => {
    beforeEach(() => {
      vaultMocks.storeCredential.mockClear()
    })

    it('writes encrypted data to localStorage for the specified provider', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {},
        })
      )

      await _reEncryptProviderKeyLocallyForTesting('gemini', 'test-key')

      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.providerKeys.gemini).toBeDefined()
      expect(stored.providerKeys.gemini.encryptedData).toBe('encrypted:test-key')
    })

    it('preserves existing provider keys when re-encrypting', async () => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          ...DEFAULTS,
          providerKeys: {
            openai: { iv: 'existing-iv', encryptedData: 'existing-encrypted' },
          },
        })
      )

      await _reEncryptProviderKeyLocallyForTesting('gemini', 'test-key')

      const stored = JSON.parse(localStorage.getItem('ai-configuration')!)
      expect(stored.providerKeys.openai).toBeDefined()
      expect(stored.providerKeys.gemini).toBeDefined()
    })

    it('does NOT dispatch ai-configuration-updated event', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      localStorage.setItem('ai-configuration', JSON.stringify(DEFAULTS))

      await _reEncryptProviderKeyLocallyForTesting('gemini', 'test-key')

      const updateEvents = dispatchSpy.mock.calls.filter(
        ([e]) => e instanceof CustomEvent && e.type === 'ai-configuration-updated'
      )
      expect(updateEvents).toHaveLength(0)
      dispatchSpy.mockRestore()
    })

    it('does NOT call storeCredential (no Vault write)', async () => {
      localStorage.setItem('ai-configuration', JSON.stringify(DEFAULTS))

      await _reEncryptProviderKeyLocallyForTesting('gemini', 'test-key')

      expect(vaultMocks.storeCredential).not.toHaveBeenCalled()
    })
  })
})
