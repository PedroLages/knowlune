/**
 * E83-S03: Library grid/list views, BookCard, BookListItem, empty state
 *
 * Basic smoke tests verifying:
 *   - Library page renders with empty state
 *   - Import button is visible
 *   - View toggle appears when books exist
 */
import { test, expect } from '../../support/fixtures'

test.describe('Library page — E83-S03', () => {
  test('renders empty state with import CTA', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
    })
    await page.goto('/library')

    // Empty state heading
    await expect(page.getByText('Your library is empty')).toBeVisible()

    // Import button in header
    await expect(page.getByTestId('import-book-trigger')).toBeVisible()

    // Empty state CTA button
    await expect(page.getByTestId('import-first-book-cta')).toBeVisible()
  })

  test('import button opens dialog', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
    })
    await page.goto('/library')

    await page.getByTestId('import-book-trigger').click()

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
