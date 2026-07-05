---
story_id: E61-S02
story_name: 'Service Worker Push and Click Handlers'
status: ready-for-dev
started: 2026-07-05
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.2: Service Worker Push and Click Handlers

> **Updated 2026-07-05**: Updated to target `src/sw.ts` (injectManifest) instead of standalone `public/sw.js`. The push/notificationclick/pushsubscriptionchange handler logic is unchanged — only the file target and tooling context are updated.

**Depends on**: E61-S01 (injectManifest migration + push placeholder must be in place)

## Story

As a learner,
I want to see browser notifications when study reminders arrive,
so that I can be reminded to study even when the app is not open.

## Acceptance Criteria

### Push Event

**Given** the Service Worker is active and push permission is granted
**When** a push event with a valid JSON payload is received
**Then** a browser notification is displayed with the payload's title, body, and icon
**And** the notification uses `/icons/icon-192.png` as the default icon
**And** the notification uses a badge icon (`/icons/badge-72.png`) if the browser supports it

**Given** a push event payload includes a `tag` field
**When** a notification with the same tag already exists
**Then** the new notification replaces the existing one (no duplicate notifications)

**Given** the push event has no payload or an invalid JSON payload
**When** the Service Worker processes the push event
**Then** a generic notification is shown with the title "Knowlune" and body "You have a new notification"

### Notification Click

**Given** a browser notification is displayed
**When** the user clicks the notification
**Then** the notification is closed
**And** if the app is already open in a tab, that tab is focused
**And** if the app is not open, a new tab opens at the URL from the notification payload

**Given** a push event payload includes a `url` field of `/flashcards`
**When** the user clicks the notification
**Then** the app opens or focuses at `/flashcards`

### Subscription Change

**Given** the Service Worker receives a `pushsubscriptionchange` event
**When** a subscription expires and is renewed by the browser
**Then** the Service Worker re-subscribes with the same VAPID key
**And** the new subscription is sent to the backend (POST to Supabase)

### Build & Icons

**Given** all handlers are implemented in `src/sw.ts`
**When** `npm run build` runs
**Then** `dist/sw.js` contains push, notificationclick, and pushsubscriptionchange handlers
**And** `public/icons/icon-192.png` and `public/icons/badge-72.png` exist in `dist/`
**And** the build succeeds without errors

## Tasks / Subtasks

- [ ] Task 1: Replace push placeholder with full handler in `src/sw.ts` (AC: 1, 2, 3)
  - [ ] 1.1 Replace the minimal push listener from E61-S01 with full implementation — parse JSON payload, extract title/body/icon/badge/tag/url
  - [ ] 1.2 Call `self.registration.showNotification()` with all fields: title, body, icon, badge, tag, data: { url }
  - [ ] 1.3 Fallback to generic notification on invalid/missing payload
  - [ ] 1.4 Default icon: `/icons/icon-192.png`, default badge: `/icons/badge-72.png`
  - [ ] 1.5 Use `tag` field for notification deduplication (same tag = replace existing)
  - [ ] 1.6 Wrap everything in `event.waitUntil()`

- [ ] Task 2: Implement notificationclick handler in `src/sw.ts` (AC: 4, 5)
  - [ ] 2.1 Add `self.addEventListener('notificationclick', ...)` with `event.waitUntil()`
  - [ ] 2.2 Close the notification via `event.notification.close()`
  - [ ] 2.3 Use `clients.matchAll({ type: 'window', includeUncontrolled: true })` to find open Knowlune tabs
  - [ ] 2.4 If matching tab found: call `client.focus()` and `client.navigate(url)` if URL differs
  - [ ] 2.5 If no tab found: call `clients.openWindow(url || '/')` to open new tab
  - [ ] 2.6 Fallback for browsers without `client.navigate()`: `client.focus()` + `postMessage` for React Router navigation

- [ ] Task 3: Implement pushsubscriptionchange handler in `src/sw.ts` (AC: 6)
  - [ ] 3.1 Add `self.addEventListener('pushsubscriptionchange', ...)` with `event.waitUntil()`
  - [ ] 3.2 Re-subscribe using `event.oldSubscription.options` (same VAPID key)
  - [ ] 3.3 POST new subscription to Supabase endpoint (`/api/push/subscriptions`)
  - [ ] 3.4 Use `fetch()` with appropriate error handling and retry logic
  - [ ] 3.5 Log failures — don't throw (subscription loss is recoverable on next app visit)

- [ ] Task 4: Create notification icon assets (AC: 7)
  - [ ] 4.1 Create `public/icons/` directory
  - [ ] 4.2 Copy `public/pwa-192x192.png` to `public/icons/icon-192.png`
  - [ ] 4.3 Create `public/icons/badge-72.png` — monochrome, 72×72px, transparent background (Android strips color for status bar)

- [ ] Task 5: Manual testing via DevTools
  - [ ] 5.1 Test push via Chrome DevTools > Application > Service Workers > Push — notification displays with all fields
  - [ ] 5.2 Test with no payload — generic fallback notification shown
  - [ ] 5.3 Test notification click — opens/focuses correct URL
  - [ ] 5.4 Test with tag — duplicate notifications collapse
  - [ ] 5.5 Test with app open vs. app closed (click behavior differs)

