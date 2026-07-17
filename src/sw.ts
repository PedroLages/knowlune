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

// ─── Navigation fallback ─────────────────────────────────────────────────

const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// ─── Default handler ─────────────────────────────────────────────────────

setDefaultHandler(new NetworkOnly())

// ─── SW Lifecycle ────────────────────────────────────────────────────────
// skipWaiting intentionally omitted from install event. registerType:'prompt'
// keeps the new worker waiting until the user accepts the update through
// PWAUpdatePrompt. The listener below applies that explicit choice.

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().catch(err => {
      // silent-catch-ok
      console.warn('[SW] clients.claim() failed:', err)
    })
  )
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
    if (parsed.protocol === 'https:' && parsed.origin === self.location.origin) {
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
          const safePayload: NotificationOptions = {}
          if (typeof payload.body === 'string') safePayload.body = payload.body
          if (typeof payload.icon === 'string') safePayload.icon = payload.icon
          if (typeof payload.badge === 'string') safePayload.badge = payload.badge
          if (typeof payload.tag === 'string') safePayload.tag = payload.tag
          if (typeof payload.lang === 'string') safePayload.lang = payload.lang
          if (payload.dir === 'auto' || payload.dir === 'ltr' || payload.dir === 'rtl') {
            safePayload.dir = payload.dir
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
          console.error('[SW] Push subscription POST failed:', response.status, response.statusText)
        }
      } catch (error) {
        // Intentional: log but don't throw — subscription loss is recoverable
        // on next app visit via usePushSubscription hook
        console.error('[SW] Push subscription change failed:', error)
      }
    })()
  )
})
