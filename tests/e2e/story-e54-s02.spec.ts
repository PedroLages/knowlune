/**
 * E2E Tests: E54-S02 — Wire Lesson Flow to YouTube Player
 *
 * Tests acceptance criteria:
 * - AC1: YouTube auto-complete (>90%) triggers celebration + auto-advance
 * - AC2: Prev/next navigation for YouTube courses
 * - AC3: Manual completion triggers celebration; course-level on last video
 * - AC4: Auto-advance countdown navigates to next YouTube video
 *
 * NOTE: YouTube IFrame API cannot be exercised in E2E tests, so auto-complete
 * is simulated via the manual completion toggle, which triggers the same
 * celebration + auto-advance flow. The wiring from onAutoComplete → celebration
 * is verified by the unit-level code path (same handler).
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { TIMEOUTS } from '../utils/constants'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data — YouTube course with 3 videos
// ---------------------------------------------------------------------------

const YT_COURSE = {
  ...createImportedCourse({
    id: 'e54s02-yt-course',
    name: 'YouTube Flow Test Course',
    videoCount: 3,
    pdfCount: 0,
  }),
  source: 'youtube' as const,
  youtubePlaylistId: 'PLe54s02-flow',
  youtubeChannelId: 'UCe54',
  youtubeChannelTitle: 'Flow Academy',
}

const YT_VIDEOS = [
  {
    id: 'e54s02-yt-v01',
    courseId: 'e54s02-yt-course',
    filename: 'YT-Intro',
    path: '',
    duration: 120,
    format: 'mp4',
    order: 0,
    youtubeVideoId: 'yt_intro_001',
    youtubeUrl: 'https://www.youtube.com/watch?v=yt_intro_001',
  },
  {
    id: 'e54s02-yt-v02',
    courseId: 'e54s02-yt-course',
    filename: 'YT-Basics',
    path: '',
    duration: 300,
    format: 'mp4',
    order: 1,
    youtubeVideoId: 'yt_basics_002',
    youtubeUrl: 'https://www.youtube.com/watch?v=yt_basics_002',
  },
  {
    id: 'e54s02-yt-v03',
    courseId: 'e54s02-yt-course',
    filename: 'YT-Advanced',
    path: '',
    duration: 600,
    format: 'mp4',
    order: 2,
    youtubeVideoId: 'yt_advanced_003',
    youtubeUrl: 'https://www.youtube.com/watch?v=yt_advanced_003',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedYouTubeData(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [YT_COURSE as Record<string, unknown>])
  await seedImportedVideos(page, YT_VIDEOS as unknown as Record<string, unknown>[])
  await page.reload({ waitUntil: 'domcontentloaded' })
}

async function goToLesson(page: Page, lessonId: string): Promise<void> {
  await navigateAndWait(page, `/courses/e54s02-yt-course/lessons/${lessonId}`)
}

async function markCompleteViaToggle(page: Page): Promise<void> {
  const completionToggle = page.getByTestId('completion-toggle')
  await expect(completionToggle).toBeVisible({ timeout: TIMEOUTS.LONG })
  await completionToggle.click()

  const completedOption = page.getByTestId('status-option-completed')
  await expect(completedOption).toBeVisible({ timeout: TIMEOUTS.SHORT })
  await completedOption.click()
}

async function dismissCelebrationModal(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]')
  if (await dialog.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.MEDIUM }).catch(() => {})
  }
}

// ===========================================================================
// AC1: Celebration modal after YouTube completion
// ===========================================================================

test.describe('AC1: YouTube completion triggers celebration', () => {
  test('marking YouTube lesson complete shows celebration modal', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    await markCompleteViaToggle(page)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Lesson Completed/i)
  })

  test('auto-advance countdown appears after YouTube lesson completion', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    await markCompleteViaToggle(page)
    await dismissCelebrationModal(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    await expect(countdown).toContainText('YT-Basics')
  })
})

// ===========================================================================
// AC2: Prev/next navigation for YouTube courses
// ===========================================================================

test.describe('AC2: YouTube prev/next navigation', () => {
  test('prev/next navigation is visible for YouTube courses', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('next button navigates to next YouTube video', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })

    const prevButton = nav.getByRole('button', { name: /Previous/i })
    await expect(prevButton).toBeDisabled()

    const nextButton = nav.getByRole('button', { name: /Next/i })
    await expect(nextButton).toBeEnabled()
    await nextButton.click()

    await page.waitForURL(/e54s02-yt-v02/, { timeout: TIMEOUTS.LONG })
  })

  test('previous button navigates to previous YouTube video', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v02')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })

    const prevButton = nav.getByRole('button', { name: /Previous/i })
    await expect(prevButton).toBeEnabled()
    await prevButton.click()

    await page.waitForURL(/e54s02-yt-v01/, { timeout: TIMEOUTS.LONG })
  })

  test('next button is disabled on last YouTube video', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v03')

    const nav = page.getByTestId('lesson-navigation')
    await expect(nav).toBeVisible({ timeout: TIMEOUTS.LONG })

    const nextButton = nav.getByRole('button', { name: /Next/i })
    await expect(nextButton).toBeDisabled()
  })

  test('YouTube lesson URL uses /courses/ path (not /youtube-courses/)', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    // Verify we're on the unified route
    expect(page.url()).toContain('/courses/e54s02-yt-course/lessons/e54s02-yt-v01')
    expect(page.url()).not.toContain('/youtube-courses/')
  })
})

// ===========================================================================
// AC3: Manual completion + course-level celebration
// ===========================================================================

test.describe('AC3: Manual completion and course-level celebration', () => {
  test('manual completion to "Completed" shows celebration', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v02')

    await markCompleteViaToggle(page)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Lesson Completed/i)
  })

  test('completing last YouTube video shows course-level celebration', async ({ page }) => {
    await seedYouTubeData(page)

    // Complete first two videos
    for (const vid of ['e54s02-yt-v01', 'e54s02-yt-v02']) {
      await goToLesson(page, vid)
      await markCompleteViaToggle(page)
      await dismissCelebrationModal(page)
    }

    // Complete last video
    await goToLesson(page, 'e54s02-yt-v03')
    await markCompleteViaToggle(page)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await expect(dialog).toContainText(/Course Completed/i)
  })
})

// ===========================================================================
// AC4: Auto-advance countdown navigates to next video
// ===========================================================================

test.describe('AC4: Auto-advance countdown', () => {
  test('cancel button stops YouTube auto-advance', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    await markCompleteViaToggle(page)
    await dismissCelebrationModal(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: TIMEOUTS.DEFAULT })

    // The YouTube player loading overlay (absolute inset-0) and Sonner toast
    // notifications intercept pointer events over the Cancel button.
    // Use dispatchEvent to bypass overlay interception.
    await countdown.getByRole('button', { name: /Cancel/i }).dispatchEvent('click')
    await expect(countdown).not.toBeVisible({ timeout: TIMEOUTS.SHORT })
  })

  test('no auto-advance on last YouTube video', async ({ page }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v03')

    await markCompleteViaToggle(page)
    await dismissCelebrationModal(page)

    // Auto-advance should NOT appear (no next video)
    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).not.toBeVisible({ timeout: TIMEOUTS.SHORT })
  })

  test('Continue Learning in celebration modal navigates to next YouTube video', async ({
    page,
  }) => {
    await seedYouTubeData(page)
    await goToLesson(page, 'e54s02-yt-v01')

    await markCompleteViaToggle(page)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIUM })

    const continueBtn = dialog.getByRole('button', { name: /Continue Learning/i })
    await expect(continueBtn).toBeVisible()
    await continueBtn.click()

    await page.waitForURL(/e54s02-yt-v02/, { timeout: TIMEOUTS.LONG })
  })
})
