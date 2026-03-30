---
story_id: E35-S01
story_name: "Entitlement Middleware Foundation"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 35.1: Entitlement Middleware Foundation

## Story

As a platform operator,
I want all entitlement enforcement middleware modules built and unit-tested,
so that the security infrastructure is validated before activating it on live routes.

## Acceptance Criteria

**AC1: Module creation**

**Given** the `server/middleware/` directory does not yet exist
**When** this story is complete
**Then** the following modules exist with passing unit tests:
- `authenticate.ts` — JWT validation with `jose`
- `origin-check.ts` — Origin/Referer allowlist
- `entitlement.ts` — LRU cache + Supabase fallback (BYOK detection deferred to S03)
- `rate-limiter.ts` — Per-user token bucket with `rate-limiter-flexible`
- `types.ts` — Shared types (`AuthenticatedRequest`, `EntitlementCacheEntry`)

**AC2: JWT validation — happy path**

**Given** a valid Supabase JWT (HS256, `aud: "authenticated"`, unexpired)
**When** `authenticateJWT` middleware processes the request
**Then** it extracts `sub` as `userId`, attaches `{ userId, email, role }` to `req.auth`
**And** calls `next()`

**AC3: JWT validation — rejection**

**Given** an expired, malformed, or missing JWT
**When** `authenticateJWT` middleware processes the request
**Then** it responds with 401 and the appropriate error code:
- Missing header → `AUTH_REQUIRED`
- Malformed/invalid signature → `AUTH_INVALID`
- Expired token → `TOKEN_EXPIRED`
**And** does NOT call `next()`

**AC4: Origin check — rejection**

**Given** `ALLOWED_ORIGINS=http://localhost:5173,https://knowlune.app`
**When** a request arrives with `Origin: https://evil.com`
**Then** the origin check middleware responds with 403 `ORIGIN_BLOCKED`

**AC5: Health check bypass**

**Given** the health check endpoint `/api/ai/ollama/health`
**When** any request arrives (regardless of origin or auth)
**Then** it bypasses all authentication and origin checks

**AC6: Entitlement check — cache miss**

**Given** the entitlement cache is empty for a user
**When** `checkEntitlement` middleware runs for that user
**Then** it queries Supabase: `entitlements.select('tier, expires_at').eq('user_id', userId).single()`
**And** stores the result in `lru-cache` with 5-minute TTL
**And** rejects `tier === 'free'` with 403 `ENTITLEMENT_EXPIRED`

**AC7: Supabase unreachable — cached user (fail-open)**

**Given** Supabase is unreachable during entitlement check
**When** the user has a cached entry
**Then** the cached entry is honored (fail-open)

**AC8: Supabase unreachable — unknown user (fail-closed)**

**Given** Supabase is unreachable during entitlement check
**When** the user has NO cached entry
**Then** the middleware responds with 503 `SERVICE_UNAVAILABLE` (fail-closed)

**AC9: Rate limiter — burst protection**

**Given** a rate limiter configured for premium tier (20 burst, 10/min refill)
**When** a user sends 21 requests in rapid succession
**Then** the 21st request receives 429 with `Retry-After` header

**AC10: No route wiring**

**Given** all middleware modules are built
**When** the application starts
**Then** no routes use the new middleware — app behavior is unchanged from before this story

## Tasks / Subtasks

