---
story_id: E61-S03
story_name: "Push Subscription Management and Supabase Persistence"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.3: Push Subscription Management and Supabase Persistence

## Story

As a learner,
I want my push subscription saved to my account,
so that I receive notifications on all my devices.

## Acceptance Criteria

**Given** the user has granted push notification permission
**When** `subscribeToPush()` is called in `pushManager.ts`
**Then** `pushManager.subscribe()` is called with `userVisibleOnly: true` and the VAPID public key as `applicationServerKey`
**And** the resulting PushSubscription is serialized to JSON

**Given** a valid PushSubscription object
**When** the subscription is persisted
**Then** a row is inserted into Supabase `push_subscriptions` table with `user_id`, `endpoint`, `p256dh`, `auth_key`, and `user_agent`
**And** the UNIQUE constraint on `(user_id, endpoint)` prevents duplicate subscriptions

**Given** the Supabase migration is applied
**When** I inspect the `push_subscriptions` table
**Then** it has columns: `id` (UUID PK), `user_id` (FK to auth.users), `endpoint` (TEXT), `p256dh` (TEXT), `auth_key` (TEXT), `user_agent` (TEXT), `created_at` (TIMESTAMPTZ), `last_successful_push` (TIMESTAMPTZ)
**And** RLS is enabled with a policy allowing users to manage only their own subscriptions
**And** an index exists on `user_id`

**Given** the user calls `unsubscribeFromPush()`
**When** the function executes
**Then** `PushSubscription.unsubscribe()` is called on the browser subscription
**And** the corresponding row is deleted from `push_subscriptions` in Supabase

**Given** the user is not authenticated (no Supabase session)
**When** `subscribeToPush()` is called
**Then** the function returns an error result indicating authentication is required
**And** no subscription is created

## Tasks / Subtasks

- [ ] Task 1: Create Supabase migration for `push_subscriptions` table (AC: 3)
  - [ ] 1.1 Create `supabase/migrations/YYYYMMDD_push_subscriptions.sql`
  - [ ] 1.2 Define table with columns: `id`, `user_id`, `endpoint`, `p256dh`, `auth_key`, `user_agent`, `created_at`, `last_successful_push`
  - [ ] 1.3 Add UNIQUE constraint on `(user_id, endpoint)`
  - [ ] 1.4 Add index on `user_id`
  - [ ] 1.5 Enable RLS and create policy: users manage only own subscriptions
  - [ ] 1.6 Add `ON DELETE CASCADE` for `user_id` FK
- [ ] Task 2: Implement `subscribeToPush()` in `src/lib/pushManager.ts` (AC: 1, 2)
  - [ ] 2.1 Get SW registration via `navigator.serviceWorker.ready`
  - [ ] 2.2 Call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })`
  - [ ] 2.3 Extract `endpoint`, `p256dh`, `auth` from `subscription.toJSON().keys`
  - [ ] 2.4 Insert into Supabase `push_subscriptions` via Supabase client (not Edge Function)
  - [ ] 2.5 Return `{ ok: true, data: subscription }` on success
- [ ] Task 3: Implement `unsubscribeFromPush()` in `src/lib/pushManager.ts` (AC: 4)
  - [ ] 3.1 Get current subscription via `registration.pushManager.getSubscription()`
  - [ ] 3.2 Call `subscription.unsubscribe()` on the browser side
  - [ ] 3.3 Delete row from Supabase `push_subscriptions` where `endpoint` matches
  - [ ] 3.4 Return `{ ok: true }` on success
- [ ] Task 4: Add authentication guard (AC: 5)
  - [ ] 4.1 Check Supabase session before subscribe/unsubscribe operations
  - [ ] 4.2 Return `{ ok: false, error: { code: 'AUTH_REQUIRED', message: '...' } }` if not authenticated
- [ ] Task 5: Update `pushsubscriptionchange` handler in `sw.js` (AC: 2)
  - [ ] 5.1 Update the stub from S02 to POST new subscription data to Supabase REST API
  - [ ] 5.2 Include auth token in request headers (via SW message passing or stored token)
- [ ] Task 6: Unit tests
  - [ ] 6.1 Test `subscribeToPush()` calls PushManager.subscribe with correct options
  - [ ] 6.2 Test `subscribeToPush()` returns auth error when no session
  - [ ] 6.3 Test `unsubscribeFromPush()` calls both browser unsubscribe and Supabase delete
  - [ ] 6.4 Test upsert behavior (UNIQUE constraint prevents duplicates)

## Design Guidance

No UI components in this story. Database schema + TypeScript module work.

## Implementation Notes

### Architecture Compliance (from ADR-2)

- **Use Supabase client directly** for subscription CRUD (not a separate Edge Function). RLS handles auth.
- **Schema exactly as specified in ADR-2:**

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_successful_push TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);
```

- **Result pattern:** All `pushManager.ts` functions return `{ ok: true, data } | { ok: false, error: { code, message } }`

### Existing Patterns to Follow

- **Supabase client:** Import from existing `src/lib/api.ts` or wherever the Supabase client is initialized
- **Auth check:** Use `supabase.auth.getSession()` to verify authentication
- **Error logging:** `console.error('[PushManager]', error)` prefix pattern
- **Migration naming:** Check existing `supabase/migrations/` for date format convention

### Key Technical Details

- `PushSubscription.toJSON()` returns `{ endpoint, expirationTime, keys: { p256dh, auth } }` — extract `keys.p256dh` and `keys.auth` for storage
- `user_agent` is captured via `navigator.userAgent` — useful for multi-device management later
- VAPID public key accessed via `import.meta.env.VITE_VAPID_PUBLIC_KEY`
- `userVisibleOnly: true` is mandatory (browser requirement — every push must show a notification)

### Dependencies

- Depends on S01: `pushManager.ts` module exists with stubs, `urlBase64ToUint8Array` implemented
- Depends on S02: Service Worker is active and has push event handler
- Requires Supabase project with auth configured (E44-E49 sync epic)

## Testing Notes

- Unit test with mocked `PushManager`, `navigator.serviceWorker`, and Supabase client
- Migration can be tested locally via `supabase db reset` if local Supabase is configured
- Integration test: subscribe -> verify row in `push_subscriptions` -> unsubscribe -> verify row deleted

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
