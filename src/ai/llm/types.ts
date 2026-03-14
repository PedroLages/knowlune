/**
 * LLM (Large Language Model) type definitions
 *
 * Defines interfaces for streaming chat completions from AI providers.
 */

import type { AIProviderId } from '@/lib/aiConfiguration'

/** Message format for LLM APIs */
export interface LLMMessage {
  /** Message role */
  role: 'system' | 'user' | 'assistant'
  /** Message content */
  content: string
}

/** Streaming chunk from LLM */
export interface LLMStreamChunk {
  /** Text content delta */
  content: string
  /** Reason for stream completion */
  finishReason?: 'stop' | 'length' | 'error'
}

/** LLM error types */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly providerId?: AIProviderId
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

/** LLM error codes */
export type LLMErrorCode =
  | 'TIMEOUT' // Request timed out
  | 'RATE_LIMIT' // Rate limit exceeded (HTTP 429)
  | 'AUTH_ERROR' // Authentication failed (HTTP 401)
  | 'NETWORK_ERROR' // Network failure
  | 'INVALID_RESPONSE' // Malformed response
  | 'UNKNOWN' // Unknown error

/** Request timeout in milliseconds */
export const LLM_REQUEST_TIMEOUT = 30000 // 30 seconds
