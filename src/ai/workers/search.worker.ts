import { BruteForceVectorStore } from '@/lib/vectorSearch'
import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
  LoadIndexPayload,
  SearchPayload,
  SearchResult,
} from './types'

const store = new BruteForceVectorStore(384)

self.onmessage = (e: MessageEvent) => {
  const request = e.data as WorkerRequest
  const { requestId, type, payload } = request

  try {
    if (type === 'load-index') {
      const { vectors } = payload as LoadIndexPayload
      store.clear()
      for (const [noteId, vector] of Object.entries(vectors)) {
        store.insert(noteId, Array.from(vector))
      }
      const response: WorkerSuccessResponse<void> = {
        requestId,
        type: 'success',
        result: undefined,
      }
      self.postMessage(response)
    } else if (type === 'search') {
      const { queryVector, topK = 5 } = payload as SearchPayload
      const results = store.search(Array.from(queryVector), topK)
      const mapped = results.map(r => ({ noteId: r.id, score: r.similarity }))
      const response: WorkerSuccessResponse<SearchResult> = {
        requestId,
        type: 'success',
        result: { results: mapped },
      }
      self.postMessage(response)
    } else {
      throw new Error(`Unknown request type: ${type}`)
    }
  } catch (error) {
    const err: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(err)
  }
}

export {}
