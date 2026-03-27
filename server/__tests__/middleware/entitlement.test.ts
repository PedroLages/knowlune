import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEntitlementMiddleware } from '../../middleware/entitlement.js'
import type { AuthenticatedRequest } from '../../middleware/types.js'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(userId?: string): AuthenticatedRequest {
  return {
    user: userId ? { sub: userId } : undefined,
    entitlement: undefined,
  } as unknown as AuthenticatedRequest
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((data: unknown) => {
      res.body = data
      return res
    }),
  }
  return res
}

const TEST_CONFIG = {
  supabaseUrl: 'http://localhost:8000',
  supabaseServiceRoleKey: 'test-service-role-key',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createEntitlementMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws if supabaseUrl is missing', () => {
    expect(() =>
      createEntitlementMiddleware({ supabaseUrl: '', supabaseServiceRoleKey: 'key' })
    ).toThrow('requires supabaseUrl and supabaseServiceRoleKey')
  })

  it('throws if supabaseServiceRoleKey is missing', () => {
    expect(() =>
      createEntitlementMiddleware({ supabaseUrl: 'http://localhost', supabaseServiceRoleKey: '' })
    ).toThrow('requires supabaseUrl and supabaseServiceRoleKey')
  })

  it('returns 401 if req.user is not set', async () => {
    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = { user: undefined, entitlement: undefined } as unknown as AuthenticatedRequest
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.body).toEqual({ error: 'Authentication required for entitlement check' })
    expect(next).not.toHaveBeenCalled()
  })

  it('fetches entitlement from Supabase on cache miss', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ tier: 'premium' }],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('user-123')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
    expect(req.entitlement).toBe('premium')
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0][0]).toContain('/rest/v1/subscriptions')
    expect(mockFetch.mock.calls[0][0]).toContain('user_id=eq.user-123')
  })

  it('serves from cache on second request for same user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ tier: 'premium' }],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)

    // First request — cache miss
    const req1 = mockReq('user-456')
    const res1 = mockRes()
    const next1 = vi.fn()
    await middleware(req1, res1 as never, next1)
    expect(mockFetch).toHaveBeenCalledOnce()

    // Second request — cache hit
    const req2 = mockReq('user-456')
    const res2 = mockRes()
    const next2 = vi.fn()
    await middleware(req2, res2 as never, next2)

    expect(mockFetch).toHaveBeenCalledOnce() // Still only 1 call
    expect(req2.entitlement).toBe('premium')
    expect(next2).toHaveBeenCalled()
  })

  it('defaults to "free" when no subscription found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('free-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(req.entitlement).toBe('free')
    expect(next).toHaveBeenCalled()
  })

  it('defaults to "free" when Supabase returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('error-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(req.entitlement).toBe('free')
    expect(next).toHaveBeenCalled()
  })

  it('defaults to "free" when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('network-error-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(req.entitlement).toBe('free')
    expect(next).toHaveBeenCalled()
  })

  it('handles "trial" tier correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ tier: 'trial' }],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('trial-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(req.entitlement).toBe('trial')
    expect(next).toHaveBeenCalled()
  })

  it('defaults unknown tier values to "free"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ tier: 'enterprise' }],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('unknown-tier-user')
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(req.entitlement).toBe('free')
    expect(next).toHaveBeenCalled()
  })
})
