---
title: "feat: InjectManifest Migration and Push Notification Foundation"
type: feat
status: active
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-e61-s01-vapid-key-setup-requirements.md
---

# feat: InjectManifest Migration and Push Notification Foundation

## Overview

Migrate the VitePWA configuration from `generateSW` to `injectManifest` strategy, creating a custom `src/sw.ts` service worker entry point that preserves existing PWA features (update prompts, install banners, precaching, 5 runtime caching rules) while adding a push event placeholder and push management infrastructure. Additionally, generate and configure VAPID keys for future push notification use.

## Problem Frame

The original E61-S01 story predated Epic 120 (PWA Polish), which shipped `PWAUpdatePrompt`, `PWAInstallBanner`, and a full Workbox `generateSW` config with precaching and runtime caching via `vite-plugin-pwa`. A standalone `public/sw.js` would conflict with the existing Workbox-managed SW. The `injectManifest` strategy lets us maintain a single SW that handles both Workbox precaching/routing and custom push handlers without breaking existing PWA functionality.

## Requirements Trace

### Environment Configuration (R1)

- R1. Generate VAPID public/private key pair via `npx web-push generate-vapid-keys`. Store public key as `VITE_VAPID_PUBLIC_KEY` in `.env` and `.env.example`. Document private key for Supabase Edge Function secret storage (never committed).

### SW and InjectManifest Migration (R2-R4)

