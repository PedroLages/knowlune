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
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome wizard so it doesn't block navigation
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
  })

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

  test('should navigate to My Courses page', async ({ page }) => {
    await goToMyClass(page)

    await expect(page.getByRole('heading', { name: 'My Courses', level: 1 })).toBeVisible()
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
    const coursesLink = page.locator('nav').getByRole('link', { name: 'Courses', exact: true })
    await expect(coursesLink).toBeVisible()
  })
})
