/**
 * ATDD acceptance tests for E05-S06: Streak Milestone Celebrations
 *
 * Tests milestone toast notifications, confetti animations, badge persistence,
 * prefers-reduced-motion support, and milestone collection gallery.
 */
import { test, expect } from '../../support/fixtures'
import { goToOverview } from '../../support/helpers/navigation'
import { buildStreakLog } from '../../support/helpers/streak-helpers'
import { getRelativeTimestamp } from './../../utils/test-time'

test.describe('Streak Milestone Celebrations (E05-S06)', () => {
  // Serial mode: milestone detection uses sessionStorage guards that can race
  // when the dev server is under parallel load from multiple browser contexts.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // Navigate once to enable localStorage/sessionStorage access
    await page.goto('/')
    await page.evaluate(() => {
      // Clear milestone and streak data BEFORE next navigation to prevent
      // stale data from triggering sessionStorage guards in parallel runs
      localStorage.removeItem('streak-milestones')
      localStorage.removeItem('study-log')
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
    await expect(toast).toBeVisible({ timeout: 10000 })

    // And: a milestone badge is displayed
    const badge = page.getByTestId('milestone-badge-7')
    await expect(badge).toBeVisible()

    // And: confetti animation fires (canvas-confetti injects a <canvas>)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 })
  })

  // ── AC2: 30-day milestone toast ──────────────────────────────

  test('AC2: should display 30-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(30))
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /30-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    const badge = page.getByTestId('milestone-badge-30')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 })
  })

  // ── AC3: 60-day milestone toast ──────────────────────────────

  test('AC3: should display 60-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(60))
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /60-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    const badge = page.getByTestId('milestone-badge-60')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 })
  })

  // ── AC4: 100-day milestone toast ─────────────────────────────

  test('AC4: should display 100-day milestone toast with badge', async ({ page, localStorage }) => {
    await localStorage.seed('study-log', buildStreakLog(100))
    await goToOverview(page)

    // 100-day streak triggers 4 simultaneous toasts (7, 30, 60, 100).
    // Sonner's default visibleToasts=3 hides the 4th; wait for earlier toasts to dismiss (8s duration).
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /100-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 15000 })

    const badge = page.getByTestId('milestone-badge-100')
    await expect(badge).toBeVisible()

    // And: confetti animation fires
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
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
    await expect(toast).toBeVisible({ timeout: 10000 })

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
        earnedAt: new Date(getRelativeTimestamp(-30)).toISOString(),
        streakStartDate: '2026-02-01',
      },
    ])

    await goToOverview(page)

    // Then: celebration toast appears again for the repeated milestone
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7-Day Streak/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    // And: localStorage now contains TWO milestone entries for milestoneValue: 7
    const milestones =
      await localStorage.get<Array<{ milestoneValue: number; streakStartDate: string }>>(
        'streak-milestones'
      )
    expect(milestones).not.toBeNull()
    const sevenDayEntries = milestones!.filter(m => m.milestoneValue === 7)
    expect(sevenDayEntries).toHaveLength(2)
    // First entry is the seeded old streak, second is the newly detected one
    expect(sevenDayEntries[0].streakStartDate).toBe('2026-02-01')
    expect(sevenDayEntries[1].streakStartDate).not.toBe('2026-02-01')
  })

  // ── Boundary: below milestone threshold ──────────────────────

  test('should NOT display any toast for a 6-day streak', async ({ page, localStorage }) => {
    // Given: streak is 6 days (below the 7-day milestone threshold)
    await localStorage.seed('study-log', buildStreakLog(6))
    await goToOverview(page)

    // Then: no milestone toast should appear
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Streak/i })
    // Wait for potential toast to appear, then verify absence
    await expect(toast).toHaveCount(0, { timeout: 2000 })
  })

  // ── Simultaneous milestones: 30-day triggers 7 + 30 ──────────

  test('should display both 7-day and 30-day toasts for a 30-day streak with no prior celebrations', async ({
    page,
    localStorage,
  }) => {
    // Given: 30-day streak with NO prior milestone celebrations
    await localStorage.seed('study-log', buildStreakLog(30))
    // No streak-milestones seeded → both 7 and 30 are uncelebrated
    await goToOverview(page)

    // Then: both milestone toasts appear
    const toast7 = page.locator('[data-sonner-toast]').filter({ hasText: /7-Day Streak/i })
    const toast30 = page.locator('[data-sonner-toast]').filter({ hasText: /30-Day Streak/i })
    await expect(toast7).toBeVisible({ timeout: 10000 })
    await expect(toast30).toBeVisible({ timeout: 10000 })

    // And: localStorage has entries for both milestones
    const milestones =
      await localStorage.get<Array<{ milestoneValue: number }>>('streak-milestones')
    expect(milestones).not.toBeNull()
    const values = milestones!.map(m => m.milestoneValue).sort((a, b) => a - b)
    expect(values).toEqual([7, 30])
  })

  // ── Gallery edge case: multi-earned badges ────────────────────

  test('AC6+: should display multiple earned badges in gallery for 30-day streak', async ({
    page,
    localStorage,
  }) => {
    // Given: 30-day streak (earns both 7-day and 30-day badges)
    await localStorage.seed('study-log', buildStreakLog(30))
    await goToOverview(page)

    // Wait for milestones to be detected and recorded
    const toast30 = page.locator('[data-sonner-toast]').filter({ hasText: /30-Day Streak/i })
    await expect(toast30).toBeVisible({ timeout: 10000 })

    // When: milestone collection is opened
    await page.getByTestId('milestone-collection-trigger').click()

    // Then: both 7-day and 30-day badges are earned (not locked)
    await expect(page.getByTestId('gallery-milestone-badge-7')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-30')).toBeVisible()

    // And: 60-day and 100-day are still locked
    await expect(page.getByTestId('gallery-milestone-badge-60-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-100-locked')).toBeVisible()
  })

  // ── Gallery edge case: zero-streak all locked ─────────────────

  test('AC6+: should display all badges as locked when no milestones earned', async ({
    page,
    localStorage,
  }) => {
    // Given: streak is 0 days (no milestones)
    await localStorage.seed('study-log', [])
    await goToOverview(page)

    // When: milestone collection is opened
    await page.getByTestId('milestone-collection-trigger').click()

    // Then: all 4 milestones shown as locked
    await expect(page.getByTestId('gallery-milestone-badge-7-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-30-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-60-locked')).toBeVisible()
    await expect(page.getByTestId('gallery-milestone-badge-100-locked')).toBeVisible()
  })
})
