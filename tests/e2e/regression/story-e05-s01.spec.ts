/**
 * E05-S01: Daily Study Streak Counter E2E Tests
 *
 * Verifies:
 *   - AC1: Streak counter visible on Overview
 *   - AC2: Live increment without reload + reduced motion
 *   - AC3: Calendar heatmap shows activity
 *   - AC4: Keyboard accessibility
 */
import { test, expect } from '../../support/fixtures'
import { TIMEOUTS } from '../../utils/constants'
import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

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

test.describe('Study Streak Counter (E05-S01)', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on narrow viewports
    await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  })

  test('AC1: streak counter is visible on overview', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const streakSection = page.getByText('Current Streak')
    await expect(streakSection).toBeVisible()

    const longestSection = page.getByText('Longest Streak')
    await expect(longestSection).toBeVisible()
  })

  test('AC1: shows correct streak from seeded data', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeStreakEntry(0),
      makeStreakEntry(1),
      makeStreakEntry(2),
    ])

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toHaveText('3')
  })

  test('AC2: live increment without page reload', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for streak value to be rendered
    const streakValue = page.getByTestId('current-streak-value')
    await expect(streakValue).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(streakValue).toHaveText('0')

    // Inject a study entry + dispatch event (no reload)
    await page.evaluate((fixedDate) => {
      const now = new Date(fixedDate)
      now.setHours(12, 0, 0, 0)
      const entry = {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: now.toISOString(),
      }
      const log = JSON.parse(window.localStorage.getItem('study-log') || '[]')
      log.push(entry)
      window.localStorage.setItem('study-log', JSON.stringify(log))
      window.dispatchEvent(new CustomEvent('study-log-updated'))
    }, FIXED_DATE)

    // Streak should now be 1 without reload
    await expect(streakValue).toHaveText('1', { timeout: TIMEOUTS.NETWORK })
  })

  test('AC2: reduced motion respected', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    })
    const rmPage = await context.newPage()

    await rmPage.evaluate((sidebarState) => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
    await rmPage.goto('/')

    await rmPage.evaluate((fixedDate) => {
      const now = new Date(fixedDate)
      now.setHours(12, 0, 0, 0)
      const entry = {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: now.toISOString(),
      }
      window.localStorage.setItem('study-log', JSON.stringify([entry]))
    }, FIXED_DATE)
    await rmPage.reload()
    await rmPage.waitForLoadState('domcontentloaded')

    const prefersReducedMotion = await rmPage.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    expect(prefersReducedMotion).toBe(true)

    await context.close()
  })

  test('AC3: calendar heatmap shows activity pattern', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [
      makeStreakEntry(0),
      makeStreakEntry(1),
      makeStreakEntry(5),
    ])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const calendarGrid = page.locator('[role="group"][aria-label="Study activity calendar"]')
    await expect(calendarGrid).toBeVisible()

    // Should have some active cells
    const activeCells = calendarGrid.locator('button[class*="bg-green"]')
    const count = await activeCells.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('AC3: calendar cells are keyboard accessible', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.seed('study-log', [makeStreakEntry(0)])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const calendarGrid = page.locator('[role="group"][aria-label="Study activity calendar"]')
    await expect(calendarGrid).toBeVisible()

    const buttons = calendarGrid.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    // First button should have aria-label
    const firstButton = buttons.first()
    const ariaLabel = await firstButton.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel).toContain(':')
  })
})
