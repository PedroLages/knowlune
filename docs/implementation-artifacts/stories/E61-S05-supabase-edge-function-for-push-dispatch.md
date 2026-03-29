---
story_id: E61-S05
story_name: "Supabase Edge Function for Push Dispatch"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.5: Supabase Edge Function for Push Dispatch

## Story

As a learner,
I want to receive push notifications triggered by server-side events,
so that I get study reminders even when the app is not open.

## Acceptance Criteria

**Given** a new row is inserted into the Supabase `notifications` table
**When** the database webhook fires
**Then** the `push-notification` Edge Function is invoked with the notification data

**Given** the Edge Function receives a notification payload
**When** it processes the notification
**Then** it queries `push_subscriptions` for the notification's `user_id`
**And** it retrieves all active subscriptions for that user

**Given** the Edge Function has active subscriptions for the user
**When** it sends push messages
**Then** each subscription receives a push message via `@negrel/webpush` with the notification title, body, and URL
**And** VAPID authentication uses the keys from Edge Function secrets

**Given** the Edge Function sends a push to an expired subscription
**When** the push service returns HTTP 404 or 410
**Then** the expired subscription is deleted from `push_subscriptions`
**And** processing continues for remaining subscriptions

**Given** the push service returns HTTP 429 (rate limited)
**When** the Edge Function processes the response
**Then** the push is retried with exponential backoff (up to 3 retries)

**Given** the Edge Function completes processing
**When** it returns a response
**Then** the response includes a delivery summary: `{ sent: N, failed: N, cleaned: N }`

**Given** the user has quiet hours enabled in their notification preferences
**When** the Edge Function processes a notification during quiet hours
**Then** the push is not sent (quiet hours check against user preferences)

## Tasks / Subtasks

- [ ] Task 1: Create Edge Function scaffold (AC: 1)
  - [ ] 1.1 Create `supabase/functions/push-notification/index.ts`
  - [ ] 1.2 Set up Deno serve handler with request validation
  - [ ] 1.3 Parse webhook payload (notification row data)
  - [ ] 1.4 Extract `user_id`, `title`, `message`, `type`, `actionUrl` from payload
- [ ] Task 2: Query subscriptions and send push messages (AC: 2, 3)
  - [ ] 2.1 Query `push_subscriptions` WHERE `user_id` matches notification's user
  - [ ] 2.2 Import and configure `@negrel/webpush` with VAPID keys from `Deno.env.get()`
  - [ ] 2.3 Build push payload: `{ title, body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: type, url: actionUrl }`
  - [ ] 2.4 Send push to each subscription endpoint
  - [ ] 2.5 Update `last_successful_push` on successful delivery
- [ ] Task 3: Handle push service error responses (AC: 4, 5)
  - [ ] 3.1 On HTTP 404/410: DELETE the expired subscription from `push_subscriptions`
  - [ ] 3.2 On HTTP 429: implement retry with exponential backoff (100ms, 200ms, 400ms — max 3 retries)
  - [ ] 3.3 On 5xx: log error, continue to next subscription (transient error)
  - [ ] 3.4 Track counts: `sent`, `failed`, `cleaned` for response summary
- [ ] Task 4: Implement quiet hours check (AC: 7)
  - [ ] 4.1 Query user's notification preferences from Supabase (or equivalent preferences table)
  - [ ] 4.2 Check if `quietHoursEnabled` is true and current time falls within `quietHoursStart`-`quietHoursEnd`
  - [ ] 4.3 If within quiet hours, skip push delivery entirely and return early
- [ ] Task 5: Build delivery summary response (AC: 6)
  - [ ] 5.1 Return JSON response: `{ sent: N, failed: N, cleaned: N }`
  - [ ] 5.2 Return HTTP 200 even on partial failures (Edge Function succeeded, some pushes failed)
