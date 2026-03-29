---
story_id: E61-S02
story_name: "Service Worker Push and Click Handlers"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.2: Service Worker Push and Click Handlers

## Story

As a learner,
I want to see browser notifications when study reminders arrive,
so that I can be reminded to study even when the app is not open.

## Acceptance Criteria

**Given** the Service Worker is active and push permission is granted
**When** a push event is received by the Service Worker
**Then** a browser notification is displayed with the payload's title, body, and icon
**And** the notification uses `/icons/icon-192.png` as the default icon
**And** the notification uses a badge icon (`/icons/badge-72.png`) if the browser supports it

**Given** a push event payload includes a `tag` field
**When** a notification with the same tag already exists
**Then** the new notification replaces the existing one (no duplicate notifications)

**Given** a browser notification is displayed
**When** the user clicks the notification
**Then** the notification is closed
**And** if the app is already open in a tab, that tab is focused
**And** if the app is not open, a new tab opens at the URL from the notification payload

**Given** a push event payload includes a `url` field of `/flashcards`
**When** the user clicks the notification
**Then** the app opens or focuses at `/flashcards`

**Given** the Service Worker receives a `pushsubscriptionchange` event
**When** a subscription expires and is renewed by the browser
**Then** the Service Worker re-subscribes with the same options
**And** the new subscription is sent to the backend (POST to Supabase)

**Given** the push event has no payload or an invalid JSON payload
**When** the Service Worker processes the push event
**Then** a generic notification is shown with the title "Knowlune" and body "You have a new notification"

## Tasks / Subtasks

- [ ] Task 1: Implement push event handler in `public/sw.js` (AC: 1, 2, 6)
  - [ ] 1.1 Add `self.addEventListener('push', ...)` with `event.waitUntil()`
  - [ ] 1.2 Parse push payload as JSON, fallback to generic notification on parse failure
  - [ ] 1.3 Call `self.registration.showNotification()` with title, body, icon, badge, tag, data (url)
  - [ ] 1.4 Default icon: `/icons/icon-192.png`, default badge: `/icons/badge-72.png`
  - [ ] 1.5 Use `tag` field to collapse duplicate notifications of the same type
- [ ] Task 2: Implement notificationclick handler in `public/sw.js` (AC: 3, 4)
  - [ ] 2.1 Add `self.addEventListener('notificationclick', ...)` with `event.waitUntil()`
  - [ ] 2.2 Close the notification via `event.notification.close()`
  - [ ] 2.3 Use `clients.matchAll({ type: 'window', includeUncontrolled: true })` to find open tabs
  - [ ] 2.4 If matching tab found, call `client.focus()` and `client.navigate(url)` if url differs
  - [ ] 2.5 If no tab found, call `clients.openWindow(url || '/')` to open new tab
- [ ] Task 3: Implement pushsubscriptionchange handler (AC: 5)
  - [ ] 3.1 Add `self.addEventListener('pushsubscriptionchange', ...)` with `event.waitUntil()`
  - [ ] 3.2 Re-subscribe using `event.oldSubscription.options` for same VAPID key
  - [ ] 3.3 POST new subscription to Supabase endpoint (or stub URL for now, finalized in S03/S05)
- [ ] Task 4: Create notification icon assets (AC: 1)
  - [ ] 4.1 Create `public/icons/` directory
  - [ ] 4.2 Copy/symlink `pwa-192x192.png` as `public/icons/icon-192.png` (or create separate)
  - [ ] 4.3 Create `public/icons/badge-72.png` — monochrome, 72x72px, transparent background
- [ ] Task 5: Manual testing via DevTools
  - [ ] 5.1 Test push via Chrome DevTools > Application > Service Workers > Push
  - [ ] 5.2 Verify notification displays with correct title, body, icon
  - [ ] 5.3 Verify click opens/focuses correct URL
  - [ ] 5.4 Verify generic fallback when push has no payload

## Design Guidance

No React UI components in this story. All work is in `public/sw.js` (vanilla JS) and static assets.

## Implementation Notes

### Architecture Compliance (from ADR-3, ADR-6)

- **`public/sw.js` is vanilla JS** — no imports, no TypeScript, no build step. It runs in a separate context from the React app.
- **Every push event MUST show a notification** — this is a browser requirement. If you receive a push without showing a notification, the browser may revoke push permission.
- **`event.waitUntil()`** is mandatory for all async operations in push, notificationclick, and pushsubscriptionchange handlers.

### Notification Payload Format (ADR-6)

```javascript
// Expected payload shape (parsed from push event data)
{
  title: "Course Completed!",       // required
  body: "You finished React 101",   // required
  icon: "/icons/icon-192.png",      // optional, has default
  badge: "/icons/badge-72.png",     // optional, has default
  tag: "course-complete",           // optional, for dedup
  url: "/courses/react-101"         // optional, for deep link
}
```

### Existing Files Context

- `public/pwa-192x192.png` exists — can be referenced or copied to `icons/icon-192.png`
- `public/mockServiceWorker.js` is MSW's service worker — completely unrelated to our `sw.js`
- Notification types from `src/data/types.ts`: `'course-complete' | 'streak-milestone' | 'import-finished' | 'achievement-unlocked' | 'review-due' | 'srs-due'`
- These type strings can be used as `tag` values in push payloads

### Key Technical Details

- `client.navigate()` is not supported in all browsers — use `client.focus()` first, then postMessage to trigger React Router navigation as a fallback pattern
- `clients.openWindow()` can only be called in response to a user gesture (notification click counts)
- Badge icon should be monochrome (Android uses it for status bar — color is stripped)
- Safari does not support `badge` in notifications — include it but it will be ignored gracefully

### Dependencies

- Depends on S01: Service Worker must be registered and `public/sw.js` must exist
- `pushsubscriptionchange` handler will POST to Supabase — the exact endpoint is finalized in S03, so stub the URL for now

## Testing Notes

- Primary testing is manual via Chrome DevTools push simulation
- E2E testing of Service Workers in Playwright requires `context.serviceWorkers()` — consider adding in a later story
- Unit testing `sw.js` is not practical (runs in SW context) — test via integration/E2E
- Verify `npm run build` still copies `sw.js` and `icons/` directory to `dist/`

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
