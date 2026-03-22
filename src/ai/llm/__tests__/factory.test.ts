/**
 * LLM Factory unit tests (AC3, AC4)
 *
 * Verifies that getLLMClientForProvider routes to the correct client type
 * based on ollamaDirectConnection config, and that the ollamaModel config
 * field is forwarded to the client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLLMClientForProvider } from '../factory'
import { OllamaDirectClient } from '../ollama-client'
import { ProxyLLMClient } from '../proxy-client'
import { LLMError } from '../types'

vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: vi.fn(),
  getDecryptedApiKey: vi.fn(),
}))

import { getAIConfiguration } from '@/lib/aiConfiguration'
import type { AIConfigurationSettings } from '@/lib/aiConfiguration'

function mockConfig(overrides: Partial<AIConfigurationSettings>) {
  vi.mocked(getAIConfiguration).mockReturnValue({
    provider: 'ollama',
    connectionStatus: 'connected',
    consentSettings: {
      videoSummary: true,
      noteQA: true,
      learningPath: true,
      knowledgeGaps: true,
      noteOrganization: true,
      analytics: true,
    },
    ...overrides,
  })
}

describe('getLLMClientForProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ollama routing (AC3 / AC4)', () => {
    it('returns ProxyLLMClient when ollamaDirectConnection is false (proxy mode default)', () => {
      mockConfig({ ollamaDirectConnection: false })
      const client = getLLMClientForProvider('ollama', 'http://192.168.1.100:11434')
      expect(client).toBeInstanceOf(ProxyLLMClient)
    })

    it('returns ProxyLLMClient when ollamaDirectConnection is undefined (defaults to proxy)', () => {
      mockConfig({ ollamaDirectConnection: undefined })
      const client = getLLMClientForProvider('ollama', 'http://192.168.1.100:11434')
      expect(client).toBeInstanceOf(ProxyLLMClient)
    })

    it('returns OllamaDirectClient when ollamaDirectConnection is true (AC4)', () => {
      mockConfig({ ollamaDirectConnection: true })
      const client = getLLMClientForProvider('ollama', 'http://192.168.1.100:11434')
      expect(client).toBeInstanceOf(OllamaDirectClient)
    })
  })

  describe('ollama model selection (H1)', () => {
    it('passes configured ollamaModel to OllamaDirectClient', () => {
      mockConfig({ ollamaDirectConnection: true, ollamaModel: 'mistral' })
      const client = getLLMClientForProvider('ollama', 'http://192.168.1.100:11434')
      expect(client).toBeInstanceOf(OllamaDirectClient)
      // Verify model is forwarded — access private field for testing
      expect((client as unknown as { model: string }).model).toBe('mistral')
    })

    it('defaults to llama3.2 when ollamaModel is not configured', () => {
      mockConfig({ ollamaDirectConnection: true, ollamaModel: undefined })
      const client = getLLMClientForProvider('ollama', 'http://192.168.1.100:11434')
      expect((client as unknown as { model: string }).model).toBe('llama3.2')
    })
  })

  describe('non-ollama providers', () => {
    it('returns ProxyLLMClient for openai', () => {
      mockConfig({ provider: 'openai' })
      const client = getLLMClientForProvider('openai', 'sk-test123')
      expect(client).toBeInstanceOf(ProxyLLMClient)
    })

    it('returns ProxyLLMClient for anthropic', () => {
      mockConfig({ provider: 'anthropic' })
      const client = getLLMClientForProvider('anthropic', 'sk-ant-test123')
      expect(client).toBeInstanceOf(ProxyLLMClient)
    })

    it('throws LLMError for unsupported provider (glm)', () => {
      mockConfig({ provider: 'openai' })
      expect(() => getLLMClientForProvider('glm' as never, 'key')).toThrow(LLMError)
      expect(() => getLLMClientForProvider('glm' as never, 'key')).toThrow(
        'Unsupported AI provider'
      )
    })
  })
})
