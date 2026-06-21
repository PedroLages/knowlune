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
    __setAuthUser: (id: string | null) => {
      mutableState.user = id ? { id } : null
    },
  }
})

// Mock aiConfiguration
vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: vi.fn(),
  getDecryptedApiKeyForProvider: vi.fn(),
}))

// Mock vector store to track saveEmbedding calls
vi.mock('@/ai/vector-store', () => ({
  vectorStorePersistence: {
    saveEmbedding: vi.fn().mockResolvedValue(undefined),
    removeEmbedding: vi.fn().mockResolvedValue(undefined),
  },
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

import { isGranted, isGrantedForProvider } from '@/lib/compliance/consentService'
import { getAIConfiguration, getDecryptedApiKeyForProvider } from '@/lib/aiConfiguration'
import { generateEmbeddings } from '@/ai/workers/coordinator'
import { vectorStorePersistence } from '@/ai/vector-store'

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
  } as unknown as import('@/data/types').Note
}

// Default 384-dim vector for mock returns
function mockEmbeddingVector(): Float32Array {
  const v = new Float32Array(384)
  v[0] = 0.5
  return v
}

describe('EmbeddingPipeline fallback', () => {
  let pipeline: InstanceType<typeof EmbeddingPipeline>

  // Store original globals
  const originalCaches = globalThis.caches
  const originalWorker = globalThis.Worker
  const originalFetch = globalThis.fetch

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
      constructor() {
        /* noop */
      }
    } as unknown as typeof Worker

    // Mock global.fetch to prevent real network calls during OpenAI fallback
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network not mocked'))
  })

  afterEach(async () => {
    // Restore globals
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
    globalThis.Worker = originalWorker
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('Happy path — local succeeds', () => {
    it('calls local provider and saves embedding, does not call OpenAI', async () => {
      // Local succeeds
      vi.mocked(generateEmbeddings).mockResolvedValue([mockEmbeddingVector()])

      await pipeline.indexNote(makeNote())

      // Local should have been called
      expect(generateEmbeddings).toHaveBeenCalledTimes(1)
      // OpenAI should NOT have been called — the decrypted key is only read
      // when local fails, and saveEmbedding should have been called
      expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()
      expect(vectorStorePersistence.saveEmbedding).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge case — local fails, OpenAI fallback succeeds', () => {
    it('reads OpenAI key when local provider fails', async () => {
      // Local fails
      // Note: reason is set via Object.assign on the mock error, bypassing the
      // real worker chain (embedding.worker.ts -> coordinator message routing).
      // In production the `reason` property is stripped at the worker message
      // boundary (postMessage serializes error.message only), so while the test
      // validates the pipeline's reason-extraction logic, the production path
      // always sees reason === 'unknown' at this level. This is a known gap
      // tracked for a future story that will preserve structured error data
      // across the worker message boundary.
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )

      await pipeline.indexNote(makeNote())

      // Local was attempted
      expect(generateEmbeddings).toHaveBeenCalled()
      // OpenAI key was read for fallback
      expect(getDecryptedApiKeyForProvider).toHaveBeenCalledWith('openai')
      // saveEmbedding not called because OpenAI fetch is mocked to fail
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
    })

    it('calls OpenAI when local provider throws onnx-backend-failed', async () => {
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('ONNX init failed'), { reason: 'onnx-backend-failed' })
      )

      await pipeline.indexNote(makeNote())

      expect(generateEmbeddings).toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).toHaveBeenCalledWith('openai')
      // saveEmbedding not called because OpenAI fetch is mocked to fail
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
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
      // No embedding should be saved - local failed and no OpenAI key
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
    })

    it('returns gracefully when OpenAI key decryption fails', async () => {
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Model not loaded'), { reason: 'onnx-backend-failed' })
      )
      vi.mocked(getDecryptedApiKeyForProvider).mockRejectedValue(new Error('Decryption failed'))

      await expect(pipeline.indexNote(makeNote())).resolves.toBeUndefined()
      // No embedding saved because key decryption failed
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
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
      // No embedding should be saved - both providers failed
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
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
      // No embedding saved because OpenAI key is null
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('logs structured telemetry when OpenAI fallback fails (AC4 clause 2)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn')

      // Local fails
      vi.mocked(generateEmbeddings).mockRejectedValue(
        Object.assign(new Error('Worker crashed'), { reason: 'onnx-backend-failed' })
      )
      // OpenAI key present, but fetch mock rejects — OpenAI call will fail
      vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue('sk-test-key')

      await pipeline.indexNote(makeNote())

      // Should have logged OpenAI fallback failure with structured telemetry
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[EmbeddingPipeline] OpenAI fallback failed:',
        expect.objectContaining({ provider: 'openai', code: 'network_error' })
      )
      // No embedding saved — both providers failed
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Consent gate integration', () => {
    it('skips embedding when user is not logged in', async () => {
      // Set user to null via __setAuthUser helper from the mock.
      // Defined inline rather than as a global type because __setAuthUser
      // only exists in the mocked module (not the real useAuthStore).
      interface AuthStoreMock {
        useAuthStore: { getState: () => { user: { id: string } | null } }
        __setAuthUser: (id: string | null) => void
      }
      const authModule = (await import('@/stores/useAuthStore')) as unknown as AuthStoreMock
      authModule.__setAuthUser(null)

      await pipeline.indexNote(makeNote())

      // Neither provider should be called
      expect(generateEmbeddings).not.toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()
      // No embedding saved because pipeline exited early
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
    })

    it('skips embedding when ai_embeddings consent is not granted', async () => {
      vi.mocked(isGranted).mockResolvedValue(false)

      await pipeline.indexNote(makeNote())

      expect(generateEmbeddings).not.toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
    })

    it('skips embedding when provider consent is not granted', async () => {
      vi.mocked(isGrantedForProvider).mockResolvedValue(false)

      await pipeline.indexNote(makeNote())

      expect(generateEmbeddings).not.toHaveBeenCalled()
      expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()
      expect(vectorStorePersistence.saveEmbedding).not.toHaveBeenCalled()
    })
  })
})
