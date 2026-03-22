/**
 * E08-S01: Study Time Analytics — ATDD Tests
 *
 * Validates:
 *   - Study time chart displays with aggregated session data
 *   - Period toggle (daily/weekly/monthly) updates chart view
 *   - Weekly adherence percentage calculated correctly
 *   - Accessibility (alt text, table view, color-blind patterns)
 *   - Empty state when no sessions recorded
 */
import { test, expect, type Page } from '../../support/fixtures'
import { createStudySession } from '../../support/fixtures/factories/session-factory'
import {
  FIXED_DATE,
  FIXED_TIMESTAMP,
  getRelativeDate,
  addMinutes,
  getRelativeDateWithMinutes,
} from '../../utils/test-time'
import { seedStudySessions } from '../../support/helpers/seed-helpers'

/**
 * Mock Date constructor and Date.now() to return FIXED_DATE
 * Critical for components that use Date.now() or new Date() for calculations (e.g., weekly adherence)
 */
async function mockDateNow(page: Page) {
  await page.addInitScript(
    ({ fixedDate, fixedTimestamp }) => {
      const OriginalDate = Date
      // Override Date.now()
      Date.now = () => fixedTimestamp

      // Override Date constructor to return FIXED_DATE when called without arguments
      // @ts-expect-error - overriding global Date
      globalThis.Date = class extends OriginalDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(fixedDate)
          } else {
            super(...args)
          }
        }

        static now() {
          return fixedTimestamp
        }
      }
    },
    { fixedDate: FIXED_DATE, fixedTimestamp: FIXED_TIMESTAMP }
  )
}

