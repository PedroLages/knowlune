---
story_id: E61-S01
story_name: "InjectManifest Migration and Push Foundation"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.1: InjectManifest Migration and Push Foundation

> **Updated 2026-07-05**: Rewritten to use `injectManifest` strategy instead of standalone `public/sw.js`. Since this story was originally authored, E120 (PWA Polish) shipped with `PWAUpdatePrompt` + `PWAInstallBanner` + full Workbox `generateSW` config. The original approach ("do NOT use vite-plugin-pwa") would conflict with these shipped features. The updated approach integrates push handlers into the existing vite-plugin-pwa pipeline via `injectManifest`.

## Story

As a developer,
I want the service worker migrated to `injectManifest` strategy with a push event placeholder and VAPID keys configured,
so that the foundation for push notifications is in place without breaking existing PWA features (update prompts, install banners, precaching).

## Acceptance Criteria

### VAPID Keys

**Given** the project has no VAPID keys configured
**When** I run `npx web-push generate-vapid-keys`
**Then** a public/private key pair is generated
**And** the public key is stored in `.env` as `VITE_VAPID_PUBLIC_KEY`
**And** the public key is added to `.env.example` (without the value)
**And** the private key is documented for Edge Function secret storage

### InjectManifest Migration

**Given** the VitePWA config currently uses `generateSW` (default `workbox:` block)
**When** the config is migrated to `injectManifest`
**Then** a `src/sw.ts` file is created as the custom SW entry point
**And** all 5 existing `runtimeCaching` rules are ported to `registerRoute()` calls in `src/sw.ts`
**And** the existing `navigateFallback` and `navigateFallbackDenylist` behave identically via Workbox API
**And** `registerType: 'prompt'` continues to work — `PWAUpdatePrompt` shows update banners
**And** `PWAInstallBanner` continues to work — `beforeinstallprompt` fires normally

### SW Lifecycle

**Given** the custom `src/sw.ts` is compiled by the build
**When** the SW installs
**Then** `skipWaiting()` is called so the new SW activates immediately
**And** `clientsClaim()` is called in the activate event so the SW controls all pages

### Push Placeholder

**Given** the custom `src/sw.ts` is active
**When** a push event is received
**Then** a generic notification is shown with title "Knowlune" and body "You have a new notification"
**And** `event.waitUntil()` wraps the async operation

### Push Manager Module

**Given** `src/lib/pushManager.ts` is created
**When** imported by other modules
**Then** it exports `subscribeToPush(registration)`, `unsubscribeFromPush(subscription)`, `getPushPermissionState()`, and `urlBase64ToUint8Array()`
**And** it does NOT export `registerServiceWorker()` (registration is handled by vite-plugin-pwa)

### Push Subscription Hook

**Given** `src/hooks/usePushSubscription.ts` is created
**When** used in a React component
**Then** it exposes `{ isSubscribed, subscribe, unsubscribe, permissionState }`
**And** it uses `useRegisterSW` from `virtual:pwa-register/react` to get the SW registration
**And** it calls `subscribeToPush()` from `pushManager.ts` once the registration is available

### Build Verification

**Given** all changes are implemented
**When** `npm run build` runs
**Then** `dist/sw.js` contains Workbox precaching + runtime caching + push event handler
**And** the build succeeds without errors
**And** `npm run ci` passes (typecheck + lint + format:check + build + test:unit)

## Tasks / Subtasks

- [ ] Task 1: Generate VAPID keys and configure environment (AC: 1)
  - [ ] 1.1 Run `npx web-push generate-vapid-keys` to generate key pair
  - [ ] 1.2 Add `VITE_VAPID_PUBLIC_KEY=<public-key>` to `.env`
  - [ ] 1.3 Add `VITE_VAPID_PUBLIC_KEY=` (empty) to `.env.example`
  - [ ] 1.4 Document in story notes: private key must be stored as Edge Function secret (Supabase vault), NEVER committed

- [ ] Task 2: Migrate VitePWA from `generateSW` to `injectManifest` (AC: 2)
  - [ ] 2.1 Replace `workbox: { … }` block in `vite.config.ts` with `injectManifest: { swSrc: 'src/sw.ts', globPatterns: …, globIgnores: … }`
  - [ ] 2.2 Keep `registerType: 'prompt'`, `manifest`, `includeAssets`, and `devOptions` unchanged
  - [ ] 2.3 Ensure `worker.format: 'es'` is present for ES module workers (already configured)

