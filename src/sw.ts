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

// c. HuggingFace models: CacheFirst, 20 entries, 90 days
registerRoute(
  /^https:\/\/huggingface\.co\/.*/i,
  new CacheFirst({
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

// ─── Navigation fallback ─────────────────────────────────────────────────

const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// ─── Default handler ─────────────────────────────────────────────────────

setDefaultHandler(new NetworkOnly())

// ─── SW Lifecycle ────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
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
      if (typeof payload.title === 'string' && payload.title.length > 0) {
        title = payload.title
      }
      if (typeof payload.body === 'string' && payload.body.length > 0) {
        body = payload.body
      }
    } catch {
      // Invalid JSON payload — use defaults
    }
  }

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})
