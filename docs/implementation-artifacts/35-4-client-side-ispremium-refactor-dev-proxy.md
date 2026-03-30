---
story_id: E35-S04
story_name: "Client-Side isPremium() Refactor + Dev Proxy"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 35.4: Client-Side isPremium() Refactor + Dev Proxy

## Story

As a developer,
I want `isPremium()` clearly documented as a UX hint and the dev proxy to mirror production enforcement,
so that the security boundary is unambiguous and dev-prod parity is maintained.

## Acceptance Criteria

**AC1: isPremium() JSDoc update**

**Given** the `isPremium()` function in `src/lib/entitlement/isPremium.ts`
**When** a developer reads the source code
**Then** a JSDoc comment clearly states: `/** UX hint for fast rendering. Server-side middleware (server/middleware/entitlement.ts) is the security boundary. */`
**And** no logic changes are made — `PremiumGate`, `useIsPremium()`, `SubscriptionCard` all continue working as-is

**AC2: Subscription lapse — structured error response**

**Given** a premium subscription that lapses (Stripe webhook updates `entitlements` table to `tier: 'free'`)
**When** the server cache TTL expires (max 5 minutes)
**Then** the next AI request returns 403 `ENTITLEMENT_EXPIRED` with structured error:
```json
{ "error": "ENTITLEMENT_EXPIRED", "message": "Your premium subscription has expired.", "upgradeUrl": "/settings" }
```
**And** the client shows a re-subscribe CTA via the existing `PremiumGate` component

**AC3: DEV_SKIP_ENTITLEMENT escape hatch**

**Given** the Vite dev server is running with `DEV_SKIP_ENTITLEMENT=true` in `.env.local`
**When** a developer makes AI requests in development
**Then** all auth and entitlement checks are bypassed
**And** a console warning is logged: `"Entitlement checks disabled (DEV_SKIP_ENTITLEMENT=true)"`

**AC4: Vite proxies to Express when available**

**Given** the Vite dev server is running WITHOUT `DEV_SKIP_ENTITLEMENT=true`
**When** Express proxy is running on :3001
**Then** Vite proxies `/api/ai/*` to Express (Express handles auth — no duplication)

**AC5: Vite applies middleware when Express is not available**

**Given** the Vite dev server is running WITHOUT Express on :3001
**When** the Vite dev middleware handles requests directly
**Then** it applies the same middleware chain from `server/middleware/`
**And** enforces auth in development (dev-prod parity)

**AC6: .env.example documentation**

**Given** the `.env.example` file
**When** this story is complete
**Then** it documents all new env vars with descriptions:
- `SUPABASE_JWT_SECRET` — JWT verification secret (from Supabase dashboard: Settings > API > JWT Secret)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase client (bypasses RLS for entitlement queries)
- `ALLOWED_ORIGINS` — Comma-separated origin allowlist for CORS enforcement
- `DEV_SKIP_ENTITLEMENT` — Set to `true` to bypass auth/entitlement checks in development

## Tasks / Subtasks

- [ ] Task 1: Update `isPremium()` JSDoc (AC: 1)
  - [ ] 1.1 Add JSDoc to `isPremium()` in `src/lib/entitlement/isPremium.ts`:
    ```
    /** UX hint for fast rendering. Server-side middleware (server/middleware/entitlement.ts) is the security boundary. */
    ```
  - [ ] 1.2 Add JSDoc to `useIsPremium()` hook if it exists:
    ```
    /** UX hint hook. Do NOT use for security decisions. See server/middleware/entitlement.ts. */
    ```
  - [ ] 1.3 Verify no logic changes — run existing tests to confirm no behavioral change

- [ ] Task 2: Handle 403 structured error in client (AC: 2)
  - [ ] 2.1 In `src/ai/llm/client.ts`, parse 403 response body for structured error
  - [ ] 2.2 Extract `upgradeUrl` from error response
  - [ ] 2.3 Surface error to UI layer with `upgradeUrl` for navigation
  - [ ] 2.4 Verify `PremiumGate` component handles the `ENTITLEMENT_ERROR` code correctly
  - [ ] 2.5 Add user-facing toast or modal with re-subscribe CTA pointing to `/settings`

- [ ] Task 3: Implement `DEV_SKIP_ENTITLEMENT` in Vite dev proxy (AC: 3)
  - [ ] 3.1 In `vite.config.ts` (or `ollamaDevProxy` function), check for `process.env.DEV_SKIP_ENTITLEMENT === 'true'`
  - [ ] 3.2 Also verify `process.env.NODE_ENV === 'development'` — never honor this flag in production
  - [ ] 3.3 When enabled, bypass all middleware and proxy directly to AI providers
  - [ ] 3.4 Log console warning: `"Entitlement checks disabled (DEV_SKIP_ENTITLEMENT=true)"`
  - [ ] 3.5 Log warning only once (not on every request)

- [ ] Task 4: Configure Vite proxy to Express when available (AC: 4)
  - [ ] 4.1 In `vite.config.ts`, configure `/api/ai/*` proxy to `http://localhost:3001`
  - [ ] 4.2 When Express is available, Vite acts as a pass-through (no middleware duplication)
  - [ ] 4.3 Express handles all auth/entitlement enforcement

