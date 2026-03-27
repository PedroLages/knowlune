import { describe, it, expect, vi } from 'vitest'
import { createOriginCheck } from '../../middleware/origin-check.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(headers: Record<string, string> = {}) {
  return { headers } as never
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createOriginCheck', () => {
  it('throws if no allowed origins are provided', () => {
    expect(() => createOriginCheck({ allowedOrigins: [] })).toThrow(
      'requires at least one allowed origin'
    )
  })

  const middleware = createOriginCheck({
    allowedOrigins: ['http://localhost:5173', 'https://knowlune.app'],
  })

  it('allows requests with matching Origin header', () => {
    const req = mockReq({ origin: 'http://localhost:5173' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('allows requests with matching Origin (case-insensitive)', () => {
    const req = mockReq({ origin: 'HTTPS://KNOWLUNE.APP' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
  })

  it('allows requests with matching Origin (trailing slash stripped)', () => {
    const req = mockReq({ origin: 'http://localhost:5173/' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
  })

  it('allows requests with no Origin and no Referer (server-to-server)', () => {
    const req = mockReq({})
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
  })

  it('allows requests with matching Referer when Origin is absent', () => {
    const req = mockReq({ referer: 'http://localhost:5173/some/path' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalled()
  })

  it('rejects requests with unrecognized Origin', () => {
    const req = mockReq({ origin: 'https://evil.com' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body).toEqual({ error: 'Forbidden: origin not allowed' })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with unrecognized Origin and unrecognized Referer', () => {
    const req = mockReq({
      origin: 'https://evil.com',
      referer: 'https://evil.com/some/path',
    })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with invalid Referer URL (no Origin)', () => {
    const req = mockReq({ referer: 'not-a-url' })
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res as never, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