- [ ] Task 1: Create `server/middleware/types.ts` (AC: 1)
  - [ ] 1.1 Define `AuthenticatedRequest` extending Express `Request` with `auth: { userId, email, role }` and `isBYOK: boolean`
  - [ ] 1.2 Define `EntitlementCacheEntry` with `tier: 'free' | 'trial' | 'premium'` and `expiresAt?: string`
  - [ ] 1.3 Define error code constants: `AUTH_REQUIRED`, `AUTH_INVALID`, `TOKEN_EXPIRED`, `ORIGIN_BLOCKED`, `ENTITLEMENT_EXPIRED`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`

- [ ] Task 2: Create `server/middleware/authenticate.ts` (AC: 2, 3, 5)
  - [ ] 2.1 Install `jose` v6.x (`npm i jose`)
  - [ ] 2.2 Implement `authenticateJWT` middleware function
  - [ ] 2.3 Extract `Authorization: Bearer <token>` header; respond 401 `AUTH_REQUIRED` if missing
  - [ ] 2.4 Call `jose.jwtVerify(token, secret, { audience: 'authenticated' })` with `SUPABASE_JWT_SECRET`
  - [ ] 2.5 Handle `jose` errors: `JWTExpired` → 401 `TOKEN_EXPIRED`; all others → 401 `AUTH_INVALID`
  - [ ] 2.6 Extract `sub` (userId), `email`, `role` from payload; attach to `req.auth`
  - [ ] 2.7 Add JWKS-ready design: check for `SUPABASE_JWKS_URL` env var; if present, use `jose.createRemoteJWKSet()` instead of shared secret
  - [ ] 2.8 Implement health check bypass: skip auth if `req.path === '/api/ai/ollama/health'`

- [ ] Task 3: Create `server/middleware/origin-check.ts` (AC: 4, 5)
  - [ ] 3.1 Parse `ALLOWED_ORIGINS` env var as comma-separated list
  - [ ] 3.2 Check `Origin` header (fallback to `Referer` header for non-browser clients)
  - [ ] 3.3 Reject with 403 `ORIGIN_BLOCKED` if origin not in allowlist
  - [ ] 3.4 Allow requests with no `Origin` header (server-to-server, curl, etc.) — configurable via `REQUIRE_ORIGIN` flag
  - [ ] 3.5 Implement health check bypass: skip origin check for `/api/ai/ollama/health`

- [ ] Task 4: Create `server/middleware/entitlement.ts` (AC: 6, 7, 8)
  - [ ] 4.1 Install `lru-cache` v11+ (`npm i lru-cache`)
  - [ ] 4.2 Create `entitlementCache` with `max: 1000`, `ttl: 5 * 60 * 1000`
  - [ ] 4.3 Implement `checkEntitlement` middleware
  - [ ] 4.4 Cache hit path: use cached tier; reject `free` with 403 `ENTITLEMENT_EXPIRED`
  - [ ] 4.5 Cache miss path: query Supabase via `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
  - [ ] 4.6 Supabase error handling: fail-open for cached users, fail-closed (503) for unknown users
  - [ ] 4.7 Structure 403 response: `{ error: "ENTITLEMENT_EXPIRED", message: "Your premium subscription has expired.", upgradeUrl: "/settings" }`
  - [ ] 4.8 Leave BYOK detection as a stub (placeholder for S03): `// BYOK detection added in E35-S03`

- [ ] Task 5: Create `server/middleware/rate-limiter.ts` (AC: 9)
  - [ ] 5.1 Install `rate-limiter-flexible` (`npm i rate-limiter-flexible`)
  - [ ] 5.2 Configure tier-based rate limiters:
    - Free: 5 burst, 2/min refill
    - Trial: 20 burst, 10/min refill
    - Premium: 20 burst, 10/min refill
    - BYOK: 30 burst, 15/min refill (used in S03)
  - [ ] 5.3 Key by `req.auth.userId`
  - [ ] 5.4 Streaming requests consume 2 points; non-streaming 1 point (detect via request path or content-type)
  - [ ] 5.5 Reject with 429 and `Retry-After` header (seconds until next available token)

- [ ] Task 6: Update `package.json` and `.env.example` (AC: 1)
  - [ ] 6.1 Add dependencies: `jose`, `lru-cache`, `rate-limiter-flexible`
  - [ ] 6.2 Add to `.env.example`: `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`

