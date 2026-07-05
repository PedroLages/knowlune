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

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing'
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

// f. Route chunks: StaleWhileRevalidate, 50 entries, 30 days
// Any JS chunk not in the precache manifest (route-specific chunks, optional
// libraries like tiptap/chart/pdf) is cached on first access. Precached files
// are served by the precache handler registered first, so this rule only
// catches non-precached JS.
// E64-S09: Added to support precache size reduction — precache only contains
// critical app shell; everything else is cached at runtime.
registerRoute(
  /^\/assets\/.+\.js$/i,
  new StaleWhileRevalidate({
    cacheName: 'route-chunks',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// ─── Navigation fallback ─────────────────────────────────────────────────

const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// ─── Default handler ─────────────────────────────────────────────────────

setDefaultHandler(new NetworkOnly())

// ─── SW Lifecycle ────────────────────────────────────────────────────────
// skipWaiting intentionally omitted from install event — registerType:'autoUpdate'
// means vite-plugin-pwa calls skipWaiting() automatically after a new SW
// takes over. The SKIP_WAITING message listener below is retained for
// backward-compatible manual updates via the message protocol.

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim().catch(err => { // silent-catch-ok
    console.warn('[SW] clients.claim() failed:', err)
  }))
})

// ─── SKIP_WAITING message listener ───────────────────────────────────────
// Required by PWAUpdatePrompt's "Reload" button

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    skipWaiting()
  }
})

// ─── Push event placeholder ──────────────────────────────────────────────

self.addEventListener('push', event => {
  let title = 'Knowlune'
  let body = 'You have a new notification'

  if (event.data) {
    try {
      const payload = event.data.json()
      if (typeof payload !== 'object' || payload === null) {
        console.warn('[SW] Push payload is not an object')
      } else {
        if (typeof payload.title === 'string' && payload.title.length > 0) {
          title = payload.title.slice(0, 200)
        }
        if (typeof payload.body === 'string' && payload.body.length > 0) {
          body = payload.body.slice(0, 500)
        }
      }
    } catch (err) {
      console.warn('[SW] Invalid push payload:', err) // silent-catch-ok
    }
  }

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch(err => { // silent-catch-ok
      console.warn('[SW] Failed to show notification:', err)
    })
  )
})
