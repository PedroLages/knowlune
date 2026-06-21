/**
 * Unit tests for OpenAIEmbeddingProvider
 *
 * Covers:
 * - Happy path: sends correct request with dimensions=384, returns Float32Array[]
 * - Edge case: dimension mismatch rejects non-384 responses
 * - Error path: 401 -> InvalidApiKeyError
 * - Error path: 429 -> EmbeddingRateLimitError with exponential backoff
 * - Error path: network errors -> EmbeddingNetworkError
 * - Edge case: empty/whitespace texts filtered before API call
 * - Edge case: isAvailable() with and without API key
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Module-level mock for fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import AFTER mocks are set up
const {
  OpenAIEmbeddingProvider,
  InvalidApiKeyError,
  EmbeddingRateLimitError,
  EmbeddingDimensionError,
  EmbeddingNetworkError,
  EmbeddingProviderError,
} = await import('../openaiProvider')

describe('OpenAIEmbeddingProvider', () => {
  let provider: InstanceType<typeof OpenAIEmbeddingProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenAIEmbeddingProvider('sk-test-key-12345')
  })

  afterEach(() => {
    // Restore global.fetch to avoid leaking mock across tests
    global.fetch = mockFetch
  })

  describe('isAvailable()', () => {
    it('returns true when API key is non-empty', async () => {
      expect(await provider.isAvailable()).toBe(true)
    })

    it('returns false when API key is empty string', async () => {
      const emptyProvider = new OpenAIEmbeddingProvider('')
      expect(await emptyProvider.isAvailable()).toBe(false)
    })

    it('returns false when API key is only whitespace', async () => {
      const wsProvider = new OpenAIEmbeddingProvider('   ')
      expect(await wsProvider.isAvailable()).toBe(false)
    })
  })

  describe('embed() — happy path', () => {
    it('sends correct request body with dimensions: 384', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding: new Array(384).fill(0.1),
            },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
      })

      const result = await provider.embed(['Hello world'])

      // Verify request was sent correctly
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/embeddings')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(options.headers['Authorization']).toBe('Bearer sk-test-key-12345')
      expect(JSON.parse(options.body)).toEqual({
        model: 'text-embedding-3-small',
        input: ['Hello world'],
        dimensions: 384,
      })

      // Verify result
      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(Float32Array)
      expect(result[0]).toHaveLength(384)
    })

    it('returns multiple embeddings for multiple texts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { object: 'embedding', index: 0, embedding: new Array(384).fill(0.1) },
            { object: 'embedding', index: 1, embedding: new Array(384).fill(0.2) },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 8, total_tokens: 8 },
        }),
      })

      const result = await provider.embed(['First text', 'Second text'])
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(Float32Array)
      expect(result[1]).toBeInstanceOf(Float32Array)
    })

    it('filters empty texts before API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', index: 0, embedding: new Array(384).fill(0.1) }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
      })

      const result = await provider.embed(['Hello', '', '  ', 'World'])
      // Should filter empty/whitespace and send only ['Hello', 'World']
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.input).toEqual(['Hello', 'World'])
      expect(result).toHaveLength(1) // one response for the two valid texts
    })

    it('returns empty array when all texts are empty', async () => {
      const result = await provider.embed(['', '  '])
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('embed() — dimension validation', () => {
    it('throws EmbeddingDimensionError when dimensions do not match 384', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding: new Array(512).fill(0.1), // Wrong dimension
            },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
      })

      const err = await provider.embed(['Hello']).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(EmbeddingDimensionError)
      expect((err as Error).message).toBe('Dimension mismatch: expected 384, got 512')
    })
  })

  describe('embed() — HTTP error handling', () => {
    it('throws InvalidApiKeyError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Incorrect API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        }),
      })

      await expect(provider.embed(['Hello'])).rejects.toThrow(InvalidApiKeyError)
    })

    it('throws InvalidApiKeyError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: { message: 'Key not permitted', type: 'access_denied', code: null },
        }),
      })

      await expect(provider.embed(['Hello'])).rejects.toThrow(InvalidApiKeyError)
    })

    it('throws EmbeddingRateLimitError on 429', async () => {
      // Need enough mock responses for MAX_RETRIES+1 = 4 attempts
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Rate limit exceeded', type: 'rate_limit', code: 'rate_limited' },
        }),
      }
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse)

      await expect(provider.embed(['Hello'])).rejects.toThrow(EmbeddingRateLimitError)
    })

    it('retries with exponential backoff on 429, then succeeds', async () => {
      vi.useFakeTimers()

      // Return 429 twice, then success on third attempt
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({
            error: { message: 'Rate limit', type: 'rate_limit', code: 'rate_limited' },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({
            error: { message: 'Rate limit', type: 'rate_limit', code: 'rate_limited' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            object: 'list',
            data: [{ object: 'embedding', index: 0, embedding: new Array(384).fill(0.1) }],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 4, total_tokens: 4 },
          }),
        })

      const resultPromise = provider.embed(['Hello'])
      // Advance timers past all backoff delays (1s + 2s + buffer)
      await vi.advanceTimersByTimeAsync(4000)
      const result = await resultPromise
      expect(result).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledTimes(3) // 2 retries + 1 success

      vi.useRealTimers()
    })

    it('throws EmbeddingRateLimitError after max retries exhausted', async () => {
      // Return 429 for all retries (MAX_RETRIES+1 = 4 attempts)
      const errorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Rate limit', type: 'rate_limit', code: 'rate_limited' },
        }),
      }
      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)

      await expect(provider.embed(['Hello'])).rejects.toThrow(EmbeddingRateLimitError)
      expect(mockFetch).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })

    it('throws EmbeddingNetworkError when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(provider.embed(['Hello'])).rejects.toThrow(EmbeddingNetworkError)
    })

    it('throws EmbeddingNetworkError on network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))

      await expect(provider.embed(['Hello'])).rejects.toThrow(EmbeddingNetworkError)
    })

    it('throws EmbeddingProviderError on 500 with error body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: { message: 'Server error', type: 'server_error', code: null },
        }),
      })

      await expect(provider.embed(['Hello'])).rejects.toThrow(EmbeddingProviderError)
      await expect(provider.embed(['Hello'])).rejects.not.toThrow(InvalidApiKeyError)
    })
  })

  describe('error properties', () => {
    it('EmbeddingProviderError carries provider and code', () => {
      const error = new EmbeddingProviderError('test', 'openai', 'test_code')
      expect(error.provider).toBe('openai')
      expect(error.code).toBe('test_code')
      expect(error.message).toBe('test')
      expect(error.name).toBe('EmbeddingProviderError')
    })

    it('InvalidApiKeyError has correct provider and code', () => {
      const error = new InvalidApiKeyError('openai')
      expect(error.provider).toBe('openai')
      expect(error.code).toBe('invalid_api_key')
      expect(error.name).toBe('InvalidApiKeyError')
    })

    it('EmbeddingDimensionError has correct provider, code, and message', () => {
      const error = new EmbeddingDimensionError('openai', 512, 384)
      expect(error.provider).toBe('openai')
      expect(error.code).toBe('dimension_mismatch')
      expect(error.message).toBe('Dimension mismatch: expected 384, got 512')
      expect(error.name).toBe('EmbeddingDimensionError')
    })
  })
})
