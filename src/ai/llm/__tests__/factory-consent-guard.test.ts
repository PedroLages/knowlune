/**
 * Unit tests for consent guard in getLLMClient — E119-S08
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockIsGranted, mockGetState } = vi.hoisted(() => {
  const mockIsGranted = vi.fn()
  const mockGetState = vi.fn()
  return { mockIsGranted, mockGetState }
})

vi.mock('@/lib/compliance/consentService', () => ({
  isGranted: mockIsGranted,
  CONSENT_PURPOSES: {
    AI_TUTOR: 'ai_tutor',
    AI_EMBEDDINGS: 'ai_embeddings',
    VOICE_TRANSCRIPTION: 'voice_transcription',
    ANALYTICS_TELEMETRY: 'analytics_telemetry',
    MARKETING_EMAIL: 'marketing_email',
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: { getState: mockGetState },
}))

// Mock getAIConfiguration and all resolved key functions so the factory
// doesn't error after the guard passes.
vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: () => ({ provider: 'openai' }),
  getDecryptedApiKey: vi.fn().mockResolvedValue('sk-test'),
  getDecryptedApiKeyForProvider: vi.fn().mockResolvedValue('sk-test'),
  getOllamaServerUrl: vi.fn().mockReturnValue(null),
  getOllamaSelectedModel: vi.fn().mockReturnValue(null),
  isOllamaDirectConnection: vi.fn().mockReturnValue(false),
  resolveFeatureModel: vi.fn().mockReturnValue({ provider: 'openai', model: 'gpt-4o-mini' }),
  isFeatureEnabled: vi.fn().mockReturnValue(true),
  isAIAvailable: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/modelDefaults', () => ({
  PROVIDER_DEFAULTS: {},
}))

vi.mock('@/ai/llm/proxy-client', () => ({
  ProxyLLMClient: class {
    constructor() {}
  },
}))

vi.mock('@/ai/llm/ollama-client', () => ({
  OllamaLLMClient: class {
    constructor() {}
  },
}))

import { getLLMClient } from '../factory'
import { ConsentError } from '@/ai/lib/ConsentError'

beforeEach(() => {
  vi.clearAllMocks()
  // Ensure window.__mockLLMClient is not set
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>).__mockLLMClient
  }
})

describe('getLLMClient consent guard', () => {
  it('throws ConsentError when ai_tutor consent is not granted', async () => {
    mockGetState.mockReturnValue({ user: { id: 'user-1' } })
    mockIsGranted.mockResolvedValue(false)

    await expect(getLLMClient()).rejects.toBeInstanceOf(ConsentError)
    const err = await getLLMClient().catch(e => e)
    expect(err).toBeInstanceOf(ConsentError)
    expect(err.purpose).toBe('ai_tutor')
  })

  it('throws ConsentError when no user is signed in', async () => {
    mockGetState.mockReturnValue({ user: null })

    await expect(getLLMClient()).rejects.toBeInstanceOf(ConsentError)
  })

  it('returns client when ai_tutor consent is granted', async () => {
    mockGetState.mockReturnValue({ user: { id: 'user-1' } })
    mockIsGranted.mockResolvedValue(true)

    const client = await getLLMClient()
    expect(client).toBeDefined()
    expect(mockIsGranted).toHaveBeenCalledWith('user-1', 'ai_tutor')
  })

  it('ConsentError has informative message containing purpose name', async () => {
    mockGetState.mockReturnValue({ user: { id: 'user-1' } })
    mockIsGranted.mockResolvedValue(false)

    const err = await getLLMClient().catch(e => e)
    expect(err.message).toContain('ai_tutor')
    expect(err.message).toContain('Settings')
  })
})
