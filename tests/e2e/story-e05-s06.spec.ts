/**
 * ATDD acceptance tests for E05-S06: Streak Milestone Celebrations
 *
 * Tests milestone toast notifications, confetti animations, badge persistence,
 * prefers-reduced-motion support, and milestone collection gallery.
 *
 * RED phase: All tests should FAIL until implementation is complete.
 */
import { test, expect } from '../support/fixtures'
import { goToOverview } from '../support/helpers/navigation'
import { createStudyAction } from '../support/fixtures/factories/course-factory'

// ── Helpers ──────────────────────────────────────────────────

/** Build a study log with one lesson_complete per day for N consecutive days ending today. */
function buildStreakLog(days: number) {
  const actions = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(12, 0, 0, 0) // noon to avoid DST edge cases
    actions.push(
      createStudyAction({
        type: 'lesson_complete',
        courseId: 'streak-test-course',
        lessonId: `lesson-day-${days - i}`,
        timestamp: d.toISOString(),
      })
    )
  }
  return actions
}

// ── AC1: 7-day milestone toast ───────────────────────────────

test.describe('Streak Milestone Celebrations (E05-S06)', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on tablet viewports
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC1: should display 7-day milestone toast with badge', async ({
    page,
    localStorage,
  }) => {
    // Given: streak reaches exactly 7 days
    await localStorage.seed('study-log', buildStreakLog(7))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // Then: a Sonner toast appears with 7-day milestone content
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // And: a milestone badge is displayed
    const badge = page.getByTestId('milestone-badge-7')
    await expect(badge).toBeVisible()
  })

  // ── AC2: 30-day milestone toast ──────────────────────────

  test('AC2: should display 30-day milestone toast with badge', async ({
    page,
    localStorage,
  }) => {
    await localStorage.seed('study-log', buildStreakLog(30))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /30/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-30')
    await expect(badge).toBeVisible()
  })

  // ── AC3: 60-day milestone toast ──────────────────────────

  test('AC3: should display 60-day milestone toast with badge', async ({
    page,
    localStorage,
  }) => {
    await localStorage.seed('study-log', buildStreakLog(60))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /60/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-60')
    await expect(badge).toBeVisible()
  })

  // ── AC4: 100-day milestone toast ─────────────────────────

  test('AC4: should display 100-day milestone toast with badge', async ({
    page,
    localStorage,
  }) => {
    await localStorage.seed('study-log', buildStreakLog(100))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /100/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('milestone-badge-100')
    await expect(badge).toBeVisible()
  })

  // ── AC5: prefers-reduced-motion ──────────────────────────

  test('AC5: should suppress celebration animation when prefers-reduced-motion is active', async ({
    page,
    localStorage,
  }) => {
    // Given: reduced motion is preferred
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await localStorage.seed('study-log', buildStreakLog(7))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // Then: toast still appears (badge visible)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7/i })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // And: no confetti canvas should be rendered
    const confettiCanvas = page.locator('canvas')
    await expect(confettiCanvas).toHaveCount(0)
  })

  // ── AC6: milestone collection view ───────────────────────

  test('AC6: should display earned badges with dates and locked placeholders', async ({
    page,
    localStorage,
  }) => {
    // Given: learner has a 7-day streak (earned 7-day badge)
    await localStorage.seed('study-log', buildStreakLog(7))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // When: milestone collection is opened
    const milestoneCollectionTrigger = page.getByTestId('milestone-collection-trigger')
    await milestoneCollectionTrigger.click()

    // Then: earned badge shows with date
    const earnedBadge = page.getByTestId('milestone-badge-7')
    await expect(earnedBadge).toBeVisible()

    // And: unearned milestones shown as locked/dimmed
    const lockedBadge30 = page.getByTestId('milestone-badge-30-locked')
    await expect(lockedBadge30).toBeVisible()

    const lockedBadge60 = page.getByTestId('milestone-badge-60-locked')
    await expect(lockedBadge60).toBeVisible()

    const lockedBadge100 = page.getByTestId('milestone-badge-100-locked')
    await expect(lockedBadge100).toBeVisible()
  })

  // ── AC7: repeated milestone after streak reset ───────────

  test('AC7: should celebrate milestone again after streak reset and re-achievement', async ({
    page,
    localStorage,
  }) => {
    // Given: first 7-day streak achieved and milestone recorded
    await localStorage.seed('study-log', buildStreakLog(7))

    // Simulate that the 7-day milestone was already celebrated previously
    await localStorage.seed('streak-milestones', [
      {
        id: 'milestone-7-1',
        milestoneValue: 7,
        earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ])

    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // Then: celebration toast appears again for the repeated milestone
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /7/i })
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  // ── AC6 (extended): milestone badge shows achievement date ─

  test('AC6: milestone badge should display the date it was achieved', async ({
    page,
    localStorage,
  }) => {
    await localStorage.seed('study-log', buildStreakLog(7))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // Open milestone collection
    const trigger = page.getByTestId('milestone-collection-trigger')
    await trigger.click()

    // The earned badge should contain today's date (or relative date text)
    const earnedBadge = page.getByTestId('milestone-badge-7')
    await expect(earnedBadge).toBeVisible()
    // Should have a date indicator (exact format TBD during implementation)
    await expect(earnedBadge).toContainText(/\d/)
  })

  // ── AC1: confetti animation fires on milestone ────────────

  test('AC1: should trigger confetti animation on 7-day milestone', async ({
    page,
    localStorage,
  }) => {
    // Intercept canvas-confetti by checking for canvas element
    await localStorage.seed('study-log', buildStreakLog(7))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToOverview(page)

    // canvas-confetti injects a <canvas> element when firing
    const confettiCanvas = page.locator('canvas')
    await expect(confettiCanvas).toBeVisible({ timeout: 5000 })
  })
})
