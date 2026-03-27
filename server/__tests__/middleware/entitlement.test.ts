import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEntitlementMiddleware, createDetectBYOKMiddleware } from '../../middleware/entitlement.js'
import type { AuthenticatedRequest } from '../../middleware/types.js'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(
  userId?: string,
  body?: Record<string, unknown>
): AuthenticatedRequest {
  return {
    user: userId ? { sub: userId } : undefined,
    entitlement: undefined,
    isBYOK: undefined,
    body: body ?? {},
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
// Entitlement Middleware Tests
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

  // -----------------------------------------------------------------------
  // BYOK pass-through tests (E35-S03)
  // -----------------------------------------------------------------------

  it('skips entitlement check when req.isBYOK is true', async () => {
    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('byok-user')
    req.isBYOK = true
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    // Should proceed without calling Supabase
    expect(next).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    // Entitlement is not set for BYOK requests (not needed)
    expect(req.entitlement).toBeUndefined()
  })

  it('BYOK skip works for free-tier users (no entitlement rejection)', async () => {
    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('free-byok-user')
    req.isBYOK = true
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('BYOK skip works for premium users (entitlement not checked)', async () => {
    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('premium-byok-user')
    req.isBYOK = true
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('non-BYOK request still goes through entitlement check', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ tier: 'premium' }],
    })

    const middleware = createEntitlementMiddleware(TEST_CONFIG)
    const req = mockReq('normal-user')
    req.isBYOK = false
    const res = mockRes()
    const next = vi.fn()

    await middleware(req, res as never, next)

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(req.entitlement).toBe('premium')
    expect(next).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// BYOK Detection Middleware Tests (E35-S03)
// ---------------------------------------------------------------------------

describe('createDetectBYOKMiddleware', () => {
  it('sets isBYOK=true when body.apiKey is present (cloud BYOK)', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-1', { apiKey: 'sk-test-123', provider: 'openai', messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(true)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=true when body.ollamaServerUrl is present (self-hosted BYOK)', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-2', { ollamaServerUrl: 'http://192.168.2.200:11434', messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(true)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=true when BOTH apiKey and ollamaServerUrl are present', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-3', {
      apiKey: 'sk-test',
      ollamaServerUrl: 'http://192.168.2.200:11434',
      messages: [],
    })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(true)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=false when neither apiKey nor ollamaServerUrl present', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-4', { messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(false)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=false when apiKey is empty string', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-5', { apiKey: '', messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(false)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=false when ollamaServerUrl is empty string', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-6', { ollamaServerUrl: '', messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(false)
    expect(next).toHaveBeenCalled()
  })

  it('sets isBYOK=false when apiKey is not a string', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-7', { apiKey: 123, messages: [] })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(false)
    expect(next).toHaveBeenCalled()
  })

  it('handles request with no body gracefully', () => {
    const middleware = createDetectBYOKMiddleware()
    const req = mockReq('user-8')
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(req.isBYOK).toBe(false)
    expect(next).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// BYOK + Entitlement integration scenario tests (E35-S03)
// ---------------------------------------------------------------------------

describe('BYOK + Entitlement integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('free-tier user with BYOK key bypasses entitlement (full chain simulation)', async () => {
    // Simulate: detectBYOK sets isBYOK=true, then entitlement middleware skips check
    const detectMiddleware = createDetectBYOKMiddleware()
    const entitlementMiddleware = createEntitlementMiddleware(TEST_CONFIG)

    const req = mockReq('free-user-byok', { apiKey: 'sk-test-key', provider: 'openai', messages: [] })
    const res = mockRes()

    // Step 1: Detect BYOK
    const detectNext = vi.fn()
    detectMiddleware(req, res as never, detectNext)
    expect(req.isBYOK).toBe(true)

    // Step 2: Entitlement middleware should skip
    const entitlementNext = vi.fn()
    await entitlementMiddleware(req, res as never, entitlementNext)

    expect(entitlementNext).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled() // No Supabase call
    expect(res.status).not.toHaveBeenCalled() // No 403 rejection
  })

  it('premium user with BYOK key treated as BYOK (not hosted-AI)', async () => {
    // Even premium users with apiKey should be treated as BYOK
    const detectMiddleware = createDetectBYOKMiddleware()
    const entitlementMiddleware = createEntitlementMiddleware(TEST_CONFIG)

    const req = mockReq('premium-user-byok', { apiKey: 'sk-premium-key', provider: 'anthropic', messages: [] })
    const res = mockRes()

    const detectNext = vi.fn()
    detectMiddleware(req, res as never, detectNext)
    expect(req.isBYOK).toBe(true)

    const entitlementNext = vi.fn()
    await entitlementMiddleware(req, res as never, entitlementNext)

    expect(entitlementNext).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('non-BYOK request from free user gets entitlement checked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const detectMiddleware = createDetectBYOKMiddleware()
    const entitlementMiddleware = createEntitlementMiddleware(TEST_CONFIG)

    const req = mockReq('free-user-no-byok', { messages: [] })
    const res = mockRes()

    const detectNext = vi.fn()
    detectMiddleware(req, res as never, detectNext)
    expect(req.isBYOK).toBe(false)

    const entitlementNext = vi.fn()
    await entitlementMiddleware(req, res as never, entitlementNext)

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(req.entitlement).toBe('free')
  })

  it('Ollama BYOK with ollamaServerUrl skips entitlement', async () => {
    const detectMiddleware = createDetectBYOKMiddleware()
    const entitlementMiddleware = createEntitlementMiddleware(TEST_CONFIG)

    const req = mockReq('ollama-user', { ollamaServerUrl: 'http://192.168.2.200:11434', messages: [] })
    const res = mockRes()

    const detectNext = vi.fn()
    detectMiddleware(req, res as never, detectNext)
    expect(req.isBYOK).toBe(true)

    const entitlementNext = vi.fn()
    await entitlementMiddleware(req, res as never, entitlementNext)

    expect(entitlementNext).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