- R2. Replace `workbox: { ... }` block in `vite.config.ts` with `injectManifest: { swSrc: 'src/sw.ts', ... }`. All 5 existing `runtimeCaching` rules, `navigateFallback`, and `navigateFallbackDenylist` must be ported to Workbox API calls in `src/sw.ts`. `registerType: 'prompt'` must continue working. `beforeinstallprompt` must continue firing.
- R3. Custom `src/sw.ts` must call `skipWaiting()` on install, `clientsClaim()` on activate, and have a `message` listener for `SKIP_WAITING` (required by PWAUpdatePrompt's "Reload" button).
- R4. Add minimal `push` event listener in `src/sw.ts` that shows a generic notification with `event.waitUntil()` wrapping async operation. Parse JSON payload for title/body if available.

### Push Subscription Infrastructure (R5-R6)

- R5. Create `src/lib/pushManager.ts` exporting `subscribeToPush(registration)`, `unsubscribeFromPush(subscription)`, `getPushPermissionState()`, and `urlBase64ToUint8Array()`. Use a `Result<T, E>` pattern for error handling. Does NOT export `registerServiceWorker()`.
- R6. Create `src/hooks/usePushSubscription.ts` exposing `{ isSubscribed, subscribe, unsubscribe, permissionState }`. Uses `useRegisterSW` from `virtual:pwa-register/react`. Guards with `'serviceWorker' in navigator && 'PushManager' in window`. Handles permission denied gracefully.

### Build and Regression Verification (R7)

- R7. `npm run build` produces `dist/sw.js` containing Workbox precaching + runtime caching + push event handler. `npm run ci` passes.

## Scope Boundaries

- No UI components -- this is infrastructure/foundation work only.
- Full push notification click handlers and notification management deferred to E61-S02.
- E2E tests for service worker behavior deferred to E61-S02 (requires DevTools protocol).
- Supabase Edge Function setup for sending push notifications is out of scope.
- Notification preferences UI or subscription management UI is out of scope.

## Context & Research

### Relevant Code and Patterns

- **Current VitePWA config:** `vite.config.ts` lines 504-590 -- `workbox: {}` block with `generateSW`, 5 `runtimeCaching` rules, `navigateFallback`, `globPatterns`, `globIgnores`
- **PWAUpdatePrompt:** `src/app/components/PWAUpdatePrompt.tsx` -- uses `useRegisterSW` from `virtual:pwa-register/react` with hourly polling; only rendered in `PROD` mode (`import.meta.env.PROD`)
- **PWAInstallBanner:** `src/app/components/PWAInstallBanner.tsx` -- handles `beforeinstallprompt` event, standalone detection, iOS/Android flows; unrelated to SW strategy
- **Hook convention:** Named exports, options object pattern, JSDoc with `@since` tags, `useEffect` cleanup for event listeners and intervals
- **Lib module convention:** Named exports, JSDoc `@module` tag, no default exports
- **Error handling:** `catch` blocks must have visible user feedback (ESLint rule `error-handling/no-silent-catch`)
- **Notification permission:** `src/lib/studyReminders.ts` has `getNotificationPermission()` and `requestNotificationPermission()` -- reusable pattern
- **Existing test patterns:** `src/app/components/__tests__/PWAInstallBanner.test.tsx` -- `vi.mock()`, `vi.fn()`, `beforeEach` with `vi.restoreAllMocks()` and `localStorage.clear()`
- **Test setup:** `src/test/setup.ts` -- jsdom environment; no built-in ServiceWorker/PushManager/Notification support (must mock)
- **Type declarations:** `src/vite-env.d.ts` has `/// <reference types="vite-plugin-pwa/client" />` -- provides `self.__WB_MANIFEST` typing
- **Worker config:** `worker: { format: 'es' }` already set in `vite.config.ts` line 592
- **Env vars convention:** `VITE_` prefix for client-exposed env vars; private keys never have `VITE_` prefix
- **API URLs:** `src/lib/apiBaseUrl.ts` constructs Supabase Edge Function URLs via `VITE_API_BASE_URL`

### Institutional Learnings

- **E120 PWA Polish lessons** (`docs/solutions/e120-pwa-polish-lessons.md`): `NetworkOnly` + `cacheName` is a no-op (NetworkOnly never writes to cache). Always guard `setInterval` in `onRegisteredSW` with `clearInterval` before setting a new one (can stack on re-registration). iPadOS 13+ reports as Macintosh UA with `navigator.maxTouchPoints > 1`.
- **ServerResult pattern** exists in `src/lib/courseServerService.ts`: `{ ok: true; data: T } | { ok: false; error: string; status?: number }` -- this is the closest existing Result pattern. The `ok` field name (not `success`) is load-bearing.
- **No centralized `Result<T, E>` type** exists in the codebase. If push subscription management needs one, create a shared type rather than inlining.

### External References

- vite-plugin-pwa v1.2.0 docs: `injectManifest` strategy requires `swSrc` pointing to custom SW entry point; `swDest` defaults to the same output path as `generateSW` (`sw.js`); `self.__WB_MANIFEST` is injected at build time
- Workbox v7 API: `precacheAndRoute(manifest)`, `registerRoute(condition, handler)`, `NavigationRoute(handler, options)`, `createHandlerBoundToURL(url)`, `setDefaultHandler(handler)`, strategies from `workbox-strategies` (or `workbox-routing` re-export), plugins from `workbox-expiration` and `workbox-cacheable-response`

## Key Technical Decisions

- **injectManifest over standalone SW:** Using `injectManifest` (not a standalone `public/sw.js`) avoids SW conflict with vite-plugin-pwa's auto-registration. vite-plugin-pwa handles registration, update detection, and the `SKIP_WAITING` message protocol. The custom SW only adds Workbox routing calls and push handlers.
- **Result type in pushManager.ts:** Use `{ ok: true; data: T } | { ok: false; error: PushError }` to match the existing `ServerResult` convention in the codebase. Define `PushError` as `{ code: string; message: string }` with specific error codes for permission denied, subscription failed, unsubscribe failed, API not supported.
- **No E2E tests in this story:** SW testing requires DevTools protocol (controlling SW lifecycle, push events, notificationclick). Deferred to E61-S02.
- **SW TypeScript scope:** The SW file runs in `ServiceWorkerGlobalScope`. Import only Workbox utilities -- no React, no DOM types, no Zustand. Use `declare let self: ServiceWorkerGlobalScope`. The Vite build compiles `src/sw.ts` separately from the app bundle.
- **`useRegisterSW` called multiple times is safe:** `PWAUpdatePrompt` already uses it. The new `usePushSubscription` hook can use its own `useRegisterSW` call -- vite-plugin-pwa shares the same SW registration.

## Implementation Units

- [ ] **Unit 1: VAPID Key Generation and Environment Configuration**

**Goal:** Generate VAPID key pair and configure environment variables

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `.env`
- Modify: `.env.example`

**Approach:**
- Run `npx web-push generate-vapid-keys` to generate a public/private key pair
- Add `VITE_VAPID_PUBLIC_KEY=<public-key>` to `.env` (the actual value -- the existing `.env` has the real Supabase keys, so this is safe)
- Add `VITE_VAPID_PUBLIC_KEY=` (empty, with a comment explaining how to generate) to `.env.example`
- Document in the plan: the private key must be stored as a Supabase Edge Function secret via `supabase secrets set VAPID_PRIVATE_KEY=<private-key>`. NEVER commit the private key. The Edge Function (built in E61-S05) reads it from `Deno.env.get('VAPID_PRIVATE_KEY')`.
- Add `web-push` as a dev dependency: `npm install -D web-push`

**Test expectation:** none -- environment configuration, no behavioral code

**Verification:**
- `cat .env | grep VITE_VAPID_PUBLIC_KEY` shows a non-empty value
- `cat .env.example | grep VITE_VAPID_PUBLIC_KEY` shows the key name (empty value)
- `npm ls web-push` shows the package installed

---

- [ ] **Unit 2: Migrate VitePWA Configuration from generateSW to injectManifest**

**Goal:** Replace the `workbox: {}` block with `injectManifest: {}` in vite.config.ts

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `vite.config.ts`

**Approach:**
- Remove the `workbox: { ... }` block (lines 545-586) from the `VitePWA({ ... })` call
- Add `injectManifest: { swSrc: 'src/sw.ts', globPatterns: [...], globIgnores: [...] }` in its place
  - `globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']` -- same as current
  - `globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js']` -- same as current
- Keep `registerType: 'prompt'`, `includeAssets`, `manifest`, `devOptions` unchanged
- The `worker: { format: 'es' }` setting (line 592) already enables ES module workers -- keep as-is
- Do NOT touch `runtimeCaching`, `navigateFallback`, or `navigateFallbackDenylist` -- these move to `src/sw.ts`

**Patterns to follow:**
- Current VitePWA config structure (lines 504-590 of vite.config.ts) -- mirror the formatting

**Test expectation:** none -- configuration change only; verified by build output

**Verification:**
- `npm run build` succeeds
- `dist/sw.js` exists and is a non-empty JS file (not the Workbox-generated template)

---

- [ ] **Unit 3: Create src/sw.ts Custom Service Worker Entry Point**

**Goal:** Create the custom SW that handles Workbox precaching, 5 runtime caching rules, navigation fallback, SW lifecycle events, SKIP_WAITING message, and push event placeholder

**Requirements:** R2, R3, R4

**Dependencies:** Unit 2 (injectManifest config must reference this file)

**Files:**
- Create: `src/sw.ts`

**Approach:**
- Create `src/sw.ts` as the custom SW entry point with the following structure:

```
// TypeScript declaration for ServiceWorkerGlobalScope
declare let self: ServiceWorkerGlobalScope;

// Imports from Workbox packages (already installed via vite-plugin-pwa)
// - precacheAndRoute, createHandlerBoundToURL from workbox-precaching
// - registerRoute, NavigationRoute, setDefaultHandler from workbox-routing
// - CacheFirst, StaleWhileRevalidate, NetworkOnly from workbox-strategies
// - ExpirationPlugin from workbox-expiration
// - CacheableResponsePlugin from workbox-cacheable-response
// - clientsClaim, skipWaiting from workbox-core

// 1. Precache all assets from __WB_MANIFEST (injected at build time)
//    precacheAndRoute(self.__WB_MANIFEST);

// 2. Port 5 existing runtimeCaching rules:
//    a. Local images (/images/*.png|webp|jpg|jpeg) -- CacheFirst, 200 entries, 30 days
//    b. Unsplash images (images.unsplash.com) -- StaleWhileRevalidate, 80 entries, 30 days
//    c. HuggingFace models (huggingface.co) -- CacheFirst, 20 entries, 90 days
//    d. AI API (/api/ai/*) -- NetworkOnly
//    e. ABS proxy (/api/abs/proxy/) -- NetworkOnly

// 3. Navigation fallback: register NavigationRoute with
//    createHandlerBoundToURL('/index.html') and denylist: [/^\/api\//]

// 4. Default handler: setDefaultHandler(new NetworkOnly())

// 5. SW Lifecycle:
//    - install event: self.skipWaiting()
//    - activate event: event.waitUntil(self.clients.claim())

// 6. SKIP_WAITING message listener (required by PWAUpdatePrompt):
//    - Listen for event.data?.type === 'SKIP_WAITING', call self.skipWaiting()

// 7. Push event placeholder:
//    - Listen for 'push' event
//    - Wrap in event.waitUntil(async () => { ... })
//    - Parse JSON payload: event.data?.json() for title/body fields
//    - Fallback: title='Knowlune', body='You have a new notification'
//    - Call self.registration.showNotification(title, { body, icon: '/pwa-192x192.png' })
//    - Wrap JSON parse in try/catch -- use defaults on error/missing payload
```

**Patterns to follow:**
- The pseudo-code structure in the origin document (`docs/brainstorms/2026-07-05-e61-s01-vapid-key-setup-requirements.md`) is the precise specification for this file
- Workbox API calls follow the official Workbox v7 API (already used implicitly by generateSW)

**Execution note:** Write this file with the exact Workbox import paths used by vite-plugin-pwa's internal Workbox bundle. Use `import` from the bare package names (`workbox-precaching`, `workbox-routing`, `workbox-strategies`, etc.) -- these are already available as transitive dependencies of vite-plugin-pwa. Add `/// <reference lib="webworker" />` as the first line of `src/sw.ts` -- this is required for `tsc --noEmit` to resolve all SW-specific types (the current tsconfig only includes "ES2020", "DOM", "DOM.Iterable").

**Test expectation:** none -- SW code cannot be unit-tested in jsdom. Build verification confirms the compiled SW contains both Workbox and push code. E2E SW tests deferred to E61-S02.

**Verification:**
- `npm run build` succeeds
- `dist/sw.js` contains strings from all sections: `precacheAndRoute`, `self.__WB_MANIFEST`, `registerRoute`, `CacheFirst`, `StaleWhileRevalidate`, `skipWaiting`, `clientsClaim`, `SKIP_WAITING`, `showNotification`
- `dist/sw.js` does NOT contain React, Zustand, or DOM-specific strings

---

- [ ] **Unit 4: Create src/lib/pushManager.ts Module**

**Goal:** Create the push subscription management module with Result-type error handling

**Requirements:** R5

**Dependencies:** Unit 1 (VITE_VAPID_PUBLIC_KEY must be available)

**Files:**
- Create: `src/lib/pushManager.ts`
- Modify: `src/vite-env.d.ts` (add VITE_VAPID_PUBLIC_KEY to ImportMetaEnv)

**Approach:**

**pushManager.ts structure:**
```
// @module pushManager
// @since E61-S01

// Types:
// - PushError: { code: string; message: string }
//   Codes: 'PERMISSION_DENIED', 'SUBSCRIPTION_FAILED', 'UNSUBSCRIBE_FAILED',
//          'API_NOT_SUPPORTED', 'INVALID_VAPID_KEY'
// - PushResult<T>: { ok: true; data: T } | { ok: false; error: PushError }
// - PermissionState: 'granted' | 'denied' | 'default' | 'unsupported'

// Exports:
// 1. urlBase64ToUint8Array(base64String: string): Uint8Array
//    - Converts a URL-safe base64 VAPID public key to Uint8Array
//    - VAPID keys are base64url-encoded; need padding restoration and byte conversion
//    - Required by PushManager.subscribe({ applicationServerKey })

// 2. subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushResult<PushSubscription>>
//    - Reads VITE_VAPID_PUBLIC_KEY from import.meta.env
//    - Returns PushResult<PushSubscription>
//      - ok=false with code 'API_NOT_SUPPORTED' if PushManager not available
//      - ok=false with code 'PERMISSION_DENIED' if Notification.permission === 'denied'
//      - Calls registration.pushManager.subscribe({
//          userVisibleOnly: true,
//          applicationServerKey: urlBase64ToUint8Array(vapidKey)
//        })
//      - ok=false with code 'SUBSCRIPTION_FAILED' on error

// 3. unsubscribeFromPush(subscription: PushSubscription): Promise<PushResult<void>>
//    - Calls subscription.unsubscribe()
//    - ok=false with code 'UNSUBSCRIBE_FAILED' on error

// 4. getPushPermissionState(): PermissionState
//    - Returns 'unsupported' if PushManager or Notification API not available
//    - Returns Notification.permission directly otherwise
```

**vite-env.d.ts changes:**
- Add `readonly VITE_VAPID_PUBLIC_KEY?: string` to `ImportMetaEnv` interface

**Patterns to follow:**
- ServerResult pattern: `{ ok: true; data: T } | { ok: false; error: string }` from `src/lib/courseServerService.ts`
- Named exports, JSDoc `@module` tag, no default exports (lib module conventions)
- `catch` blocks must not be silent -- re-throw or return error result (ESLint rule)

**Test scenarios:**
- **Happy path:**
  - `urlBase64ToUint8Array` with a known valid VAPID public key returns correct Uint8Array
  - `getPushPermissionState` returns `'granted'` when Notification.permission is 'granted'
  - `subscribeToPush` with a valid registration and permission returns `{ ok: true, data: subscription }`
  - `unsubscribeFromPush` with a valid subscription returns `{ ok: true, data: undefined }`
- **Edge cases:**
  - `urlBase64ToUint8Array` with empty string returns empty Uint8Array
  - `urlBase64ToUint8Array` with padding characters handles them correctly (base64url vs base64)
  - `getPushPermissionState` returns `'unsupported'` when Notification API is missing (mock `typeof Notification === 'undefined'`)
  - `getPushPermissionState` returns `'unsupported'` when PushManager is missing from window
  - `subscribeToPush` returns error when VITE_VAPID_PUBLIC_KEY is not set
- **Error and failure paths:**
  - `subscribeToPush` with `Notification.permission === 'denied'` returns `{ ok: false, error: { code: 'PERMISSION_DENIED' } }`
  - `subscribeToPush` when `registration.pushManager.subscribe` throws returns error result
  - `unsubscribeFromPush` when `subscription.unsubscribe` throws returns error result

**Verification:**
- Unit tests pass for all test scenarios above
- `npx tsc --noEmit` passes (type checks including new `ImportMetaEnv` extension)

---

- [ ] **Unit 5: Create src/hooks/usePushSubscription.ts**

**Goal:** Create the React hook that exposes push subscription state and actions, using `useRegisterSW` from vite-plugin-pwa

**Requirements:** R6

**Dependencies:** Unit 4 (pushManager.ts module)

**Files:**
- Create: `src/hooks/usePushSubscription.ts`

**Approach:**
```
// @since E61-S01

// Hook shape:
// export function usePushSubscription(): {
//   isSubscribed: boolean
//   subscribe: () => Promise<void>
//   unsubscribe: () => Promise<void>
//   permissionState: 'granted' | 'denied' | 'default' | 'unsupported'
// }

// Internal state:
// - isSubscribed: boolean, initially false
// - permissionState: from getPushPermissionState(), re-checked after subscribe/unsubscribe
// - subscription: PushSubscription | null, tracked locally

// Implementation:
// 1. Import useRegisterSW from 'virtual:pwa-register/react'
// 2. Call useRegisterSW(), passing onRegisteredSW as an OPTION callback (not a return value).
//    useRegisterSW returns { needRefresh, offlineReady, updateServiceWorker }.
//    The ServiceWorkerRegistration is captured via:
//      useRegisterSW({
//        onRegisteredSW(_swUrl, registration) { /* capture registration here */ }
//      })
//    See PWAUpdatePrompt.tsx for the correct usage pattern.
// 3. Guard all PushManager calls with 'serviceWorker' in navigator && 'PushManager' in window
// 4. subscribe(): calls subscribeToPush(registration), updates isSubscribed on success, shows toast on error
// 5. unsubscribe(): calls unsubscribeFromPush(subscription), updates isSubscribed, shows toast on error
// 6. On mount, check if there's an existing subscription via registration.pushManager.getSubscription()
```

**Patterns to follow:**
- Hook conventions from existing hooks (`src/hooks/useColorScheme.ts`): `useState`, `useEffect`, named export, JSDoc `@since` tag
- `PWAUpdatePrompt.tsx` pattern for `useRegisterSW` usage
- Error handling: show `toast.error()` on failures (ESLint rule compliance)

**Test scenarios:**
- **Happy path:**
  - Hook returns correct initial state when ServiceWorker and PushManager are available
  - `subscribe` calls `subscribeToPush` and updates `isSubscribed` to true on success
  - `unsubscribe` calls `unsubscribeFromPush` and updates `isSubscribed` to false on success
- **Edge cases:**
  - Hook returns `permissionState: 'unsupported'` when ServiceWorker or PushManager not available
  - Hook initializes `isSubscribed: false` when no existing subscription found
- **Error paths:**
  - `subscribe` shows `toast.error()` when `subscribeToPush` returns error
  - `unsubscribe` shows `toast.error()` when `unsubscribeFromPush` returns error
  - Permission denied state is handled gracefully (no throw, appropriate state)

**Verification:**
- Unit tests pass for all test scenarios (with mocked useRegisterSW, PushManager, ServiceWorkerRegistration)
- `npx tsc --noEmit` passes

---

- [ ] **Unit 6: Unit Tests for pushManager.ts and usePushSubscription.ts**

**Goal:** Comprehensive unit tests for the push subscription infrastructure

**Requirements:** R5, R6, R7

**Dependencies:** Units 4 and 5 must exist

**Files:**
- Create: `src/lib/__tests__/pushManager.test.ts`
- Create: `src/hooks/__tests__/usePushSubscription.test.ts`

**Approach:**

**pushManager.test.ts:**
- Mock `import.meta.env.VITE_VAPID_PUBLIC_KEY` (vi.stubEnv or vi.mock for the module)
- Mock `Notification` API: `globalThis.Notification` with `permission` property
- Mock `PushManager`, `PushSubscription`, `ServiceWorkerRegistration`
- Test each function with its scenarios (see Unit 4 test scenarios)

**usePushSubscription.test.ts:**
- Mock `virtual:pwa-register/react` module: `vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: ... }))`
- Mock `pushManager.ts` functions via `vi.mock('@/lib/pushManager')`
- Mock ServiceWorker/PushManager availability in global scope
- Render hook via `renderHook` from `@testing-library/react`
- Test each scenario (see Unit 5 test scenarios)

**Patterns to follow:**
- Existing test pattern: `src/app/components/__tests__/PWAInstallBanner.test.tsx` -- `vi.fn()`, `beforeEach` with `vi.restoreAllMocks()`, `afterEach` cleanup
- Test setup: `src/test/setup.ts` -- use existing global mocks pattern for ServiceWorker APIs
- `@testing-library/react` `renderHook` for hook tests (see existing hook tests like `src/hooks/__tests__/usePomodoroTimer.test.ts`)

**Test scenarios:**
Cover all scenarios enumerated in Units 4 and 5 above, plus:
- PushManager test: `urlBase64ToUint8Array` with known VAPID key produces deterministic output
- PushManager test: `getPushPermissionState` returns `'default'` when `Notification.permission` is `'default'`
- Hook test: Component unmount cleans up without errors
- Hook test: Multiple calls to `usePushSubscription` in the same app don't conflict

**Verification:**
- `npm run test:unit` passes (all tests green)
- Coverage for `pushManager.ts` >= 90% (target, not a hard gate)

---

- [ ] **Unit 7: Build Verification and Regression Check**

**Goal:** Verify the build produces a correct SW file and all existing tests/lint/type checks pass

**Requirements:** R7

**Dependencies:** Units 1-6

**Files:**
- No file changes -- verification only

**Approach:**
- Run `npm run build` and verify `dist/sw.js` exists and contains expected content
- Verify `dist/sw.js` includes:
  - `precacheAndRoute` call with injected manifest
  - All 5 runtime caching rules (registerRoute calls)
  - NavigationRoute with `/index.html` fallback and `/api/` denylist
  - `skipWaiting` and `clientsClaim` calls
  - `SKIP_WAITING` message listener
  - `push` event listener with `showNotification`
- Run `npm run ci` (typecheck + lint + format:check + build + test:unit)
- All existing tests must pass (no regressions)
- Manual verification: `npm run preview`, open DevTools > Application > Service Workers -- SW is active
- Manual verification: trigger update prompt -- PWAUpdatePrompt still works
- Manual verification: install prompt -- PWAInstallBanner still works (Chromium)

**Test expectation:** none -- verification only; no new code

**Verification:**
- `npm run build` exits 0
- `grep -c "precacheAndRoute" dist/sw.js` >= 1
- `grep -c "registerRoute" dist/sw.js` >= 5 (5 runtime rules + 1 navigation route = 6 total)
- `grep -c "showNotification" dist/sw.js` >= 1
- `npm run ci` exits 0
- DevTools confirms SW is active and no console errors

## System-Wide Impact

- **Interaction graph:** `src/sw.ts` interacts with vite-plugin-pwa's registration lifecycle. The `message` listener for `SKIP_WAITING` must match what `PWAUpdatePrompt`'s `updateServiceWorker(true)` dispatches. If the protocol differs, the "Reload" button stops working.
- **Error propagation:** Push subscription errors in `pushManager.ts` surface as error `Result` types (not thrown exceptions). The hook layer converts them to toast notifications. No crash propagation.
- **State lifecycle risks:** `useRegisterSW` is safe to call multiple times (already called by `PWAUpdatePrompt`). The new hook's `useRegisterSW` call shares the same registration. No duplicate registration issues.
- **API surface parity:** No public API changes. The internal `pushManager.ts` and `usePushSubscription.ts` are new modules used by future UI components (E61-S03+).
- **Unchanged invariants:** `PWAUpdatePrompt.tsx`, `PWAInstallBanner.tsx`, `App.tsx`, `public/_headers` remain untouched. The `beforeinstallprompt` and SKIP_WAITING protocols are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| injectManifest produces different output than generateSW, breaking existing caching behavior | Verify `dist/sw.js` contains all 5 runtime caching rules and the navigation fallback with identical parameters. Manual verification of SW in DevTools. |
| Workbox package imports not resolvable from src/sw.ts (transitive dependency only) | vite-plugin-pwa bundles Workbox internally. If `import from 'workbox-precaching'` fails, use explicit relative node_modules path or verify plugin re-exports. Since vite-plugin-pwa uses these internally, they should be available. |
| TypeScript errors in src/sw.ts due to missing WebWorker lib or ServiceWorkerGlobalScope types | Required: add `/// <reference lib="webworker" />` as the first line of `src/sw.ts`. Also add `declare let self: ServiceWorkerGlobalScope`. Without the WebWorker reference lib, `tsc --noEmit` will fail on all SW-specific types (`self.__WB_MANIFEST`, `self.registration.showNotification`, `self.clients.claim()`). |
| `web-push` not available on npm (already listed by class name in requirements) | Install as dev dependency. The package is stable and actively maintained. |

## Documentation / Operational Notes

- **VAPID public key setup:** Documented above in Unit 1. The generated keys are stored:
  - Public: `.env` as `VITE_VAPID_PUBLIC_KEY` (committed, exposed to client)
  - Private: Supabase Edge Function secret via `supabase secrets set VAPID_PRIVATE_KEY=<key>` (never committed)
- **Edge Function integration:** The private key is consumed by the E61-S05 Edge Function via `Deno.env.get('VAPID_PRIVATE_KEY')`. Document this contract so the Edge Function developer knows the env var name.
- **No deployment changes:** The build output's SW file path remains `dist/sw.js`. Existing `_headers` entries for `/sw.js` continue to work.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-07-05-e61-s01-vapid-key-setup-requirements.md`
- **Story file:** `docs/implementation-artifacts/stories/E61-S01-vapid-key-setup-and-service-worker-registration.md`
- **Related stories:** `docs/implementation-artifacts/stories/E61-S02-service-worker-push-and-click-handlers.md` (deferred push handlers)
- **Institutional learnings:** `docs/solutions/e120-pwa-polish-lessons.md`
- **Existing tests:** `src/app/components/__tests__/PWAInstallBanner.test.tsx`
- **Existing Result pattern:** `src/lib/courseServerService.ts` (ServerResult type)
