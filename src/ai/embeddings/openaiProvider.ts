/**
 * OpenAI Embedding Provider
 *
 * Calls the OpenAI Embeddings API (text-embedding-3-small) with 384 dimensions.
 * Falls back gracefully: typed errors carry a `provider` field for actionable
 * telemetry (requestId, provider name, error class) instead of opaque failures.
 *
 * Error handling:
 * - 401/403 → InvalidApiKeyError (surfaced via toast once, not per-request)
 * - 429 → retry with exponential backoff, max 3 retries, then fail
 * - Dimension mismatch → EmbeddingDimensionError, do NOT write mismatched vectors
 * - Network → EmbeddingNetworkError, trigger fallback chain
 */

import type { EmbeddingProvider } from './EmbeddingProvider'

// ============================================================================
// OpenAI API Configuration
// ============================================================================

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'
const DEFAULT_MODEL = 'text-embedding-3-small'
const EXPECTED_DIMENSIONS = 384
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1_000
const REQUEST_TIMEOUT_MS = 15_000

// ============================================================================
// Typed Errors
// ============================================================================

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'EmbeddingProviderError'
  }
}

export class InvalidApiKeyError extends EmbeddingProviderError {
  constructor(provider: string) {
    super('Invalid or missing API key', provider, 'invalid_api_key')
    this.name = 'InvalidApiKeyError'
  }
}

export class EmbeddingRateLimitError extends EmbeddingProviderError {
  constructor(provider: string) {
    super('Rate limit exceeded', provider, 'rate_limited')
    this.name = 'EmbeddingRateLimitError'
  }
}

export class EmbeddingDimensionError extends EmbeddingProviderError {
  constructor(provider: string, actual: number, expected: number) {
    super(
      `Dimension mismatch: expected ${expected}, got ${actual}`,
      provider,
      'dimension_mismatch'
    )
    this.name = 'EmbeddingDimensionError'
  }
}

export class EmbeddingNetworkError extends EmbeddingProviderError {
  constructor(provider: string, message: string) {
    super(`Failed to reach embedding API: ${message}`, provider, 'network_error')
    this.name = 'EmbeddingNetworkError'
  }
}

// ============================================================================
// Helper
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// OpenAI Embedding API Response Types
// ============================================================================

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

interface OpenAIErrorBody {
  error?: {
    message: string
    type: string
    code: string | null
  }
}

// ============================================================================
// OpenAI Embedding Provider
// ============================================================================

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai'

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Checks whether this provider is ready.
   * For OpenAI, availability means a non-empty API key is configured.
   * The actual credential validity is tested on first embed() call.
   */
  async isAvailable(): Promise<boolean> {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0
  }

  /**
   * Generate embeddings for the given texts using the OpenAI Embeddings API.
   *
   * Validation steps:
   * 1. Filter empty/whitespace texts (consistent with local provider behavior)
   * 2. Send POST request with exponential backoff on 429
   * 3. Validate HTTP response status
   * 4. Validate each embedding has exactly 384 dimensions
   * 5. Convert to Float32Array[]
   */
  async embed(texts: string[]): Promise<Float32Array[]> {
    // Filter empty/whitespace texts (consistent with local provider behavior)
    const filteredTexts = texts.map((t) => t.trim()).filter(Boolean)
    if (filteredTexts.length === 0) {
      return []
    }

    const body = JSON.stringify({
      model: DEFAULT_MODEL,
      input: filteredTexts,
      dimensions: EXPECTED_DIMENSIONS,
    })

    const response = await this.makeRequestWithRetry(body)

    return this.validateAndConvert(response)
  }

  /**
   * Make the HTTP request with retry on 429 (rate limit).
   * Non-429 errors are thrown immediately (not retried).
   * Network/fetch failures are thrown immediately.
   */
  private async makeRequestWithRetry(body: string): Promise<OpenAIEmbeddingResponse> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response

      try {
        response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (error) {
        // Network or timeout error — not retryable
        throw new EmbeddingNetworkError(
          'openai',
          error instanceof Error ? error.message : 'Unknown network error'
        )
      }

      if (response.ok) {
        let parsed: OpenAIEmbeddingResponse
        try {
          parsed = await response.json()
        } catch {
          throw new EmbeddingProviderError(
            'Failed to parse OpenAI embedding response',
            'openai',
            'invalid_response'
          )
        }
        return parsed
      }

      // Handle HTTP error status
      if (response.status === 429) {
        // Rate limit — retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
          console.info(
            `[OpenAIEmbeddingProvider] Rate limited, retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`
          )
          await sleep(delay)
          continue
        }
        throw new EmbeddingRateLimitError('openai')
      }

      // Non-retryable errors (401, 403, 500, etc.) — throw immediately
      await this.throwNonRetryableError(response)
    }

    // Should never reach here, but TypeScript doesn't know that
    throw new EmbeddingRateLimitError('openai')
  }

  /**
   * Parse and throw the appropriate error for a non-OK, non-429 response.
   * Never returns — always throws.
   */
  private async throwNonRetryableError(response: Response): Promise<never> {
    const status = response.status

    // Attempt to parse error body for better messages
    let errorMessage = `HTTP ${status}`
    try {
      const errorBody: OpenAIErrorBody = await response.json()
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      errorMessage = response.statusText || `HTTP ${status}`
    }

    switch (status) {
      case 401:
      case 403:
        throw new InvalidApiKeyError('openai')
      default:
        throw new EmbeddingProviderError(
          `OpenAI API error: ${errorMessage}`,
          'openai',
          `http_${status}`
        )
    }
  }

  /**
   * Validate the API response and convert to Float32Array[].
   *
   * Checks:
   * - Response has correct number of embeddings (one per input text)
   * - Each embedding has exactly 384 dimensions
   *
   * Throws EmbeddingDimensionError on mismatch — caller must NOT write
   * mismatched vectors into the vector store.
   */
  private validateAndConvert(response: OpenAIEmbeddingResponse): Float32Array[] {
    if (!response.data || !Array.isArray(response.data)) {
      throw new EmbeddingProviderError(
        'OpenAI response missing data array',
        'openai',
        'invalid_response'
      )
    }

    const embeddings: Float32Array[] = []

    for (const item of response.data) {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        throw new EmbeddingProviderError(
          'OpenAI response item missing embedding array',
          'openai',
          'invalid_response'
        )
      }

      const dims = item.embedding.length
      if (dims !== EXPECTED_DIMENSIONS) {
        throw new EmbeddingDimensionError('openai', dims, EXPECTED_DIMENSIONS)
      }

      embeddings.push(new Float32Array(item.embedding))
    }

    return embeddings
  }
}
