/**
 * ATDD E2E tests for E23-S01: Remove Hardcoded Branding from Courses Page
 *
 * AC1: No hardcoded branding in the page header subtitle
 * AC2: Empty state when no courses exist (cleared IndexedDB)
 * AC3: Design tokens used (no hardcoded colors) — verified by ESLint
 * AC4: Responsive layout on mobile, tablet, desktop
 */
import { test, expect } from '../../support/fixtures'
import { goToCourses } from '../../support/helpers/navigation'

// ---------------------------------------------------------------------------
// AC1: No hardcoded branding in page header
// ---------------------------------------------------------------------------

test.describe('AC1: No hardcoded branding', () => {
  test('page header subtitle does not contain hardcoded provider branding', async ({ page }) => {
    await goToCourses(page)

    // Scope to the header area via data-testid — course card data may still reference the provider
    const headerArea = page.locator('[data-testid="courses-header"]')
    const headerText = await headerArea.textContent()

    expect(headerText).not.toContain('Chase Hughes')
    expect(headerText).not.toContain('The Operative Kit')
  })
})

// ---------------------------------------------------------------------------
// AC2: Empty state when no courses exist
// ---------------------------------------------------------------------------

test.describe('AC2: Empty state for no courses', () => {
  test('shows empty state when IndexedDB has no courses', async ({ page, indexedDB }) => {
    // Navigate first so Dexie creates the database
    await goToCourses(page)

    // Clear all course data from IndexedDB using the fixture helper
    await indexedDB.clearStore('courses')
    await indexedDB.clearStore('importedCourses')

    // Navigate away, then back — this forces a fresh component mount.
    // Use addInitScript to block course seed on next navigation.
    // FRAGILE: This monkey-patches IDBObjectStore.prototype.add at a low level.
    // If Dexie switches to bulkAdd/put internally, this interception will silently
    // stop working. The fake IDBRequest also lacks addEventListener/removeEventListener.
    // Validated by passing E2E tests; if Dexie upgrades break this, replace with a
    // higher-level mock (e.g., localStorage flag the app reads to skip seeding).
    await page.addInitScript(() => {
      const origAdd = IDBObjectStore.prototype.add
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === 'courses') {
          const req = {} as IDBRequest
          setTimeout(() => req.onsuccess?.(new Event('success')), 0)
          Object.defineProperty(req, 'result', { get: () => undefined })
          Object.defineProperty(req, 'readyState', { get: () => 'done' as IDBRequestReadyState })
          Object.defineProperty(req, 'error', { get: () => null })
          Object.defineProperty(req, 'onsuccess', { writable: true, value: null })
          Object.defineProperty(req, 'onerror', { writable: true, value: null })
          return req as IDBRequest
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
        return origAdd.apply(this, args as [any, IDBValidKey?])
      }
    })

    await page.goto('/courses')
    await page.waitForLoadState('load')

    // 5s timeout: IDB clear + navigation + component mount. Higher than default
    // because the two-phase clear-then-block-reseed dance adds latency.
    const emptyState = page.locator('[data-testid="courses-empty-state"]')
    await expect(emptyState).toBeVisible({ timeout: 5_000 })
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

      // Page heading and primary CTA should be visible at all breakpoints
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()
      await expect(page.getByRole('button', { name: 'Import Course' })).toBeVisible()

      // No horizontal overflow
      const body = page.locator('body')
      const bodyBox = await body.boundingBox()
      expect(bodyBox).not.toBeNull()
      expect(bodyBox!.width).toBeLessThanOrEqual(vp.width + 1)
    })
  }
})
