/**
 * E05-S02: Streak Pause & Freeze Days — ATDD Acceptance Tests
 *
 * RED stage: All tests should FAIL until implementation is complete.
 *
 * Verifies:
 *   - AC1: Pause toggle preserves streak with paused indicator
 *   - AC2: Resume clears pause, resets 24-hour window
 *   - AC3: Freeze day selector (1-3 days of week)
 *   - AC4: Freeze days prevent streak reset
 *   - AC5: Study on freeze day counts as regular day
 *   - AC6: Max 3 freeze days validation
 *   - AC7: Pause suspends freeze logic
 */
import { test, expect } from '../../support/fixtures'
import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'

function makeStreakEntry(daysAgo: number): {
  type: string
  courseId: string
  timestamp: string
} {
  const d = new Date(getRelativeDate(-daysAgo))
  d.setHours(12, 0, 0, 0)
  return {
    type: 'lesson_complete',
    courseId: 'course-1',
    timestamp: d.toISOString(),
  }
}

test.describe('Streak Pause & Freeze Days (E05-S02)', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on narrow viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  // ── AC1: Pause toggle ──

  test('AC1: pause toggle is visible on streak widget', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [makeStreakEntry(0), makeStreakEntry(1)])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // A dedicated pause/resume toggle should exist on the streak widget
    const pauseToggle = page.getByTestId('streak-pause-toggle')
    await expect(pauseToggle).toBeVisible()
  })

  test('AC1: pausing streak shows paused indicator and preserves count', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeStreakEntry(0),
      makeStreakEntry(1),
      makeStreakEntry(2),
    ])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify streak is 3 before pausing
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('3')

    // Toggle pause
    const pauseToggle = page.getByTestId('streak-pause-toggle')
    await pauseToggle.click()

    // Should show paused indicator
    const pausedIndicator = page.getByTestId('streak-paused-indicator')
    await expect(pausedIndicator).toBeVisible()

    // Streak count should be preserved (still 3)
    await expect(streakValue).toHaveText('3')
  })

  // ── AC2: Resume ──

  test('AC2: resuming streak clears paused state', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [makeStreakEntry(0), makeStreakEntry(1)])

    // Seed paused state
    await localStorage.seed('study-streak-pause', {
      enabled: true,
      startDate: FIXED_DATE,
      days: 7,
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Should show paused indicator
    const pausedIndicator = page.getByTestId('streak-paused-indicator')
    await expect(pausedIndicator).toBeVisible()

    // Click resume
    const resumeToggle = page.getByTestId('streak-pause-toggle')
    await resumeToggle.click()

    // Paused indicator should disappear
    await expect(pausedIndicator).not.toBeVisible()

    // Streak value should still be intact
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('2')
  })

  test('AC2: streak does not reset on resume when last study was yesterday', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    // Seed: studied yesterday only (no study today)
    await localStorage.seed('study-log', [makeStreakEntry(1)])
    // Seed active pause
    await localStorage.seed('study-streak-pause', {
      enabled: true,
      startDate: FIXED_DATE,
      days: 99999,
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify paused with streak=1
    await expect(page.getByTestId('streak-paused-indicator')).toBeVisible()
    await expect(page.getByTestId('current-streak-value')).toHaveText('1')

    // Click resume
    await page.getByTestId('streak-pause-toggle').click()

    // Paused indicator should disappear
    await expect(page.getByTestId('streak-paused-indicator')).not.toBeVisible()

    // Streak should still be 1 (yesterday's study, 24h window resets from now)
    await expect(page.getByTestId('current-streak-value')).toHaveText('1')
  })

  // ── AC3: Freeze day configuration ──

  test('AC3: freeze day selector allows selecting days of the week', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Open freeze day settings
    const freezeSettingsButton = page.getByTestId('freeze-days-settings')
    await expect(freezeSettingsButton).toBeVisible()
    await freezeSettingsButton.click()

    // Should show 7 day-of-week options
    const dayOptions = page.getByTestId('freeze-day-option')
    await expect(dayOptions).toHaveCount(7)

    // Select Saturday (index 6)
    await dayOptions.nth(6).click()

    // Selected day should be visually indicated
    await expect(dayOptions.nth(6)).toHaveAttribute('data-selected', 'true')
  })

  test('AC3: saving freeze days persists selection across dialog re-open', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const freezeSettingsButton = page.getByTestId('freeze-days-settings')
    await freezeSettingsButton.click()

    const dayOptions = page.getByTestId('freeze-day-option')

    // Select Saturday (index 6) and Monday (index 1)
    await dayOptions.nth(6).click()
    await dayOptions.nth(1).click()
    await expect(dayOptions.nth(6)).toHaveAttribute('data-selected', 'true')
    await expect(dayOptions.nth(1)).toHaveAttribute('data-selected', 'true')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    // Re-open dialog
    await freezeSettingsButton.click()

    // Previously selected days should still be selected
    const reopenedOptions = page.getByTestId('freeze-day-option')
    await expect(reopenedOptions.nth(6)).toHaveAttribute('data-selected', 'true')
    await expect(reopenedOptions.nth(1)).toHaveAttribute('data-selected', 'true')
    // Unselected day should remain unselected
    await expect(reopenedOptions.nth(3)).toHaveAttribute('data-selected', 'false')
  })

  // ── AC4: Freeze days prevent streak reset ──

  test('AC4: streak does not reset on configured freeze day with no activity', async ({
    page,
    localStorage,
  }) => {
    // Today is a freeze day, no study today, but studied yesterday
    const todayDayIndex = new Date(FIXED_DATE).getDay() // 0=Sun, 1=Mon, ...

    await page.goto('/')
    // Seed: studied yesterday and day before, but NOT today
    await localStorage.seed('study-log', [makeStreakEntry(1), makeStreakEntry(2)])
    // Configure today as a freeze day
    await localStorage.seed('study-streak-freeze-days', {
      freezeDays: [todayDayIndex],
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Streak should be preserved (not reset to 0) because today is a freeze day
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('2')
  })

  // ── AC5: Study on freeze day counts as regular day ──

  test('AC5: studying on a freeze day increments streak normally', async ({
    page,
    localStorage,
  }) => {
    const todayDayIndex = new Date(FIXED_DATE).getDay()

    await page.goto('/')
    // Seed: studied today, yesterday, day before — today is also a freeze day
    await localStorage.seed('study-log', [
      makeStreakEntry(0),
      makeStreakEntry(1),
      makeStreakEntry(2),
    ])
    await localStorage.seed('study-streak-freeze-days', {
      freezeDays: [todayDayIndex],
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Streak should be 3 (freeze day consumed as regular day)
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('3')
  })

  // ── AC6: Max 3 freeze days validation ──

  test('AC6: cannot select more than 3 freeze days', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Open freeze day settings
    const freezeSettingsButton = page.getByTestId('freeze-days-settings')
    await freezeSettingsButton.click()

    const dayOptions = page.getByTestId('freeze-day-option')

    // Select 3 days
    await dayOptions.nth(0).click() // Sun
    await dayOptions.nth(2).click() // Tue
    await dayOptions.nth(6).click() // Sat

    // Try to select a 4th day
    await dayOptions.nth(4).click() // Thu

    // 4th day should NOT be selected
    await expect(dayOptions.nth(4)).not.toHaveAttribute('data-selected', 'true')

    // Validation message should appear
    const validationMsg = page.getByTestId('freeze-days-validation')
    await expect(validationMsg).toBeVisible()
    await expect(validationMsg).toContainText('3')
  })

  // ── AC7: Pause suspends freeze logic ──

  test('AC7: freeze logic is suspended while streak is paused', async ({ page, localStorage }) => {
    const todayDayIndex = new Date(FIXED_DATE).getDay()

    await page.goto('/')
    await localStorage.seed('study-log', [makeStreakEntry(1), makeStreakEntry(2)])

    // Configure today as freeze day AND pause the streak
    await localStorage.seed('study-streak-freeze-days', {
      freezeDays: [todayDayIndex],
    })
    await localStorage.seed('study-streak-pause', {
      enabled: true,
      startDate: FIXED_DATE,
      days: 7,
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Paused indicator should be visible (pause takes precedence)
    const pausedIndicator = page.getByTestId('streak-paused-indicator')
    await expect(pausedIndicator).toBeVisible()

    // Streak should be preserved via pause mechanism, not freeze
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('2')
  })
})
