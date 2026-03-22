/**
 * ATDD E2E tests for E23-S01: Remove Hardcoded Branding from Courses Page
 *
 * AC1: No hardcoded branding in the page header subtitle
 * AC2: Empty state when no courses exist (cleared IndexedDB)
 * AC3: Design tokens used (no hardcoded colors) — verified by ESLint
 * AC4: Responsive layout on mobile, tablet, desktop
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// AC1: No hardcoded branding in page header
// ---------------------------------------------------------------------------

test.describe('AC1: No hardcoded branding', () => {
  test('page header subtitle does not contain hardcoded provider branding', async ({
    page,
  }) => {
    await goToCourses(page)

    // Check only the header area — course card data may still reference the provider
    // The header is the first div child containing h1 + subtitle paragraph
    const headerArea = page.locator('main > div > div').first()
    const headerText = await headerArea.textContent()

    expect(headerText).not.toContain('Chase Hughes')
    expect(headerText).not.toContain('The Operative Kit')
  })
})

// ---------------------------------------------------------------------------
// AC2: Empty state when no courses exist
// ---------------------------------------------------------------------------

test.describe('AC2: Empty state for no courses', () => {
  test('shows empty state when IndexedDB has no courses', async ({
    page,
    indexedDB,
  }) => {
    // Navigate first so Dexie creates the database
    await goToCourses(page)

    // Clear all course data from IndexedDB
    await indexedDB.clearStore('courses')
    await indexedDB.clearStore('importedCourses')

    // Clear Zustand stores by dispatching a custom event the component can react to,
    // and directly update the DOM by triggering a re-render via navigation
    // Simplest: navigate away and back with a clean DB, but block the seed
    await page.evaluate(async () => {
      // Clear the Dexie courses table
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const tx = db.transaction(['courses', 'importedCourses'], 'readwrite')
      tx.objectStore('courses').clear()
      tx.objectStore('importedCourses').clear()
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    })

    // Navigate away, then back — this forces a fresh component mount
    // Use addInitScript to block seed on next navigation
    await page.addInitScript(() => {
      // Override Dexie's bulkAdd by intercepting at the IDBObjectStore level
      const origAdd = IDBObjectStore.prototype.add
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === 'courses') {
          // Silently skip — return a resolved request
          const req = {} as IDBRequest
          setTimeout(() => req.onsuccess?.(new Event('success')), 0)
          Object.defineProperty(req, 'result', { get: () => undefined })
          Object.defineProperty(req, 'readyState', { get: () => 'done' as IDBRequestReadyState })
          Object.defineProperty(req, 'error', { get: () => null })
          Object.defineProperty(req, 'onsuccess', { writable: true, value: null })
          Object.defineProperty(req, 'onerror', { writable: true, value: null })
          return req as IDBRequest
        }
        return origAdd.apply(this, args as [any, IDBValidKey?])
      }
    })

    await page.goto('/courses')
    await page.waitForLoadState('load')

    const emptyState = page.locator('[data-testid="courses-empty-state"]')
    await expect(emptyState).toBeVisible({ timeout: 10_000 })
    await expect(emptyState).toContainText('No courses yet')
    await expect(emptyState).toContainText('Import Course')
  })
})

// ---------------------------------------------------------------------------
// AC4: Responsive layout
// ---------------------------------------------------------------------------

test.describe('AC4: Responsive layout', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]

  for (const vp of viewports) {
    test(`courses page renders correctly on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await goToCourses(page)

      // Page heading should be visible at all breakpoints
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()

      // No horizontal overflow
      const body = page.locator('body')
      const bodyBox = await body.boundingBox()
      expect(bodyBox).not.toBeNull()
      expect(bodyBox!.width).toBeLessThanOrEqual(vp.width + 1)
    })
  }
})
