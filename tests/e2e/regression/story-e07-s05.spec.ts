import { FIXED_DATE } from './../../utils/test-time'
/**
 * E07-S05: Smart Study Schedule Suggestion
 *
 * Tests the three states of the StudyScheduleWidget on the Overview dashboard:
 *   1. insufficient-data  — fewer than 7 distinct study days in the log
 *   2. no-goal            — 7+ days but no time-based study goal
 *   3. ready              — 7+ days AND a time-based study goal
 */
import { test, expect } from '../../support/fixtures'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

/** Build a study-log array with `count` lesson_complete entries spread across `daySpread`
 *  distinct days, all at the specified hour. Uses explicit date construction so the hour
 *  of each entry is exactly `hour` regardless of the current wall clock time. */
function makeStudyLog(count: number, daySpread: number, hour = 9) {
  const now = new Date(FIXED_DATE)
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = i % daySpread
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0, 0)
    return {
      type: 'lesson_complete',
      courseId: 'nci-access',
      lessonId: `lesson-${i}`,
      timestamp: d.toISOString(),
    }
  })
}

/** A weekly time-based study goal: 300 min/week */
const WEEKLY_TIME_GOAL = {
  frequency: 'weekly',
  metric: 'time',
  target: 300,
  createdAt: FIXED_DATE,
}

/** Minimal in-progress course-progress entries (courses with 1 lesson done, not 100%) */
const ACTIVE_COURSE_PROGRESS = {
  'behavior-skills-breakthrough': {
    courseId: 'behavior-skills-breakthrough',
    completedLessons: ['bsb-human-behavior-introduction'],
    notes: {},
    startedAt: '2026-01-01T00:00:00.000Z',
    lastAccessedAt: '2026-01-01T00:00:00.000Z',
  },
  '6mx': {
    courseId: '6mx',
    completedLessons: ['6mx-welcome-intro'],
    notes: {},
    startedAt: '2026-01-01T00:00:00.000Z',
    lastAccessedAt: '2026-01-01T00:00:00.000Z',
  },
}

test.describe('E07-S05: Smart Study Schedule Suggestion', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay at tablet viewports
    await page.evaluate(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  test('AC2: shows insufficient-data state when fewer than 7 study days', async ({ page }) => {
    // Seed only 3 distinct days
    await page.addInitScript(
      ({ log }) => {
        window.localStorage.setItem('study-log', JSON.stringify(log))
      },
      { log: makeStudyLog(6, 3) }
    )

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const widget = page.getByTestId('schedule-insufficient-data')
    await widget.scrollIntoViewIfNeeded()
    await expect(widget).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await expect(widget).toContainText('Build Your Study Pattern')
    await expect(widget).toContainText('7 days')
  })

  test('AC5: shows no-goal state when 7+ days but no time-based goal set', async ({ page }) => {
    // Seed 10 distinct study days, no goal
    await page.addInitScript(
      ({ log }) => {
        window.localStorage.setItem('study-log', JSON.stringify(log))
        window.localStorage.removeItem('study-goals')
      },
      { log: makeStudyLog(20, 10, 9) }
    )

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const widget = page.getByTestId('schedule-no-goal')
    await widget.scrollIntoViewIfNeeded()
    await expect(widget).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    // Optimal hour should also be displayed in the no-goal state
    await expect(widget.getByTestId('schedule-optimal-hour')).toBeVisible()
  })

  test('AC1 + AC3: shows full schedule with optimal hour and daily duration when ready', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ log, goal }) => {
        window.localStorage.setItem('study-log', JSON.stringify(log))
        window.localStorage.setItem('study-goals', JSON.stringify(goal))
      },
      { log: makeStudyLog(20, 10, 9), goal: WEEKLY_TIME_GOAL }
    )

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const widget = page.getByTestId('schedule-ready')
    await widget.scrollIntoViewIfNeeded()
    await expect(widget).toBeVisible({ timeout: TIMEOUTS.EXTENDED })

    // AC1: Optimal hour should be visible and contain "9" (the seeded peak hour)
    const hourDisplay = widget.getByTestId('schedule-optimal-hour')
    await expect(hourDisplay).toBeVisible()
    await expect(hourDisplay).toContainText('9')

    // AC3: Daily duration should be visible and contain a time unit
    const durationDisplay = widget.getByTestId('schedule-daily-duration')
    await expect(durationDisplay).toBeVisible()
    await expect(durationDisplay).toContainText(/\d+\s*(min|h)/)
  })

  test('AC4: shows per-course time allocation rows in ready state', async ({ page }) => {
    await page.addInitScript(
      ({ log, goal, progress }) => {
        window.localStorage.setItem('study-log', JSON.stringify(log))
        window.localStorage.setItem('study-goals', JSON.stringify(goal))
        window.localStorage.setItem('course-progress', JSON.stringify(progress))
        // Set migration version so the progress lib skips migration
        window.localStorage.setItem('notes-migration-version', '1')
      },
      {
        log: makeStudyLog(20, 10, 9),
        goal: WEEKLY_TIME_GOAL,
        progress: ACTIVE_COURSE_PROGRESS,
      }
    )

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const widget = page.getByTestId('schedule-ready')
    await widget.scrollIntoViewIfNeeded()
    await expect(widget).toBeVisible({ timeout: TIMEOUTS.EXTENDED })

    // Course time allocation section heading should appear
    await expect(widget.getByText('Course Time Allocation')).toBeVisible()

    // At least one course row with a "X min" label should be visible
    const minuteLabels = widget.locator('text=/^\\d+ min$/')
    await expect(minuteLabels.first()).toBeVisible()
  })

  test('AC5: settings link navigates to /settings from no-goal state', async ({ page }) => {
    await page.addInitScript(
      ({ log }) => {
        window.localStorage.setItem('study-log', JSON.stringify(log))
        window.localStorage.removeItem('study-goals')
      },
      { log: makeStudyLog(20, 10, 9) }
    )

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const widget = page.getByTestId('schedule-no-goal')
    await widget.scrollIntoViewIfNeeded()
    await expect(widget).toBeVisible({ timeout: TIMEOUTS.EXTENDED })

    const settingsLink = page.getByTestId('schedule-settings-link')
    await settingsLink.click()

    await expect(page).toHaveURL('/settings', { timeout: TIMEOUTS.LONG })
  })
})