- [ ] Task 5: Apply shared middleware in Vite when Express is not available (AC: 5)
  - [ ] 5.1 Import middleware from `server/middleware/` into Vite dev plugin
  - [ ] 5.2 Apply the same chain: origin-check → authenticate → entitlement → rate-limiter
  - [ ] 5.3 Handle import compatibility (server middleware is Express-style; may need adapter for Vite's connect middleware)
  - [ ] 5.4 Fall back to this path only when Express proxy on :3001 is unreachable

- [ ] Task 6: Update `.env.example` (AC: 6)
  - [ ] 6.1 Add `SUPABASE_JWT_SECRET` with description comment
  - [ ] 6.2 Add `SUPABASE_SERVICE_ROLE_KEY` with description comment
  - [ ] 6.3 Add `ALLOWED_ORIGINS` with default value `http://localhost:5173`
  - [ ] 6.4 Add `DEV_SKIP_ENTITLEMENT` with description and default `false`

- [ ] Task 7: Testing (AC: 1-6)
  - [ ] 7.1 Verify `isPremium()` behavior unchanged (existing tests pass)
  - [ ] 7.2 Test 403 structured error parsing in client
  - [ ] 7.3 Test DEV_SKIP_ENTITLEMENT=true → middleware bypassed, warning logged
  - [ ] 7.4 Test DEV_SKIP_ENTITLEMENT absent → middleware enforced
  - [ ] 7.5 Test DEV_SKIP_ENTITLEMENT in production NODE_ENV → ignored (enforced)
  - [ ] 7.6 Verify Vite proxy forwards to Express when :3001 is available
  - [ ] 7.7 Run full E2E suite to confirm no regressions

## Implementation Notes

### isPremium() Role Clarification
No code changes to `isPremium()` — only JSDoc additions. The function continues to read from IndexedDB for fast client-side rendering decisions. Components that use it (`PremiumGate`, `SubscriptionCard`, feature gates) continue working as-is. The security boundary is now the server middleware, not this function.

### Dev Proxy Architecture
The Vite dev server has three modes for `/api/ai/*` requests:

1. **DEV_SKIP_ENTITLEMENT=true**: Bypass all checks, direct proxy to AI providers. For local development without Supabase.
2. **Express on :3001 available**: Vite proxies to Express, which handles all enforcement. Standard development flow.
3. **Express not available, DEV_SKIP_ENTITLEMENT not set**: Vite applies shared middleware from `server/middleware/`. Dev-prod parity without running Express separately.

### DEV_SKIP_ENTITLEMENT Safety
- Only honored when `NODE_ENV === 'development'`
- Never checked in production builds (Vite strips `process.env` access in client builds)
- Server-side: Express `server/index.ts` should also check this flag for consistency
- Console warning ensures developers are aware when checks are disabled

### Subscription Lapse Flow
```
1. User's Stripe subscription expires
2. Stripe webhook fires → supabase/functions/stripe-webhook updates entitlements table (tier: 'free')
3. Server-side: entitlement cache TTL expires (max 5 minutes)
4. Next AI request: checkEntitlement reads fresh data from Supabase → tier is 'free'
5. Server responds: 403 { error: "ENTITLEMENT_EXPIRED", message: "...", upgradeUrl: "/settings" }
6. Client: BaseLLMClient maps 403 → LLMError(ENTITLEMENT_ERROR)
7. UI: Catches ENTITLEMENT_ERROR → shows PremiumGate with re-subscribe CTA
```

Max propagation delay: 5 minutes (cache TTL). Acceptable for a learning platform.

### Key Files
- Modify: `src/lib/entitlement/isPremium.ts` (JSDoc update only)
- Modify: `vite.config.ts` (import middleware for `ollamaDevProxy()`, respect `DEV_SKIP_ENTITLEMENT`)
- Modify: `.env.example` (document all new env vars)
- Modify: `src/ai/llm/client.ts` (403 structured error → re-subscribe CTA trigger)

### Dependencies
- E35-S01 (middleware modules must exist)
- Can be worked in parallel with E35-S03

## Testing Notes

### Security Boundary Verification
- **DEV_SKIP_ENTITLEMENT cannot escape to production:** Verify that setting `DEV_SKIP_ENTITLEMENT=true` with `NODE_ENV=production` does NOT bypass checks
- **isPremium() is not the security boundary:** Verify that even if `isPremium()` returns `true` client-side, a free-tier user's AI request is still rejected by the server with 403
- **Subscription lapse propagation:** Verify that after entitlement table update, the next AI request (after cache TTL) returns 403 with the structured error body

### Dev Proxy Testing
- Start Vite without Express → verify middleware applies
- Start Vite with Express on :3001 → verify proxy forwards
- Start Vite with DEV_SKIP_ENTITLEMENT=true → verify bypass + warning

### Regression Testing
- All existing `isPremium()` consumers must continue working
- `PremiumGate` component must render correctly for both premium and free users
- AI features must work for premium users (no false rejections)

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