- [ ] Task 6: Configure VAPID secrets
  - [ ] 6.1 Document `supabase secrets set VAPID_PRIVATE_KEY="..."` command
  - [ ] 6.2 Document `supabase secrets set VAPID_PUBLIC_KEY="..."` command
  - [ ] 6.3 Access via `Deno.env.get('VAPID_PRIVATE_KEY')` and `Deno.env.get('VAPID_PUBLIC_KEY')`
- [ ] Task 7: Configure database webhook
  - [ ] 7.1 Create webhook on `notifications` table for INSERT events
  - [ ] 7.2 Point webhook to `push-notification` Edge Function URL
  - [ ] 7.3 Document webhook configuration in Supabase dashboard
- [ ] Task 8: Tests
  - [ ] 8.1 Test payload parsing handles missing fields gracefully
  - [ ] 8.2 Test expired subscription cleanup on 404/410
  - [ ] 8.3 Test quiet hours check correctly suppresses delivery
  - [ ] 8.4 Test delivery summary counts are accurate

## Design Guidance

No UI components in this story. Server-side Edge Function work.

## Implementation Notes

### Architecture Compliance (from ADR-4, ADR-7)

- **Trigger:** Database webhook on `notifications` table INSERT, NOT direct client invocation
- **Library:** `@negrel/webpush` for Deno — the only push library dependency
- **Cleanup:** Lazy cleanup (per-push on 404/410) is implemented here. Batch cleanup (weekly cron) is deferred.
- **VAPID keys:** `Deno.env.get('VAPID_PRIVATE_KEY')` and `Deno.env.get('VAPID_PUBLIC_KEY')` — never hardcoded

### Edge Function Structure

```typescript
// supabase/functions/push-notification/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @negrel/webpush import for Deno

serve(async (req: Request) => {
  // 1. Parse webhook payload
  // 2. Query push_subscriptions for user_id
  // 3. Check quiet hours
  // 4. Send push to each subscription
  // 5. Handle errors (404/410 cleanup, 429 retry)
  // 6. Return delivery summary
})
```

### Existing Notification Types (for payload mapping)

From `src/data/types.ts`:
- `'course-complete'` -> tag: `course-complete`, url: `/courses/{courseId}`
- `'streak-milestone'` -> tag: `streak-milestone`, url: `/`
- `'import-finished'` -> tag: `import-finished`, url: `/courses/{courseId}`
- `'achievement-unlocked'` -> tag: `achievement-unlocked`, url: `/`
- `'review-due'` -> tag: `review-due`, url: `/flashcards`
- `'srs-due'` -> tag: `srs-due`, url: `/flashcards`

### Existing Notification Preferences Schema

From `src/data/types.ts` — `NotificationPreferences` interface:
- `quietHoursEnabled: boolean`
- `quietHoursStart: string` ("HH:MM" 24h format)
- `quietHoursEnd: string` ("HH:MM" 24h format)
- Per-type toggles: `courseComplete`, `streakMilestone`, `importFinished`, `achievementUnlocked`, `reviewDue`, `srsDue`

The Edge Function needs to read these preferences from Supabase to check quiet hours and type-level opt-out.

### Key Technical Details

- Supabase Edge Functions run Deno — use `https://` imports, not npm
- Supabase client in Edge Functions: `createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)` — service role bypasses RLS for reading subscriptions
- `@negrel/webpush` requires VAPID subject (email): use `mailto:notifications@knowlune.app` or similar
- Webhook payload includes the full inserted row — `record.user_id`, `record.title`, `record.message`, `record.type`, `record.action_url`

### Dependencies

- Depends on S03: `push_subscriptions` table must exist with data
- Requires Supabase project with Edge Functions enabled
- Requires VAPID keys set as Edge Function secrets
- Requires `notifications` table to exist in Supabase (from E44-E49 sync)

## Testing Notes

- Test locally with `supabase functions serve push-notification --env-file .env.local`
- Simulate webhook by sending POST with notification payload
- Test 404/410 cleanup by inserting a subscription with an invalid endpoint
- Integration test requires real push service (or mock) — consider end-to-end test in S07

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
