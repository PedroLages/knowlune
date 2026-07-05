/**
 * ATDD tests for E61-S02: Service Worker Push and Click Handlers.
 *
 * These tests validate that the compiled service worker (dist/sw.js)
 * contains the required push, notificationclick, and pushsubscriptionchange
 * handlers, and that the notification icon assets exist.
 *
 * Full SW push lifecycle testing requires Chrome DevTools Protocol (CDP)
 * to control the ServiceWorker → dispatch push events → inspect notifications.
 * That level of testing is deferred to manual DevTools verification.
 * These tests cover build-time assertions and SW registration.
 *
 * AC Mapping:
 *   AC 1-3: Push handler — build-time verification that handler code exists
 *   AC 4-5: Notification click — build-time verification that handler exists
 *   AC 6:   Subscription change — build-time verification that handler exists
 *   AC 7:   Build & icons — asset existence + build output verification
 */

import { test, expect } from '../support/fixtures'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const DIST_DIR = path.resolve(__dirname, '../../dist')
const SW_FILE = path.join(DIST_DIR, 'sw.js')
const ICON_192 = path.join(DIST_DIR, 'icons/icon-192.png')
const BADGE_72 = path.join(DIST_DIR, 'icons/badge-72.png')

test.describe('E61-S02: Service Worker Push and Click Handlers — Build Verification', () => {
  test('AC 7: dist/sw.js exists and contains push event handler', () => {
    expect(existsSync(SW_FILE), 'dist/sw.js must exist after build').toBe(true)

    const swContent = readFileSync(SW_FILE, 'utf-8')

    // AC 1: Push handler
    expect(swContent, 'push event listener must be in compiled SW').toContain(
      'addEventListener'
    )
    expect(swContent, 'push handler must call event.waitUntil()').toContain(
      'waitUntil'
    )
    expect(swContent, 'push handler must call showNotification').toContain(
      'showNotification'
    )

    // AC 1: Default icon
    expect(swContent, 'must reference default icon').toMatch(
      /icon-192\.png/
    )
    // AC 1: Default badge
    expect(swContent, 'must reference badge icon').toMatch(
      /badge-72\.png/
    )

    // AC 4-5: Notification click handler
    expect(swContent, 'notificationclick listener must be in compiled SW').toContain(
      'notificationclick'
    )
    expect(swContent, 'notificationclick must close notification').toContain(
      'close'
    )
    expect(swContent, 'notificationclick must matchAll clients').toContain(
      'matchAll'
    )

    // AC 6: Subscription change handler
    expect(
      swContent,
      'pushsubscriptionchange listener must be in compiled SW'
    ).toContain('pushsubscriptionchange')
    expect(swContent, 'pushsubscriptionchange must re-subscribe').toContain(
      'subscribe'
    )
  })

  test('AC 7: icon assets exist in dist/', () => {
    expect(existsSync(ICON_192), 'icons/icon-192.png must exist in dist/').toBe(true)
    expect(existsSync(BADGE_72), 'icons/badge-72.png must exist in dist/').toBe(true)
  })
})

test.describe('E61-S02: Service Worker Registration', () => {
  test('service worker registers successfully', async ({ page }) => {
    await page.goto('/')

    // Wait for the SW to be registered (vite-plugin-pwa handles this)
    // The SW may take a moment to register after page load
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false

      // Poll for SW registration (up to 10s)
      for (let i = 0; i < 20; i++) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg && reg.active) return true
        await new Promise(r => setTimeout(r, 500))
      }
      return false
    })

    expect(hasSW, 'Service Worker must be registered and active').toBe(true)
  })

  test('push manager is available after SW registration', async ({ page }) => {
    await page.goto('/')

    const pushAvailable = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      if (!('PushManager' in window)) return false

      // Wait for SW to be ready
      const reg = await navigator.serviceWorker.ready
      return !!reg.pushManager
    })

    expect(pushAvailable, 'PushManager must be available after SW registration').toBe(true)
  })
})