## Design Guidance

No React UI components in this story. All work is in `src/sw.ts` (compiled to `dist/sw.js`) and static assets in `public/icons/`.

## Implementation Notes

### Integration with injectManifest (from E61-S01)

This story extends the custom `src/sw.ts` created in E61-S01. The file already contains:

- Workbox precaching (`precacheAndRoute`)
- 5 runtime caching rules (`registerRoute`)
- Navigation fallback
- SW lifecycle (`skipWaiting`, `clientsClaim`)
- SKIP_WAITING message handler
- Minimal push placeholder (generic notification only)

All new code is added to the **same file** — no separate SW files. The push placeholder from E61-S01 should be **replaced** (not duplicated) with the full implementation.

### Notification Payload Format

```typescript
// Expected payload (sent from Supabase Edge Function via Web Push)
{
  title: string;         // required — notification title
  body: string;          // required — notification body
  icon?: string;         // optional — defaults to '/icons/icon-192.png'
  badge?: string;        // optional — defaults to '/icons/badge-72.png'
  tag?: string;          // optional — for deduplication
  url?: string;          // optional — deep link path (e.g., '/flashcards')
  data?: Record<string, unknown>;  // optional — additional metadata
}
```

### Known Notification Types (for `tag` values)

From `src/data/types.ts`: `'course-complete' | 'streak-milestone' | 'import-finished' | 'achievement-unlocked' | 'review-due' | 'srs-due'`

These map directly to `tag` values in push payloads for deduplication.

### Push Event Handler — Full Code

```ts
// src/sw.ts — Push event handler (replaces E61-S01 placeholder)
self.addEventListener('push', event => {
  event.waitUntil(
    (async () => {
      const defaults = {
        title: 'Knowlune',
        body: 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
      }

      let notificationOptions: NotificationOptions & { data?: { url?: string } } = { ...defaults }

      try {
        if (event.data) {
          const payload = event.data.json()
          notificationOptions = {
            ...defaults,
            ...payload,
            data: { url: payload.url || '/' },
          }
        }
      } catch {
        // Invalid/missing payload — use defaults (no-op, already set)
      }

      await self.registration.showNotification(
        notificationOptions.title || defaults.title,
        notificationOptions
      )
    })()
  )
})
```

### Notification Click Handler — Full Code

```ts
// src/sw.ts — Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Try to focus an existing tab
      for (const client of windowClients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          // If the URL differs, try navigate (Chromium), then postMessage fallback
          if (clientUrl.pathname !== url) {
            if ('navigate' in client) {
              await (client as WindowClient).navigate(url)
            }
            // Intentional: postMessage fallback for non-Chromium browsers
            client.postMessage({ type: 'NAVIGATE', url })
          }
          await client.focus()
          return
        }
      }

      // No existing tab — open new one (allowed because this is a user gesture)
      if (self.clients.openWindow) {
        await self.clients.openWindow(url)
      }
    })()
  )
})
```

### Push Subscription Change Handler — Full Code

```ts
// src/sw.ts — Push subscription change handler
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    (async () => {
      try {
        const newSubscription = await self.registration.pushManager.subscribe(
          event.oldSubscription.options
        )

        // Send new subscription to backend
        await fetch('/api/push/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription.toJSON()),
        })
      } catch (error) {
        // Intentional: log but don't throw — subscription loss is recoverable
        // on next app visit via usePushSubscription hook
        console.error('[SW] Push subscription change failed:', error)
      }
    })()
  )
})
```

### Key Technical Details

- **`event.waitUntil()` is mandatory** for all async operations in push handlers — without it, the browser may terminate the SW before work completes
- **Every push MUST show a notification** — browser requirement; failure to show a notification may revoke push permission
- **`client.navigate()`** is Chromium-only — use with fallback to `postMessage` for cross-browser support
- **`clients.openWindow()`** only works in response to a user gesture — notification click qualifies
- **Badge icon** should be monochrome (Android strips color for status bar); Safari ignores the `badge` field
- **`pushsubscriptionchange`** fires when the browser renews the subscription — must re-POST to backend
- Supabase endpoint (`/api/push/subscriptions`) doesn't exist yet — this is the foundation; the actual backend is a separate story

### Dependencies

- **E61-S01 must be complete**: `src/sw.ts` must exist with Workbox precaching + placeholder push handler
- `icons/icon-192.png`: copy of existing `public/pwa-192x192.png`
- `icons/badge-72.png`: new monochrome asset
- No new npm dependencies

## Testing Notes

- Primary testing is **manual** via Chrome DevTools > Application > Service Workers > Push
- Playwright E2E testing of SW events requires `context.serviceWorkers()` — consider in a follow-up story
- Test scenarios:
  1. Push with full payload → verify all notification fields
  2. Push with no payload → verify generic fallback
  3. Push with same tag twice → verify deduplication
  4. Click notification with app open → verify tab focuses, URL navigates
  5. Click notification with app closed → verify new tab opens at correct URL
  6. Simulate subscription change → verify re-subscription + backend POST
- `npm run build` must produce `dist/sw.js` with all three handlers
- `npm run ci` must pass (no regressions from existing tests)

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

## Implementation Plan

See [plan](../plans/plan-e61-s02-service-worker-push-and-click-handlers.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
