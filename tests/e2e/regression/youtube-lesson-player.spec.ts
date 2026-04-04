/**
 * YouTubeLessonPlayer — E2E regression tests
 *
 * Tests verify:
 *   - Player renders with course/video data seeded in IndexedDB
 *   - Progress tracking UI elements are visible
 *   - Transcript panel is present
 *   - Navigation back to course detail works
 *   - Error/loading states for missing video
 *   - Offline fallback renders when navigator.onLine is false
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../../support/helpers/seed-helpers'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const YOUTUBE_COURSE = {
  ...createImportedCourse({
    id: 'yt-lesson-course',
    name: 'TypeScript Mastery',
    videoCount: 2,
    pdfCount: 0,
  }),
  source: 'youtube' as const,
  youtubePlaylistId: 'PLts-mastery',
  youtubeChannelId: 'UCts',
  youtubeChannelTitle: 'TypeScript Academy',
}

const TEST_VIDEOS = [
  {
    id: 'yt-lesson-vid-01',
    courseId: 'yt-lesson-course',
    filename: 'Getting Started with TypeScript',
    path: '',
    duration: 600,
    format: 'mp4',
    order: 0,
    youtubeVideoId: 'ts_abc123',
    youtubeUrl: 'https://www.youtube.com/watch?v=ts_abc123',
    thumbnailUrl: 'https://i.ytimg.com/vi/ts_abc123/default.jpg',
    description: 'Learn the fundamentals of TypeScript in this introductory lesson.',
  },
  {
    id: 'yt-lesson-vid-02',
    courseId: 'yt-lesson-course',
    filename: 'Advanced Types',
    path: '',
    duration: 900,
    format: 'mp4',
    order: 1,
    youtubeVideoId: 'ts_def456',
    youtubeUrl: 'https://www.youtube.com/watch?v=ts_def456',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedLessonData(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [YOUTUBE_COURSE as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
}

async function goToLesson(page: Page, courseId: string, lessonId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}/lessons/${lessonId}`)
}

// ===========================================================================
// Player Rendering
// ===========================================================================

test.describe('YouTubeLessonPlayer — Rendering', () => {
  test('should display lesson title below the video', async ({ page }) => {
    // GIVEN: YouTube course and video data seeded
    await seedLessonData(page)

    // WHEN: User navigates to lesson player
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Player content area is visible with correct title below video
    await expect(page.getByTestId('youtube-lesson-player-content')).toBeVisible()
    await expect(page.getByTestId('lesson-title')).toContainText(
      'Getting Started with TypeScript'
    )
  })

  test('should display course name in back-link toolbar', async ({ page }) => {
    // GIVEN: Lesson data seeded
    await seedLessonData(page)

    // WHEN: Navigate to lesson
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Course name appears in the back-link
    await expect(page.getByLabel('Back to course')).toContainText('TypeScript Mastery')
  })

  test('should display video description below player', async ({ page }) => {
    // GIVEN: Video with description seeded
    await seedLessonData(page)

    // WHEN: Navigate to lesson with description
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Description text is visible
    await expect(
      page.getByText('Learn the fundamentals of TypeScript in this introductory lesson.')
    ).toBeVisible()
  })
})

// ===========================================================================
// Completion Status Toggle
// ===========================================================================

test.describe('YouTubeLessonPlayer — Completion Status', () => {
  test('should display completion toggle button with default status', async ({ page }) => {
    // GIVEN: Lesson data seeded
    await seedLessonData(page)

    // WHEN: Navigate to lesson
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Completion toggle is visible with initial status
    const toggle = page.getByTestId('completion-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', /completion status/i)
  })

  test('should open status dropdown with all options', async ({ page }) => {
    // GIVEN: Lesson player loaded
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // WHEN: User clicks the completion toggle
    await page.getByTestId('completion-toggle').click()

    // THEN: All three status options are visible
    await expect(page.getByTestId('status-option-not-started')).toBeVisible()
    await expect(page.getByTestId('status-option-in-progress')).toBeVisible()
    await expect(page.getByTestId('status-option-completed')).toBeVisible()
  })

  test('should display status labels in dropdown', async ({ page }) => {
    // GIVEN: Lesson player loaded
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // WHEN: Open status dropdown
    await page.getByTestId('completion-toggle').click()

    // THEN: Status labels are displayed
    await expect(page.getByText('Not Started')).toBeVisible()
    await expect(page.getByText('In Progress')).toBeVisible()
    await expect(page.getByText('Completed')).toBeVisible()
  })
})

// ===========================================================================
// Transcript Panel
// ===========================================================================

test.describe('YouTubeLessonPlayer — Transcript Panel', () => {
  test('should display transcript panel region', async ({ page }) => {
    // GIVEN: Lesson data seeded
    await seedLessonData(page)

    // WHEN: Navigate to lesson
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Transcript panel aside is present
    const transcriptPanel = page.getByRole('region', { name: /video transcript/i })
    await expect(transcriptPanel).toBeVisible()
  })
})

// ===========================================================================
// Navigation
// ===========================================================================

test.describe('YouTubeLessonPlayer — Navigation', () => {
  test('should display back to course link', async ({ page }) => {
    // GIVEN: Lesson player loaded
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Back to course link is visible
    await expect(page.getByLabel('Back to course')).toBeVisible()
  })

  test('should navigate back to course detail when back link is clicked', async ({ page }) => {
    // GIVEN: Lesson player loaded
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // WHEN: User clicks back to course
    await page.getByLabel('Back to course').click()

    // THEN: Navigated to course detail page
    await page.waitForURL(/\/courses\/yt-lesson-course$/)
  })
})

// ===========================================================================
// Error & Loading States
// ===========================================================================

test.describe('YouTubeLessonPlayer — Error States', () => {
  test('should show video not found for non-existent video ID', async ({ page }) => {
    // GIVEN: Course seeded but no matching video
    await seedLessonData(page)

    // WHEN: Navigate to non-existent video
    await goToLesson(page, 'yt-lesson-course', 'non-existent-video')

    // THEN: Video not found message is displayed
    await expect(page.getByTestId('youtube-lesson-player-content')).toBeVisible()
    await expect(page.getByText('Video not found.')).toBeVisible()
  })

  test('should show back to course link in error state', async ({ page }) => {
    // GIVEN: Video not found state
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'non-existent-video')

    // THEN: Back to Course link is available
    await expect(page.getByText('Back to Course')).toBeVisible()
  })

  test('should navigate to course from error state back link', async ({ page }) => {
    // GIVEN: Video not found state
    await seedLessonData(page)
    await goToLesson(page, 'yt-lesson-course', 'non-existent-video')

    // WHEN: User clicks Back to Course
    await page.getByText('Back to Course').click()

    // THEN: Navigated back to course detail
    await page.waitForURL(/\/courses\/yt-lesson-course$/)
  })
})

// ===========================================================================
// Offline Fallback
// ===========================================================================

test.describe('YouTubeLessonPlayer — Offline', () => {
  test('should show offline placeholder when offline', async ({ page }) => {
    // GIVEN: Lesson data seeded
    await seedLessonData(page)

    // WHEN: Go offline then navigate to lesson
    await page.context().setOffline(true)
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Offline placeholder is visible
    await expect(page.getByTestId('youtube-offline-placeholder')).toBeVisible()
    await expect(page.getByText('No internet connection')).toBeVisible()
    await expect(
      page.getByText(/connect to the internet to watch this youtube video/i)
    ).toBeVisible()

    // Cleanup
    await page.context().setOffline(false)
  })

  test('should not show YouTube player when offline', async ({ page }) => {
    // GIVEN: Lesson data seeded, browser is offline
    await seedLessonData(page)
    await page.context().setOffline(true)

    // WHEN: Navigate to lesson
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Offline placeholder shows instead of player
    await expect(page.getByTestId('youtube-offline-placeholder')).toBeVisible()
    // The transcript panel should not be visible when offline
    await expect(page.getByRole('region', { name: /video transcript/i })).not.toBeVisible()

    // Cleanup
    await page.context().setOffline(false)
  })

  test('should still show header and completion toggle when offline', async ({ page }) => {
    // GIVEN: Lesson data seeded, browser is offline
    await seedLessonData(page)
    await page.context().setOffline(true)

    // WHEN: Navigate to lesson
    await goToLesson(page, 'yt-lesson-course', 'yt-lesson-vid-01')

    // THEN: Lesson title and completion toggle still render
    await expect(page.getByTestId('lesson-title')).toContainText(
      'Getting Started with TypeScript'
    )
    await expect(page.getByTestId('completion-toggle')).toBeVisible()

    // Cleanup
    await page.context().setOffline(false)
  })
})
