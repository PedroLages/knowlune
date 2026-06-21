/**
 * Unit tests for LocalEmbeddingProvider
 *
 * Covers:
 * - isAvailable() with Cache API available and model files present
 * - isAvailable() with Cache API unavailable (typeof caches === 'undefined')
 * - isAvailable() with partial cache (some model files missing)
 * - isAvailable() with empty cache
 * - isAvailable() when web workers are not supported
 * - embed() delegates to coordinator generateEmbeddings()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the coordinator module
vi.mock('@/ai/workers/coordinator', () => ({
  generateEmbeddings: vi.fn(),
}))

// Mock workerCapabilities
vi.mock('@/ai/lib/workerCapabilities', () => ({
  supportsWorkers: vi.fn(),
}))

const { generateEmbeddings } = await import('@/ai/workers/coordinator')
const { supportsWorkers } = await import('@/ai/lib/workerCapabilities')

const { LocalEmbeddingProvider } = await import('../localProvider')

describe('LocalEmbeddingProvider', () => {
  let provider: InstanceType<typeof LocalEmbeddingProvider>

  // Store original caches
  const originalCaches = globalThis.caches

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new LocalEmbeddingProvider()
  })

  afterEach(() => {
    // Restore original caches
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
  })

  describe('isAvailable()', () => {
    it('returns false when web workers are not supported', async () => {
      vi.mocked(supportsWorkers).mockReturnValue(false)

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })

    it('returns false when Cache API is unavailable', async () => {
      vi.mocked(supportsWorkers).mockReturnValue(true)
      Object.defineProperty(globalThis, 'caches', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })

    it('returns true when all model files are cached', async () => {
      vi.mocked(supportsWorkers).mockReturnValue(true)

      const mockCache = {
        match: vi.fn().mockResolvedValue(new Response('mock')),
      }

      Object.defineProperty(globalThis, 'caches', {
        value: {
          open: vi.fn().mockResolvedValue(mockCache),
          has: vi.fn(),
        },
        writable: true,
        configurable: true,
      })

      const result = await provider.isAvailable()
      expect(result).toBe(true)
      expect(mockCache.match).toHaveBeenCalledTimes(3) // 3 expected files
    })

    it('returns false when some model files are missing (partial cache)', async () => {
      vi.mocked(supportsWorkers).mockReturnValue(true)

      let callCount = 0
      const mockCache = {
        match: vi.fn().mockImplementation(() => {
          callCount++
          // First file exists, second two don't
          return callCount === 1 ? new Response('mock') : undefined
        }),
      }

      Object.defineProperty(globalThis, 'caches', {
        value: {
          open: vi.fn().mockResolvedValue(mockCache),
          has: vi.fn(),
        },
        writable: true,
        configurable: true,
      })

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })

    it('returns false when Cache API throws', async () => {
      vi.mocked(supportsWorkers).mockReturnValue(true)

      Object.defineProperty(globalThis, 'caches', {
        value: {
          open: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
          has: vi.fn(),
        },
        writable: true,
        configurable: true,
      })

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })
  })

  describe('embed()', () => {
    it('delegates to coordinator generateEmbeddings', async () => {
      const mockEmbeddings = [new Float32Array(384)]
      vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddings)

      const result = await provider.embed(['Hello world'])

      expect(generateEmbeddings).toHaveBeenCalledWith(['Hello world'])
      expect(result).toBe(mockEmbeddings)
    })

    it('passes through multiple texts', async () => {
      const mockEmbeddings = [new Float32Array(384), new Float32Array(384)]
      vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddings)

      const result = await provider.embed(['text1', 'text2'])

      expect(generateEmbeddings).toHaveBeenCalledWith(['text1', 'text2'])
      expect(result).toHaveLength(2)
    })
  })
})
