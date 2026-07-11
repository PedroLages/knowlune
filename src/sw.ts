/// <reference lib="webworker" />

/**
 * Custom service worker entry point for injectManifest strategy (E61-S01).
 *
 * vite-plugin-pwa handles SW registration, update detection, and the
 * SKIP_WAITING message protocol. This file only adds Workbox routing calls
 * and push event handling.
 *
 * @module sw
 * @since E61-S01
 */

declare let self: ServiceWorkerGlobalScope

import { precacheAndRoute, matchPrecache } from 'workbox-precaching'
import {
  registerRoute,
  NavigationRoute,
  setDefaultHandler,
  setCatchHandler,
} from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { skipWaiting } from 'workbox-core'

// ─── Precache ────────────────────────────────────────────────────────────

precacheAndRoute(self.__WB_MANIFEST)

// ─── Runtime caching rules ───────────────────────────────────────────────

// a. Local images: CacheFirst, 200 entries, 30 days
registerRoute(
  /^\/images\/.+\.(png|webp|jpg|jpeg)$/i,
  new CacheFirst({
    cacheName: 'local-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
)

// b. Unsplash images: StaleWhileRevalidate, 80 entries, 30 days
registerRoute(
  /^https:\/\/images\.unsplash\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'unsplash-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// c. HuggingFace models: StaleWhileRevalidate, 20 entries, 90 days
// Switched from CacheFirst because HuggingFace may not send CORS headers
// for all responses, which causes CacheableResponsePlugin to drop them.
// StaleWhileRevalidate serves cached content even when the network fetch
// fails.
registerRoute(
  /^https:\/\/huggingface\.co\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'hf-models',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// d. AI API: NetworkOnly
registerRoute(/^\/api\/ai\/.*/i, new NetworkOnly())

// e. ABS proxy: NetworkOnly
registerRoute(/\/api\/abs\/proxy\//, new NetworkOnly())

// f. Hashed route chunks: CacheFirst, 500 entries, 30 days
// Content-hashed filenames are immutable (new build → new hashes), so
// CacheFirst is safe. This cache acts as transitional protection for
// tabs running an older application bundle — after a SW update, old
// tabs may still reference chunks from the previous deployment. Those
// chunks remain in this cache (up to 30 days) even if they're no
// longer in the precache manifest.
//
// Uses a dedicated cache name (knowlune-route-chunks) separate from the
// precache so it survives across SW updates.
registerRoute(
  /^\/assets\/.+\.(?:js|css|woff2?)$/i,
  new CacheFirst({
    cacheName: 'knowlune-route-chunks',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  })
)

// g. Workers: CacheFirst, 50 entries, 30 days
// Web workers and service worker helpers are also content-hashed.
registerRoute(
  /\.worker\.js$/i,
  new CacheFirst({
    cacheName: 'knowlune-route-chunks',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  })
)

// ─── Navigation fallback ─────────────────────────────────────────────────
//
// Network-first for HTML navigation requests.  The old App Shell pattern
// (createHandlerBoundToURL('/index.html')) serves the precached index.html on
// every navigation — after a new deployment the precached index.html still
// references stale chunk filenames and causes "Failed to fetch dynamically
// imported module" errors for every React.lazy() page.
//
// NetworkFirst ensures the browser always fetches the current index.html from
// the server, so chunk references match the deployed assets.  The catch-
// handler falls back to the precached index.html when the user is offline.

const navigationRoute = new NavigationRoute(
  async ({ request }) => {
    try {
      // Try the network first — fetch fresh HTML with current chunk references
      const response = await fetch(request)
      if (response.ok) return response
    } catch {
      // Network unavailable — handled by setCatchHandler below
    }
    // Fallback: explicit throw so setCatchHandler takes over
    throw new Error('Network unavailable — attempting offline fallback')
  },
  { denylist: [/^\/api\//] }
)
registerRoute(navigationRoute)

// Offline fallback for navigation requests — serve the precached index.html
// so the SPA shell still loads when the user has no connection.
setCatchHandler(async ({ request }) => {
  // Only handle navigation (document) requests; let other failed requests
  // fall through to the default (NetworkOnly).
  if (request.mode === 'navigate') {
    const precached = await matchPrecache('/index.html')
    if (precached) return precached
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return Response.error()
})

// ─── Default handler ─────────────────────────────────────────────────────

setDefaultHandler(new NetworkOnly())

// ─── SW Lifecycle ────────────────────────────────────────────────────────
//
// registerType: 'prompt' means the browser detects new SW versions but does
// NOT auto-activate them. The old SW continues controlling existing tabs.
// The PWAUpdatePrompt component shows a "New version available" banner;
// the user accepts → skipWaiting() is called via message → page reloads →
// the new SW activates for the fresh page.
//
// We deliberately do NOT call clients.claim() here — claim() would make the
// new SW take control of tabs that are running an OLD application bundle
// (loaded by the old SW). Those old tabs reference old chunk filenames that
// the new SW's precache may not contain, causing "Failed to fetch dynamically
// imported module" errors.
//
// The SKIP_WAITING message listener below is driven by PWAUpdatePrompt's
// "Reload" button and is the ONLY path to activate a waiting SW.

// ─── SW diagnostics ──────────────────────────────────────────────────────

const BUILD_VERSION = '__BUILD_VERSION__'

self.addEventListener('install', () => {
  if (BUILD_VERSION && !BUILD_VERSION.startsWith('__')) {
    console.log(`[SW] Install — build ${BUILD_VERSION}`)
  } else {
    console.log('[SW] Install')
  }
})

self.addEventListener('activate', event => {
  if (BUILD_VERSION && !BUILD_VERSION.startsWith('__')) {
    console.log(`[SW] Activate — build ${BUILD_VERSION}`)
  } else {
    console.log('[SW] Activate')
  }

  // Clean up old precache revisions (Workbox default behavior).
  // We intentionally omit clients.claim() — see lifecycle comment above.
  event.waitUntil(
    (async () => {
      // Workbox automatically cleans outdated precache entries during activate.
      // No additional cleanup needed.
    })()
  )
})

// ─── Controller change detection ─────────────────────────────────────────
// Log when a new SW takes control (useful for debugging deployment mismatches)

self.addEventListener('controllerchange', () => {
  console.log('[SW] Controller changed — new SW took over')
})

// ─── SKIP_WAITING message listener ───────────────────────────────────────
// Required by PWAUpdatePrompt's "Reload" button

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    skipWaiting()
  }
})

// ─── URL validation helper ────────────────────────────────────────────────
// Validates that a URL from a push payload is safe to navigate to.
// Only allows relative paths (starting with /) and same-origin https URLs.
// javascript:, data:, and cross-origin URLs are rejected.

function validateNavigationUrl(url: string): string | null {
  try {
    // Relative paths are safe — they stay within the app
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url
    }
    // Absolute URLs must be same-origin https
    const parsed = new URL(url)
    if (
      parsed.protocol === 'https:' &&
      parsed.origin === self.location.origin
    ) {
      return url
    }
    console.warn('[SW] Blocked unsafe navigation URL:', url)
    return null
  } catch {
    // Invalid URL — treat as relative path
    if (url.startsWith('/')) return url
    console.warn('[SW] Blocked malformed navigation URL:', url)
    return null
  }
}

// ─── Push event handler ──────────────────────────────────────────────────
// Handles incoming push messages. Every push MUST show a notification —
// browsers may revoke push permission if no notification is displayed.
// Tag field enables deduplication (same tag replaces existing notification).
// url is stored in data for use by the notificationclick handler.
//
// Payload fields are whitelisted to prevent a malicious push server from
// injecting arbitrary NotificationOptions (actions, requireInteraction,
// renotify, silent). Only safe display-related fields pass through.

self.addEventListener('push', event => {
  event.waitUntil(
    (async () => {
      const defaults = {
        title: 'Knowlune',
        body: 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
      }

      let title = defaults.title
      let notificationOptions: NotificationOptions & { data?: { url?: string } } = {
        body: defaults.body,
        icon: defaults.icon,
        badge: defaults.badge,
      }

      try {
        if (event.data) {
          const payload = event.data.json()
          if (typeof payload.title === 'string' && payload.title.length > 0) {
            title = payload.title
          }

          // Whitelist: only safe display fields pass through from the payload.
          // Reject actions, requireInteraction, renotify, silent, and other
          // fields that a malicious push server could abuse.
          // Cast via unknown — the WebWorker lib types are missing 'image',
          // 'vibrate', and 'timestamp' from NotificationOptions, but all
          // three are valid per the Notifications API spec.
          const ALLOWED_PAYLOAD_FIELDS = [
            'body', 'icon', 'badge', 'tag', 'image',
            'vibrate', 'dir', 'lang', 'timestamp',
          ] as unknown as (keyof NotificationOptions)[]

          const safePayload: Record<string, unknown> = {}
          for (const field of ALLOWED_PAYLOAD_FIELDS) {
            if (field in payload) {
              safePayload[field] = payload[field]
            }
          }

          // Validate and sanitize the navigation URL
          const rawUrl = typeof payload.url === 'string' ? payload.url : '/'
          const safeUrl = validateNavigationUrl(rawUrl) || '/'

          notificationOptions = {
            ...notificationOptions,
            ...safePayload,
            data: { url: safeUrl },
          }
        }
      } catch {
        // Invalid/missing payload — use defaults (already set above)
      }

      await self.registration.showNotification(title, notificationOptions)
    })()
  )
})

// ─── Notification click handler ──────────────────────────────────────────
// Closes the notification, then focuses an existing Knowlune tab (navigating
// to the payload URL if it differs) or opens a new tab. client.navigate() is
// Chromium-only — postMessage fallback for Firefox/Safari.

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/'
  const url = validateNavigationUrl(rawUrl) || '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Try to focus an existing Knowlune tab
      for (const client of windowClients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          // Navigate if URL differs from current tab
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

      // No existing tab — open new one (allowed because notificationclick is a user gesture)
      if (self.clients.openWindow) {
        await self.clients.openWindow(url)
      }
    })()
  )
})

// ─── Push subscription change handler ────────────────────────────────────
// When the browser renews the push subscription, re-subscribe with the same
// VAPID key and POST the new subscription to the backend. Failures are logged
// but not thrown — subscription loss is recoverable on next app visit via
// the usePushSubscription hook.

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    (async () => {
      try {
        if (!event.oldSubscription) {
          console.warn('[SW] pushsubscriptionchange: no old subscription to renew')
          return
        }

        const newSubscription = await self.registration.pushManager.subscribe(
          event.oldSubscription.options
        )

        // Send new subscription to backend
        const response = await fetch('/api/push/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription.toJSON()),
        })
        if (!response.ok) {
          console.error(
            '[SW] Push subscription POST failed:',
            response.status,
            response.statusText
          )
        }
      } catch (error) {
        // Intentional: log but don't throw — subscription loss is recoverable
        // on next app visit via usePushSubscription hook
        console.error('[SW] Push subscription change failed:', error)
      }
    })()
  )
})
