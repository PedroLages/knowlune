/**
 * Search Worker
 *
 * Handles vector similarity search off the main thread.
 * Maintains an in-memory vector index loaded via 'load-index' messages.
 * Returns top-K results sorted by cosine similarity score.
 */

import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
  SearchPayload,
  SearchResult,
  LoadIndexPayload,
} from './types'
import { cosineSimilarity } from '@/lib/vectorMath'

// In-memory vector index (loaded from main thread via load-index message)
let vectorIndex: Map<string, Float32Array> | null = null

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest

  try {
    if (request.type === 'load-index') {
      const { vectors } = request.payload as LoadIndexPayload
      vectorIndex = new Map(Object.entries(vectors))

      const response: WorkerSuccessResponse<void> = {
        requestId: request.requestId,
        type: 'success',
        result: undefined,
      }
      self.postMessage(response)
      return
    }

    if (request.type === 'search') {
      if (!vectorIndex) {
        throw new Error('Vector index not loaded. Call load-index first.')
      }

      const { queryVector, topK = 5 } = request.payload as SearchPayload

      const results: Array<{ noteId: string; score: number }> = []
      for (const [noteId, vector] of vectorIndex.entries()) {
        const score = cosineSimilarity(queryVector, vector)
        results.push({ noteId, score })
      }

      results.sort((a, b) => b.score - a.score)

      const response: WorkerSuccessResponse<SearchResult> = {
        requestId: request.requestId,
        type: 'success',
        result: { results: results.slice(0, topK) },
      }
      self.postMessage(response)
      return
    }

    throw new Error(`Unknown request type: ${request.type}`)
  } catch (error) {
    const response: WorkerErrorResponse = {
      requestId: request.requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(response)
  }
}

self.addEventListener('error', event => {
  // Log the error — the coordinator's worker.onerror handler on the main thread
  // will reject pending requests and terminate this worker via handleWorkerError.
  // Posting a message here without a requestId would be unroutable, and
  // calling self.close() would race with the coordinator's own termination.
  console.error('[SearchWorker] Unhandled error:', event)
})

export {}
