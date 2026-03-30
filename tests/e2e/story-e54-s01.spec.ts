/**
 * E2E Tests: E54-S01 — Video Completion, Celebration & Auto-Advance
 *
 * Tests acceptance criteria:
 * - AC1: Video end triggers lesson completion
 * - AC2: Celebration modal appears after completion
 * - AC3: Auto-advance countdown after modal dismissal
 * - AC4: Prev/next navigation works
 * - AC5: Manual completion toggle shows celebration
 * - AC6: Course-level celebration on last video
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { TIMEOUTS } from '../utils/constants'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data — 3 video lessons for prev/next and course-completion tests
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'e54-completion-course',
  name: 'Completion Test Course',
  videoCount: 3,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'e54-vid-01',
    courseId: 'e54-completion-course',
    filename: '01-Intro.mp4',
    path: '/01-Intro.mp4',
    duration: 120,
    format: 'mp4',
    order: 0,
  },
  {
    id: 'e54-vid-02',
    courseId: 'e54-completion-course',
    filename: '02-Basics.mp4',
    path: '/02-Basics.mp4',
    duration: 300,
    format: 'mp4',
    order: 1,
  },
  {
    id: 'e54-vid-03',
    courseId: 'e54-completion-course',
    filename: '03-Advanced.mp4',
    path: '/03-Advanced.mp4',
    duration: 600,
    format: 'mp4',
    order: 2,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCourseData(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await page.reload({ waitUntil: 'domcontentloaded' })
}

async function goToLesson(page: Page, lessonId: string): Promise<void> {
  await navigateAndWait(page, `/courses/e54-completion-course/lessons/${lessonId}`)
}

/** Dispatch 'ended' event on the <video> element to simulate video completion. */
async function simulateVideoEnd(page: Page): Promise<void> {
  await page.locator('video').waitFor({ timeout: TIMEOUTS.LONG })
  await page.evaluate(() => {
    const video = document.querySelector('video')
    if (video) video.dispatchEvent(new Event('ended'))
  })
}

/** Dismiss the celebration modal by pressing Escape. */
async function dismissCelebrationModal(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]')
  if (await dialog.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.MEDIUM }).catch(() => {})
  }
}

// ===========================================================================
// AC1: Video end triggers lesson completion
// ===========================================================================

test.describe('AC1: Video end triggers lesson completion', () => {
  test('marks lesson as completed when video ends', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    // Completion toggle should show non-completed status initially
    const completionToggle = page.getByTestId('completion-toggle')
    await expect(completionToggle).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Simulate video ending
    await simulateVideoEnd(page)

    // Completion toggle should now reflect completed status
    await expect(completionToggle).toContainText(/Completed/i, { timeout: TIMEOUTS.MEDIUM })
  })
})

// ===========================================================================
// AC2: Celebration modal appears after completion
// ===========================================================================

test.describe('AC2: Celebration modal after completion', () => {
  test('shows lesson celebration modal when video ends', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    await simulateVideoEnd(page)

    // Celebration dialog should appear
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Lesson Completed/i)
  })

  test('celebration modal has Close and Continue buttons', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    await simulateVideoEnd(page)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog.getByRole('button', { name: /Close/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Continue Learning/i })).toBeVisible()
  })
})

// ===========================================================================
// AC3: Auto-advance countdown after modal dismissal
// ===========================================================================

test.describe('AC3: Auto-advance countdown', () => {
  test('shows auto-advance countdown after video ends with next lesson available', async ({
    page,
  }) => {
    await seedCourseData(page)
    // Navigate to 1st lesson (has a next lesson)
    await goToLesson(page, 'e54-vid-01')

    await simulateVideoEnd(page)
    await dismissCelebrationModal(page)

    // Auto-advance countdown should appear
    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    // Should mention the next lesson
    await expect(countdown).toContainText('02-Basics.mp4')
  })

  test('cancel button stops auto-advance', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    await simulateVideoEnd(page)
    await dismissCelebrationModal(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: TIMEOUTS.DEFAULT })

    // Click cancel
    await countdown.getByRole('button', { name: /Cancel/i }).click()

    // Countdown should disappear
    await expect(countdown).not.toBeVisible({ timeout: TIMEOUTS.SHORT })
  })
})

// ===========================================================================
// AC4: Prev/next navigation works
// ===========================================================================

test.describe('AC4: Prev/next navigation', () => {
  test('next button navigates to the next lesson', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Previous should be disabled on first lesson
    const prevButton = nav.getByRole('button', { name: /Previous/i })
    await expect(prevButton).toBeDisabled()

    // Next should be enabled and navigate
    const nextButton = nav.getByRole('button', { name: /Next/i })
    await expect(nextButton).toBeEnabled()
    await nextButton.click()

    // URL should change to 2nd lesson
    await page.waitForURL(/e54-vid-02/, { timeout: TIMEOUTS.LONG })
  })

  test('previous button navigates to the previous lesson', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-02')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Previous should be enabled on 2nd lesson
    const prevButton = nav.getByRole('button', { name: /Previous/i })
    await expect(prevButton).toBeEnabled()
    await prevButton.click()

    // URL should change to 1st lesson
    await page.waitForURL(/e54-vid-01/, { timeout: TIMEOUTS.LONG })
  })
})

// ===========================================================================
// AC5: Manual completion toggle shows celebration
// ===========================================================================

test.describe('AC5: Manual completion toggle', () => {
  test('toggling completion to completed shows celebration modal', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e54-vid-01')

    // Click the completion toggle dropdown
    const completionToggle = page.getByTestId('completion-toggle')
    await expect(completionToggle).toBeVisible({ timeout: TIMEOUTS.LONG })
    await completionToggle.click()

    // Select "Completed" status
    const completedOption = page.getByTestId('status-option-completed')
    await expect(completedOption).toBeVisible({ timeout: TIMEOUTS.SHORT })
    await completedOption.click()

    // Celebration dialog should appear
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Lesson Completed/i)
  })
})

// ===========================================================================
// AC6: Course-level celebration on last video
// ===========================================================================

test.describe('AC6: Course-level celebration on last video', () => {
  test('shows course completion celebration when all lessons completed', async ({ page }) => {
    await seedCourseData(page)

    // Complete first two lessons via their lesson pages
    for (const vid of ['e54-vid-01', 'e54-vid-02']) {
      await goToLesson(page, vid)
      await simulateVideoEnd(page)
      await dismissCelebrationModal(page)
    }

    // Navigate to last lesson and complete it
    await goToLesson(page, 'e54-vid-03')
    await simulateVideoEnd(page)

    // Celebration dialog should show course-level completion
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Course Completed/i)
  })
})
