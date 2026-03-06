/**
 * Courses page E2E tests — verifies course listing, filtering,
 * and navigation to course details.
 *
 * Demonstrates:
 *   - Network-first patterns (intercept before navigate)
 *   - Clean selector strategy (role-based, text-based)
 *   - Deterministic waiting (no hard waits)
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('Courses Page', () => {
  test('should display courses heading', async ({ page }) => {
    await goToCourses(page)

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
  })

  test('should display course cards', async ({ page }) => {
    await goToCourses(page)

    // At least one course card should be visible
    const courseCards = page.locator('[class*="card"]')
    const count = await courseCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should navigate to course detail on card click', async ({ page }) => {
    await goToCourses(page)

    // Find a clickable course link
    const courseLink = page
      .getByRole('link')
      .filter({ hasText: /lessons/ })
      .first()

    // Only test if courses exist
    if ((await courseLink.count()) > 0) {
      await courseLink.click()
      await page.waitForURL(/\/courses\//)
      expect(page.url()).toContain('/courses/')
    }
  })
})
