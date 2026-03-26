/**
 * ATDD E2E tests for E23-S04: Restructure Sidebar Navigation Groups
 *
 * Validates the Library-Study-Track sidebar group restructure:
 * - Library (4): Overview, Courses, Learning Paths, Authors
 * - Study (5): My Courses, Notes, Flashcards, Review, Learning Path
 * - Track (7): Challenges, Knowledge Gaps, Retention, Session History, Study/Quiz/AI Analytics
 *
 * "Connect" group is eliminated.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// Desktop viewport — sidebar visible at ≥1024px
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }

test.describe('E23-S04: Restructure Sidebar Navigation Groups', () => {
  // ---------------------------------------------------------------------------
  // AC1: Sidebar shows Library, Study, Track group labels
  // ---------------------------------------------------------------------------
  test('AC1: sidebar shows exactly Library, Study, Track group labels', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')
    await expect(sidebar).toBeVisible()

    // Group labels have unique id attributes (nav-group-{label}) — locate by id so the
    // test is not coupled to CSS text-transform or computed innerText behaviour.
    await expect(sidebar.locator('#nav-group-library')).toBeVisible()
    await expect(sidebar.locator('#nav-group-study')).toBeVisible()
    await expect(sidebar.locator('#nav-group-track')).toBeVisible()

    // Old group labels must not appear
    await expect(sidebar.locator('#nav-group-connect')).not.toBeAttached()
    await expect(sidebar.locator('#nav-group-learn')).not.toBeAttached()
    await expect(sidebar.locator('#nav-group-review')).not.toBeAttached()
  })

  // ---------------------------------------------------------------------------
  // AC2: Library group contains 4 correct items
  // ---------------------------------------------------------------------------
  test('AC2: Library group contains Overview, Courses, Learning Paths, Authors', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    // All 4 items must be present as links
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Courses', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Learning Paths' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Authors' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC3: Study group contains 5 correct items
  // ---------------------------------------------------------------------------
  test('AC3: Study group contains My Courses, Notes, Flashcards, Review, Learning Path', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    await expect(sidebar.getByRole('link', { name: 'My Courses' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Notes' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Flashcards' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Review', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Learning Path' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC4: Track group contains 7 correct items
  // ---------------------------------------------------------------------------
  test('AC4: Track group contains Challenges, Knowledge Gaps, Retention, Session History, and 3 analytics tabs', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    await expect(sidebar.getByRole('link', { name: 'Challenges' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Knowledge Gaps' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Retention' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Session History' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Study Analytics' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'AI Analytics' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC5: Mobile bottom bar shows Overview, My Courses, Courses, Notes
  // ---------------------------------------------------------------------------
  test('AC5: mobile bottom bar shows 4 primary items + More button', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await navigateAndWait(page, '/')

    const bottomNav = page.locator('nav[aria-label="Mobile navigation"]')
    await expect(bottomNav).toBeVisible()

    // Primary items visible in bottom bar
    await expect(bottomNav.getByText('Overview')).toBeVisible()
    await expect(bottomNav.getByText('My Courses')).toBeVisible()
    await expect(bottomNav.getByText('Courses')).toBeVisible()
    await expect(bottomNav.getByText('Notes')).toBeVisible()

    // More button visible
    await expect(bottomNav.getByRole('button', { name: 'More menu' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC6: Mobile overflow drawer shows all non-primary items
  // ---------------------------------------------------------------------------
  test('AC6: mobile More drawer includes all non-primary items', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await navigateAndWait(page, '/')

    // Open the "More" drawer.
    // dispatchEvent bypasses coordinate-based interception from the dev-only Agentation toolbar
    // which overlays the bottom portion of the viewport in development mode.
    const moreButton = page.getByRole('button', { name: 'More menu' })
    await expect(moreButton).toBeVisible()
    await moreButton.dispatchEvent('click')

    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible()

    // Library overflow items
    await expect(drawer.getByRole('link', { name: 'Learning Paths' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Authors' })).toBeVisible()

    // Study group items in overflow
    await expect(drawer.getByRole('link', { name: 'Flashcards' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Review', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Learning Path' })).toBeVisible()

    // Track items in overflow
    await expect(drawer.getByRole('link', { name: 'Challenges' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Knowledge Gaps' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Retention' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Session History' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Study Analytics' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'AI Analytics' })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC7: Collapsed sidebar separators align with 3-group boundaries
  // ---------------------------------------------------------------------------
  test('AC7: collapsed sidebar shows separators between groups', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateAndWait(page, '/')

    // Collapse the sidebar
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' })
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    // In collapsed mode, separators appear between groups (idx > 0).
    // There should be exactly 2 separators (before Study and before Track groups)
    const separators = sidebar.getByTestId('group-separator')
    await expect(separators).toHaveCount(2)
  })

  // ---------------------------------------------------------------------------
  // AC8: Responsive layout — no overflow at mobile, tablet, desktop
  // ---------------------------------------------------------------------------
  test('AC8: no horizontal overflow at mobile, tablet, and desktop viewports', async ({ page }) => {
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
