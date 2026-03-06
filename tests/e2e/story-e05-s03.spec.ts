/**
 * E05-S03: Study Goals & Weekly Adherence — ATDD Acceptance Tests
 *
 * RED stage: All tests should FAIL until implementation is complete.
 *
 * Verifies:
 *   - AC1: Empty state prompts goal setup with CTA
 *   - AC2: Goal configuration form (daily/weekly, time/session, target)
 *   - AC3: Daily goal progress widget on dashboard
 *   - AC4: Weekly goal cumulative progress
 *   - AC5: Weekly adherence percentage
 *   - AC6: Goal completion visual indicator
 */
import { test, expect } from '../support/fixtures'

test.describe('Study Goals & Weekly Adherence (E05-S03)', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on narrow viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  // ── AC1: Empty state with CTA ──

  test('AC1: goals widget shows empty state when no goals configured', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const goalsWidget = page.getByTestId('study-goals-widget')
    await expect(goalsWidget).toBeVisible()

    // Empty state should prompt user to set a goal
    const emptyState = page.getByTestId('goals-empty-state')
    await expect(emptyState).toBeVisible()

    // CTA button to configure first goal
    const setupCta = page.getByTestId('goals-setup-cta')
    await expect(setupCta).toBeVisible()
  })

  // ── AC2: Goal configuration form ──

  test('AC2: goal configuration form allows choosing daily or weekly goal', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Open goal configuration
    const setupCta = page.getByTestId('goals-setup-cta')
    await setupCta.click()

    // Should show goal frequency options
    const dailyOption = page.getByTestId('goal-frequency-daily')
    const weeklyOption = page.getByTestId('goal-frequency-weekly')
    await expect(dailyOption).toBeVisible()
    await expect(weeklyOption).toBeVisible()
  })

  test('AC2: goal configuration allows selecting time-based or session-based metric', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await page.getByTestId('goals-setup-cta').click()

    // Select daily goal first
    await page.getByTestId('goal-frequency-daily').click()

    // Should show metric type options
    const timeMetric = page.getByTestId('goal-metric-time')
    const sessionMetric = page.getByTestId('goal-metric-sessions')
    await expect(timeMetric).toBeVisible()
    await expect(sessionMetric).toBeVisible()
  })

  test('AC2: goal configuration allows setting a numeric target', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await page.getByTestId('goals-setup-cta').click()
    await page.getByTestId('goal-frequency-daily').click()
    await page.getByTestId('goal-metric-time').click()

    // Numeric target input should be visible
    const targetInput = page.getByTestId('goal-target-input')
    await expect(targetInput).toBeVisible()

    // Should accept numeric value
    await targetInput.fill('60')
    await expect(targetInput).toHaveValue('60')
  })

  // ── AC3: Daily goal progress widget ──

  test('AC3: daily goal progress shows current progress toward today\'s goal', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed: daily goal of 60 minutes
    await localStorage.seed('study-goals', {
      frequency: 'daily',
      metric: 'time',
      target: 60,
    })

    // Seed: 45 minutes of study today
    const today = new Date()
    today.setHours(10, 0, 0, 0)
    await localStorage.seed('study-log', [
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: today.toISOString(),
        durationMs: 45 * 60 * 1000,
      },
    ])

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Progress text should show "45 / 60 min" or similar
    const progressText = page.getByTestId('goal-progress-text')
    await expect(progressText).toBeVisible()
    await expect(progressText).toContainText('45')
    await expect(progressText).toContainText('60')
  })

  test('AC3: daily goal progress shows visual progress indicator', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    await localStorage.seed('study-goals', {
      frequency: 'daily',
      metric: 'time',
      target: 60,
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Visual progress indicator (ring or bar) should be visible
    const progressIndicator = page.getByTestId('goal-progress-indicator')
    await expect(progressIndicator).toBeVisible()
  })

  // ── AC4: Weekly goal cumulative progress ──

  test('AC4: weekly goal shows cumulative weekly progress', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed: weekly goal of 300 minutes
    await localStorage.seed('study-goals', {
      frequency: 'weekly',
      metric: 'time',
      target: 300,
    })

    // Seed: sessions across the current week
    const sessions = []
    for (let i = 0; i < 3; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(10, 0, 0, 0)
      sessions.push({
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: d.toISOString(),
        durationMs: 60 * 60 * 1000, // 60 min each
      })
    }
    await localStorage.seed('study-log', sessions)

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Should show weekly progress (180 / 300 min or similar)
    const progressText = page.getByTestId('goal-progress-text')
    await expect(progressText).toBeVisible()
    await expect(progressText).toContainText('180')
    await expect(progressText).toContainText('300')
  })

  // ── AC5: Weekly adherence percentage ──

  test('AC5: weekly adherence percentage is displayed', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed: daily goal configured
    await localStorage.seed('study-goals', {
      frequency: 'daily',
      metric: 'time',
      target: 30,
    })

    // Seed: studied on 5 of the last 7 days
    const sessions = []
    for (const daysAgo of [0, 1, 2, 4, 6]) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      d.setHours(10, 0, 0, 0)
      sessions.push({
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: d.toISOString(),
        durationMs: 45 * 60 * 1000,
      })
    }
    await localStorage.seed('study-log', sessions)

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Adherence percentage should be visible
    const adherence = page.getByTestId('goal-adherence-percentage')
    await expect(adherence).toBeVisible()
    // 5 out of 7 days = ~71%
    await expect(adherence).toContainText('%')
  })

  // ── AC6: Goal completion visual indicator ──

  test('AC6: progress widget indicates completion when goal is met', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed: daily goal of 30 minutes
    await localStorage.seed('study-goals', {
      frequency: 'daily',
      metric: 'time',
      target: 30,
    })

    // Seed: 45 minutes studied today (exceeds goal)
    const today = new Date()
    today.setHours(10, 0, 0, 0)
    await localStorage.seed('study-log', [
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: today.toISOString(),
        durationMs: 45 * 60 * 1000,
      },
    ])

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Completion indicator should be visible (checkmark, filled ring, etc.)
    const completionIndicator = page.getByTestId('goal-completed-indicator')
    await expect(completionIndicator).toBeVisible()
  })
})
