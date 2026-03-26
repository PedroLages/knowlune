/**
 * ATDD E2E tests for E25-S09: Standardize Empty States Across Pages
 *
 * Tests the shared EmptyState component on the My Courses "By Status" tab:
 * - The "no in-progress" empty state appears when no courses have been started
 * - CTA navigates to /courses
 * - Proper role="status" attribute and descriptive content
 */
import { test, expect } from '../../support/fixtures'
import { goToMyClass } from '../../support/helpers/navigation'

test.describe('E25-S09: Empty State CTAs', () => {
  test('no-in-progress empty state CTA navigates to /courses', async ({ page }) => {
    await goToMyClass(page)

    // The "By Status" tab is default; with no progress, "no in-progress" empty state shows
    const emptyState = page.locator('[data-testid="empty-state-no-in-progress"]')
    await expect(emptyState).toBeVisible()

    // Click the CTA button
    const ctaButton = emptyState.getByRole('link', { name: 'Browse Courses' })
    await expect(ctaButton).toBeVisible()
    await ctaButton.click()

    // Should navigate to /courses
    await expect(page).toHaveURL(/\/courses/)
  })

  test('empty state container has role="status"', async ({ page }) => {
    await goToMyClass(page)

    const emptyState = page.locator('[data-testid="empty-state-no-in-progress"]')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveAttribute('role', 'status')
  })

  test('empty state displays icon and descriptive text', async ({ page }) => {
    await goToMyClass(page)

    const emptyState = page.locator('[data-testid="empty-state-no-in-progress"]')
    await expect(emptyState).toBeVisible()

    // Icon should be present
    const icon = emptyState.locator('[data-testid="empty-state-icon"]')
    await expect(icon).toBeVisible()

    // Title and description text
    await expect(emptyState.getByText('No courses in progress')).toBeVisible()
    await expect(emptyState.getByText('Start a new course to begin learning!')).toBeVisible()
  })
})