- [ ] Task 3: Create `src/sw.ts` — custom SW entry point (AC: 2, 3, 4)
  - [ ] 3.1 Import `precacheAndRoute` from `workbox-precaching` and call `precacheAndRoute(self.__WB_MANIFEST)`
  - [ ] 3.2 Port all 5 `runtimeCaching` rules using `registerRoute()` + strategies (CacheFirst, StaleWhileRevalidate, NetworkOnly)
  - [ ] 3.3 Add `setDefaultHandler(new NetworkOnly())` as fallback
  - [ ] 3.4 Add `NavigationRoute` with denylist via `registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))`
  - [ ] 3.5 Add `skipWaiting()` in install event
  - [ ] 3.6 Add `clientsClaim()` in activate event
  - [ ] 3.7 Add `message` event listener for `SKIP_WAITING` (PWAUpdatePrompt relies on this)
  - [ ] 3.8 Add minimal `push` event listener — parse JSON payload, show generic notification, `event.waitUntil()`
  - [ ] 3.9 Verify TypeScript types: the compiled SW must not import DOM-only or React types — use `self` global and `ServiceWorkerGlobalScope` event types

- [ ] Task 4: Create `src/lib/pushManager.ts` module (AC: 5)
  - [ ] 4.1 Define `PushError` type and `Result<T, E>` pattern
  - [ ] 4.2 Implement `urlBase64ToUint8Array(base64String)` — VAPID key conversion
  - [ ] 4.3 Implement `subscribeToPush(registration: ServiceWorkerRegistration)` — calls `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, returns `Result<PushSubscription, PushError>`
  - [ ] 4.4 Implement `unsubscribeFromPush(subscription: PushSubscription)` — calls `subscription.unsubscribe()`, returns `Result<void, PushError>`
  - [ ] 4.5 Implement `getPushPermissionState()` — returns `'granted' | 'denied' | 'default' | 'unsupported'`
  - [ ] 4.6 Do NOT include `registerServiceWorker()` — SW registration is handled by vite-plugin-pwa's `useRegisterSW`

- [ ] Task 5: Create `src/hooks/usePushSubscription.ts` (AC: 6)
  - [ ] 5.1 Import `useRegisterSW` from `virtual:pwa-register/react`
  - [ ] 5.2 Call `subscribeToPush(registration)` from `onRegisteredSW` callback
  - [ ] 5.3 Expose `{ isSubscribed, subscribe, unsubscribe, permissionState }`
  - [ ] 5.4 Guard with `'serviceWorker' in navigator && 'PushManager' in window` check
  - [ ] 5.5 Handle permission denied gracefully — return appropriate state, no throw

- [ ] Task 6: Unit tests
  - [ ] 6.1 Test `urlBase64ToUint8Array` with known VAPID key pair
  - [ ] 6.2 Test `getPushPermissionState()` returns `'unsupported'` when Notification API missing
  - [ ] 6.3 Test `subscribeToPush()` with mocked `registration.pushManager.subscribe`
  - [ ] 6.4 Test `unsubscribeFromPush()` with mocked `subscription.unsubscribe`
  - [ ] 6.5 Test `Result` type success and error paths

- [ ] Task 7: Verify no regressions
  - [ ] 7.1 `npm run build` — SW file contains all expected handlers
  - [ ] 7.2 `npm run ci` — all existing tests pass
  - [ ] 7.3 Manual: `npm run preview`, open DevTools > Application > Service Workers — SW is active
  - [ ] 7.4 Manual: trigger update prompt — `PWAUpdatePrompt` still works
  - [ ] 7.5 Manual: install prompt — `PWAInstallBanner` still works (Chromium)

## Design Guidance

No UI components in this story. This is infrastructure/foundation work.

## Implementation Notes

### Why `injectManifest` Instead of Standalone `public/sw.js`

The original story (authored before E120 shipped) assumed Knowlune had no PWA infrastructure and only needed SW for push. Since then, E120 added:
- `PWAUpdatePrompt` (update detection via `useRegisterSW` from `virtual:pwa-register/react`)
- `PWAInstallBanner` (install prompts on Android + iOS)
- Workbox `generateSW` config with precaching + 5 runtime caching rules

A standalone `public/sw.js` would either be overwritten by Workbox's `generateSW` output, or if registered separately, would conflict with the existing SW. `injectManifest` lets us have one SW that does both: Workbox precaching/routing AND custom push handlers.

### `injectManifest` Config Migration

**Before** (current `vite.config.ts`):
```ts
VitePWA({
  registerType: 'prompt',
  // ... manifest unchanged ...
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
    globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [ /* 5 rules */ ],
  },
})
```

**After**:
```ts
VitePWA({
  registerType: 'prompt',
  // ... manifest unchanged ...
  injectManifest: {
    swSrc: 'src/sw.ts',
    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
    globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js'],
  },
})
```

The `runtimeCaching`, `navigateFallback`, and `navigateFallbackDenylist` move into `src/sw.ts` as Workbox API calls.

### `src/sw.ts` Structure

```ts
// src/sw.ts — Custom Service Worker entry point (injectManifest)
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-routing';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim, skipWaiting } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Precache all assets in __WB_MANIFEST (injected by vite-plugin-pwa at build)
precacheAndRoute(self.__WB_MANIFEST);

