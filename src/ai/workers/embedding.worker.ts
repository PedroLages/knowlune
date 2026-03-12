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
 *
 * Generates deterministic, normalized non-zero vectors via a simple LCG hash
 * so that different texts produce distinguishable similarity scores.
 */
async function generateMockEmbeddings(texts: string[]): Promise<Float32Array[]> {
  console.log('[EmbeddingWorker] MOCK: Generating embeddings for', texts.length, 'texts')

  // Simulate embedding generation (50ms per text)
  await new Promise(resolve => setTimeout(resolve, texts.length * 50))

  return texts.map(text => {
    const v = new Float32Array(384)

    // Seed an LCG from the text content for deterministic, text-dependent vectors
    let seed = 0
    for (let i = 0; i < text.length; i++) {
      seed = (seed * 31 + text.charCodeAt(i)) | 0
    }

    for (let i = 0; i < 384; i++) {
      // LCG step (Numerical Recipes constants)
      seed = (seed * 1664525 + 1013904223) | 0
      v[i] = (seed & 0x7fffffff) / 0x7fffffff // [0, 1]
    }

    // Normalize to unit vector so cosine similarity is well-defined
    const magnitude = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0))
    for (let i = 0; i < 384; i++) v[i] /= magnitude

    return v
  })
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
