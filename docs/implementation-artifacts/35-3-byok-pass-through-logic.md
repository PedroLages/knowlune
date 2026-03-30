---
story_id: E35-S03
story_name: "BYOK Pass-Through Logic"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 35.3: BYOK Pass-Through Logic

## Story

As a user who provides their own API keys,
I want to use AI features through the proxy without needing a premium subscription,
so that I can use my own OpenAI/Anthropic/Ollama resources while still being a registered Knowlune user.

## Acceptance Criteria

**AC1: BYOK detection — cloud provider API key**

**Given** a signed-in user (any tier: free, trial, or premium)
**When** they send an AI request with `apiKey` in the request body (cloud providers)
**Then** the middleware detects `req.isBYOK = true`
**And** the entitlement check is skipped entirely
**And** the request proceeds to the route handler

**AC2: BYOK detection — Ollama server URL**

**Given** a signed-in user (any tier)
**When** they send an AI request with `ollamaServerUrl` in the request body
**Then** the middleware detects `req.isBYOK = true`
**And** the entitlement check is skipped
**And** the existing SSRF protection (`isAllowedOllamaUrl`) still applies

**AC3: BYOK still requires JWT**

**Given** a BYOK request without a valid JWT
**When** the middleware chain processes it
**Then** it is rejected with 401 `AUTH_REQUIRED`
**And** the BYOK key is never forwarded to the provider (no open relay)

**AC4: BYOK rate limiting**

**Given** a BYOK user (any tier)
**When** they send requests
**Then** they are rate-limited at the BYOK tier (30 burst, 15/min refill, 1 point per request)
**And** this is independent of their subscription tier's rate limit

**AC5: Free-tier BYOK — entitlement isolation**

**Given** a free-tier user with BYOK keys configured
**When** they use AI features
**Then** BYOK requests succeed (entitlement skipped)
**And** non-BYOK requests (if any future Knowlune-hosted feature is invoked) are rejected with 403

**AC6: BYOK + premium user — BYOK takes precedence**

**Given** the BYOK detection logic
**When** a request has BOTH `apiKey` in body AND is from a premium user
**Then** it is treated as BYOK (entitlement check skipped, BYOK rate limit applied)
**And** the entitlement middleware layers remain independent (BYOK and hosted-AI paths never coupled)

**AC7: BYOK rejection independence (critical security invariant)**

**Given** any BYOK request
**When** the middleware evaluates it
**Then** the BYOK pass/fail decision NEVER depends on the user's hosted-AI entitlement state
**And** the BYOK code path has no imports from or references to the entitlement cache lookup

## Tasks / Subtasks

- [ ] Task 1: Implement BYOK detection in `server/middleware/entitlement.ts` (AC: 1, 2, 6)
  - [ ] 1.1 Add `detectBYOK()` function that inspects `req.body` for `apiKey` or `ollamaServerUrl`
  - [ ] 1.2 Set `req.isBYOK = true` when BYOK is detected
  - [ ] 1.3 In `checkEntitlement`, skip entitlement lookup when `req.isBYOK === true`
  - [ ] 1.4 Ensure BYOK detection runs BEFORE entitlement lookup (within the same middleware or as separate step)
  - [ ] 1.5 When request has both `apiKey` and premium entitlement, treat as BYOK (BYOK takes precedence)

- [ ] Task 2: Add BYOK rate limit tier to `server/middleware/rate-limiter.ts` (AC: 4)
  - [ ] 2.1 Add BYOK tier configuration: 30 burst, 15/min refill
  - [ ] 2.2 Create separate `RateLimiterMemory` instance for BYOK (independent from subscription tiers)
  - [ ] 2.3 In rate limiter middleware, check `req.isBYOK` to select the correct limiter
  - [ ] 2.4 BYOK requests always consume 1 point (no streaming multiplier — user pays their own provider costs)

- [ ] Task 3: Verify JWT requirement for BYOK (AC: 3)
  - [ ] 3.1 Confirm `authenticateJWT` runs before BYOK detection in the middleware chain
  - [ ] 3.2 Add explicit test: BYOK request without JWT → 401 (key never forwarded)
  - [ ] 3.3 Verify no code path exists where BYOK detection could bypass JWT validation

- [ ] Task 4: Verify SSRF protection for Ollama BYOK (AC: 2)
  - [ ] 4.1 Confirm `isAllowedOllamaUrl` check still runs for BYOK Ollama requests
  - [ ] 4.2 Add test: BYOK with `ollamaServerUrl: "http://169.254.169.254/metadata"` → rejected by SSRF protection

