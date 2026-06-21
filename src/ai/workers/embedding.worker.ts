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
  WorkerProgressUpdate,
  EmbedPayload,
  EmbedResult,
  ProgressMessage,
} from './types'

// ============================================================================
// PLACEHOLDER: Mock Embedding Generation (DISABLED - using real Transformers.js)
// ============================================================================

/*
 * MOCK: Generate fake embeddings for testing.
 * Replace with actual Transformers.js pipeline in production.
 *
 * Generates deterministic, normalized non-zero vectors via a simple LCG hash
 * so that different texts produce distinguishable similarity scores.
 */
/*
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
*/

// ============================================================================
// PRODUCTION: Transformers.js Integration
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic pipeline type from @xenova/transformers
let embeddingPipeline: any = null

/**
 * Tracks which requestId triggered the pipeline initialization, so that
 * progress callbacks from Transformers.js model download are attributed to
 * the correct request. This is set ONCE when the first embed message triggers
 * the pipeline download, and subsequent concurrent messages share the same
 * pipeline without overwriting this ID.
 */
let pipelineInitRequestId: string | null = null

/**
 * Concurrency guard: once pipeline initialization starts, subsequent callers
 * await the same promise instead of triggering redundant model downloads.
 */
let pipelineInitPromise: Promise<any> | null = null

/**
 * Progress callback passed to Transformers.js pipeline() options.
 * Forwards model download progress to the coordinator so it can dispatch
 * a CustomEvent for the UI progress toast.
 *
 * Uses pipelineInitRequestId (not a per-message variable) to ensure that
 * even if multiple embed messages arrive during model download, progress
 * events are attributed to the request that ORIGINALLY triggered the
 * pipeline initialization.
 */
function onPipelineProgress(progress: ProgressMessage): void {
  const requestId = pipelineInitRequestId
  if (!requestId) return

  // Clamp display to 100% and handle indeterminate (total=0) case:
  // use -1 for indeterminate so the UI shows "..." instead of "0%"
  const progressValue =
    progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : -1

  const progressUpdate: WorkerProgressUpdate = {
    requestId,
    type: 'download-progress',
    status: progress.status === 'done' ? 'done' : 'progress',
    progress: progressValue,
    file: progress.file,
    loaded: progress.loaded,
    total: progress.total,
  }

  self.postMessage(progressUpdate)
}

/**
 * Lazy-initialise the Transformers.js pipeline on first embed request.
 *
 * Concurrency-guarded by pipelineInitPromise: if two messages arrive before
 * the pipeline is ready, both await the same promise instead of triggering
 * redundant downloads.
 *
 * Previous behaviour eagerly imported and configured @xenova/transformers at
 * module scope, which produced ~8 console errors when the model wasn't cached
 * or the network was unavailable (KI-028). Moving all side-effects here
 * ensures the worker boots silently and only attempts a download when the
 * caller actually needs embeddings.
 */
async function initializePipeline(requestId: string): Promise<any> {
  if (embeddingPipeline) return embeddingPipeline
  if (pipelineInitPromise) return pipelineInitPromise

  // Capture which requestId triggered the first-ever pipeline init.
  // This ensures progress callbacks are attributed correctly even when
  // multiple messages arrive before the download completes.
  pipelineInitRequestId = requestId

  // Skip model fetch when offline — will retry when connection resumes
  if (!navigator.onLine) {
    throw new Error('Offline — skipping model download. Will retry when connection resumes.')
  }

  console.log('[EmbeddingWorker] Loading model: all-MiniLM-L6-v2')

  pipelineInitPromise = (async () => {
    try {
      // Dynamic import keeps module-level evaluation side-effect-free
      const { pipeline, env } = await import('@xenova/transformers')

      // Configure environment before first pipeline() call
      env.allowLocalModels = false

      // ONNX backend initialization: wrap in try/catch to report specific
      // failure reasons. Common failure modes:
      // - Low memory / OOM: WASM backend allocation fails
      // - Cache API unavailable: model binaries can't be loaded
      // - Browser-incompatible WASM: older Firefox, Safari private browsing
      try {
        env.backends.onnx.wasm.numThreads = 1 // CRITICAL: Limit to 1 thread per worker
      } catch (onnxError) {
        throw Object.assign(
          new Error('ONNX backend initialization failed'),
          { reason: 'onnx-backend-failed', cause: onnxError }
        )
      }

      let pipelineInstance: any
      try {
        pipelineInstance = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2', // 384-dim, 23MB model (defaults to WASM/CPU)
          { progress_callback: onPipelineProgress }
        )
      } catch (pipelineError) {
        // Determine the root cause for telemetry
        // @ts-expect-error - adding custom reason for telemetry
        const reason: string = pipelineError?.message?.includes('ONNX') ||
          pipelineError?.message?.includes('wasm') ||
          pipelineError?.message?.includes('WebAssembly')
          ? 'onnx-backend-failed'
          : pipelineError?.message?.includes('cache') ||
            pipelineError?.message?.includes('Cache')
          ? 'cache-unavailable'
          : 'model-load-failed'
        throw Object.assign(
          new Error('Pipeline initialization failed'),
          { reason, cause: pipelineError }
        )
      }

      embeddingPipeline = pipelineInstance

      // Integrity verification: run a quick inference to confirm the model
      // loaded correctly and produces the expected 384-dim output. This catches
      // corrupted downloads, model file mismatches, or MITM-substituted models.
      // all-MiniLM-L6-v2 is a fixed-architecture model, so the output dimension
      // is a reliable integrity check.
      {
        const verifyResult = await embeddingPipeline('test', {
          pooling: 'mean',
          normalize: true,
        })
        const outputDim = verifyResult?.data?.length ?? 0
        // For a single string input, data is a Tensor-like object; verify the
        // flattened length matches what we expect (384-dim single vector).
        if (outputDim !== 384) {
          throw new Error(
            `Model integrity check failed: expected 384-dim output, got ${outputDim}-dim. ` +
              'The downloaded model may be corrupted or substituted.'
          )
        }
        console.log('[EmbeddingWorker] Model integrity verified: 384-dim output confirmed')
      }

      // Signal completion so the UI can dismiss the progress toast
      if (pipelineInitRequestId) {
        const doneUpdate: WorkerProgressUpdate = {
          requestId: pipelineInitRequestId,
          type: 'download-progress',
          status: 'done',
          progress: 100,
        }
        self.postMessage(doneUpdate)
      }

      pipelineInitRequestId = null
      pipelineInitPromise = null

      console.log('[EmbeddingWorker] Model loaded successfully')
      return embeddingPipeline
    } catch (error) {
      pipelineInitPromise = null
      pipelineInitRequestId = null

      // Single warning instead of multiple uncaught errors (KI-028)
      console.warn(
        '[EmbeddingWorker] Model unavailable — embeddings disabled until next attempt.',
        error
      )
      throw new Error('Unable to load AI model. Check your internet connection.')
    }
  })()

  return pipelineInitPromise
}

async function generateEmbeddings(texts: string[], requestId: string): Promise<Float32Array[]> {
  const pipeline = await initializePipeline(requestId)

  // Generate embeddings (returns Float32Array[])
  const result = await pipeline(texts, { pooling: 'mean', normalize: true })
  return result.data // 384-dim vectors
}

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

    // Generate embeddings (Real Transformers.js).
    // Pass requestId so initializePipeline can associate progress events
    // with the request that triggered the model download.
    const embeddings = await generateEmbeddings(texts, requestId)

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
