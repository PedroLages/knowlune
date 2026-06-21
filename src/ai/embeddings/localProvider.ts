/**
 * Local Embedding Provider
 *
 * Wraps the existing generateEmbeddings() from the worker coordinator to
 * provide an EmbeddingProvider-compatible interface.
 *
 * The isAvailable() check probes whether the Cache API has the transformers
 * model cached and whether web workers are supported. This avoids a full
 * model download crash when the Cache API is unavailable (private browsing,
 * Firefox, older Android WebView).
 */

import type { EmbeddingProvider } from './EmbeddingProvider'
import { generateEmbeddings } from '@/ai/workers/coordinator'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

/** The cache name Transformers.js uses by default */
const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

/**
 * Model files expected in the transformers cache.
 * The ONNX file (~23 MB) is the critical file — if it's missing the model
 * cannot load. The config/tokenizer files are small but also required.
 */
const EXPECTED_CACHE_PATTERNS = [
  'all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
  'all-MiniLM-L6-v2/resolve/main/tokenizer.json',
  'all-MiniLM-L6-v2/resolve/main/config.json',
]

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local'

  /**
   * Check whether the local provider is available.
   *
   * Returns true only when ALL of:
   * 1. Web Workers are supported (navigator)
   * 2. Cache API is available (navigator)
   * 3. The critical model ONNX file is present in the transformers cache
   *
   * Returns false without throwing for:
   * - Cache API unavailable (typeof caches === 'undefined')
   * - Firefox private browsing (navigator.storage.estimate() unavailable)
   * - Browser does not support workers
   */
  async isAvailable(): Promise<boolean> {
    // Web Workers are a hard requirement for the local provider
    if (!supportsWorkers()) {
      return false
    }

    // Cache API is required for model storage
    if (typeof caches === 'undefined') {
      console.info('[LocalEmbeddingProvider] Cache API unavailable — local model cannot load')
      return false
    }

    try {
      const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
      if (!cache) {
        return false
      }

      // Check that ALL critical model files are cached.
      // If any are missing, the model download will need to re-run (or fail).
      const results = await Promise.all(
        EXPECTED_CACHE_PATTERNS.map(async pattern => {
          // caches.match returns the first cached Response matching the URL pattern.
          // We use Request with the HuggingFace URL pattern that Transformers.js uses.
          const request = new Request(`https://huggingface.co/Xenova/${pattern}`)
          const match = await cache.match(request)
          return !!match
        })
      )

      const allPresent = results.every(Boolean)
      if (!allPresent) {
        const missingCount = results.filter(r => !r).length
        console.info(
          `[LocalEmbeddingProvider] Cache partial: ${missingCount}/${EXPECTED_CACHE_PATTERNS.length} model files missing`
        )
      }
      return allPresent
    } catch (error) {
      // Cache API threw (e.g., quota exceeded, opaque failure).
      // Treat as unavailable rather than propagating the error.
      console.warn('[LocalEmbeddingProvider] Cache API check failed:', error)
      return false
    }
  }

  /**
   * Generate embeddings using the on-device Transformers.js model via the
   * existing worker pool coordinator.
   *
   * Delegates directly to generateEmbeddings() from coordinator.ts, which
   * manages the worker lifecycle and message routing.
   */
  async embed(texts: string[]): Promise<Float32Array[]> {
    return generateEmbeddings(texts)
  }
}
