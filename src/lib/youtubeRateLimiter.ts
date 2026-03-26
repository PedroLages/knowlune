/**
 * YouTube API Rate Limiter — Token Bucket Algorithm
 *
 * Limits YouTube Data API v3 requests to 3 per second using a token bucket.
 * Excess requests are queued and executed when tokens become available.
 * 429 responses trigger exponential backoff with jitter.
 *
 * @see E28-S03 — YouTube Data API v3 Client with Rate Limiting
 */

/** Configuration for the rate limiter */
export interface RateLimiterConfig {
  /** Maximum tokens in the bucket (max burst size) */
  maxTokens: number
  /** Tokens added per second (refill rate) */
  refillRate: number
  /** Maximum retry attempts for 429 responses */
  maxRetries: number
  /** Base delay in ms for exponential backoff */
  baseBackoffMs: number
  /** Maximum backoff delay in ms */
  maxBackoffMs: number
}

/** Default rate limiter configuration: 3 req/sec, 5 retries */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxTokens: 3,
  refillRate: 3,
  maxRetries: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 32000,
}

/** Queued request waiting for a token */
interface QueuedRequest<T> {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

/**
 * Token bucket rate limiter for YouTube API requests.
 *
 * Usage:
 * ```ts
 * const limiter = new YouTubeRateLimiter()
 * const result = await limiter.execute(() => fetch(url))
 * ```
 */
export class YouTubeRateLimiter {
  private tokens: number
  private lastRefill: number
  private queue: QueuedRequest<unknown>[] = []
  private processing = false
  private config: RateLimiterConfig

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config }
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
  }

  /** Refill tokens based on elapsed time */
  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    const newTokens = elapsed * this.config.refillRate
    this.tokens = Math.min(this.config.maxTokens, this.tokens + newTokens)
    this.lastRefill = now
  }

  /** Try to consume a token. Returns true if successful. */
  private tryConsume(): boolean {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  /** Calculate wait time until a token is available (ms) */
  private getWaitTime(): number {
    this.refill()
    if (this.tokens >= 1) return 0
    const deficit = 1 - this.tokens
    return (deficit / this.config.refillRate) * 1000
  }

  /** Process queued requests sequentially */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const waitTime = this.getWaitTime()
      if (waitTime > 0) {
        await this.sleep(waitTime)
      }

      if (this.tryConsume()) {
        const request = this.queue.shift()
        if (request) {
          try {
            const result = await request.execute()
            request.resolve(result)
          } catch (error) {
            request.reject(error instanceof Error ? error : new Error(String(error)))
          }
        }
      }
    }

    this.processing = false
  }

  /**
   * Execute a function with rate limiting.
   * If no tokens are available, the request is queued.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.tryConsume()) {
      return fn()
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      void this.processQueue()
    })
  }

  /**
   * Execute a fetch with rate limiting and automatic retry on 429.
   * Applies exponential backoff with jitter for rate-limited responses.
   *
   * @param fetchFn - Function that performs the fetch
   * @returns The Response object
   * @throws Error after max retries exhausted
   */
  async executeWithRetry(fetchFn: () => Promise<Response>): Promise<Response> {
    let attempt = 0

    while (attempt <= this.config.maxRetries) {
      const response = await this.execute(fetchFn)

      if (response.status !== 429) {
        return response
      }

      attempt++
      if (attempt > this.config.maxRetries) {
        return response // Return the 429 response — caller handles it
      }

      // Exponential backoff with jitter
      const backoff = Math.min(
        this.config.baseBackoffMs * Math.pow(2, attempt - 1),
        this.config.maxBackoffMs
      )
      const jitter = backoff * 0.5 * Math.random()
      await this.sleep(backoff + jitter)
    }

    // Should not reach here, but TypeScript needs a return
    return this.execute(fetchFn)
  }

  /** Get current queue length (for diagnostics) */
  get queueLength(): number {
    return this.queue.length
  }

  /** Get current token count (for diagnostics) */
  get availableTokens(): number {
    this.refill()
    return Math.floor(this.tokens)
  }

  /** Reset the rate limiter state */
  reset(): void {
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
    this.queue = []
    this.processing = false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/** Singleton rate limiter instance for the YouTube API client */
let _instance: YouTubeRateLimiter | null = null

/**
 * Get the shared YouTube rate limiter instance.
 * Creates one on first call with default config.
 */
export function getYouTubeRateLimiter(): YouTubeRateLimiter {
  if (!_instance) {
    _instance = new YouTubeRateLimiter()
  }
  return _instance
}

/**
 * Reset the shared rate limiter (useful for testing).
 * @internal
 */
export function resetYouTubeRateLimiter(): void {
  _instance?.reset()
  _instance = null
}
