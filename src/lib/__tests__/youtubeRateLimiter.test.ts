/**
 * Unit Tests: youtubeRateLimiter.ts
 *
 * Tests the token bucket rate limiter for YouTube API requests:
 * - Token consumption and refill
 * - Request queueing when tokens exhausted
 * - Exponential backoff on 429 responses
 * - Singleton management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  YouTubeRateLimiter,
  DEFAULT_RATE_LIMITER_CONFIG,
  getYouTubeRateLimiter,
  resetYouTubeRateLimiter,
} from '@/lib/youtubeRateLimiter'

describe('youtubeRateLimiter.ts', () => {
  beforeEach(() => {
    resetYouTubeRateLimiter()
    vi.restoreAllMocks()
  })

  describe('YouTubeRateLimiter', () => {
    it('executes requests immediately when tokens are available', async () => {
      const limiter = new YouTubeRateLimiter()
      const result = await limiter.execute(async () => 'hello')
      expect(result).toBe('hello')
    })

    it('allows burst of maxTokens requests', async () => {
      const limiter = new YouTubeRateLimiter({ maxTokens: 3, refillRate: 3 })
      const results: number[] = []

      // Should all execute immediately (3 tokens available)
      await Promise.all([
        limiter.execute(async () => {
          results.push(1)
          return 1
        }),
        limiter.execute(async () => {
          results.push(2)
          return 2
        }),
        limiter.execute(async () => {
          results.push(3)
          return 3
        }),
      ])

      expect(results).toHaveLength(3)
    })

    it('queues requests when tokens are exhausted', async () => {
      const limiter = new YouTubeRateLimiter({ maxTokens: 1, refillRate: 100 })
      const order: number[] = []

      // First executes immediately, second queues
      const p1 = limiter.execute(async () => {
        order.push(1)
        return 1
      })
      const p2 = limiter.execute(async () => {
        order.push(2)
        return 2
      })

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe(1)
      expect(r2).toBe(2)
      expect(order).toContain(1)
      expect(order).toContain(2)
    })

    it('reports available tokens', () => {
      const limiter = new YouTubeRateLimiter({ maxTokens: 5, refillRate: 5 })
      expect(limiter.availableTokens).toBe(5)
    })

    it('reports queue length', () => {
      const limiter = new YouTubeRateLimiter()
      expect(limiter.queueLength).toBe(0)
    })

    it('resets state correctly', async () => {
      const limiter = new YouTubeRateLimiter({ maxTokens: 1, refillRate: 1 })
      await limiter.execute(async () => 'consume')
      limiter.reset()
      expect(limiter.availableTokens).toBe(1)
      expect(limiter.queueLength).toBe(0)
    })

    it('propagates errors from executed functions', async () => {
      const limiter = new YouTubeRateLimiter()
      await expect(
        limiter.execute(async () => {
          throw new Error('test error')
        })
      ).rejects.toThrow('test error')
    })
  })

  describe('executeWithRetry', () => {
    it('returns non-429 responses immediately', async () => {
      const limiter = new YouTubeRateLimiter()
      const response = new Response('ok', { status: 200 })
      const result = await limiter.executeWithRetry(async () => response)
      expect(result.status).toBe(200)
    })

    it('retries on 429 responses', async () => {
      const limiter = new YouTubeRateLimiter({
        maxRetries: 2,
        baseBackoffMs: 10,
        maxBackoffMs: 50,
      })

      let callCount = 0
      const fetchFn = async (): Promise<Response> => {
        callCount++
        if (callCount <= 1) {
          return new Response('rate limited', { status: 429 })
        }
        return new Response('ok', { status: 200 })
      }

      const result = await limiter.executeWithRetry(fetchFn)
      expect(result.status).toBe(200)
      expect(callCount).toBe(2)
    })

    it('returns 429 after max retries exhausted', async () => {
      const limiter = new YouTubeRateLimiter({
        maxRetries: 1,
        baseBackoffMs: 10,
        maxBackoffMs: 20,
      })

      const fetchFn = async (): Promise<Response> => {
        return new Response('rate limited', { status: 429 })
      }

      const result = await limiter.executeWithRetry(fetchFn)
      expect(result.status).toBe(429)
    })
  })

  describe('DEFAULT_RATE_LIMITER_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_RATE_LIMITER_CONFIG.maxTokens).toBe(3)
      expect(DEFAULT_RATE_LIMITER_CONFIG.refillRate).toBe(3)
      expect(DEFAULT_RATE_LIMITER_CONFIG.maxRetries).toBe(5)
      expect(DEFAULT_RATE_LIMITER_CONFIG.baseBackoffMs).toBe(1000)
      expect(DEFAULT_RATE_LIMITER_CONFIG.maxBackoffMs).toBe(32000)
    })
  })

  describe('Singleton management', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getYouTubeRateLimiter()
      const b = getYouTubeRateLimiter()
      expect(a).toBe(b)
    })

    it('creates a new instance after reset', () => {
      const a = getYouTubeRateLimiter()
      resetYouTubeRateLimiter()
      const b = getYouTubeRateLimiter()
      expect(a).not.toBe(b)
    })
  })
})
