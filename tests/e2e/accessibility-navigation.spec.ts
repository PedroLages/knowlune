import { test, expect } from '@playwright/test'

test.describe('Accessibility - Navigation', () => {
  test('Navigation - Sidebar links have proper ARIA current state', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Find active nav link (should have aria-current="page")
    const activeLink = page.locator('a[aria-current="page"], [data-active="true"]').first()

    // Verify it exists and is visible
    await expect(activeLink).toBeVisible()
  })
})
