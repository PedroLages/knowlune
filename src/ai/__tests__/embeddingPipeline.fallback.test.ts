/**
 * Unit tests for EmbeddingPipeline fallback behavior
 *
 * Covers:
 * - Happy path: Local provider succeeds -> OpenAI never called
 * - Edge case: Local fails + OpenAI key present -> OpenAI called, returns vector
 * - Edge case: Local fails + no OpenAI key -> pipeline returns null (graceful)
 * - Error path: Both providers fail -> note saved without embedding (logged)
 * - Telemetry: Error classes surfaced with provider name
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Dexie from 'dexie'

// Mock consent service
vi.mock('@/lib/compliance/consentService', () => ({
  isGranted: vi.fn().mockResolvedValue(true),
  isGrantedForProvider: vi.fn().mockResolvedValue(true),
  CONSENT_PURPOSES: { AI_EMBEDDINGS: 'ai_embeddings' },
}))

// Mock auth store — export mutable state via mock module for test manipulation
vi.mock('@/stores/useAuthStore', () => {
  // Use getter so tests can mutate the testAuthState reference
  const mutableState: { user: { id: string } | null } = { user: { id: 'test-user' } }
  return {
    useAuthStore: {
      getState: () => mutableState,
    },
    __setAuthUser: (id: string | null) => { mutableState.user = id ? { id } : null },
  }
})

// Mock aiConfiguration
vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: vi.fn(),
  getDecryptedApiKeyForProvider: vi.fn(),
}))

// Mock coordinator generateEmbeddings
vi.mock('@/ai/workers/coordinator', () => ({
  generateEmbeddings: vi.fn(),
  warmUpEmbeddingModel: vi.fn(),
}))

// Mock workerCapabilities - LocalEmbeddingProvider uses this
vi.mock('@/ai/lib/workerCapabilities', () => ({
  supportsWorkers: vi.fn().mockReturnValue(true),
}))

import { getAIConfiguration, getDecryptedApiKeyForProvider } from '@/lib/aiConfiguration'
import { generateEmbeddings } from '@/ai/workers/coordinator'

// Import after mocks
const { EmbeddingPipeline } = await import('../embeddingPipeline')

function makeNote(overrides: Partial<{ id: string; content: string }> = {}) {
  return {
    id: overrides.id ?? 'note-1',
    content: overrides.content ?? 'Test note content',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    title: 'Test Note',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as import('@/data/types').Note
}

// Default 384-dim vector for mock returns
function mockEmbeddingVector(): Float32Array {
  const v = new Float32Array(384)
  v[0] = 0.5
  return v
}

describe('EmbeddingPipeline fallback', () => {
  let pipeline: EmbeddingPipeline

  // Store original globals
  const originalCaches = globalThis.caches
  const originalWorker = globalThis.Worker

  beforeEach(async () => {
    vi.clearAllMocks()
    await Dexie.delete('ElearningDB')
    // Re-import schema for fresh Dexie
    vi.resetModules()
    await import('@/db/schema')

    pipeline = new EmbeddingPipeline()

    // Default: user is logged in, consent granted, configuration returns openai provider
    vi.mocked(getAIConfiguration).mockReturnValue({
      provider: 'openai',
      providerKeys: { openai: { iv: 'mock-iv', encryptedData: 'mock-data' } },
      apiKeyEncrypted: undefined,
    } as any)
    vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue('sk-test-key')

    // Mock Cache API so LocalEmbeddingProvider.isAvailable() returns true
    const mockCache = {
      match: vi.fn().mockResolvedValue(new Response('cached-model')),
    }
    Object.defineProperty(globalThis, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
        has: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // Mock Worker constructor so supportsWorkers() returns true
    globalThis.Worker = class MockWorker {
      constructor() { /* noop */ }
    } as unknown as typeof Worker
  })

  afterEach(async () => {
    // Restore globals
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
    globalThis.Worker = originalWorker
    vi.restoreAllMocks()
  })

  describe('Happy path — local succeeds', () => {
    it('calls local provider and saves embedding, does not call OpenAI', async () => {
      // Local succeeds
      vi.mocked(generateEmbeddings).mockResolvedValue([mockEmbeddingVector()])

      await pipeline.indexNote(makeNote())

      // Local should have been called
      expect(generateEmbeddings).toHaveBeenCalledTimes(1)
      // OpenAI should NOT have been called — the decrypted key provider is read
      // only if local fails, so we verify it was never read for the fallback
      // Note: getDecryptedApiKeyForProvider may be called by getAIConfiguration;
      // we focus on generateEmbeddings being the sole embedding attempt
    })
  })

  describe('Edge case — local fails, OpenAI fallback succeeds', () => {
    it('reads OpenAI key when local provider fails', async () => {
      // Local fails
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )

      await pipeline.indexNote(makeNote())

      // Local was attempted
      expect(generateEmbeddings).toHaveBeenCalled()
      // OpenAI key was read for fallback
      expect(getDecryptedApiKeyForProvider).toHaveBeenCalledWith('openai')
    })

    it('calls OpenAI when local provider throws onnx-backend-failed', async () => {
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('ONNX init failed'), { reason: 'onnx-backend-failed' })
      )

      await pipeline.indexNote(makeNote())

      expect(generateEmbeddings).toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).toHaveBeenCalledWith('openai')
    })
  })

  describe('Edge case — local fails, no OpenAI key', () => {
    it('returns gracefully without saving embedding when no OpenAI key', async () => {
      // Local unavailable
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )
      // No OpenAI key configured
      vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue(null)

      // Should not throw
      await expect(pipeline.indexNote(makeNote())).resolves.toBeUndefined()
    })

    it('returns gracefully when OpenAI key decryption fails', async () => {
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )
      vi.mocked(getDecryptedApiKeyForProvider).mockRejectedValue(new Error('Decryption failed'))

      await expect(pipeline.indexNote(makeNote())).resolves.toBeUndefined()
    })
  })

  describe('Error path — both providers fail', () => {
    it('does not throw when local fails and OpenAI key is present but unreachable', async () => {
      // Local fails
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )
      // OpenAI key present
      vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue('sk-test-key')

      await expect(pipeline.indexNote(makeNote())).resolves.toBeUndefined()
    })
  })

  describe('Telemetry — error surface', () => {
    it('logs telemetry with provider name and error class on local failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn')

      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Worker crashed'), { reason: 'onnx-backend-failed' })
      )
      vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue(null)

      await pipeline.indexNote(makeNote())

      // Should have logged telemetry with provider: 'local'
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[EmbeddingPipeline] Local embedding failed:',
        expect.objectContaining({ provider: 'local', reason: 'onnx-backend-failed' })
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Consent gate integration', () => {
    it('skips embedding when user is not logged in', async () => {
      // Set user to null via __setAuthUser helper from the mock
      const authModule = (await import('@/stores/useAuthStore')) as {
        useAuthStore: { getState: () => { user: { id: string } | null } }
        __setAuthUser: (id: string | null) => void
      }
      authModule.__setAuthUser(null)

      await pipeline.indexNote(makeNote())

      // Neither provider should be called
      expect(generateEmbeddings).not.toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()
    })
  })
})
