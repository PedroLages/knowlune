---
story_id: E61-S01
story_name: "VAPID Key Setup and Service Worker Registration"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.1: VAPID Key Setup and Service Worker Registration

## Story

As a developer,
I want VAPID keys generated and a Service Worker registered at root scope,
so that the foundation for push notifications is in place.

## Acceptance Criteria

**Given** the project has no VAPID keys configured
**When** I run the VAPID key generation command (`npx web-push generate-vapid-keys`)
**Then** a public/private key pair is generated
**And** the public key is stored in `.env` as `VITE_VAPID_PUBLIC_KEY`
**And** the private key is documented for later Edge Function secret storage

**Given** the app is loaded in a browser that supports Service Workers
**When** the app initializes
**Then** a Service Worker (`/sw.js`) is registered at root scope (`/`)
**And** the registration succeeds without errors in the console

**Given** the Service Worker is registered
**When** I inspect the browser DevTools > Application > Service Workers
**Then** the Service Worker is listed as active and controlling the page

**Given** `public/sw.js` exists in the project
**When** `npm run build` is executed
**Then** `sw.js` is copied to the `dist/` output directory at root level

**Given** the `src/lib/pushManager.ts` module is created
**When** imported by other modules
**Then** it exports `registerServiceWorker()`, `subscribeToPush()`, `unsubscribeFromPush()`, `getPushPermissionState()`, and `urlBase64ToUint8Array()` functions

## Tasks / Subtasks

- [ ] Task 1: Generate VAPID keys and configure environment (AC: 1)
  - [ ] 1.1 Run `npx web-push generate-vapid-keys` to generate key pair
  - [ ] 1.2 Add `VITE_VAPID_PUBLIC_KEY=<public-key>` to `.env` and `.env.example`
  - [ ] 1.3 Document private key storage instructions for Edge Function secrets in story notes
- [ ] Task 2: Create Service Worker file `public/sw.js` (AC: 2, 3, 4)
  - [ ] 2.1 Create `public/sw.js` with minimal push event placeholder (`self.addEventListener('push', ...)`)
  - [ ] 2.2 Add `self.addEventListener('install', ...)` with `self.skipWaiting()`
  - [ ] 2.3 Add `self.addEventListener('activate', ...)` with `clients.claim()`
  - [ ] 2.4 Verify `npm run build` copies `sw.js` to `dist/` root
- [ ] Task 3: Create `src/lib/pushManager.ts` module (AC: 5)
  - [ ] 3.1 Implement `urlBase64ToUint8Array(base64String)` utility
  - [ ] 3.2 Implement `registerServiceWorker()` — calls `navigator.serviceWorker.register('/sw.js')`
  - [ ] 3.3 Stub `subscribeToPush()` — returns `Result<PushSubscription, PushError>` (full implementation in S03)
  - [ ] 3.4 Stub `unsubscribeFromPush()` — returns `Result<void, PushError>` (full implementation in S03)
  - [ ] 3.5 Implement `getPushPermissionState()` — returns `'granted' | 'denied' | 'default' | 'unsupported'`
  - [ ] 3.6 Define `PushError` type and `Result<T, E>` pattern for all exports
- [ ] Task 4: Wire SW registration into app initialization (AC: 2)
  - [ ] 4.1 Call `registerServiceWorker()` in `App.tsx` useEffect (or appropriate init location)
  - [ ] 4.2 Guard with `'serviceWorker' in navigator` check
  - [ ] 4.3 Log registration result with `[PushManager]` prefix
- [ ] Task 5: Unit tests for pushManager.ts
  - [ ] 5.1 Test `urlBase64ToUint8Array` with known VAPID key
  - [ ] 5.2 Test `getPushPermissionState()` returns `'unsupported'` when Notification API missing
  - [ ] 5.3 Test `registerServiceWorker()` handles missing SW support gracefully

## Design Guidance

No UI components in this story. This is infrastructure/foundation work.

## Implementation Notes

### Architecture Compliance (from ADR-1, ADR-3)

- **Manual SW registration** — do NOT use `vite-plugin-pwa`. Knowlune only needs SW for push, not offline caching.
- **`public/sw.js`** must be vanilla JS with NO imports, NO build step. It's a separate execution context from React.
- **`src/lib/pushManager.ts`** is the single entry point for all Push API interactions. No other module should call `navigator.serviceWorker` or `PushManager` directly.
- VAPID private key must NEVER appear in client code or version control.

### Existing Patterns to Follow

- **Error handling:** Use `Result<T, PushError>` pattern (similar to how existing services return structured results). All push errors logged with `[PushManager]` prefix.
- **Module pattern:** Follow `src/lib/eventBus.ts` singleton pattern — module-level exports, no class needed.
- **Import alias:** Use `@/lib/pushManager` for imports.
- **`mockServiceWorker.js`** already exists in `public/` for MSW — our `sw.js` is separate and unrelated.

### Existing Files Context

- `public/` already contains: `apple-touch-icon-180x180.png`, `favicon.svg`, `images/`, `mockServiceWorker.js`, `offline.html`, `pwa-192x192.png`, `pwa-512x512.png`, `reduce-motion-init.js`
- No `icons/` subdirectory exists yet — will be created in S02 for `badge-72.png`
- No existing `sw.js` — this is a new file

### Key Technical Details

- `urlBase64ToUint8Array` is needed because `PushManager.subscribe()` requires `applicationServerKey` as a `Uint8Array`, but VAPID public keys are base64url-encoded strings
- SW registration is idempotent — safe to call on every app load
- `VITE_VAPID_PUBLIC_KEY` is accessed via `import.meta.env.VITE_VAPID_PUBLIC_KEY` in Vite

### Dependencies

- `web-push` npm package needed only for key generation (dev dependency, not runtime)
- No new runtime client dependencies

## Testing Notes

- Unit test `urlBase64ToUint8Array` with a known VAPID key pair
- Mock `navigator.serviceWorker` for registration tests
- E2E verification: SW shows as active in browser after page load (can be checked in S02's E2E tests)
- Build verification: `npm run build && ls dist/sw.js` should succeed

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
