/**
 * Unit Tests: Multi-Provider BYOK Key Storage (E90-S03)
 *
 * Tests:
 * - saveProviderApiKey: encrypts and stores to providerKeys map
 * - getDecryptedApiKeyForProvider: providerKeys lookup, legacy fallback, Ollama bypass
 * - getDecryptedApiKey: delegates to getDecryptedApiKeyForProvider
 * - Cross-tab event dispatch on save
 * - Provider-not-found returns null
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock crypto module — returns predictable encrypted strings for assertions
vi.mock('@/lib/crypto', () => ({
  encryptData: vi.fn(async (data: string) => ({
    iv: `iv-for-${data}`,
    encryptedData: `enc-${data}`,
  })),
  decryptData: vi.fn(async (_iv: string, encryptedData: string) => {
    // Reverse the mock encryption
    if (encryptedData.startsWith('enc-')) {
      return encryptedData.replace('enc-', '')
    }
    throw new Error('Decryption failed')
  }),
}))

import {
  getAIConfiguration,
  saveProviderApiKey,
  getDecryptedApiKeyForProvider,
  getDecryptedApiKey,
  DEFAULTS,
  type AIConfigurationSettings,
} from '@/lib/aiConfiguration'

const STORAGE_KEY = 'ai-configuration'

describe('Multi-Provider BYOK Key Storage (E90-S03)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // ===========================================================================
  // AC4: saveProviderApiKey encrypts and stores to providerKeys[provider]
  // ===========================================================================

  describe('saveProviderApiKey', () => {
    it('encrypts and stores a key for a specific provider', async () => {
      await saveProviderApiKey('anthropic', 'sk-ant-test-key')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.providerKeys).toBeDefined()
      expect(stored.providerKeys.anthropic).toEqual({
        iv: 'iv-for-sk-ant-test-key',
        encryptedData: 'enc-sk-ant-test-key',
      })
    })

    it('preserves existing provider keys when adding a new one', async () => {
      await saveProviderApiKey('openai', 'sk-openai-key')
      await saveProviderApiKey('anthropic', 'sk-ant-key')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.providerKeys.openai).toBeDefined()
      expect(stored.providerKeys.anthropic).toBeDefined()
    })

    it('overwrites existing key for same provider', async () => {
      await saveProviderApiKey('openai', 'sk-old-key')
      await saveProviderApiKey('openai', 'sk-new-key')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.providerKeys.openai.encryptedData).toBe('enc-sk-new-key')
    })

    // AC6: ai-configuration-updated event fires
    it('dispatches ai-configuration-updated event', async () => {
      const listener = vi.fn()
      window.addEventListener('ai-configuration-updated', listener)

      await saveProviderApiKey('groq', 'gsk_test')

      expect(listener).toHaveBeenCalledTimes(1)
      window.removeEventListener('ai-configuration-updated', listener)
    })

    it('does not modify legacy apiKeyEncrypted field', async () => {
      // Set up legacy key
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        apiKeyEncrypted: { iv: 'legacy-iv', encryptedData: 'enc-legacy-key' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      await saveProviderApiKey('anthropic', 'sk-ant-new')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      // Legacy field untouched
      expect(stored.apiKeyEncrypted).toEqual({ iv: 'legacy-iv', encryptedData: 'enc-legacy-key' })
      // New field populated
      expect(stored.providerKeys.anthropic).toBeDefined()
    })
  })

  // ===========================================================================
  // AC2: getDecryptedApiKeyForProvider checks providerKeys first, legacy fallback
  // ===========================================================================

  describe('getDecryptedApiKeyForProvider', () => {
    it('returns decrypted key from providerKeys when available', async () => {
      await saveProviderApiKey('anthropic', 'sk-ant-secret')

      const key = await getDecryptedApiKeyForProvider('anthropic')
      expect(key).toBe('sk-ant-secret')
    })

    // AC3: Legacy fallback for global provider
    it('falls back to legacy apiKeyEncrypted for the global provider', async () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'openai',
        apiKeyEncrypted: { iv: 'test-iv', encryptedData: 'enc-sk-legacy' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      const key = await getDecryptedApiKeyForProvider('openai')
      expect(key).toBe('sk-legacy')
    })

    it('does NOT fall back to legacy key for a non-global provider', async () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'openai',
        apiKeyEncrypted: { iv: 'test-iv', encryptedData: 'enc-sk-legacy' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      // Anthropic is not the global provider, so legacy fallback should not apply
      const key = await getDecryptedApiKeyForProvider('anthropic')
      expect(key).toBeNull()
    })

    // AC7: provider-not-found returns null
    it('returns null when provider has no key stored', async () => {
      const key = await getDecryptedApiKeyForProvider('groq')
      expect(key).toBeNull()
    })

    // AC7: Ollama bypass returns dummy key
    it('returns "ollama" dummy key when Ollama has server URL configured', async () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'ollama',
        ollamaSettings: {
          serverUrl: 'http://localhost:11434',
          directConnection: false,
        },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      const key = await getDecryptedApiKeyForProvider('ollama')
      expect(key).toBe('ollama')
    })

    it('returns null for Ollama when no server URL configured', async () => {
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'ollama',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      const key = await getDecryptedApiKeyForProvider('ollama')
      expect(key).toBeNull()
    })

    it('prefers providerKeys over legacy key even for global provider', async () => {
      // Both legacy and providerKeys are set for the global provider
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        provider: 'openai',
        apiKeyEncrypted: { iv: 'old-iv', encryptedData: 'enc-old-key' },
        providerKeys: {
          openai: { iv: 'new-iv', encryptedData: 'enc-new-key' },
        },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      const key = await getDecryptedApiKeyForProvider('openai')
      expect(key).toBe('new-key')
    })

    it('returns null on decryption failure for providerKeys', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config: AIConfigurationSettings = {
        ...DEFAULTS,
        providerKeys: {
          anthropic: { iv: 'bad-iv', encryptedData: 'corrupted-data' },
        },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))

      const key = await getDecryptedApiKeyForProvider('anthropic')
      expect(key).toBeNull()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  // ===========================================================================
  // getDecryptedApiKey delegates to getDecryptedApiKeyForProvider
  // ===========================================================================

  describe('getDecryptedApiKey (delegation)', () => {
    it('returns key for the global provider', async () => {
      await saveProviderApiKey('openai', 'sk-global-key')
      // Set global provider to openai
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...JSON.parse(localStorage.getItem(STORAGE_KEY)!),
          provider: 'openai',
        })
      )

      const key = await getDecryptedApiKey()
      expect(key).toBe('sk-global-key')
    })

    it('returns null when global provider has no key', async () => {
      const key = await getDecryptedApiKey()
      expect(key).toBeNull()
    })
  })

  // ===========================================================================
  // AC1: providerKeys field exists on AIConfigurationSettings
  // ===========================================================================

  describe('providerKeys field', () => {
    it('is preserved through getAIConfiguration round-trip', async () => {
      await saveProviderApiKey('gemini', 'AIza-test-key')

      const config = getAIConfiguration()
      expect(config.providerKeys).toBeDefined()
      expect(config.providerKeys!.gemini).toBeDefined()
    })

    it('defaults to undefined when not set', () => {
      const config = getAIConfiguration()
      expect(config.providerKeys).toBeUndefined()
    })
  })

  // ===========================================================================
  // AC5: API keys never logged or stored in plaintext
  // ===========================================================================

  describe('security', () => {
    it('stores encrypted data structure, not raw plaintext field', async () => {
      await saveProviderApiKey('openai', 'sk-secret')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      // providerKeys should contain an EncryptedData object (iv + encryptedData),
      // not a raw string. Real encryptData() produces ciphertext; our mock
      // confirms the structure is correct.
      const keyData = stored.providerKeys.openai
      expect(keyData).toHaveProperty('iv')
      expect(keyData).toHaveProperty('encryptedData')
      expect(typeof keyData.iv).toBe('string')
      expect(typeof keyData.encryptedData).toBe('string')
      // No raw 'apiKey' or 'key' field stored
      expect(keyData).not.toHaveProperty('apiKey')
      expect(keyData).not.toHaveProperty('key')
      expect(keyData).not.toHaveProperty('plaintext')
    })
  })
})