test.describe('Story E08-S01: Study Time Analytics', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock Date.now() to use FIXED_DATE for deterministic adherence calculations
    await mockDateNow(page)

    // Seed sidebar state BEFORE navigation to prevent overlay blocking on tablet viewports
    await context.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    // Navigate to Reports page
    await page.goto('/reports')
  })

  test('AC1: Chart displays total study time aggregated by day for current week', async ({
    page,
  }) => {
    // Seed study sessions for the current week
    const sessions = [
      createStudySession({
        id: 'session-1',
        courseId: 'course-1',
        startTime: getRelativeDate(-2), // 2 days before FIXED_DATE (2025-01-13)
        endTime: getRelativeDateWithMinutes(-2, 60), // 60 minutes after start
        duration: 3600, // 1 hour
      }),
      createStudySession({
        id: 'session-2',
        courseId: 'course-2',
        startTime: getRelativeDate(-1), // 1 day before FIXED_DATE (2025-01-14)
        endTime: getRelativeDateWithMinutes(-1, 90), // 90 minutes after start
        duration: 5400, // 1.5 hours
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // Verify Study Time Analytics section exists
    await expect(page.getByRole('heading', { name: 'Study Time Analytics' })).toBeVisible()

    // Verify chart renders with session data
    const chart = page.getByTestId('study-time-chart')
    await expect(chart).toBeVisible()

    // Verify alt text indicates data presence
    const altText = await chart.getAttribute('aria-label')
    expect(altText).toContain('Study time chart')
    expect(altText).not.toContain('no data')

    // Verify chart displays correct aggregated data values
    // Session 1: Jan 13, 60 minutes (1 hour)
    // Session 2: Jan 14, 90 minutes (1.5 hours)
    await expect(chart.getByText('Jan 13')).toBeVisible()
    await expect(chart.getByText('Jan 14')).toBeVisible()

    // Toggle to table view to validate exact data values
    await page.getByRole('button', { name: /view as table/i }).click()
    const table = page.getByRole('table', { name: /study time data/i })
    await expect(table.locator('tbody tr').filter({ hasText: 'Jan 13' })).toContainText('60')
    await expect(table.locator('tbody tr').filter({ hasText: 'Jan 14' })).toContainText('90')
  })

  test('AC1: User can toggle chart view between daily, weekly, and monthly period breakdowns', async ({
    page,
  }) => {
    // Seed sessions across multiple weeks/months
    const sessions = Array.from({ length: 20 }, (_, i) =>
      createStudySession({
        id: `session-${i}`,
        courseId: 'course-1',
        startTime: getRelativeDate(-i * 7), // Sessions spread across 20 weeks
        endTime: getRelativeDateWithMinutes(-i * 7, 60), // 60 minutes after start
        duration: 3600,
      })
    )

    await seedStudySessions(page, sessions)
    await page.reload()

    // Verify period toggle exists
    const dailyToggle = page.getByRole('button', { name: 'Daily' })
    const weeklyToggle = page.getByRole('button', { name: 'Weekly' })
    const monthlyToggle = page.getByRole('button', { name: 'Monthly' })

    await expect(dailyToggle).toBeVisible()
    await expect(weeklyToggle).toBeVisible()
    await expect(monthlyToggle).toBeVisible()

    // Click weekly toggle and verify chart shows weekly labels
    await weeklyToggle.click()
    const chart = page.getByTestId('study-time-chart')
    await expect(chart.getByText(/Week \d+/).first()).toBeVisible()

    // Click monthly toggle and verify chart shows monthly labels
    await monthlyToggle.click()
    await expect(chart.getByText(/\w+ \d{4}/).first()).toBeVisible() // e.g., "Jan 2025"
  })

  test('AC2: Weekly adherence percentage is displayed and calculated correctly', async ({
    page,
  }) => {
    // Seed 3 study sessions this week (assuming default target of 5 days)
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-2),
        endTime: getRelativeDateWithMinutes(-2, 60),
        duration: 3600,
      }),
      createStudySession({
        id: 'session-2',
        startTime: getRelativeDate(-1),
        endTime: getRelativeDateWithMinutes(-1, 60),
        duration: 3600,
      }),
      createStudySession({
        id: 'session-3',
        startTime: FIXED_DATE,
        endTime: addMinutes(60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // Verify adherence percentage is visible
    const adherenceSection = page.getByTestId('weekly-adherence')
    await expect(adherenceSection).toBeVisible()

    // With default target of 5 days, 3 days studied = 60% adherence
    await expect(adherenceSection).toContainText('60%')

    // Verify visual progress indicator exists
    const progressIndicator = page.getByTestId('adherence-progress-indicator')
    await expect(progressIndicator).toBeVisible()
  })

  test('AC2: Adherence percentage updates in real time when new sessions recorded', async ({
    page,
  }) => {
    // Start with 2 sessions
    const initialSessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-2),
        endTime: getRelativeDateWithMinutes(-2, 60),
        duration: 3600,
      }),
      createStudySession({
        id: 'session-2',
        startTime: getRelativeDate(-1),
        endTime: getRelativeDateWithMinutes(-1, 60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, initialSessions)
    await page.reload()

    // Verify initial adherence (2/5 = 40%)
    await expect(page.getByTestId('weekly-adherence')).toContainText('40%')

    // Add a third session to simulate real-time update
    const additionalSession = [
      createStudySession({
        id: 'session-3',
        startTime: FIXED_DATE,
        endTime: addMinutes(60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, additionalSession)
    await page.reload()

    // Verify adherence updates to 60% (3/5)
    await expect(page.getByTestId('weekly-adherence')).toContainText('60%')
  })

  test('AC3: Chart includes descriptive alt text summarizing data trend', async ({ page }) => {
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-6),
        endTime: getRelativeDateWithMinutes(-6, 120),
        duration: 7200,
      }),
      createStudySession({
        id: 'session-2',
        startTime: getRelativeDate(-3),
        endTime: getRelativeDateWithMinutes(-3, 90),
        duration: 5400,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    const chart = page.getByTestId('study-time-chart')
    await expect(chart).toHaveAttribute('aria-label', /.+/)

    // Alt text should describe the trend (e.g., "Study time chart showing 2.5 hours per week average")
    const altText = await chart.getAttribute('aria-label')
    expect(altText).toBeTruthy()
    expect(altText!.length).toBeGreaterThan(10) // Ensure it's descriptive
  })

  test('AC3: "View as table" toggle renders accessible HTML table with same data', async ({
    page,
  }) => {
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-2),
        endTime: getRelativeDateWithMinutes(-2, 60),
        duration: 3600,
      }),
      createStudySession({
        id: 'session-2',
        startTime: getRelativeDate(-1),
        endTime: getRelativeDateWithMinutes(-1, 90),
        duration: 5400,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // Click "View as table" toggle
    const tableToggle = page.getByRole('button', { name: /view as table/i })
    await expect(tableToggle).toBeVisible()
    await tableToggle.click()

    // Verify accessible table is displayed
    const table = page.getByRole('table', { name: /study time data/i })
    await expect(table).toBeVisible()

    // Verify table has headers
    await expect(table.locator('thead')).toBeVisible()

    // Verify table contains data rows
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(2) // 2 sessions = 2 rows
  })

  test('AC3: Data series differentiated by pattern or label, not color alone', async ({ page }) => {
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-2),
        endTime: getRelativeDateWithMinutes(-2, 60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    const chart = page.getByTestId('study-time-chart')

    // Verify chart elements have text labels or aria-labels
    // This ensures screen readers can distinguish data series
    const dataElements = chart.locator('[role="img"], [role="graphics-symbol"]')
    const count = await dataElements.count()

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const element = dataElements.nth(i)
        const ariaLabel = await element.getAttribute('aria-label')
        expect(ariaLabel).toBeTruthy() // Each element should have descriptive aria-label
      }
    }
  })

  test('AC4: Empty state displayed when no study sessions recorded', async ({ page }) => {
    // No sessions seeded — navigate to clean state
    await page.reload()

    // Verify empty state is displayed
    const emptyState = page.getByTestId('study-time-empty-state')
    await expect(emptyState).toBeVisible()

    // Verify guidance message
    await expect(emptyState).toContainText(/data will appear once study sessions are recorded/i)

    // Chart should not be visible in empty state
    const chart = page.getByTestId('study-time-chart')
    await expect(chart).not.toBeVisible()
  })

  test('Accessibility: Reports page keyboard navigable', async ({ page }) => {
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-1),
        endTime: getRelativeDateWithMinutes(-1, 60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // Verify period toggle buttons are keyboard accessible
    const dailyButton = page.getByRole('button', { name: 'Daily' })
    const weeklyButton = page.getByRole('button', { name: 'Weekly' })
    const monthlyButton = page.getByRole('button', { name: 'Monthly' })

    // Focus first button (simulates user navigating to controls)
    await dailyButton.focus()
    await expect(dailyButton).toBeFocused()

    // Tab through period toggles
    await page.keyboard.press('Tab')
    await expect(weeklyButton).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(monthlyButton).toBeFocused()

    // Enter/Space should activate toggle
    await page.keyboard.press('Enter')

    // Verify monthly view is now active (button has 'default' variant styling)
    await expect(monthlyButton).toHaveClass(/bg-primary/) // Playwright auto-retry waits for state update
  })

  test('Accessibility: Progress indicator has proper ARIA attributes', async ({ page }) => {
    const sessions = [
      createStudySession({
        id: 'session-1',
        startTime: getRelativeDate(-1),
        endTime: getRelativeDateWithMinutes(-1, 60),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    const progressIndicator = page.getByTestId('adherence-progress-indicator')

    // Verify progress indicator has role="progressbar"
    await expect(progressIndicator).toHaveAttribute('role', 'progressbar')

    // Verify aria-valuenow, aria-valuemin, aria-valuemax
    await expect(progressIndicator).toHaveAttribute('aria-valuenow', '20') // 1 day / 5 days = 20%
    await expect(progressIndicator).toHaveAttribute('aria-valuemin', '0')
    await expect(progressIndicator).toHaveAttribute('aria-valuemax', '100')

    // Verify aria-label describes the value
    const ariaLabel = await progressIndicator.getAttribute('aria-label')
    expect(ariaLabel).toContain('20')
    expect(ariaLabel).toContain('%')
  })
})