// --- Runtime Caching (ported from vite.config.ts workbox.runtimeCaching) ---

// Local images — CacheFirst, 200 entries, 30 days
registerRoute(
  ({ url }) => url.pathname.match(/^\/images\/.+\.(png|webp|jpg|jpeg)$/i),
  new CacheFirst({
    cacheName: 'local-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Unsplash images — StaleWhileRevalidate, 80 entries, 30 days
registerRoute(
  ({ url }) => /^https:\/\/images\.unsplash\.com\/.*/i.test(url.href),
  new StaleWhileRevalidate({
    cacheName: 'unsplash-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// HuggingFace models — CacheFirst, 20 entries, 90 days
registerRoute(
  ({ url }) => /^https:\/\/huggingface\.co\/.*/i.test(url.href),
  new CacheFirst({
    cacheName: 'hf-models',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// AI API — NetworkOnly
registerRoute(({ url }) => /^\/api\/ai\/.*/i.test(url.pathname), new NetworkOnly());

// ABS Proxy — NetworkOnly
registerRoute(({ url }) => /\/api\/abs\/proxy\//.test(url.pathname), new NetworkOnly());

// --- Navigation Fallback ---
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// --- Fallback for unmatched routes ---
setDefaultHandler(new NetworkOnly());

// --- SW Lifecycle ---
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Required for PWAUpdatePrompt — listens for SKIP_WAITING message
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Push Notification (placeholder — full handlers in E61-S02) ---
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let title = 'Knowlune';
      let body = 'You have a new notification';
      try {
        const payload = event.data?.json();
        if (payload?.title) title = payload.title;
        if (payload?.body) body = payload.body;
      } catch {
        // Use defaults on invalid/missing payload
      }
      await self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
      });
    })()
  );
});
```

### Architecture Notes

- **TypeScript in SW**: The SW runs in `ServiceWorkerGlobalScope`. Import only Workbox utilities — no React, no DOM types, no Zustand. Use `declare let self: ServiceWorkerGlobalScope` at top of file. The Vite build compiles it to vanilla JS in `dist/sw.js`.
- **`useRegisterSW` is safe to call multiple times**: `PWAUpdatePrompt` already uses it. Our `usePushSubscription` hook can use its own `useRegisterSW` call — vite-plugin-pwa shares the same registration. No conflict.
- **SW lifecycle**: `skipWaiting()` + `clientsClaim()` ensure the new SW activates immediately. The `message` listener for `SKIP_WAITING` is required for `PWAUpdatePrompt`'s "Reload" button.
- **VAPID private key**: NEVER in client code. Store as Supabase Edge Function secret. The public key is safe to expose — it's in `.env` as `VITE_VAPID_PUBLIC_KEY` (Vite strips the `VITE_` prefix from non-prefixed env vars at build time).
- **Existing files unchanged**: `PWAUpdatePrompt.tsx`, `PWAInstallBanner.tsx`, `App.tsx`, `public/_headers`.

### Dependencies

- `web-push` — dev dependency, for key generation only (`npx web-push generate-vapid-keys`)
- `workbox-precaching`, `workbox-routing`, `workbox-expiration`, `workbox-cacheable-response`, `workbox-core` — already installed (Workbox v7.4.0, shipped with vite-plugin-pwa)
- No new runtime dependencies

## Testing Notes

- Unit tests for `pushManager.ts`: mock `navigator.serviceWorker`, `PushManager`, `Notification`
- Unit tests for `urlBase64ToUint8Array`: test with known VAPID key pair (input/output values)
- Build verification: `npm run build && ls dist/sw.js` — file should exist and contain both Workbox and push code
- Manual SW verification: `npm run preview`, DevTools > Application > Service Workers — SW active, no errors
- No E2E tests for SW behavior in this story (SW testing requires DevTools protocol — deferred to E61-S02)
- All existing tests must continue passing (`npm run ci`)

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
