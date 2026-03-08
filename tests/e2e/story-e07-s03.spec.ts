/**
 * E07-S03: Next Course Suggestion After Completion
 *
 * Tests the end-to-end flow for the next course suggestion feature
 * that appears when a learner completes 100% of a course.
 *
 * Course used: 'authority' (7 lessons)
 */
import { test, expect } from '../support/fixtures'

// All 7 lesson IDs for the 'authority' course
const AUTHORITY_LESSONS = [
  'authority-lesson-01-communication-laws',
  'authority-lesson-02-composure-confidence',
  'authority-lesson-03-confidence-strengths',
  'authority-lesson-04-discipline-habits',
  'authority-lesson-05-authority-triangle',
  'authority-lesson-06-overcoming-anxiety',
  'authority-lesson-07-resources',
]

const LAST_LESSON = AUTHORITY_LESSONS[AUTHORITY_LESSONS.length - 1]
const LAST_LESSON_URL = `/courses/authority/${LAST_LESSON}`

// All 8 course IDs (for "all done" seeding)
const ALL_COURSE_IDS = [
  'nci-access',
  'authority',
  'confidence-reboot',
  '6mx',
  'operative-six',
  'behavior-skills',
  'ops-manual',
  'study-materials',
]

/**
 * Seed N-1 completed lessons for the authority course so that completing
 * the last lesson triggers a course-completion event.
 */
async function seedAuthorityAlmostComplete(
  page: import('@playwright/test').Page,
  localStorage: { seed: (key: string, data: unknown) => Promise<void> }
) {
  const progress: Record<string, unknown> = {
    authority: {
      courseId: 'authority',
      completedLessons: AUTHORITY_LESSONS.slice(0, 6), // all but last
      lastWatchedLesson: AUTHORITY_LESSONS[5],
      lastAccessedAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: {},
    },
  }
  await localStorage.seed('course-progress', progress)
}

/** Click the explicit "Close" text button in the CompletionModal */
async function closeCompletionModal(page: import('@playwright/test').Page) {
  // The CompletionModal renders a <Button variant="outline">Close</Button>
  // The Dialog also has an X icon button with aria-label "Close"
  // We want the explicit text button — use a data-testid-independent locator
  await page.locator('button', { hasText: 'Close' }).first().click()
}

test.describe('E07-S03: Next Course Suggestion After Completion', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Prevent sidebar overlay at tablet viewports; clear any persisted dismissals
    await page.addInitScript(() => {
      window.localStorage.setItem('eduvi-sidebar-v1', 'false')
      window.localStorage.removeItem('levelup-dismissed-suggestions')
    })
    // Also clear after navigating to ensure any leftover state is gone
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.removeItem('levelup-dismissed-suggestions')
    })
    // Clear course progress so tests start clean
    await localStorage.clearAll()
  })

  test('AC1: suggestion card appears after completing final lesson', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    // Navigate to last lesson
    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    // Click "Mark Complete" to complete the last lesson
    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
    await markCompleteBtn.click()

    // Course-level celebration modal should appear
    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: 8000 })

    // Close the modal using the explicit "Close" button
    await closeCompletionModal(page)

    // Next course suggestion card should now be visible
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: 5000 })
  })

  test('AC3: clicking "Start Course" navigates to the suggested course', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: 8000 })
    await closeCompletionModal(page)

    // Suggestion card should be visible
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: 5000 })

    // Click "Start Course"
    await page.getByRole('button', { name: /start course/i }).click()

    // Should navigate to some course page (not authority — that's already done)
    await expect(page).toHaveURL(/\/courses\/(?!authority)/, { timeout: 5000 })
  })

  test('AC4: dismiss hides the suggestion card', async ({ page, localStorage }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: 8000 })
    await closeCompletionModal(page)
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: 5000 })

    // Click dismiss (×) button
    await page.getByRole('button', { name: /dismiss course suggestion/i }).click()

    // Card should be gone
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })

  test('AC4: dismiss persists across page reload', async ({ page, localStorage }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: 8000 })
    await closeCompletionModal(page)
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: 5000 })

    // Dismiss the suggestion
    await page.getByRole('button', { name: /dismiss course suggestion/i }).click()
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Card should still not appear (dismissal persisted in localStorage via Zustand persist)
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })

  test('AC5: congratulatory message shown when all courses are complete', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed authority with N-1 lessons complete, all other courses with fake 100% progress
    const progress: Record<string, unknown> = {}

    // Use 1000 fake lesson IDs per course — well above any real course's lesson count.
    // The algorithm checks completedLessons.length >= module-derived total,
    // so we need a count that exceeds the largest real course (nci-access ~275 lessons).
    // NOTE: The algorithm uses course.modules.reduce(sum + m.lessons.length),
    // so completedLessons.length comparison works regardless of actual IDs.
    for (const courseId of ALL_COURSE_IDS.filter(id => id !== 'authority')) {
      progress[courseId] = {
        courseId,
        completedLessons: Array.from({ length: 1000 }, (_, i) => `${courseId}-lesson-${i + 1}`),
        lastAccessedAt: new Date().toISOString(),
        startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: {},
      }
    }

    progress.authority = {
      courseId: 'authority',
      completedLessons: AUTHORITY_LESSONS.slice(0, 6),
      lastWatchedLesson: AUTHORITY_LESSONS[5],
      lastAccessedAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: {},
    }

    await localStorage.seed('course-progress', progress)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: 8000 })
    await closeCompletionModal(page)

    // Congratulatory message should appear (not a suggestion card)
    await expect(page.getByTestId('next-course-congratulations')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("You've completed all active courses!")).toBeVisible()
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })
})
