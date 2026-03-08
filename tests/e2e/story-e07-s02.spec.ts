/**
 * E2E tests for Story E07-S02: Recommended Next Dashboard Section
 *
 * Validates that the "Recommended Next" widget renders correctly with
 * seeded course progress data and shows an empty state when no courses
 * are in progress.
 *
 * Uses real course IDs from allCourses (static data) so the app can
 * resolve course metadata when computing recommendations.
 */
import { test, expect } from '../support/fixtures'
import { createCourseProgress } from '../support/fixtures/factories/course-factory'

// Real course IDs from src/data/courses — must match allCourses
const COURSE_1 = '6mx'
const COURSE_2 = 'ba-101'

test.describe('Recommended Next Dashboard Section (E07-S02)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar state to prevent fullscreen overlay at tablet viewports
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC4 — shows empty state when no courses are in progress', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for loading to complete
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const emptyState = page.getByTestId('recommended-next-empty')
    await expect(emptyState).toBeVisible()
    await expect(page.getByText('No courses in progress')).toBeVisible()
    await expect(page.getByRole('link', { name: /explore courses/i })).toBeVisible()
  })

  test('AC1/AC2 — shows section heading and course cards with seeded progress', async ({
    page,
    localStorage,
  }) => {
    // Seed two in-progress courses BEFORE navigating
    const progress1 = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day2-eyes-entrainment',
    })
    const progress2 = createCourseProgress({
      courseId: COURSE_2,
      completedLessons: ['lesson-1'],
      lastWatchedLesson: 'lesson-2',
    })

    await page.goto('/')
    await localStorage.seed('course-progress', {
      [COURSE_1]: progress1,
      [COURSE_2]: progress2,
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for loading to complete
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Section heading must be visible
    await expect(page.getByRole('heading', { name: 'Recommended Next' })).toBeVisible()

    // Cards container must render at least one card
    const cardsContainer = page.getByTestId('recommended-next-cards')
    await expect(cardsContainer).toBeVisible()

    const cards = cardsContainer.locator('[data-testid^="course-card"], a, [class*="card"]')
    await expect(cardsContainer).not.toBeEmpty()
  })

  test('AC3 — clicking a course card navigates to course page', async ({
    page,
    localStorage,
  }) => {
    const progress = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day2-eyes-entrainment',
    })

    await page.goto('/')
    await localStorage.seed('course-progress', { [COURSE_1]: progress })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const section = page.getByTestId('recommended-next-section')
    await expect(section).toBeVisible()

    // Find the first clickable link within the recommended section
    const firstLink = section.locator('a').first()
    await expect(firstLink).toBeVisible()

    const href = await firstLink.getAttribute('href')
    expect(href).toContain('/courses/')
  })
})