- [ ] Task 7: Unit tests (AC: 2-9)
  - [ ] 7.1 Create `server/middleware/__tests__/authenticate.test.ts`
    - Valid JWT → attaches auth, calls next
    - Missing header → 401 AUTH_REQUIRED
    - Malformed token → 401 AUTH_INVALID
    - Expired token → 401 TOKEN_EXPIRED
    - Wrong audience → 401 AUTH_INVALID
    - Health check path → bypasses auth
  - [ ] 7.2 Create `server/middleware/__tests__/origin-check.test.ts`
    - Allowed origin → calls next
    - Blocked origin → 403 ORIGIN_BLOCKED
    - No origin header → configurable behavior
    - Health check → bypasses origin check
  - [ ] 7.3 Create `server/middleware/__tests__/entitlement.test.ts`
    - Cache hit (premium) → calls next
    - Cache hit (free) → 403 ENTITLEMENT_EXPIRED
    - Cache miss → queries Supabase, caches result
    - Supabase error + cached user → fail-open
    - Supabase error + no cache → 503 SERVICE_UNAVAILABLE
  - [ ] 7.4 Create `server/middleware/__tests__/rate-limiter.test.ts`
    - Under limit → calls next
    - Over limit → 429 with Retry-After
    - Streaming requests consume 2 points

- [ ] Task 8: Verify no route wiring (AC: 10)
  - [ ] 8.1 Confirm `server/index.ts` has NO imports from `server/middleware/`
  - [ ] 8.2 Run existing E2E tests to confirm zero behavioral change

## Implementation Notes

### Architecture
- All middleware follows Express `(req, res, next)` signature
- Middleware chain order (not wired until S02): Origin check → JWT auth → Entitlement → Rate limiter
- Each middleware is independently testable with mock `req`/`res`/`next`

### JWT Configuration
- `jose` v6.x is ESM-native, zero-dep, maintained by Auth0
- HS256 symmetric verification with `SUPABASE_JWT_SECRET` (self-hosted Supabase default)
- JWKS-ready: if `SUPABASE_JWKS_URL` is set, uses `jose.createRemoteJWKSet()` for asymmetric key verification
- JWT payload shape (Supabase): `{ sub: userId, email, role, aud: "authenticated", exp, iat }`

### Cache Design
- `lru-cache` v11+ with TypeScript generics: `LRUCache<string, EntitlementCacheEntry>`
- Max 1000 entries (~50KB memory), 5-minute TTL
- Stale-while-revalidate not needed for v1 (synchronous check is fast enough)

### Rate Limiter Design
- `rate-limiter-flexible` with `RateLimiterMemory` backend (upgradeable to Redis)
- Token bucket algorithm: burst capacity + refill rate
- Per-user keying via `req.auth.userId` (requires JWT auth to run first)

### Security Considerations
- Middleware must NOT leak internal error details in responses
- JWT secret must never appear in logs or error messages
- Rate limiter must not be bypassable by rotating IPs (keyed by userId, not IP)
- Entitlement check uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (server-only, never exposed to client)

### Key Files
- Create: `server/middleware/authenticate.ts`, `origin-check.ts`, `entitlement.ts`, `rate-limiter.ts`, `types.ts`
- Create: `server/middleware/__tests__/authenticate.test.ts`, `origin-check.test.ts`, `entitlement.test.ts`, `rate-limiter.test.ts`
- Modify: `package.json` (add jose, lru-cache, rate-limiter-flexible)
- Modify: `.env.example` (add new env vars)

## Testing Notes

### Security Boundary Verification
- **JWT validation:** Test with tokens signed by wrong secret → must reject
- **JWT timing:** Test with tokens expired 1 second ago → must reject (no clock skew tolerance by default)
- **Origin check:** Test with `Origin: null` (privacy-redirected) → must reject by default
- **Entitlement fail-closed:** Mock Supabase timeout → unknown users get 503, not 200
- **Rate limiter isolation:** Verify user A's rate limit does not affect user B

### Unit Test Strategy
- Use `jose` to sign test JWTs with known secrets (fast, no Supabase dependency)
- Mock Supabase client for entitlement tests (inject via constructor or dependency injection)
- Use `rate-limiter-flexible`'s built-in memory backend for deterministic rate limit tests
- Mock Express `req`/`res`/`next` objects (no HTTP server needed)

### Performance Validation
- JWT verification should complete in < 2ms (benchmark in unit test)
- LRU cache hit should add < 1ms overhead

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document during implementation]
