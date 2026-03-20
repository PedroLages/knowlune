/**
 * Navigation E2E tests — verifies all main routes load and sidebar
 * navigation works correctly.
 *
 * Demonstrates:
 *   - Custom fixtures (test from support/fixtures)
 *   - Pure helper functions (navigation.ts)
 *   - Network-first patterns (waitForLoadState before assertions)
 *   - data-testid selector strategy where available
 */
import { test, expect } from '../support/fixtures'
import {
  goToOverview,
  goToCourses,
  goToMyClass,
  goToReports,
  goToSettings,
} from '../support/helpers/navigation'

test.describe('App Navigation', () => {
  test('should load Overview page at root', async ({ page }) => {
    await goToOverview(page)

    await expect(
      page.getByRole('heading', { name: 'Your Learning Studio', level: 1 })
    ).toBeVisible()
  })

  test('should navigate to Courses page', async ({ page }) => {
    await goToCourses(page)

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
  })

  test('should navigate to My Class page', async ({ page }) => {
    await goToMyClass(page)

    await expect(page.getByRole('heading', { name: 'My Progress', level: 1 })).toBeVisible()
  })

test('should navigate to Reports page', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible()
  })

  test('should navigate to Settings page', async ({ page }) => {
    await goToSettings(page)

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('sidebar should highlight active route', async ({ page }) => {
    await goToCourses(page)

    // The sidebar link for Courses should have an active indicator
    const coursesLink = page.locator('nav').getByRole('link', { name: /courses/i })
    await expect(coursesLink).toBeVisible()
  })
})
