---
story_id: E35-S02
story_name: "Express Proxy Entitlement Guard"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 35.2: Express Proxy Entitlement Guard

## Story

As a platform operator,
I want the middleware chain wired into Express and the client sending auth headers,
so that all AI proxy requests are authenticated and authorized in production.

## Acceptance Criteria

**AC1: Middleware chain wired to Express**

**Given** the middleware modules from S01 are built and tested
**When** this story is complete
**Then** `server/index.ts` applies the middleware chain to all `/api/ai/*` routes in order:
1. Origin check
2. JWT authentication
3. Entitlement check (premium required for Knowlune-hosted AI)
4. Rate limiter (per-user, tier-based)

**AC2: Client sends auth headers**

**Given** the Express middleware chain is active
**When** `ProxyLLMClient` or `OllamaLLMClient` (in proxy mode) sends an AI request
**Then** the request includes `Authorization: Bearer <JWT>` from `useAuthStore.getState().session?.access_token`

**AC3: Premium user — transparent operation**

**Given** a signed-in premium user
**When** they use any AI feature (summary, Q&A, learning path, etc.)
**Then** the request passes all middleware checks and reaches the existing route handler
**And** the AI feature works identically to before this change

**AC4: Free-tier user — entitlement rejection**

**Given** a signed-in free-tier user
**When** they attempt to use a Knowlune-hosted AI feature
**Then** the server responds with 403 `ENTITLEMENT_EXPIRED`
**And** the client maps 403 to `LLMError` with code `ENTITLEMENT_ERROR`
**And** the UI shows the existing `PremiumGate` re-subscribe CTA

**AC5: Expired JWT — auto-refresh**

**Given** a user whose JWT has expired
**When** they attempt an AI request
**Then** the server responds with 401 `TOKEN_EXPIRED`
**And** the Supabase client auto-refreshes the token via `onAuthStateChange`
**And** the client retries with the new token (transparent to user)

**AC6: Unauthenticated user — pre-flight rejection**

**Given** a user who is not signed in
**When** the `getLLMClient()` factory detects no session
**Then** it throws `LLMError` with code `AUTH_REQUIRED` before making any network request

**AC7: Health check bypass**

**Given** a request to `/api/ai/ollama/health`
**When** any client (authenticated or not) sends the request
**Then** it bypasses the entire middleware chain and returns the health status

**AC8: New error codes in LLMErrorCode**

**Given** the `LLMErrorCode` enum in `src/ai/llm/types.ts`
**When** this story is complete
**Then** it includes `ENTITLEMENT_ERROR` and `RATE_LIMITED` as new codes

## Tasks / Subtasks

- [ ] Task 1: Wire middleware chain in `server/index.ts` (AC: 1, 7)
  - [ ] 1.1 Import all middleware from `server/middleware/`
  - [ ] 1.2 Apply middleware chain to `/api/ai/*` routes BEFORE existing route handlers
  - [ ] 1.3 Exclude `/api/ai/ollama/health` from the middleware chain (health check bypass)
  - [ ] 1.4 Verify middleware order: origin-check → authenticate → entitlement → rate-limiter
  - [ ] 1.5 Add error handling middleware at the end for unhandled middleware errors

- [ ] Task 2: Add error codes to `src/ai/llm/types.ts` (AC: 8)
  - [ ] 2.1 Add `ENTITLEMENT_ERROR` to `LLMErrorCode` enum
  - [ ] 2.2 Add `RATE_LIMITED` to `LLMErrorCode` enum

- [ ] Task 3: Add HTTP status code mapping to `src/ai/llm/client.ts` (AC: 4, 5)
  - [ ] 3.1 Map 401 responses → `LLMError` with code `AUTH_REQUIRED`
  - [ ] 3.2 Map 403 responses → `LLMError` with code `ENTITLEMENT_ERROR`
  - [ ] 3.3 Map 429 responses → `LLMError` with code `RATE_LIMITED`
  - [ ] 3.4 Include `Retry-After` header value in 429 error metadata
  - [ ] 3.5 Parse structured error body from 403: `{ error, message, upgradeUrl }`

- [ ] Task 4: Add Authorization header to `ProxyLLMClient` (AC: 2)
  - [ ] 4.1 Modify `src/ai/llm/proxy-client.ts` constructor to accept `accessToken` parameter
  - [ ] 4.2 Add `Authorization: Bearer <token>` to all fetch requests
  - [ ] 4.3 Handle missing token: throw `LLMError` with `AUTH_REQUIRED` before fetch

