/**
 * E117-S02: Unified Search Palette — Empty State (R14, R15, R16).
 *
 * - Fresh install (no imports, no opens) → welcome copy.
 * - Recently opened rows rendered from localStorage.
 * - Continue learning is covered in best-matches spec alongside ranking
 *   since both require IndexedDB seeding of courses + progress.
 *
 * Unit 6 will add deterministic time helpers and shared seed utilities.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'

async function openCommandPalette(page: Parameters<typeof navigateAndWait>[0]) {
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.LONG })
}

test.describe('E117-S02: empty state', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress mobile/tablet sidebar overlay.
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  test('welcome copy shows when both empty-state rows are empty', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Clear recent list from any previous test state.
    await page.evaluate(() => localStorage.removeItem('knowlune.recentSearchHits.v1'))

    await openCommandPalette(page)

    // Welcome copy appears once Continue Learning resolves to [].
    await expect(page.getByTestId('search-welcome-copy')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    await expect(page.getByTestId('search-welcome-copy')).toContainText(
      /Start by importing a course or adding a book/i
    )
  })

  test('Recently opened rows render from localStorage', async ({ page }) => {
    await navigateAndWait(page, '/')
    await page.evaluate(() => {
      const hits = [
        {
          type: 'course',
          id: 'recent-course-a',
          openedAt: '2026-04-18T00:00:00.000Z',
        },
        {
          type: 'book',
          id: 'recent-book-b',
          openedAt: '2026-04-18T00:00:00.000Z',
        },
      ]
      localStorage.setItem('knowlune.recentSearchHits.v1', JSON.stringify(hits))
    })

    await openCommandPalette(page)

    await expect(page.getByText('Recently opened')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    await expect(
      page.getByTestId('search-recent-course-recent-course-a')
    ).toBeVisible()
    await expect(
      page.getByTestId('search-recent-book-recent-book-b')
    ).toBeVisible()
  })

  test('Recently opened caps at 5 rows', async ({ page }) => {
    await navigateAndWait(page, '/')
    await page.evaluate(() => {
      const hits = Array.from({ length: 7 }, (_, i) => ({
        type: 'course',
        id: `r-${i}`,
        openedAt: `2026-04-18T00:00:0${i}.000Z`,
      }))
      localStorage.setItem('knowlune.recentSearchHits.v1', JSON.stringify(hits))
    })

    await openCommandPalette(page)

    await expect(page.getByText('Recently opened')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    const rows = page.locator('[data-testid^="search-recent-course-r-"]')
    await expect(rows).toHaveCount(5)
  })
})
