import { test, expect } from '../support/fixtures'

test.describe('Accessibility - Navigation', () => {
  test('Navigation - Sidebar links have proper ARIA current state', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Tablet navigation lives in a closed sheet until the menu is opened.
    const openNavigation = page.getByRole('button', { name: 'Open navigation menu' })
    if (await openNavigation.isVisible()) {
      await openNavigation.click()
    }

    // Find active nav link (should have aria-current="page")
    const activeLink = page.locator('a[aria-current="page"], [data-active="true"]').first()

    // Verify it exists and is visible
    await expect(activeLink).toBeVisible()
  })
})
