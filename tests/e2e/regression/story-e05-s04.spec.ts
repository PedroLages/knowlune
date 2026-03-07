/**
 * E05-S04: Study History Calendar E2E Tests
 *
 * Verifies:
 *   - AC1: Month-view calendar with study day highlights
 *   - AC2: Month navigation (prev/next) with highlight verification
 *   - AC3: Day detail popover with session list (multiple action types)
 *   - AC4: Empty day detail state
 *   - AC5: Freeze day visual distinction
 *   - AC6: Mobile responsiveness (44×44px touch targets)
 */
import { test, expect } from '../../support/fixtures'
import { createStudyAction } from '../../support/fixtures/factories'

/**
 * Creates a study action pinned to a specific day of the current month.
 * Uses day-of-month instead of "days ago" to avoid month-boundary flakiness.
 */
function makeEntryForDay(
  dayOfMonth: number,
  courseId = 'ba-101',
  type = 'lesson_complete' as string
) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 12, 0, 0, 0)
  return createStudyAction({
    courseId,
    timestamp: date.toISOString(),
    type,
  })
}

/** Creates a study action pinned to a specific day of the previous month. */
function makeEntryForPrevMonth(dayOfMonth: number, courseId = 'ba-101') {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 12, 0, 0, 0)
  return createStudyAction({
    courseId,
    timestamp: date.toISOString(),
  })
}

