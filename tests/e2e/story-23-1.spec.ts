/**
 * ATDD E2E tests for E23-S01: Remove Hardcoded Branding from Courses Page
 *
 * RED phase — these tests should FAIL until the story is implemented.
 *
 * AC1: No hardcoded branding (provider names, logos, branding text)
 * AC2: Empty state when no imported courses
 * AC3: Design tokens used (no hardcoded colors)
 * AC4: Responsive layout on mobile, tablet, desktop
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// AC1: No hardcoded branding on Courses page
// ---------------------------------------------------------------------------

test.describe('AC1: No hardcoded branding', () => {
  test('courses page does not display hardcoded provider names or branding text', async ({
    page,
  }) => {
    await goToCourses(page)

    // The page header should not contain hardcoded provider branding
    const bodyText = await page.locator('main').textContent()

    // Hardcoded branding identified in Courses.tsx line 209
    expect(bodyText).not.toContain('Chase Hughes')
    expect(bodyText).not.toContain('The Operative Kit')
  })
})

// ---------------------------------------------------------------------------
// AC2: Empty state when no imported courses
// ---------------------------------------------------------------------------

test.describe('AC2: Empty state for no courses', () => {
  test('shows appropriate empty state when no courses are imported', async ({
    page,
  }) => {
    // Navigate with no seeded courses — IndexedDB is clean
    await goToCourses(page)

    // Should show an empty state message (not hardcoded placeholder courses)
    const emptyState = page.locator('[data-testid="courses-empty-state"]')
    await expect(emptyState).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4: Responsive layout
// ---------------------------------------------------------------------------

test.describe('AC4: Responsive layout', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]

  for (const vp of viewports) {
    test(`courses page renders correctly on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await goToCourses(page)

      // Page heading should be visible at all breakpoints
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()

      // No horizontal overflow
      const body = page.locator('body')
      const bodyBox = await body.boundingBox()
      expect(bodyBox).not.toBeNull()
      expect(bodyBox!.width).toBeLessThanOrEqual(vp.width + 1)
    })
  }
})
