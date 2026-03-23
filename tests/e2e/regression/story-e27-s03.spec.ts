/**
 * E27-S03: Update Sidebar Links To Reports Tabs
 *
 * Tests that sidebar links navigate to specific Reports tabs
 * and that the active state highlights correctly per tab.
 *
 * NOTE: Tab content activation (Reports.tsx reading ?tab=) requires E27-S01.
 * URL navigation and sidebar active state are independently testable here.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E27-S03: Sidebar links to Reports tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure desktop sidebar is expanded (not collapsed to icon-only mode)
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-collapsed-v1', 'false')
    })
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('Study Analytics link is visible in sidebar', async ({ page }) => {
    await navigateAndWait(page, '/')
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toBeVisible()
  })

  test('Quiz Analytics link is visible in sidebar', async ({ page }) => {
    await navigateAndWait(page, '/')
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).toBeVisible()
  })

  test('AI Analytics link is visible in sidebar', async ({ page }) => {
    await navigateAndWait(page, '/')
    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).toBeVisible()
  })

  test('Study Analytics link navigates to /reports?tab=study', async ({ page }) => {
    await navigateAndWait(page, '/')
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await studyLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
  })

  test('Quiz Analytics link navigates to /reports?tab=quizzes', async ({ page }) => {
    await navigateAndWait(page, '/')
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await quizLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
  })

  test('AI Analytics link navigates to /reports?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/')
    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await aiLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
  })

  test('Study Analytics sidebar item has aria-current=page on /reports?tab=study', async ({
    page,
  }) => {
    await navigateAndWait(page, '/reports?tab=study')
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toHaveAttribute('aria-current', 'page')
    // Other tabs must be inactive
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).not.toHaveAttribute('aria-current', 'page')
    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('Quiz Analytics sidebar item has aria-current=page on /reports?tab=quizzes', async ({
    page,
  }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).toHaveAttribute('aria-current', 'page')
    // Other tabs must be inactive
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).not.toHaveAttribute('aria-current', 'page')
    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('AI Analytics sidebar item has aria-current=page on /reports?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).toHaveAttribute('aria-current', 'page')
    // Other tabs must be inactive
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).not.toHaveAttribute('aria-current', 'page')
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('Study Analytics is active on bare /reports (default tab)', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toHaveAttribute('aria-current', 'page')

    // Quiz and AI should NOT be active
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).not.toHaveAttribute('aria-current', 'page')

    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('single Reports link is no longer present in sidebar', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Old single "Reports" link should not exist; only the tab-specific ones
    const oldLink = page.locator('nav').getByRole('link', { name: /^Reports$/ })
    await expect(oldLink).not.toBeAttached()
  })

  test('SearchCommandPalette shows tab-specific Reports entries (AC8)', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Open command palette
    await page.keyboard.press('Meta+k')
    const palette = page.getByRole('dialog')
    await expect(palette).toBeVisible()

    // Search for analytics
    await page.keyboard.type('Analytics')

    // All three tab entries should be visible
    await expect(palette.getByRole('option', { name: 'Study Analytics' })).toBeVisible()
    await expect(palette.getByRole('option', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(palette.getByRole('option', { name: 'AI Analytics' })).toBeVisible()

    // Selecting Study Analytics navigates to the correct URL
    await palette.getByRole('option', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
  })
})
