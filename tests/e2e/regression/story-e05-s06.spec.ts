/**
 * ATDD acceptance tests for E05-S06: Streak Milestone Celebrations
 *
 * Tests milestone toast notifications, confetti animations, badge persistence,
 * prefers-reduced-motion support, and milestone collection gallery.
 */
import { test, expect } from '../support/fixtures'
import { goToOverview } from '../support/helpers/navigation'
import { buildStreakLog } from '../support/helpers/streak-helpers'

test.describe('Streak Milestone Celebrations (E05-S06)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate once to enable localStorage/sessionStorage access
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
      sessionStorage.clear()
    })
  })

  // ── AC1: 7-day milestone toast ───────────────────────────────

  test('AC1: should display 7-day milestone toast with badge', async ({ page, localStorage }) => {
    // Given: streak reaches exactly 7 days
    await localStorage.seed('study-log', buildStreakLog(7))
    // Single navigation triggers mount effect → milestone detection → toast
    await goToOverview(page)

    // Then: a Sonner toast appears with 7-day milestone content
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // And: a milestone badge is displayed
    const badge = page.getByTestId('milestone-badge-7')
    await expect(badge).toBeVisible()

    // And: confetti animation fires (canvas-confetti injects a <canvas>)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
  })

  // ── AC2: 30-day milestone toast ──────────────────────────────

  test('AC2: should display 30-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(30))
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /30-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-30')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
  })

  // ── AC3: 60-day milestone toast ──────────────────────────────

  test('AC3: should display 60-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(60))
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /60-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-60')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
  })

  // ── AC4: 100-day milestone toast ─────────────────────────────

  test('AC4: should display 100-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(100))
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /100-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-100')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
  })

  // ── AC5: prefers-reduced-motion ──────────────────────────────

  test('AC5: should suppress celebration animation when prefers-reduced-motion is active', async ({
    page,
    localStorage,
  }) => {
    // Given: reduced motion is preferred
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await localStorage.seed('study-log', buildStreakLog(7))
    await goToOverview(page)

    // Then: toast still appears with badge
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // And: milestone badge is still displayed
    await expect(page.getByTestId('milestone-badge-7')).toBeVisible()

    // And: no confetti canvas should be rendered
    const confettiCanvas = page.locator('canvas')
    await expect(confettiCanvas).toHaveCount(0)
  })

  // ── AC6: milestone collection view ───────────────────────────

  test('AC6: should display earned badges with dates and locked placeholders', async ({
    page,
    localStorage,
  }) => {
    // Given: learner has a 7-day streak (earned 7-day badge)
    await localStorage.seed('study-log', buildStreakLog(7))
    await goToOverview(page)

    // When: milestone collection is opened
    const milestoneCollectionTrigger = page.getByTestId('milestone-collection-trigger')
    await milestoneCollectionTrigger.click()

    // Then: earned badge shows with date (gallery-prefixed to avoid toast collision)
    const earnedBadge = page.getByTestId('gallery-milestone-badge-7')
    await expect(earnedBadge).toBeVisible()
    // Should have a formatted date like "Mar 7, 2026"
    await expect(earnedBadge).toContainText(/[A-Z][a-z]+ \d{1,2}, \d{4}/)

    // And: unearned milestones shown as locked/dimmed
    await expect(page.getByTestId('gallery-milestone-badge-30-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-60-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-100-locked')).toBeVisible()
  })

  // ── AC7: repeated milestone after streak reset ───────────────

  test('AC7: should celebrate milestone again after streak reset and re-achievement', async ({
    page,
    localStorage,
  }) => {
    // Given: first 7-day streak achieved and milestone recorded from a previous streak
    await localStorage.seed('study-log', buildStreakLog(7))
    await localStorage.seed('streak-milestones', [
      {
        id: 'milestone-7-1',
        milestoneValue: 7,
        earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        streakStartDate: '2026-02-01',
      },
    ])

    await goToOverview(page)

    // Then: celebration toast appears again for the repeated milestone
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})
