/**
 * E91-S11: Lesson Search in Side Panel
 *
 * Tests search/filter functionality in the PlayerSidePanel Lessons tab.
 *
 * Acceptance Criteria:
 * - AC1: Search input shown when >8 lessons
 * - AC2: Real-time filtering by title (case-insensitive)
 * - AC3: Matched substring highlighted with <mark>
 * - AC4: Clear button resets search and shows all lessons
 * - AC5: Search input NOT shown when ≤8 lessons
 * - AC6: Empty state shown when no matches
 * - AC7: aria-label on search input
 */
import { test, expect, type Page } from '@playwright/test'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
} from '../support/helpers/seed-helpers'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'e91s11-search-course'
const SMALL_COURSE_ID = 'e91s11-small-course'

/** Generate lesson videos for seeding */
function createTestVideos(courseId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${courseId}-lesson-${i + 1}`,
    courseId,
    filename: `Lesson ${i + 1} - Topic ${String.fromCharCode(65 + (i % 26))}`,
    path: `Lesson ${i + 1}.mp4`,
    duration: 300 + i * 60,
    format: 'mp4',
    order: i,
    fileHandle: null,
  }))
}

const LARGE_VIDEOS = createTestVideos(COURSE_ID, 12)
const SMALL_VIDEOS = createTestVideos(SMALL_COURSE_ID, 5)

const LARGE_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Search Test Course (12 lessons)',
  videoCount: 12,
  pdfCount: 0,
})

const SMALL_COURSE = createImportedCourse({
  id: SMALL_COURSE_ID,
  name: 'Small Course (5 lessons)',
  videoCount: 5,
  pdfCount: 0,
})

const FIRST_LESSON_ID = LARGE_VIDEOS[0].id
const LESSON_URL = `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}`
const SMALL_LESSON_URL = `/courses/${SMALL_COURSE_ID}/lessons/${SMALL_VIDEOS[0].id}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAndNavigate(page: Page, url: string) {
  await navigateAndWait(page, '/courses')
  await seedImportedCourses(page, [LARGE_COURSE, SMALL_COURSE])
  await seedImportedVideos(page, [...LARGE_VIDEOS, ...SMALL_VIDEOS])
  await navigateAndWait(page, url)
  await page.getByTestId('player-side-panel').waitFor({
    state: 'visible',
    timeout: TIMEOUTS.NETWORK,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E91-S11: Lesson Search in Side Panel', () => {
  test('AC1+AC7: search input visible for >8 lessons with aria-label', async ({
    page,
  }) => {
    await seedAndNavigate(page, LESSON_URL)

    const searchInput = page.getByTestId('lesson-search-input')
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(searchInput).toHaveAttribute(
      'aria-label',
      'Filter lessons by title'
    )
  })

  test('AC5: search input NOT shown for ≤8 lessons', async ({ page }) => {
    await seedAndNavigate(page, SMALL_LESSON_URL)

    const lessonsList = page.getByTestId('lessons-tab-list')
    await expect(lessonsList).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Search input should not exist
    await expect(page.getByTestId('lesson-search-input')).not.toBeVisible()
  })

  test('AC2: filtering by title in real time', async ({ page }) => {
    await seedAndNavigate(page, LESSON_URL)

    const searchInput = page.getByTestId('lesson-search-input')
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.LONG })

    // All 12 lessons visible initially
    const lessonLinks = page.getByTestId('lessons-tab-list').getByRole('link')
    await expect(lessonLinks).toHaveCount(12)

    // Type a query that matches a subset — "Topic A" matches lesson 1 only
    // (filenames: "Lesson 1 - Topic A", "Lesson 2 - Topic B", etc.)
    await searchInput.fill('Topic A')

    // Should filter to only matching lessons
    await expect(lessonLinks).toHaveCount(1)
  })

  test('AC3: matched substring highlighted with <mark>', async ({ page }) => {
    await seedAndNavigate(page, LESSON_URL)

    const searchInput = page.getByTestId('lesson-search-input')
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.LONG })

    await searchInput.fill('Topic')

    // All lessons contain "Topic" so all should show highlights
    const marks = page.getByTestId('lessons-tab-list').locator('mark')
    await expect(marks.first()).toBeVisible()
    await expect(marks.first()).toHaveText('Topic')
  })

  test('AC4: clear button resets search', async ({ page }) => {
    await seedAndNavigate(page, LESSON_URL)

    const searchInput = page.getByTestId('lesson-search-input')
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Filter down
    await searchInput.fill('Topic A')
    const lessonLinks = page.getByTestId('lessons-tab-list').getByRole('link')
    await expect(lessonLinks).toHaveCount(1)

    // Click clear button
    const clearButton = page.getByTestId('lesson-search-clear')
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    // All lessons restored
    await expect(lessonLinks).toHaveCount(12)
    await expect(searchInput).toHaveValue('')
  })

  test('AC6: empty state when no matches', async ({ page }) => {
    await seedAndNavigate(page, LESSON_URL)

    const searchInput = page.getByTestId('lesson-search-input')
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.LONG })

    await searchInput.fill('zzz-nonexistent-query')

    const emptyState = page.getByTestId('lesson-search-empty')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText('No lessons match your search')
  })
})