- [ ] Task 5: Verify entitlement isolation (AC: 5, 7)
  - [ ] 5.1 Code review: ensure BYOK detection code path has ZERO references to `entitlementCache.get()`
  - [ ] 5.2 Add test: free-tier user with `apiKey` → succeeds (entitlement never checked)
  - [ ] 5.3 Add test: free-tier user without `apiKey` → rejected with 403 ENTITLEMENT_EXPIRED
  - [ ] 5.4 Add test: mock entitlement cache to throw → BYOK request still succeeds (proves independence)

- [ ] Task 6: Unit tests for BYOK scenarios (AC: 1-7)
  - [ ] 6.1 Update `server/middleware/__tests__/entitlement.test.ts` with BYOK test suite:
    - `apiKey` in body → `req.isBYOK = true`, entitlement skipped
    - `ollamaServerUrl` in body → `req.isBYOK = true`, entitlement skipped
    - No BYOK keys → entitlement check runs normally
    - BYOK + premium user → treated as BYOK
    - BYOK + free user → succeeds
    - BYOK without JWT → 401 (never reaches BYOK detection)
  - [ ] 6.2 Update `server/middleware/__tests__/rate-limiter.test.ts` with BYOK tier tests:
    - BYOK user at 30 requests → passes
    - BYOK user at 31 requests → 429
    - BYOK rate limit independent from subscription rate limit
    - BYOK always 1 point per request (no streaming multiplier)

## Implementation Notes

### BYOK Detection Architecture
BYOK detection is a code path within `entitlement.ts`, not a separate middleware file. The middleware chain remains:
```
originCheck → authenticateJWT → checkEntitlement(includes BYOK detection) → rateLimiter → handler
```

The `checkEntitlement` middleware internally:
1. Parses `req.body` to check for `apiKey` or `ollamaServerUrl`
2. If BYOK detected: sets `req.isBYOK = true`, calls `next()` (skips entitlement lookup)
3. If not BYOK: proceeds with LRU cache → Supabase entitlement check

### Critical Security Invariant
**BYOK rejection must NEVER depend on hosted-AI entitlement state.** This is a lesson from Vercel's architecture (documented in architecture.md). The two paths must be completely independent:
- BYOK path: JWT valid → body has apiKey/ollamaServerUrl → skip entitlement → BYOK rate limit → handler
- Hosted path: JWT valid → no BYOK keys → check entitlement → subscription rate limit → handler

If a code change introduces a dependency between these paths (e.g., checking entitlement before BYOK detection), it creates a coupling bug where BYOK users are incorrectly rejected.

### BYOK Detection Keys
```
body.apiKey         → Cloud providers (OpenAI, Anthropic, Groq, Gemini, GLM)
body.ollamaServerUrl → Self-hosted Ollama server
```

### Rate Limit Tier Summary
| Tier | Burst | Refill | Points per request |
|------|-------|--------|--------------------|
| Free | 5 | 2/min | 1 (non-stream), 2 (stream) |
| Trial | 20 | 10/min | 1 (non-stream), 2 (stream) |
| Premium | 20 | 10/min | 1 (non-stream), 2 (stream) |
| BYOK | 30 | 15/min | 1 (always — user pays provider) |

### Key Files
- Modify: `server/middleware/entitlement.ts` (add BYOK detection, conditional entitlement skip)
- Modify: `server/middleware/rate-limiter.ts` (add BYOK tier configuration)
- Modify: `server/middleware/__tests__/entitlement.test.ts` (BYOK test scenarios)
- Modify: `server/middleware/__tests__/rate-limiter.test.ts` (BYOK tier tests)

### Dependencies
- E35-S02 (middleware must be wired to routes)

## Testing Notes

### Security Boundary Verification
- **Open relay prevention:** A BYOK request without JWT must be rejected at the JWT layer — the BYOK key must never reach the AI provider. Test this explicitly.
- **SSRF protection:** BYOK Ollama requests must still go through `isAllowedOllamaUrl`. Test with SSRF-targeting URLs (cloud metadata endpoints, localhost, internal IPs).
- **Entitlement isolation:** The most critical test is proving that BYOK detection is independent of entitlement state. Mock the entitlement cache to throw an exception — the BYOK request must still succeed.
- **Rate limit isolation:** BYOK and subscription rate limits must use separate rate limiter instances. Exhaust one → the other should still work.

### Edge Cases
- Request body is empty → not BYOK, proceed to entitlement check
- Request body has `apiKey: ""` (empty string) → not BYOK (empty key is not valid BYOK)
- Request body has `apiKey: null` → not BYOK
- Request body is unparseable JSON → Express body parser handles this before middleware
- Concurrent BYOK and non-BYOK requests from same user → each uses correct rate limiter

### Test Isolation
- BYOK tests should not depend on Supabase mock state (proves independence)
- Rate limit tests should reset rate limiter state between test cases

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
