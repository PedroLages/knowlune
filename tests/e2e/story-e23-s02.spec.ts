/**
 * ATDD E2E tests for E23-S02: Rename "My Classes" to "My Courses"
 *
 * Validates that "My Classes" is renamed to "My Courses" across:
 * - Sidebar navigation
 * - Mobile bottom bar
 * - Search command palette
 * - Page title in MyClass.tsx
 * - Route path remains /my-class for backwards compatibility
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// AC1: Sidebar shows "My Courses" instead of "My Classes"
// ---------------------------------------------------------------------------

test.describe('Sidebar navigation label', () => {
  test('displays "My Courses" in the desktop sidebar', async ({ page }) => {
    await navigateAndWait(page, '/')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')
    await expect(sidebar.getByText('My Courses')).toBeVisible()
    await expect(sidebar.getByText('My Classes')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC1: Mobile bottom bar shows "My Courses"
// ---------------------------------------------------------------------------

test.describe('Mobile bottom bar label', () => {
  test('displays "My Courses" in the mobile bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateAndWait(page, '/')

    const bottomBar = page.locator('nav[aria-label="Mobile navigation"]')
    await expect(bottomBar).toBeVisible()
    await expect(bottomBar.getByText('My Courses')).toBeVisible()
    await expect(bottomBar.getByText('My Classes')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC1: Search command palette shows "My Courses"
// ---------------------------------------------------------------------------

test.describe('Search command palette', () => {
  test('shows "My Courses" in command palette results', async ({ page }) => {
    await navigateAndWait(page, '/')

    // Open command palette via keyboard shortcut
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+k`)

    const palette = page.getByRole('dialog')
    await expect(palette).toBeVisible()

    // Type search term
    await palette.locator('input').fill('My')

    // Verify "My Courses" appears, not "My Classes"
    await expect(palette.getByText('My Courses')).toBeVisible()
    await expect(palette.getByText('My Classes')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Route path remains /my-class for backwards compatibility
// ---------------------------------------------------------------------------

test.describe('Route backwards compatibility', () => {
  test('navigating to /my-class still works', async ({ page }) => {
    await navigateAndWait(page, '/my-class')

    // Page should load successfully at /my-class
    await expect(page).toHaveURL(/\/my-class/)
    // And display the renamed title
    await expect(page.locator('h1')).toContainText('My Courses')
  })
})

// ---------------------------------------------------------------------------
// AC3: Page title reads "My Courses"
// ---------------------------------------------------------------------------

test.describe('Page title', () => {
  test('MyClass page heading says "My Courses"', async ({ page }) => {
    await navigateAndWait(page, '/my-class')

    await expect(page.locator('h1').filter({ hasText: 'My Courses' })).toBeVisible()
    // Ensure old title is gone
    await expect(page.locator('h1').filter({ hasText: 'My Progress' })).not.toBeVisible()
  })
})
