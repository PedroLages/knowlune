import { describe, it, expect, vi } from 'vitest'
import { createRateLimiter } from '../../middleware/rate-limiter.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(userId?: string, ip?: string) {
  return {
    user: userId ? { sub: userId } : undefined,
    ip: ip ?? '127.0.0.1',
    headers: {},
  } as never
}

function mockRes() {
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    body: null as unknown,
    _headers: headers,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((data: unknown) => {
      res.body = data
      return res
    }),
    set: vi.fn((key: string, value: string) => {
      headers[key] = value
      return res
    }),
  }
  return res
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  it('allows requests within the rate limit', async () => {
    const middleware = createRateLimiter({ points: 5, duration: 60 })
    const req = mockReq('user-1')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
    expect(res._headers['X-RateLimit-Remaining']).toBeDefined()
  })

  it('sets rate limit headers on successful requests', async () => {
    const middleware = createRateLimiter({ points: 10, duration: 60 })
    const req = mockReq('header-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
  })

  it('returns 429 when rate limit is exceeded', async () => {
    // Very low limit for testing
    const middleware = createRateLimiter({ points: 2, duration: 60 })

    // Use unique user ID to avoid cross-test interference
    const userId = `rate-limit-user-${Date.now()}`

    // Consume all points
    for (let i = 0; i < 2; i++) {
      const req = mockReq(userId)
      const res = mockRes()
      const next = vi.fn()
      await middleware(req, res as never, next)
      expect(next).toHaveBeenCalled()
    }

    // This request should be rate-limited
    const req = mockReq(userId)
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.body).toEqual({
      error: 'Too many requests',
      retryAfter: expect.any(Number),
    })
    expect(res._headers['Retry-After']).toBeDefined()
    expect(res._headers['X-RateLimit-Remaining']).toBe('0')
    expect(next).not.toHaveBeenCalled()
  })

  it('uses IP address for unauthenticated requests', async () => {
    const middleware = createRateLimiter({ points: 2, duration: 60 })

    const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`

    // Consume all points with IP-based key
    for (let i = 0; i < 2; i++) {
      const req = mockReq(undefined, uniqueIp)
      const res = mockRes()
      const next = vi.fn()
      await middleware(req, res as never, next)
      expect(next).toHaveBeenCalled()
    }

    // This request should be rate-limited
    const req = mockReq(undefined, uniqueIp)
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(next).not.toHaveBeenCalled()
  })

  it('rate limits independently per user', async () => {
    const middleware = createRateLimiter({ points: 1, duration: 60 })

    const user1 = `independent-user-1-${Date.now()}`
    const user2 = `independent-user-2-${Date.now()}`

    // User 1 uses their one point
    const req1 = mockReq(user1)
    const res1 = mockRes()
    const next1 = vi.fn()
    await middleware(req1, res1 as never, next1)
    expect(next1).toHaveBeenCalled()

    // User 2 should still have their own budget
    const req2 = mockReq(user2)
    const res2 = mockRes()
    const next2 = vi.fn()
    await middleware(req2, res2 as never, next2)
    expect(next2).toHaveBeenCalled()

    // User 1 should now be limited
    const req1b = mockReq(user1)
    const res1b = mockRes()
    const next1b = vi.fn()
    await middleware(req1b, res1b as never, next1b)
    expect(res1b.status).toHaveBeenCalledWith(429)
  })

  it('uses default config when none provided', async () => {
    // Should not throw
    const middleware = createRateLimiter()
    const req = mockReq(`default-config-user-${Date.now()}`)
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
  })
})
