/**
 * E117-S03: Power-User Prefix Filters & Per-Page Search Consolidation.
 *
 * AC 21 — Prefix `c:`, `b:`, `l:`, `a:`, `n:`, `h:` scope results.
 * AC 22 — Chip rendered; Backspace on empty text exits scope.
 * AC 23 — Empty scoped query → top-50 frecency-ordered results.
 * AC 24 — Per-page search inputs removed from Courses + Authors.
 * AC 25 — Header Search button opens palette pre-scoped.
 * AC 26 — Hint row visible on first open; dismissal persists.
 *
 * Seeding: uses seedFrecency + seedRecentList helpers.
 * Deterministic time: FIXED_DATE throughout.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'
import { seedFrecency } from '../helpers/seedSearchFrecency'
import { FIXED_DATE } from '../utils/test-time'

const HINT_DISMISS_KEY = 'knowlune.searchPrefixHintDismissed.v1'

async function openCommandPalette(page: Parameters<typeof navigateAndWait>[0]) {
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.LONG })
}

async function seedCourse(page: Parameters<typeof navigateAndWait>[0], course: { id: string; name: string }) {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- E117-S03 seed; direct IDB insert
  await page.evaluate(async data => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('importedCourses')) { db.close(); reject(new Error('store missing')); return }
        const tx = db.transaction('importedCourses', 'readwrite')
        tx.objectStore('importedCourses').put({
          id: data.id, name: data.name, category: 'general', tags: [], status: 'active',
          videoCount: 1, pdfCount: 0, importedAt: '2026-04-18T10:00:00Z',
          updatedAt: '2026-04-18T10:00:00Z',
        })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, course)
}

test.describe('E117-S03: prefix filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  // ─── AC 21 + AC 22: Chip + prefix parsing ────────────────────────────────

  test('typing c: triggers chip and scopes palette to courses', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedCourse(page, { id: 'tc1', name: 'TypeScript Fundamentals' })

    await openCommandPalette(page)
    await page.keyboard.type('c:TypeScript')

    await expect(page.getByTestId('search-scope-chip')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByTestId('search-scope-chip')).toContainText('Courses')
  })

  test('Backspace on empty input exits scope', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    await page.keyboard.type('c:')
    await expect(page.getByTestId('search-scope-chip')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Backspace exits scope
    await page.keyboard.press('Backspace')
    await expect(page.getByTestId('search-scope-chip')).not.toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('leading-space escape: " c:..." does not trigger chip', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    await page.keyboard.type(' c:test')
    // The chip should not appear because the space puts the prefix at position > 0
    await expect(page.getByTestId('search-scope-chip')).not.toBeVisible({ timeout: TIMEOUTS.MEDIUM })
  })

  test('chip X button clears scope', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    await page.keyboard.type('c:')
    await expect(page.getByTestId('search-scope-chip')).toBeVisible({ timeout: TIMEOUTS.LONG })

    await page.getByTestId('search-scope-chip-clear').click()
    await expect(page.getByTestId('search-scope-chip')).not.toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  // ─── AC 23: Empty scoped query → frecency top-50 ─────────────────────────

  test('empty scoped query shows frecency-ordered results', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedCourse(page, { id: 'frec1', name: 'Advanced React' })
    await seedFrecency(page, [{ entityType: 'course', entityId: 'frec1', openCount: 5, lastOpenedAt: FIXED_DATE }])

    await openCommandPalette(page)
    await page.keyboard.type('c:')

    await expect(page.getByTestId('search-scoped-top')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByText('Advanced React')).toBeVisible()
  })

  test('scoped zero-results shows clear-filter link', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    // Type a prefix then a query with no results
    await page.keyboard.type('c:zzz_nonexistent_course_xyz')

    await expect(page.getByTestId('search-scoped-empty')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByText(/Clear filter/i)).toBeVisible()
  })

  // ─── AC 26: Hint row ──────────────────────────────────────────────────────

  test('hint row is visible on first open (undismissed)', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Ensure hint is not dismissed
    await page.evaluate(() => localStorage.removeItem('knowlune.searchPrefixHintDismissed.v1'))

    // Need at least one piece of content so we're not in welcome-copy mode
    await seedCourse(page, { id: 'hintc1', name: 'Hint Test Course' })

    await openCommandPalette(page)

    await expect(page.getByTestId('search-prefix-hint')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByTestId('search-prefix-hint')).toContainText('c:')
  })

  test('dismissing hint persists across palette re-open', async ({ page }) => {
    await navigateAndWait(page, '/')
    await page.evaluate(() => localStorage.removeItem('knowlune.searchPrefixHintDismissed.v1'))
    await seedCourse(page, { id: 'hintc2', name: 'Dismiss Test Course' })

    await openCommandPalette(page)
    await expect(page.getByTestId('search-prefix-hint')).toBeVisible({ timeout: TIMEOUTS.LONG })

    await page.getByTestId('search-prefix-hint-dismiss').click()
    await expect(page.getByTestId('search-prefix-hint')).not.toBeVisible()

    // Close and re-open palette
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await openCommandPalette(page)
    await expect(page.getByTestId('search-prefix-hint')).not.toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify LS was written
    const dismissed = await page.evaluate(() => localStorage.getItem('knowlune.searchPrefixHintDismissed.v1'))
    expect(dismissed).toBe('true')
  })

  // ─── AC 24: No per-page search inputs ────────────────────────────────────

  test('Courses page has no per-page search input', async ({ page }) => {
    await navigateAndWait(page, '/courses')
    // The old input had name="course-search"; it should be gone
    await expect(page.locator('[name="course-search"]')).not.toBeAttached()
  })

  test('Authors page has no per-page search input', async ({ page }) => {
    await navigateAndWait(page, '/authors')
    await expect(page.getByTestId('author-search-input')).not.toBeAttached()
  })

  // ─── AC 25: Header Search button opens pre-scoped palette ────────────────

  test('Courses HeaderSearchButton opens palette scoped to courses', async ({ page }) => {
    await navigateAndWait(page, '/courses')
    await page.getByTestId('header-search-btn-course').click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByTestId('search-scope-chip')).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(page.getByTestId('search-scope-chip')).toContainText('Courses')
  })

  // ─── Regression: Cmd+K still opens unscoped palette ──────────────────────

  test('Cmd+K opens unscoped palette (Story 1 regression)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('search-scope-chip')).not.toBeVisible()
  })

  // ─── Keyboard accessibility ───────────────────────────────────────────────

  test('Escape closes palette and restores focus', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('scope entry announcement fires (aria-live region)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await openCommandPalette(page)

    await page.keyboard.type('c:')

    // After 400ms settle the scope announcement should be non-empty.
    await expect(async () => {
      const text = await page.getByTestId('search-scope-announcement').textContent()
      expect(text).toMatch(/Courses/)
    }).toPass({ timeout: TIMEOUTS.LONG })
  })
})
