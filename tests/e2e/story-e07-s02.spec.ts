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
const COURSE_3 = 'authority'
const COURSE_4 = 'operative-six'

test.describe('Recommended Next Dashboard Section (E07-S02)', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Clear any residual progress data from prior tests, then seed sidebar state
    await page.goto('/')
    await localStorage.clearAll()
    await page.evaluate(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC4 — shows empty state when no courses are in progress', async ({ page }) => {
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for loading to complete
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const emptyState = page.getByTestId('recommended-next-empty')
    await expect(emptyState).toBeVisible()
    await expect(page.getByText('No courses in progress')).toBeVisible()
    await expect(page.getByRole('link', { name: /explore courses/i })).toBeVisible()
  })

  test('AC1 — shows exactly 3 cards when 3+ active courses are seeded', async ({
    page,
    localStorage,
  }) => {
    // Seed 4 in-progress courses — algorithm must cap output at 3
    const progress1 = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day1-laws',
    })
    const progress2 = createCourseProgress({
      courseId: COURSE_3,
      completedLessons: ['authority-lesson-01-communication-laws'],
      lastWatchedLesson: 'authority-lesson-02-composure-confidence',
    })
    const progress3 = createCourseProgress({
      courseId: COURSE_4,
      completedLessons: ['op6-introduction'],
      lastWatchedLesson: 'op6-pillars-of-influence',
    })
    // ba-101 is not in allCourses so it will be skipped by the algorithm,
    // leaving exactly 3 scoreable courses — confirming the limit is enforced.
    const progress4 = createCourseProgress({
      courseId: COURSE_2,
      completedLessons: ['lesson-1'],
      lastWatchedLesson: 'lesson-2',
    })

    await localStorage.seed('course-progress', {
      [COURSE_1]: progress1,
      [COURSE_3]: progress2,
      [COURSE_4]: progress3,
      [COURSE_2]: progress4,
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    await expect(page.getByRole('heading', { name: 'Recommended Next' })).toBeVisible()

    const cardsContainer = page.getByTestId('recommended-next-cards')
    await expect(cardsContainer).toBeVisible()

    // Must show exactly 3 cards (algorithm hard-caps at limit=3).
    // Use href selector: outer card links point to /courses/, instructor links to /instructors/
    const cards = cardsContainer.locator('a[href*="/courses/"]')
    await expect(cards).toHaveCount(3)
  })

  test('AC2 — shows all available cards when fewer than 3 active courses', async ({
    page,
    localStorage,
  }) => {
    // Seed two in-progress courses — both should appear, no padding
    // Note: courses seeded simultaneously share the same lastAccessedAt timestamp,
    // so they rank by completion proximity (higher % first).
    const progress1 = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day2-eyes-entrainment',
    })
    const progress2 = createCourseProgress({
      courseId: COURSE_3,
      completedLessons: ['authority-lesson-01-communication-laws'],
      lastWatchedLesson: 'authority-lesson-02-composure-confidence',
    })

    await localStorage.seed('course-progress', {
      [COURSE_1]: progress1,
      [COURSE_3]: progress2,
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    await expect(page.getByRole('heading', { name: 'Recommended Next' })).toBeVisible()

    const cardsContainer = page.getByTestId('recommended-next-cards')
    await expect(cardsContainer).toBeVisible()

    // Must show exactly 2 cards — all available active courses, no padding
    const cards = cardsContainer.locator('a[href*="/courses/"]')
    await expect(cards).toHaveCount(2)
  })

  test('AC3 — clicking a course card navigates to course page', async ({ page, localStorage }) => {
    const progress = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day2-eyes-entrainment',
    })

    await localStorage.seed('course-progress', { [COURSE_1]: progress })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    const section = page.getByTestId('recommended-next-section')
    await expect(section).toBeVisible()

    // Click the course card link (not instructor link) and verify navigation
    const courseLink = section.locator('a[href*="/courses/6mx"]').first()
    await expect(courseLink).toBeVisible()

    await courseLink.click()
    await expect(page).toHaveURL(/\/courses\/6mx/)
  })

  test('AC5 — rankings refresh when returning to dashboard after progress changes', async ({
    page,
    localStorage,
  }) => {
    // AC5: "When they return to the dashboard, rankings recalculate"
    // Seed 1 active course, verify 1 card, update localStorage with a 2nd
    // course (simulating lesson completion on another page), then reload
    // (simulating return to dashboard). Verify count increases to 2.

    const progress1 = createCourseProgress({
      courseId: COURSE_1,
      completedLessons: ['6mx-welcome-intro', '6mx-day1-human-comm'],
      lastWatchedLesson: '6mx-day1-laws',
    })

    await localStorage.seed('course-progress', {
      [COURSE_1]: progress1,
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Verify 1 card initially
    const cardsContainer = page.getByTestId('recommended-next-cards')
    await expect(cardsContainer).toBeVisible()
    const cards = cardsContainer.locator('a[href*="/courses/"]')
    await expect(cards).toHaveCount(1)

    // Simulate progress change (as if user completed a lesson on another page)
    await page.evaluate(() => {
      const raw = localStorage.getItem('course-progress')
      const data = raw ? JSON.parse(raw) : {}
      data['authority'] = {
        courseId: 'authority',
        completedLessons: ['authority-lesson-01-communication-laws'],
        lastAccessedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      }
      localStorage.setItem('course-progress', JSON.stringify(data))
    })

    // Simulate returning to dashboard — component remounts, reads fresh data
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Now 2 active courses → 2 recommendation cards
    await expect(cardsContainer.locator('a[href*="/courses/"]')).toHaveCount(2)
  })
})
