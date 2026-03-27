import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthMiddleware } from '../../middleware/authenticate.js'
import type { AuthenticatedRequest } from '../../middleware/types.js'
import { SignJWT } from 'jose'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-jwt-secret-at-least-32-chars-long!!'
const SECRET_KEY = new TextEncoder().encode(TEST_SECRET)

async function createTestJwt(
  payload: Record<string, unknown>,
  options?: { expiresIn?: string; secret?: Uint8Array }
) {
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()

  if (options?.expiresIn) {
    builder.setExpirationTime(options.expiresIn)
  } else {
    builder.setExpirationTime('1h')
  }

  return builder.sign(options?.secret ?? SECRET_KEY)
}

function mockReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
    user: undefined as unknown as AuthenticatedRequest['user'],
  } as AuthenticatedRequest
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

describe('createAuthMiddleware', () => {
  it('throws if neither jwtSecret nor jwksUrl is provided', () => {
    expect(() => createAuthMiddleware({})).toThrow(
      'requires either SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL'
    )
  })

  describe('with HS256 secret', () => {
    const middleware = createAuthMiddleware({ jwtSecret: TEST_SECRET })

    it('rejects requests without Authorization header', async () => {
      const req = mockReq()
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'Missing or malformed Authorization header' })
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects requests with non-Bearer auth', async () => {
      const req = mockReq('Basic dXNlcjpwYXNz')
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects empty bearer token', async () => {
      const req = mockReq('Bearer ')
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'Empty bearer token' })
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects invalid tokens', async () => {
      const req = mockReq('Bearer not.a.valid.jwt')
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'Invalid token' })
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects tokens signed with wrong secret', async () => {
      const wrongKey = new TextEncoder().encode('wrong-secret-that-is-long-enough!!')
      const token = await createTestJwt({ sub: 'user-123' }, { secret: wrongKey })
      const req = mockReq(`Bearer ${token}`)
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'Invalid token' })
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects expired tokens', async () => {
      const token = await createTestJwt({ sub: 'user-123' }, { expiresIn: '0s' })
      // Wait a moment to ensure token is expired
      await new Promise((r) => setTimeout(r, 1100))
      const req = mockReq(`Bearer ${token}`)
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'Token expired' })
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects tokens missing "sub" claim', async () => {
      const token = await createTestJwt({ email: 'user@example.com' })
      const req = mockReq(`Bearer ${token}`)
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.body).toEqual({ error: 'JWT missing required "sub" claim' })
      expect(next).not.toHaveBeenCalled()
    })

    it('accepts valid tokens and attaches user to request', async () => {
      const token = await createTestJwt({
        sub: 'user-abc-123',
        email: 'test@example.com',
        role: 'authenticated',
      })
      const req = mockReq(`Bearer ${token}`)
      const res = mockRes()
      const next = vi.fn()

      await middleware(req, res as never, next)

      expect(next).toHaveBeenCalled()
      expect(req.user).toBeDefined()
      expect(req.user.sub).toBe('user-abc-123')
      expect(req.user.email).toBe('test@example.com')
      expect(req.user.role).toBe('authenticated')
    })
  })
})
