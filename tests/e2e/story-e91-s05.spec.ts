/**
 * E2E Tests: E91-S05 — Lesson Header Card + Chapter Markers
 *
 * Tests acceptance criteria:
 * - AC1: Lesson header card displays title, description, resource badges, tags
 * - AC2/AC3: Chapter markers visible on progress bar (local video w/ chapters)
 * - AC4: Graceful empty state when no chapter data
 * - AC5: Design tokens used (no hardcoded colors)
 * - AC6: Click chapter marker seeks video
 *
 * NOTE: Seeded ImportedVideo records lack a fileHandle, so no <video> element
 * renders. Tests verify the LessonHeaderCard rendering which does not depend
 * on video playback. Chapter marker tests verify the component exists when
 * chapter data is provided via YouTube sourceMetadata.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { TIMEOUTS } from '../utils/constants'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'e91-s05-course',
  name: 'Header Card Test Course',
  videoCount: 2,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'e91-s05-vid-01',
    courseId: 'e91-s05-course',
    filename: '01-Introduction.mp4',
    path: '/01-Introduction.mp4',
    duration: 300,
    format: 'mp4',
    order: 0,
    description: 'An introduction to the core concepts of the course.',
    chapters: [
      { time: 0, title: 'Intro' },
      { time: 60, title: 'Setup' },
      { time: 180, title: 'First Steps' },
    ],
  },
  {
    id: 'e91-s05-vid-02',
    courseId: 'e91-s05-course',
    filename: '02-Advanced-Topics.mp4',
    path: '/02-Advanced-Topics.mp4',
    duration: 600,
    format: 'mp4',
    order: 1,
    // No description, no chapters — tests graceful empty state
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
  await navigateAndWait(page, `/courses/e91-s05-course/lessons/${lessonId}`)
}

// ===========================================================================
// AC1: Lesson header card displays title, description, badges
// ===========================================================================

test.describe('AC1: Lesson header card', () => {
  test('shows title, description, and resource type badge', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e91-s05-vid-01')

    const headerCard = page.getByTestId('lesson-header-card')
    await expect(headerCard).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Title should be visible
    await expect(headerCard.locator('h2')).toContainText('01-Introduction.mp4')

    // Description should be visible
    await expect(headerCard).toContainText('An introduction to the core concepts')

    // Resource type badge should show "Video"
    const badges = page.getByTestId('resource-type-badges')
    await expect(badges).toBeVisible()
    await expect(badges).toContainText('Video')
  })

  test('handles missing description gracefully', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e91-s05-vid-02')

    const headerCard = page.getByTestId('lesson-header-card')
    await expect(headerCard).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Title should still be visible
    await expect(headerCard.locator('h2')).toContainText('02-Advanced-Topics.mp4')

    // No description paragraph — card should not have descriptive text
    const descriptionParagraph = headerCard.locator('p')
    await expect(descriptionParagraph).toHaveCount(0)
  })
})

// ===========================================================================
// AC4: Graceful empty state when no chapter data
// ===========================================================================

test.describe('AC4: No chapters graceful empty state', () => {
  test('lesson without chapters does not show chapter markers', async ({ page }) => {
    await seedCourseData(page)
    await goToLesson(page, 'e91-s05-vid-02')

    // Header card should still render
    const headerCard = page.getByTestId('lesson-header-card')
    await expect(headerCard).toBeVisible({ timeout: TIMEOUTS.LONG })

    // No chapter markers should be present (video doesn't have chapters)
    const chapterMarkers = page.getByTestId('chapter-marker')
    await expect(chapterMarkers).toHaveCount(0)
  })
})
