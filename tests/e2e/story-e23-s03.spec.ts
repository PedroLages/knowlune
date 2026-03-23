/**
 * ATDD tests for E23-S03: Rename Instructors to Authors
 *
 * GREEN phase — these tests validate the rename is complete.
 * Each test maps to an acceptance criterion.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

test.describe('E23-S03: Rename Instructors to Authors', () => {
  // AC1: All text labels, navigation items, and headings use "Author" / "Authors"
  test('AC1: no "Instructor" text appears anywhere in the app', async ({ page }) => {
    // Check multiple key pages for stray "Instructor" references
    const pagesToCheck = [
      '/authors',
      '/authors/chase-hughes',
      '/courses/operative-six',
    ]

    for (const route of pagesToCheck) {
      await navigateAndWait(page, route)
      await page.waitForLoadState('load')

      const bodyText = await page.locator('body').innerText()
      const hasInstructor = /\binstructor\b/i.test(bodyText)
      expect(hasInstructor, `Found "Instructor" text on ${route}`).toBe(false)
    }
  })

  // AC2: Sidebar navigation shows "Authors" instead of "Instructors"
  test('AC2: sidebar navigation link reads "Authors"', async ({ page }) => {
    await navigateAndWait(page, '/')
    await page.waitForLoadState('load')

    // The sidebar should have an "Authors" link
    const authorsLink = page.locator('nav').getByRole('link', { name: /authors/i })
    await expect(authorsLink).toBeVisible()

    // The sidebar should NOT have an "Instructors" link
    const instructorsLink = page.locator('nav').getByRole('link', { name: /instructors/i })
    await expect(instructorsLink).not.toBeVisible()
  })

  // AC3: Page heading and content use "Author" / "Authors" terminology
  test('AC3: Authors page heading says "Authors" not "Instructors"', async ({ page }) => {
    await navigateAndWait(page, '/authors')
    await page.waitForLoadState('load')

    // Should have a heading with "Authors" terminology
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const headingText = await heading.innerText()
    expect(headingText).toMatch(/author/i)
    expect(headingText).not.toMatch(/instructor/i)
  })

  // AC5: Layout remains responsive (spot check at mobile width)
  test('AC5: Authors page renders correctly at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await navigateAndWait(page, '/authors')
    await page.waitForLoadState('load')

    // Page should render content at mobile width
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Page should render without horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