- [ ] Task 5: Add Authorization header to `OllamaLLMClient` in proxy mode (AC: 2)
  - [ ] 5.1 Modify `src/ai/llm/ollama-client.ts` to include auth header when using proxy
  - [ ] 5.2 Direct Ollama connections (no proxy) should NOT include auth header
  - [ ] 5.3 Distinguish proxy mode from direct mode via URL prefix check

- [ ] Task 6: Update `getLLMClient()` factory (AC: 6)
  - [ ] 6.1 Modify `src/ai/llm/factory.ts` to retrieve session token from `useAuthStore`
  - [ ] 6.2 Pass `accessToken` to `ProxyLLMClient` and `OllamaLLMClient` constructors
  - [ ] 6.3 If no session exists, throw `LLMError` with `AUTH_REQUIRED` immediately

- [ ] Task 7: Implement token auto-refresh retry (AC: 5)
  - [ ] 7.1 In `BaseLLMClient`, detect 401 `TOKEN_EXPIRED` response
  - [ ] 7.2 Call `supabase.auth.getSession()` to get refreshed token
  - [ ] 7.3 Retry the original request with the new token (max 1 retry)
  - [ ] 7.4 If retry also fails with 401, surface `AUTH_REQUIRED` error to UI

- [ ] Task 8: Integration testing (AC: 3, 4, 5, 6, 7)
  - [ ] 8.1 Test premium user full flow: sign-in → AI request → success
  - [ ] 8.2 Test free-tier user: AI request → 403 → PremiumGate CTA
  - [ ] 8.3 Test expired JWT: 401 → auto-refresh → retry → success
  - [ ] 8.4 Test unauthenticated: getLLMClient() → throws AUTH_REQUIRED
  - [ ] 8.5 Test health check: no auth needed → returns status
  - [ ] 8.6 Run full E2E suite to verify no regressions

## Implementation Notes

### The "Big Flip"
This story is the critical coordination point — server enforcement and client auth headers must ship together. If only the server side is deployed, all AI requests fail with 401. If only the client side is deployed, the Authorization header is ignored.

**Deployment strategy:** Both changes land in the same commit/PR. No phased rollout needed (pre-launch, zero external consumers).

### Middleware Chain Architecture
```
app.use('/api/ai/*', originCheck, authenticateJWT, checkEntitlement, rateLimiter)
app.get('/api/ai/ollama/health', healthHandler)  // registered BEFORE middleware chain
```

The health check route must be registered before the middleware-protected wildcard route to avoid middleware execution.

### Error Response Format
All middleware errors follow a consistent JSON structure:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "retryAfter": 30  // only for 429
}
```

### Client-Side Error Handling
- `AUTH_REQUIRED` → Show sign-in prompt (redirect to `/login`)
- `ENTITLEMENT_ERROR` → Show `PremiumGate` component with re-subscribe CTA
- `RATE_LIMITED` → Show "Too many requests" toast with countdown

### Streaming Request Handling
Streaming requests (`/api/ai/stream`, `/api/ai/ollama`) consume 2 rate limit points. The rate limiter detects streaming via the request path.

### Key Files
- Modify: `server/index.ts` (import and apply middleware chain)
- Modify: `src/ai/llm/proxy-client.ts` (add Authorization header)
- Modify: `src/ai/llm/ollama-client.ts` (add Authorization header in proxy mode)
- Modify: `src/ai/llm/factory.ts` (pass session token to client constructors)
- Modify: `src/ai/llm/types.ts` (add error codes)
- Modify: `src/ai/llm/client.ts` (map HTTP status codes to LLMError)

### Dependencies
- E35-S01 (middleware modules must exist and pass tests)

## Testing Notes

### Security Boundary Verification
- **Auth enforcement is mandatory:** Verify that removing the Authorization header from a request results in 401, not a pass-through to the AI provider
- **Middleware ordering matters:** Verify that origin check runs before JWT auth (to reject bad origins without processing tokens)
- **Entitlement is not bypassable from client:** Verify that a free-tier user cannot access AI features by manipulating client-side state — the server rejects regardless of `isPremium()` return value
- **Token refresh does not leak:** Verify that the auto-refresh retry does not send the expired token to the AI provider

### Integration Test Strategy
- Use real `jose`-signed JWTs with test secrets
- Mock Supabase for entitlement lookups
- Test the full Express middleware chain with supertest
- Verify error response bodies match expected structure

### E2E Test Considerations
- Existing AI feature E2E tests should continue passing (for premium users)
- May need test fixtures that seed a premium entitlement for the test user
- Health check tests should work without authentication

### Regression Risk
This is the highest-risk story in Epic 35 — it changes the authentication contract for every AI request. Full E2E suite must pass before merge.

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
