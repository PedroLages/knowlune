/**
 * Embedding Worker
 *
 * Generates vector embeddings for text using Transformers.js.
 * Runs in Web Worker to avoid blocking main thread during inference.
 *
 * Model: all-MiniLM-L6-v2 (23MB, 384-dim, 50ms per text)
 * Backend: WebAssembly (CPU-based, no GPU required)
 *
 * IMPORTANT: This is a PLACEHOLDER implementation.
 * Actual implementation will use @xenova/transformers after testing.
 */

import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
  EmbedPayload,
  EmbedResult,
} from './types'

// ============================================================================
// PLACEHOLDER: Mock Embedding Generation
// ============================================================================

/**
 * MOCK: Generate fake embeddings for testing.
 * Replace with actual Transformers.js pipeline in production.
 */
async function generateMockEmbeddings(texts: string[]): Promise<Float32Array[]> {
  console.log('[EmbeddingWorker] MOCK: Generating embeddings for', texts.length, 'texts')

  // Simulate embedding generation (50ms per text)
  await new Promise(resolve => setTimeout(resolve, texts.length * 50))

  // Return fake 384-dim vectors (all zeros)
  return texts.map(() => new Float32Array(384))
}

// ============================================================================
// PRODUCTION: Transformers.js Integration (commented out until testing)
// ============================================================================

/*
import { pipeline, env } from '@xenova/transformers'

// Disable local model cache (IndexedDB only)
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1  // CRITICAL: Limit to 1 thread per worker

let embeddingPipeline: any = null

async function initializePipeline() {
  if (!embeddingPipeline) {
    console.log('[EmbeddingWorker] Loading model: all-MiniLM-L6-v2')

    try {
      embeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',  // 384-dim, 23MB model
        { device: 'wasm' }            // WebAssembly backend (CPU)
      )

      console.log('[EmbeddingWorker] Model loaded successfully')
    } catch (error) {
      console.error('[EmbeddingWorker] Model load failed:', error)
      throw new Error('Unable to load AI model. Check your internet connection.')
    }
  }

  return embeddingPipeline
}

async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const pipeline = await initializePipeline()

  // Generate embeddings (returns Float32Array[])
  const result = await pipeline(texts, { pooling: 'mean', normalize: true })
  return result.data  // 384-dim vectors
}
*/

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest<EmbedPayload>
  const { requestId, type, payload } = request

  if (type !== 'embed') {
    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: `Unknown request type: ${type}`,
    }
    self.postMessage(errorResponse)
    return
  }

  try {
    const { texts } = payload

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Invalid payload: texts must be non-empty array')
    }

    // Generate embeddings (MOCK for now)
    const embeddings = await generateMockEmbeddings(texts)

    const successResponse: WorkerSuccessResponse<EmbedResult> = {
      requestId,
      type: 'success',
      result: { embeddings },
    }

    self.postMessage(successResponse)
  } catch (error) {
    console.error('[EmbeddingWorker] Error:', error)

    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    self.postMessage(errorResponse)
  }
}

// ============================================================================
// Error Handler
// ============================================================================

self.addEventListener('error', event => {
  console.error('[EmbeddingWorker] Unhandled error:', event)

  // Notify coordinator of crash
  self.postMessage({
    type: 'error',
    error: 'Worker crashed due to memory pressure. Reloading...',
  })

  // Terminate worker (coordinator will respawn on next request)
  self.close()
})

// ============================================================================
// Export for TypeScript
// ============================================================================

export {}