test.describe('Study History Calendar (E05-S04)', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on narrow viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC1: month-view calendar renders for current month', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeEntryForDay(5),
      makeEntryForDay(10),
      makeEntryForDay(15),
    ])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')
    await expect(calendar).toBeVisible()

    // Should display current month name and year
    const now = new Date()
    const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    await expect(calendar.getByText(monthYear)).toBeVisible()
  })

  test('AC1: days with study sessions are highlighted', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeEntryForDay(5),
      makeEntryForDay(10),
      makeEntryForDay(15),
    ])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')
    const highlightedDays = calendar.locator('[data-has-activity="true"]')
    await expect(highlightedDays).toHaveCount(3)
  })

  test('AC2: navigate to previous month and verify highlights update', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    // Seed data for current month AND previous month
    await localStorage.seed('study-log', [
      makeEntryForDay(10), // current month
      makeEntryForPrevMonth(7), // previous month
      makeEntryForPrevMonth(14), // previous month
    ])
    await page.reload()
    await page.waitForSelector('[data-testid="study-history-calendar"]', {
      state: 'visible',
      timeout: 10000,
    })

    const calendar = page.getByTestId('study-history-calendar')

    // Current month should have 1 highlighted day
    await expect(calendar.locator('[data-has-activity="true"]')).toHaveCount(1)

    const prevBtn = calendar.getByRole('button', { name: /previous/i })
    const nextBtn = calendar.getByRole('button', { name: /next/i })

    // Navigate to previous month
    await prevBtn.click()
    const prevMonth = new Date()
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevMonthYear = prevMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    await expect(calendar.getByText(prevMonthYear)).toBeVisible()

    // Previous month should have 2 highlighted days
    await expect(calendar.locator('[data-has-activity="true"]')).toHaveCount(2)

    // Navigate back to current month
    await nextBtn.click()
    const now = new Date()
    const currentMonthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    await expect(calendar.getByText(currentMonthYear)).toBeVisible()

    // Back to 1 highlighted day
    await expect(calendar.locator('[data-has-activity="true"]')).toHaveCount(1)
  })

  test('AC3: clicking a day with sessions shows detail popover', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [makeEntryForDay(10, 'ba-101')])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')

    // Click the day with activity
    const activeCell = calendar.locator('[data-has-activity="true"]').first()
    await activeCell.click()

    // Popover should appear with session details
    const popover = page.getByTestId('day-detail-popover')
    await expect(popover).toBeVisible()

    // Should show date heading
    await expect(popover.getByTestId('popover-date-heading')).toBeVisible()

    // Should show course name (ba-101 resolves to its title, or falls back to ID)
    await expect(popover.getByText(/ba-101|Business/i)).toBeVisible()

    // Should show action label for lesson_complete
    await expect(popover.getByText(/completed lesson/i)).toBeVisible()

    // Should show timestamp (HH:MM format)
    await expect(popover.getByText(/\d{1,2}:\d{2}/)).toBeVisible()
  })

  test('AC3: popover renders different action types correctly', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeEntryForDay(10, 'ba-101', 'lesson_complete'),
      makeEntryForDay(10, 'ba-101', 'video_progress'),
      makeEntryForDay(10, 'ba-101', 'note_saved'),
    ])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')
    const activeCell = calendar.locator('[data-has-activity="true"]').first()
    await activeCell.click()

    const popover = page.getByTestId('day-detail-popover')
    await expect(popover).toBeVisible()

    // Verify all three action type labels render
    await expect(popover.getByText(/completed lesson/i)).toBeVisible()
    await expect(popover.getByText(/watched video/i)).toBeVisible()
    await expect(popover.getByText(/saved note/i)).toBeVisible()
  })

  test('AC4: clicking a day with no sessions shows empty state', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')

    // Click a day without activity
    const inactiveDay = calendar.locator('[data-has-activity="false"]').first()
    await inactiveDay.click()

    const popover = page.getByTestId('day-detail-popover')
    await expect(popover).toBeVisible()

    // Should show date heading even for empty days
    await expect(popover.getByTestId('popover-date-heading')).toBeVisible()

    await expect(popover.getByText(/no study sessions/i)).toBeVisible()
  })

  test('AC5: freeze days are visually distinguished', async ({ page, localStorage }) => {
    await page.goto('/')
    // Set Monday (1) and Wednesday (3) as freeze days
    await localStorage.seed('study-streak-freeze-days', { freezeDays: [1, 3] })
    await localStorage.seed('study-log', [])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')
    const freezeDayCells = calendar.locator('[data-freeze-day="true"]')

    // At least some freeze days should be present in the current month view
    const count = await freezeDayCells.count()
    expect(count).toBeGreaterThan(0)

    // Freeze day cells should have the snowflake icon
    const firstFreezeDay = freezeDayCells.first()
    await expect(firstFreezeDay.locator('[aria-label="Freeze day"]')).toBeVisible()
  })

  test('AC5: freeze day with activity shows as study day, not freeze day', async ({
    page,
    localStorage,
  }) => {
    // Find a Monday in the current month to use as our test day
    const now = new Date()
    let mondayDate = 1
    for (let d = 1; d <= 28; d++) {
      if (new Date(now.getFullYear(), now.getMonth(), d).getDay() === 1) {
        mondayDate = d
        break
      }
    }

    await page.goto('/')
    await localStorage.seed('study-streak-freeze-days', { freezeDays: [1] }) // Monday = freeze
    await localStorage.seed('study-log', [makeEntryForDay(mondayDate)])
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const calendar = page.getByTestId('study-history-calendar')

    // Target the exact Monday by its date number
    const mondayCell = calendar.locator(
      `button:has-text("${mondayDate}")[data-has-activity="true"]`
    )
    await expect(mondayCell.first()).toBeVisible()

    // That specific day should NOT have freeze-day attribute
    await expect(mondayCell.first()).not.toHaveAttribute('data-freeze-day', 'true')
  })

  test('AC6: calendar is responsive with adequate touch targets', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [makeEntryForDay(10)])

    // Set mobile viewport and reload to pick up seeded data
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Verify sidebar is not blocking the view
    const sidebar = page.locator('[data-testid="sidebar"]')
    if ((await sidebar.count()) > 0) {
      await expect(sidebar).not.toBeVisible()
    }

    const calendar = page.getByTestId('study-history-calendar')
    await expect(calendar).toBeVisible()

    // Day cells should have minimum 44×44px touch targets
    const dayCell = calendar.locator('[data-has-activity="true"]').first()
    const box = await dayCell.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)

    // Both nav buttons should meet 44px minimum
    const prevBtn = calendar.getByRole('button', { name: /previous/i })
    const prevBox = await prevBtn.boundingBox()
    expect(prevBox).toBeTruthy()
    expect(prevBox!.width).toBeGreaterThanOrEqual(44)
    expect(prevBox!.height).toBeGreaterThanOrEqual(44)

    const nextBtn = calendar.getByRole('button', { name: /next/i })
    const nextBox = await nextBtn.boundingBox()
    expect(nextBox).toBeTruthy()
    expect(nextBox!.width).toBeGreaterThanOrEqual(44)
    expect(nextBox!.height).toBeGreaterThanOrEqual(44)
  })
})
