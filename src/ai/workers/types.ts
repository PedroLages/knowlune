/**
 * Worker Message Types
 *
 * Structured message protocol for Web Worker communication.
 * All messages include requestId for async request/response matching.
 */

export type WorkerRequestType = 'embed' | 'search' | 'infer' | 'load-index'
export type WorkerResponseType =
  | 'success'
  | 'error'
  | 'stream-chunk'
  | 'stream-end'
  | 'download-progress'

// ============================================================================
// Request Messages
// ============================================================================

export interface WorkerRequest<T = unknown> {
  requestId: string // UUID for tracking async requests
  type: WorkerRequestType
  payload: T
  timeout?: number // Override default 30s timeout
}

// ============================================================================
// Response Messages
// ============================================================================

export interface WorkerSuccessResponse<T = unknown> {
  requestId: string
  type: 'success'
  result: T
}

export interface WorkerErrorResponse {
  requestId: string
  type: 'error'
  error: string // Human-readable error message
}

export interface WorkerStreamChunk {
  requestId: string
  type: 'stream-chunk' | 'stream-end'
  chunk?: string // Only present for 'stream-chunk'
}

export interface WorkerProgressUpdate {
  type: 'download-progress'
  progress: number // 0-100
}

export type WorkerResponse<T = unknown> =
  | WorkerSuccessResponse<T>
  | WorkerErrorResponse
  | WorkerStreamChunk
  | WorkerProgressUpdate

// ============================================================================
// Task Payloads
// ============================================================================

export interface EmbedPayload {
  texts: string[] // Batch of texts to embed
}

export interface EmbedResult {
  embeddings: Float32Array[] // 384-dim vectors
}

export interface SearchPayload {
  queryVector: Float32Array
  topK?: number // Default: 5
}

export interface SearchResult {
  results: Array<{
    noteId: string
    score: number // Cosine similarity 0-1
  }>
}

export interface LoadIndexPayload {
  vectors: Record<string, Float32Array> // { noteId: vector }
}

export interface InferPayload {
  prompt: string
  stream?: boolean // Default: false
}

export interface InferResult {
  text: string
}

// ============================================================================
// Task Options
// ============================================================================

export interface TaskOptions {
  priority?: 'high' | 'normal' | 'low'
  timeout?: number // Milliseconds (default: 30000)
  signal?: AbortSignal // For cancellation
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSuccessResponse<T>(
  response: WorkerResponse<T>
): response is WorkerSuccessResponse<T> {
  return response.type === 'success'
}

export function isErrorResponse(
  response: WorkerResponse
): response is WorkerErrorResponse {
  return response.type === 'error'
}

export function isStreamChunk(
  response: WorkerResponse
): response is WorkerStreamChunk {
  return response.type === 'stream-chunk' || response.type === 'stream-end'
}
