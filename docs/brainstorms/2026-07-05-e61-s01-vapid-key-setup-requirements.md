# Requirements Brief: E61-S01 — InjectManifest Migration and Push Foundation

**Date:** 2026-07-05
**Source:** `docs/implementation-artifacts/stories/E61-S01-vapid-key-setup-and-service-worker-registration.md`

## What We're Building

Migrate the VitePWA configuration from `generateSW` to `injectManifest` strategy, creating a custom `src/sw.ts` service worker entry point that preserves existing PWA features (update prompts, install banners, precaching) while adding a push event placeholder and support modules. Additionally, generate and configure VAPID keys for future push notification use.

## Why (Context)

The original story predated E120 (PWA Polish), which shipped `PWAUpdatePrompt`, `PWAInstallBanner`, and a full Workbox `generateSW` config with precaching and 5 runtime caching rules. A standalone `public/sw.js` would conflict with the existing Workbox-managed SW. The `injectManifest` strategy lets us maintain a single SW that handles both Workbox precaching/routing and custom push handlers without breaking existing PWA functionality.

## Key Acceptance Criteria

1. **VAPID Keys:** Generate public/private key pair via `npx web-push generate-vapid-keys`. Store public key as `VITE_VAPID_PUBLIC_KEY` in `.env` and `.env.example`. Document private key for Supabase Edge Function secret storage (never committed).

2. **InjectManifest Migration:** Replace the `workbox: { ... }` block in `vite.config.ts` with `injectManifest: { swSrc: 'src/sw.ts', globPatterns, globIgnores }`. All 5 existing `runtimeCaching` rules, `navigateFallback`, and `navigateFallbackDenylist` must be ported to Workbox API calls in `src/sw.ts`. `registerType: 'prompt'` must continue working (PWAUpdatePrompt). `beforeinstallprompt` must continue firing (PWAInstallBanner).

3. **SW Lifecycle:** Custom `src/sw.ts` must call `skipWaiting()` on install and `clientsClaim()` on activate so the new SW activates immediately and controls all pages. A `message` listener for `SKIP_WAITING` must be present (required by PWAUpdatePrompt's "Reload" button).

4. **Push Placeholder:** Add a minimal `push` event listener in `src/sw.ts` that shows a generic notification ("Knowlune" / "You have a new notification") with `event.waitUntil()` wrapping the async operation. Parse JSON payload for title/body if available.

5. **Push Manager Module** (`src/lib/pushManager.ts`): Exports `subscribeToPush(registration)`, `unsubscribeFromPush(subscription)`, `getPushPermissionState()`, and `urlBase64ToUint8Array()`. Does NOT export `registerServiceWorker()` (handled by vite-plugin-pwa). Use a `Result<T, E>` pattern for error handling.

6. **Push Subscription Hook** (`src/hooks/usePushSubscription.ts`): Exposes `{ isSubscribed, subscribe, unsubscribe, permissionState }`. Uses `useRegisterSW` from `virtual:pwa-register/react` to get the SW registration. Guards with `'serviceWorker' in navigator && 'PushManager' in window`. Handles permission denied gracefully.

7. **Build Verification:** `npm run build` produces `dist/sw.js` containing Workbox precaching + runtime caching + push event handler. `npm run ci` passes (typecheck + lint + format:check + build + test:unit).

## Constraints and Dependencies

- **Dependencies:** `web-push` (dev dependency, key generation only). Workbox packages (`workbox-precaching`, `workbox-routing`, `workbox-expiration`, `workbox-cacheable-response`, `workbox-core`) already installed via vite-plugin-pwa (v7.4.0). No new runtime dependencies.
- **TypeScript in SW:** SW runs in `ServiceWorkerGlobalScope`. Import only Workbox utilities — no React, no DOM types, no Zustand. Use `declare let self: ServiceWorkerGlobalScope`.
- **Existing files unchanged:** `PWAUpdatePrompt.tsx`, `PWAInstallBanner.tsx`, `App.tsx`, `public/_headers` must remain untouched.
- **VAPID private key:** NEVER in client code. Must be stored as Supabase Edge Function secret. Public key is safe in `.env` as `VITE_VAPID_PUBLIC_KEY`.
- **`useRegisterSW` is safe to call multiple times:** `PWAUpdatePrompt` already uses it. The new `usePushSubscription` hook can use its own `useRegisterSW` call — vite-plugin-pwa shares the same registration.
- **No E2E tests** for SW behavior in this story (requires DevTools protocol — deferred to E61-S02).

## Out of Scope

- Full push notification click handlers and notification management (deferred to E61-S02).
- E2E tests for service worker behavior (deferred to E61-S02 — requires DevTools protocol).
- Any UI components — this is infrastructure/foundation work only.
- Supabase Edge Function setup for sending push notifications.
- Notification preferences UI or subscription management UI.
