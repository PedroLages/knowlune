/**
 * ATDD E2E tests for E23-S06: Featured Author Layout for Single Author State
 *
 * AC1: Single author renders featured/hero layout (not card grid)
 * AC2: Multiple authors render card grid (current data has 1 author — tested via structure check)
 * AC3: Profile link navigates to /authors/:authorId
 * AC4: Responsive layout at mobile, tablet, desktop
 * AC5: Design tokens used (verified by ESLint — E2E validates visual rendering)
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

// ---------------------------------------------------------------------------
// AC1: Featured layout renders for single author
// ---------------------------------------------------------------------------

test.describe('AC1: Featured layout for single author', () => {
  test('renders featured-author layout instead of grid', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    const featured = page.locator('[data-testid="featured-author"]')
    await expect(featured).toBeVisible()

    // Grid should NOT be present (single author)
    await expect(page.locator('[data-testid="author-grid"]')).not.toBeAttached()
  })

  test('featured layout displays author name, title, and stats', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    const featured = page.locator('[data-testid="featured-author"]')

    // Author name visible in the featured card
    await expect(featured.getByRole('heading', { level: 2 })).toBeVisible()

    // Stats strip should be visible with at least one stat value
    const statsGrid = featured.locator('.grid')
    await expect(statsGrid).toBeVisible()
  })

  test('featured layout shows specialty badges', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    const badgesContainer = page.locator('[data-testid="specialty-badges"]')
    await expect(badgesContainer).toBeVisible()

    // At least one badge child element should be present
    const badgeCount = await badgesContainer.locator('> *').count()
    expect(badgeCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AC2: Grid layout for multiple authors (structural check)
// ---------------------------------------------------------------------------

test.describe('AC2: Grid layout guard', () => {
  test('page heading uses singular text for single author', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    // Single author => "Meet the expert behind your learning journey" (singular)
    const subtitle = page.getByText('Meet the expert behind your learning journey')
    await expect(subtitle).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: Navigation to author profile
// ---------------------------------------------------------------------------

test.describe('AC3: Profile navigation', () => {
  test('View Full Profile link navigates to author profile page', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    const profileLink = page.getByRole('link', { name: /view full profile/i })
    await expect(profileLink).toBeVisible()

    await profileLink.click()
    await page.waitForLoadState('load')

    // Should navigate to an /authors/<id> route
    await expect(page).toHaveURL(/\/authors\/[a-z-]+/)
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
    test(`featured layout renders correctly on ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndWait(page, '/authors')

      // Featured card should be visible
      const featured = page.locator('[data-testid="featured-author"]')
      await expect(featured).toBeVisible()

      // No horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth, `Horizontal overflow at ${vp.name}`).toBeLessThanOrEqual(clientWidth + 1)
    })
  }
})
