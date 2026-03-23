/**
 * ATDD E2E tests for E23-S04: Restructure Sidebar Navigation Groups
 *
 * Validates the 5-4-5 sidebar group restructure:
 * - Learn (5): Overview, My Courses, Courses, Authors, Notes
 * - Review (4): Learning Path, Knowledge Gaps, Review, Retention
 * - Track (5): Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics
 *
 * "Connect" group (formerly 1 item: Authors) is eliminated.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// Desktop viewport — sidebar visible at ≥1024px
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }

test.describe('E23-S04: Restructure Sidebar Navigation Groups', () => {
  // ---------------------------------------------------------------------------
  // AC1: Sidebar shows Learn, Review, Track group labels
  // ---------------------------------------------------------------------------
  test('AC1: sidebar shows exactly Learn, Review, Track group labels', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')
    await expect(sidebar).toBeVisible()

    // Group labels use CSS text-transform:uppercase — innerText reflects computed values.
    // Check via innerText to avoid dealing with CSS class escaping.
    const sidebarText = await sidebar.evaluate(el => el.innerText)
    expect(sidebarText).toMatch(/\bLEARN\b/)
    expect(sidebarText).toMatch(/\bREVIEW\b/)
    expect(sidebarText).toMatch(/\bTRACK\b/)

    // Old group label must not appear
    expect(sidebarText).not.toMatch(/\bCONNECT\b/)
  })

  // ---------------------------------------------------------------------------
  // AC2: Learn group contains 5 correct items
  // ---------------------------------------------------------------------------
  test('AC2: Learn group contains Overview, My Courses, Courses, Authors, Notes', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    // All 5 items must be present as links
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'My Courses' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Courses', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Authors' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Notes' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC3: Review group contains 4 correct items
  // ---------------------------------------------------------------------------
  test('AC3: Review group contains Learning Path, Knowledge Gaps, Review, Retention', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    await expect(sidebar.getByRole('link', { name: 'Learning Path' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Knowledge Gaps' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Review', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Retention' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC4: Track group contains 5 correct items
  // ---------------------------------------------------------------------------
  test('AC4: Track group contains Challenges, Session History, and 3 analytics tabs', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    await expect(sidebar.getByRole('link', { name: 'Challenges' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Session History' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Study Analytics' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'AI Analytics' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC5: Mobile overflow drawer shows all non-primary items
  // ---------------------------------------------------------------------------
  test('AC5: mobile More drawer includes Authors and all Review/Track items', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await navigateAndWait(page, '/')

    // Open the "More" drawer. Use evaluate to click the DOM element directly,
    // bypassing any dev-only toolbar overlays that intercept pointer events at coordinates.
    const moreButton = page.getByRole('button', { name: 'More menu' })
    await expect(moreButton).toBeVisible()
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[aria-label="More menu"]')
      btn?.click()
    })

    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible()

    // Authors should be in the overflow (not in primary bottom bar)
    await expect(drawer.getByRole('link', { name: 'Authors' })).toBeVisible()

    // Review group items should be in overflow
    await expect(drawer.getByRole('link', { name: 'Learning Path' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Knowledge Gaps' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Review', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Retention' })).toBeVisible()

    // Track items in overflow
    await expect(drawer.getByRole('link', { name: 'Challenges' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC6: Collapsed sidebar separators align with 3-group boundaries
  // ---------------------------------------------------------------------------
  test('AC6: collapsed sidebar shows separators between groups', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    // Collapse the sidebar
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' })
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    // In collapsed mode, separators appear as border-t divs between groups (idx > 0)
    // There should be exactly 2 separators (before Review and before Track groups)
    const separators = sidebar.locator('div[aria-hidden="true"].border-t')
    await expect(separators).toHaveCount(2)
  })

  // ---------------------------------------------------------------------------
  // AC7: Responsive layout — no overflow at mobile, tablet, desktop
  // ---------------------------------------------------------------------------
  test('AC7: no horizontal overflow at mobile, tablet, and desktop viewports', async ({ page }) => {
    const viewports = [
      { ...MOBILE, label: 'mobile' },
      { ...TABLET, label: 'tablet' },
      { ...DESKTOP, label: 'desktop' },
    ]

    for (const { width, height, label } of viewports) {
      await page.setViewportSize({ width, height })
      await navigateAndWait(page, '/')

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth, `Horizontal overflow at ${label} (${width}px)`).toBeLessThanOrEqual(
        clientWidth
      )
    }
  })
})
