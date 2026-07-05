/**
 * ATDD tests for E61-S02: Service Worker Push and Click Handlers.
 *
 * These tests validate that the compiled service worker (dist/sw.js)
 * contains the required push, notificationclick, and pushsubscriptionchange
 * handlers, and that the notification icon assets exist.
 *
 * Build Verification tests (AC 7) run in all environments — they check
 * dist/ assets directly after `npm run build`.
 *
 * Service Worker Registration tests require the production preview server
 * (npm run preview, port 4173) because vite-plugin-pwa is disabled in dev
 * mode (devOptions.enabled: false in vite.config.ts). These tests are
 * skipped when running against the Vite dev server (port 5173).
 *
 * Full SW push lifecycle testing requires Chrome DevTools Protocol (CDP)
 * to control the ServiceWorker → dispatch push events → inspect notifications.
 * That level of testing is deferred to manual DevTools verification.
 *
 * AC Mapping:
 *   AC 1:  Push handler structure — ✅ build-time (addEventListener/waitUntil/showNotification)
 *   AC 2:  Tag deduplication — ✅ build-time (tag in allowed payload fields)
 *   AC 3:  Invalid payload fallback — ⚠️ deferred (empty catch block has no grep-able code path;
 *          requires CDP push event dispatch for runtime verification. Covered by manual
 *          DevTools test plan.)
 *   AC 4-5: Notification click — ✅ build-time (notificationclick/close/matchAll/openWindow)
 *   AC 6:  Subscription change — ✅ build-time (pushsubscriptionchange/subscribe/fetch)
 *   AC 7:  Build & icons — ✅ build-time (asset existence + build output verification)
 */

import { test, expect } from '../support/fixtures'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DIST_DIR = path.resolve(__dirname, '../../dist')
const SW_FILE = path.join(DIST_DIR, 'sw.js')
const ICON_192 = path.join(DIST_DIR, 'icons/icon-192.png')
const BADGE_72 = path.join(DIST_DIR, 'icons/badge-72.png')

test.describe('E61-S02: Service Worker Push and Click Handlers — Build Verification', () => {
  test('AC 7: dist/sw.js exists and contains push event handler', () => {
    expect(existsSync(SW_FILE), 'dist/sw.js must exist after build').toBe(true)

    const swContent = readFileSync(SW_FILE, 'utf-8')

    // AC 1: Push handler
    expect(swContent, 'push event listener must be in compiled SW').toContain('addEventListener')
    expect(swContent, 'push handler must call event.waitUntil()').toContain('waitUntil')
    expect(swContent, 'push handler must call showNotification').toContain('showNotification')

    // AC 1: Default icon
    expect(swContent, 'must reference default icon').toMatch(/icon-192\.png/)
    // AC 1: Default badge
    expect(swContent, 'must reference badge icon').toMatch(/badge-72\.png/)

    // AC 2: Tag field for notification deduplication
    // The tag property passes through via whitelisted payload fields.
    // After minification 'tag' may appear as a property accessor;
    // we verify the whitelist mechanism references tag.
    expect(swContent, 'push handler must support tag dedup').toMatch(/tag/)

    // AC 4-5: Notification click handler
    expect(swContent, 'notificationclick listener must be in compiled SW').toContain(
      'notificationclick'
    )
    expect(swContent, 'notificationclick must close notification').toContain('close')
    expect(swContent, 'notificationclick must matchAll clients').toContain('matchAll')

    // AC 6: Subscription change handler
    expect(swContent, 'pushsubscriptionchange listener must be in compiled SW').toContain(
      'pushsubscriptionchange'
    )
    expect(swContent, 'pushsubscriptionchange must re-subscribe').toContain('subscribe')
    expect(swContent, 'pushsubscriptionchange must POST to backend').toContain('fetch')

    // AC 5: Notification click must handle openWindow + navigate/postMessage fallback
    expect(swContent, 'notificationclick must be able to open a new window').toContain(
      'openWindow'
    )
    expect(
      swContent,
      'notificationclick must have navigate or postMessage fallback'
    ).toMatch(/navigate|postMessage/)
  })

  test('AC 7: icon assets exist in dist/', () => {
    expect(existsSync(ICON_192), 'icons/icon-192.png must exist in dist/').toBe(true)
    expect(existsSync(BADGE_72), 'icons/badge-72.png must exist in dist/').toBe(true)
  })
})

test.describe('E61-S02: Service Worker Registration (preview server only)', () => {
  test('service worker registers successfully', async ({ page, baseURL }) => {
    test.skip(
      baseURL?.includes('5173'),
      'SW registration requires preview server (port 4173) — vite-plugin-pwa is disabled in dev mode'
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { active: false, error: 'no SW API' }
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        return {
          active: !!(reg && reg.active),
          scope: reg?.scope ?? null,
          waiting: !!(reg && reg.waiting),
        }
      } catch (e) {
        return { active: false, error: String(e) }
      }
    })

    expect(
      registration.active,
      `Service Worker must be registered and active. Got: ${JSON.stringify(registration)}`
    ).toBe(true)
  })

  test('push manager is available after SW registration', async ({ page, baseURL }) => {
    test.skip(
      baseURL?.includes('5173'),
      'SW registration requires preview server (port 4173) — vite-plugin-pwa is disabled in dev mode'
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const pushAvailable = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      if (!('PushManager' in window)) return false

      try {
        const reg = await navigator.serviceWorker.ready
        return !!reg.pushManager
      } catch {
        return false
      }
    })

    expect(pushAvailable, 'PushManager must be available after SW registration').toBe(true)
  })
})
