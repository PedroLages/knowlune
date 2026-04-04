/**
 * Unit tests for modelDiscovery.ts
 *
 * @see E90-S04 — Model Discovery for Cloud Providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverModels, clearModelCache } from '../modelDiscovery'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  clearModelCache()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('discoverModels', () => {
  describe('static providers (Anthropic, GLM)', () => {
    it('returns static Anthropic models without API call', async () => {
      const models = await discoverModels('anthropic', 'sk-ant-test-key')
      expect(mockFetch).not.toHaveBeenCalled()
      expect(models.length).toBeGreaterThan(0)
      expect(models.every(m => m.provider === 'anthropic')).toBe(true)
      expect(models.find(m => m.id === 'claude-haiku-4-5')).toBeDefined()
    })

    it('returns static GLM models without API call', async () => {
      const models = await discoverModels('glm', 'test-glm-key-12345678')
      expect(mockFetch).not.toHaveBeenCalled()
      expect(models).toHaveLength(6)
      expect(models.find(m => m.id === 'glm-4.7-flash')).toBeDefined()
      expect(models.find(m => m.id === 'glm-5.1')).toBeDefined()
    })

    it('GLM models have correct cost tiers', async () => {
      const models = await discoverModels('glm', 'test-glm-key-12345678')
      const freeModels = models.filter(m => m.costTier === 'free')
      const paidModels = models.filter(m => m.costTier === 'medium' || m.costTier === 'high')
      expect(freeModels.length).toBe(3)
      expect(paidModels.length).toBe(3)
    })

    it('returns empty array for Ollama', async () => {
      const models = await discoverModels('ollama', 'http://localhost:11434')
      expect(models).toEqual([])
    })
  })

  describe('dynamic providers (OpenAI)', () => {
    it('fetches and filters OpenAI models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'gpt-4o', created: 1000 },
              { id: 'gpt-4o-mini', created: 1001 },
              { id: 'dall-e-3', created: 1002 }, // should be filtered
              { id: 'whisper-1', created: 1003 }, // should be filtered
              { id: 'text-embedding-3-small', created: 1004 }, // should be filtered
              { id: 'o1', created: 1005 },
            ],
          }),
      })

      const models = await discoverModels('openai', 'sk-test12345678')
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(models.find(m => m.id === 'gpt-4o')).toBeDefined()
      expect(models.find(m => m.id === 'gpt-4o-mini')).toBeDefined()
      expect(models.find(m => m.id === 'o1')).toBeDefined()
      expect(models.find(m => m.id === 'dall-e-3')).toBeUndefined()
      expect(models.find(m => m.id === 'whisper-1')).toBeUndefined()
      expect(models.find(m => m.id === 'text-embedding-3-small')).toBeUndefined()
    })

    it('falls back to static models on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

      const models = await discoverModels('openai', 'sk-bad-key12345678')
      expect(models.length).toBeGreaterThan(0)
      expect(models.every(m => m.provider === 'openai')).toBe(true)
    })

    it('falls back to static models on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'))

      const models = await discoverModels('openai', 'sk-test12345678')
      expect(models.length).toBeGreaterThan(0)
    })
  })

  describe('dynamic providers (Gemini)', () => {
    it('fetches and filters Gemini models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [
              {
                name: 'models/gemini-2.0-flash',
                displayName: 'Gemini 2.0 Flash',
                supportedGenerationMethods: ['generateContent', 'countTokens'],
                inputTokenLimit: 1000000,
              },
              {
                name: 'models/embedding-001',
                displayName: 'Embedding 001',
                supportedGenerationMethods: ['embedContent'],
              },
            ],
          }),
      })

      const models = await discoverModels('gemini', 'AIzaTestKey1234567890abcdefghijklmnop')
      expect(models.find(m => m.id === 'gemini-2.0-flash')).toBeDefined()
      expect(models.find(m => m.id === 'embedding-001')).toBeUndefined()
    })
  })

  describe('dynamic providers (Groq)', () => {
    it('fetches Groq models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'llama-3.3-70b-versatile', owned_by: 'meta', context_window: 128000 },
              { id: 'mixtral-8x7b-32768', owned_by: 'mistral', context_window: 32768 },
            ],
          }),
      })

      const models = await discoverModels('groq', 'gsk_test12345678')
      expect(models).toHaveLength(2)
      expect(models.find(m => m.id === 'llama-3.3-70b-versatile')).toBeDefined()
      expect(models[0].costTier).toBe('free')
    })
  })

  describe('dynamic providers (OpenRouter)', () => {
    it('fetches and processes OpenRouter models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'anthropic/claude-haiku-4-5',
                name: 'Claude Haiku 4.5',
                pricing: { prompt: '0.25', completion: '1.25' },
                context_length: 200000,
              },
              {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                pricing: { prompt: '2.5', completion: '10' },
                context_length: 128000,
              },
            ],
          }),
      })

      const models = await discoverModels(
        'openrouter',
        'sk-or-v1-testkey1234567890abcdefghijklmnopqrstuvwxyz1234567890ab'
      )
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(models.find(m => m.id === 'anthropic/claude-haiku-4-5')).toBeDefined()
      expect(models.find(m => m.id === 'openai/gpt-4o')).toBeDefined()
      expect(models[0].provider).toBe('openrouter')
    })

    it('groups models by source provider family', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
              { id: 'openai/gpt-4o', name: 'GPT-4o' },
            ],
          }),
      })

      const models = await discoverModels(
        'openrouter',
        'sk-or-v1-testkey1234567890abcdefghijklmnopqrstuvwxyz1234567890ab'
      )
      expect(models.find(m => m.id === 'anthropic/claude-haiku-4-5')?.family).toBe('Anthropic')
      expect(models.find(m => m.id === 'openai/gpt-4o')?.family).toBe('Openai')
    })

    it('assigns cost tiers based on pricing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'free/model', name: 'Free', pricing: { prompt: '0', completion: '0' } },
              { id: 'cheap/model', name: 'Cheap', pricing: { prompt: '0.1', completion: '0.1' } },
              { id: 'mid/model', name: 'Mid', pricing: { prompt: '3', completion: '5' } },
              {
                id: 'expensive/model',
                name: 'Expensive',
                pricing: { prompt: '10', completion: '30' },
              },
            ],
          }),
      })

      const models = await discoverModels(
        'openrouter',
        'sk-or-v1-testkey1234567890abcdefghijklmnopqrstuvwxyz1234567890ab'
      )
      expect(models.find(m => m.id === 'free/model')?.costTier).toBe('free')
      expect(models.find(m => m.id === 'cheap/model')?.costTier).toBe('low')
      expect(models.find(m => m.id === 'mid/model')?.costTier).toBe('medium')
      expect(models.find(m => m.id === 'expensive/model')?.costTier).toBe('high')
    })

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

      const models = await discoverModels('openrouter', 'sk-or-v1-bad-key')
      expect(models).toEqual([])
    })
  })

  describe('caching', () => {
    it('returns cached results on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }] }),
      })

      await discoverModels('openai', 'sk-test12345678')
      const second = await discoverModels('openai', 'sk-test12345678')

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(second.find(m => m.id === 'gpt-4o')).toBeDefined()
    })

    it('uses different cache entries for different API keys', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4o-mini' }] }),
        })

      await discoverModels('openai', 'sk-key-aaa12345678')
      await discoverModels('openai', 'sk-key-bbb12345678')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('clears cache with clearModelCache()', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }] }),
      })

      await discoverModels('openai', 'sk-test12345678')
      clearModelCache()
      await discoverModels('openai', 'sk-test12345678')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('DiscoveredModel interface', () => {
    it('includes required fields', async () => {
      const models = await discoverModels('anthropic', 'sk-ant-test-key')
      const model = models[0]

      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('name')
      expect(model).toHaveProperty('provider')
      expect(model).toHaveProperty('capabilities')
      expect(Array.isArray(model.capabilities)).toBe(true)
    })

    it('includes optional fields when available', async () => {
      const models = await discoverModels('anthropic', 'sk-ant-test-key')
      const opus = models.find(m => m.id === 'claude-opus-4-6')

      expect(opus?.costTier).toBe('high')
      expect(opus?.contextWindow).toBe(200000)
      expect(opus?.family).toBe('Claude Opus')
    })
  })
})
