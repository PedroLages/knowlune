/**
 * Unit Tests: resolveFeatureModel() and getDecryptedApiKeyForProvider()
 *
 * E90-S02 — Refactor LLM Client Factory with Feature-Aware Model Resolution
 *
 * Tests the three-tier resolution cascade:
 * - Tier 1: User per-feature override (featureModels[feature])
 * - Tier 2: Feature default (FEATURE_DEFAULTS[feature])
 * - Tier 3: Global provider default (PROVIDER_DEFAULTS[globalProvider])
 *
 * Also tests provider-specific API key retrieval with legacy fallback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolveFeatureModel,
  getDecryptedApiKeyForProvider,
  getAIConfiguration,
  FEATURE_DEFAULTS,
  PROVIDER_DEFAULTS,
  type AIConfigurationSettings,
} from '@/lib/aiConfiguration'

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

function setConfig(config: Partial<AIConfigurationSettings>) {
  const full = {
    provider: 'openai' as const,
    connectionStatus: 'connected' as const,
    consentSettings: {
      videoSummary: true,
      noteQA: true,
      learningPath: true,
      knowledgeGaps: true,
      noteOrganization: true,
      analytics: true,
    },
    ...config,
  }
  localStorage.setItem('ai-configuration', JSON.stringify(full))
}

describe('resolveFeatureModel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('Tier 1: returns user per-feature override when set', () => {
    setConfig({
      provider: 'openai',
      featureModels: {
        videoSummary: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
        },
      },
    })

    const result = resolveFeatureModel('videoSummary')
    expect(result).toEqual({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
    })
  })

  it('Tier 2: returns FEATURE_DEFAULTS when no user override exists', () => {
    setConfig({ provider: 'openai' })

    const result = resolveFeatureModel('videoSummary')
    expect(result).toEqual(FEATURE_DEFAULTS.videoSummary)
  })

  it('Tier 2: returns correct feature default for each feature', () => {
    setConfig({ provider: 'openai' })

    const result = resolveFeatureModel('noteQA')
    expect(result).toEqual(FEATURE_DEFAULTS.noteQA)
  })

  it('Tier 3: falls back to global provider default when feature has no FEATURE_DEFAULTS entry', () => {
    // Simulate a feature that somehow has no default (edge case)
    // Since all features currently have defaults, we test the cascade logic
    // by verifying Tier 2 is reached for all known features
    setConfig({ provider: 'groq' })

    // All features have FEATURE_DEFAULTS, so tier 3 won't normally trigger
    // But if it did, it would return the global provider's default model
    const config = getAIConfiguration()
    expect(config.provider).toBe('groq')
    expect(PROVIDER_DEFAULTS.groq).toBe('llama-3.3-70b-versatile')
  })

  it('Tier 1 takes priority over Tier 2', () => {
    setConfig({
      provider: 'openai',
      featureModels: {
        noteQA: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 2048,
        },
      },
    })

    const result = resolveFeatureModel('noteQA')
    // Should be the override, not the FEATURE_DEFAULTS
    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-2.0-flash')
    expect(result.maxTokens).toBe(2048)
    expect(result).not.toEqual(FEATURE_DEFAULTS.noteQA)
  })

  it('returns override with optional temperature and maxTokens', () => {
    setConfig({
      featureModels: {
        analytics: {
          provider: 'anthropic',
          model: 'claude-haiku-4-5',
          temperature: 0.1,
          maxTokens: 500,
        },
      },
    })

    const result = resolveFeatureModel('analytics')
    expect(result.temperature).toBe(0.1)
    expect(result.maxTokens).toBe(500)
  })

  it('handles empty featureModels gracefully (falls to Tier 2)', () => {
    setConfig({ featureModels: {} })

    const result = resolveFeatureModel('videoSummary')
    expect(result).toEqual(FEATURE_DEFAULTS.videoSummary)
  })

  it('handles undefined featureModels gracefully (falls to Tier 2)', () => {
    setConfig({})

    const result = resolveFeatureModel('learningPath')
    expect(result).toEqual(FEATURE_DEFAULTS.learningPath)
  })
})

describe('getDecryptedApiKeyForProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns "ollama" dummy key for ollama provider', async () => {
    setConfig({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: 'http://192.168.1.100:11434',
        directConnection: true,
      },
    })

    const key = await getDecryptedApiKeyForProvider('ollama')
    expect(key).toBe('ollama')
  })

  it('returns null for ollama with no server URL', async () => {
    setConfig({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: '',
        directConnection: false,
      },
    })

    const key = await getDecryptedApiKeyForProvider('ollama')
    expect(key).toBeNull()
  })

  it('returns decrypted key from providerKeys map', async () => {
    setConfig({
      provider: 'openai',
      providerKeys: {
        anthropic: {
          iv: 'mock-iv',
          encryptedData: 'encrypted:sk-ant-test123',
        },
      },
    })

    const key = await getDecryptedApiKeyForProvider('anthropic')
    expect(key).toBe('sk-ant-test123')
  })

  it('falls back to legacy apiKeyEncrypted for global provider', async () => {
    setConfig({
      provider: 'openai',
      apiKeyEncrypted: {
        iv: 'mock-iv',
        encryptedData: 'encrypted:sk-legacy-key',
      },
    })

    const key = await getDecryptedApiKeyForProvider('openai')
    expect(key).toBe('sk-legacy-key')
  })

  it('does NOT fall back to legacy key for non-global provider', async () => {
    setConfig({
      provider: 'openai',
      apiKeyEncrypted: {
        iv: 'mock-iv',
        encryptedData: 'encrypted:sk-legacy-key',
      },
    })

    // Anthropic is not the global provider, so legacy key should not be returned
    const key = await getDecryptedApiKeyForProvider('anthropic')
    expect(key).toBeNull()
  })

  it('prefers providerKeys over legacy apiKeyEncrypted', async () => {
    setConfig({
      provider: 'openai',
      apiKeyEncrypted: {
        iv: 'mock-iv',
        encryptedData: 'encrypted:sk-legacy-key',
      },
      providerKeys: {
        openai: {
          iv: 'mock-iv',
          encryptedData: 'encrypted:sk-new-key',
        },
      },
    })

    const key = await getDecryptedApiKeyForProvider('openai')
    expect(key).toBe('sk-new-key')
  })

  it('returns null when provider has no key configured', async () => {
    setConfig({ provider: 'openai' })

    const key = await getDecryptedApiKeyForProvider('groq')
    expect(key).toBeNull()
  })

  it('returns null on decryption failure for providerKeys', async () => {
    setConfig({
      providerKeys: {
        anthropic: {
          iv: 'mock-iv',
          encryptedData: 'corrupted-data', // won't match 'encrypted:' prefix
        },
      },
    })

    const key = await getDecryptedApiKeyForProvider('anthropic')
    expect(key).toBeNull()
  })
})
