/**
 * E54-S03: Completion Checkmarks in UnifiedCourseDetail
 *
 * Tests StatusIndicator display and CourseProgress card on the
 * unified course detail page for local (imported) courses.
 *
 * Data model: UnifiedCourseDetail loads progress from the `progress`
 * table (VideoProgress shape: courseId, videoId, completionPercentage).
 * A lesson is "completed" when completionPercentage >= 90.
 *
 * Serial mode: IndexedDB is shared state in Chromium.
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
  clearIndexedDBStore,
} from '../../support/helpers/seed-helpers'
import { goToCourse, goToCourses } from '../../support/helpers/navigation'

const COURSE_ID = 'e54-test-course'
const VIDEO_IDS = ['vid-1', 'vid-2', 'vid-3', 'vid-4']

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'E54 Checkmark Test Course',
  videoCount: VIDEO_IDS.length,
  pdfCount: 0,
})

const TEST_VIDEOS = VIDEO_IDS.map((id, i) => ({
  id,
  courseId: COURSE_ID,
  filename: `Lesson ${i + 1}.mp4`,
  path: `Lesson ${i + 1}.mp4`,
  duration: 300 + i * 60,
  format: 'mp4',
  order: i,
  fileHandle: null,
}))

/** Create a VideoProgress record for the `progress` table. */
function createVideoProgress(
  videoId: string,
  completionPercentage: number
): Record<string, unknown> {
  return {
    courseId: COURSE_ID,
    videoId,
    currentTime: 0,
    completionPercentage,
  }
}

test.describe('E54-S03: Completion Checkmarks', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // Navigate first so Dexie initialises the DB schema
    await goToCourses(page)
    // Seed course and videos
    await seedImportedCourses(page, [TEST_COURSE])
    await seedImportedVideos(page, TEST_VIDEOS)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'progress')
  })

  // AC3: No videos watched — all not-started, 0 of 4
  test('AC3: shows all not-started indicators and 0% when no videos watched', async ({ page }) => {
    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    // Progress card shows 0 of 4 lessons completed
    const progressCard = page.getByTestId('course-progress-card')
    await expect(progressCard).toBeVisible()
    await expect(progressCard).toContainText('0 of 4 lessons completed')

    // All status indicators show not-started
    for (const videoId of VIDEO_IDS) {
      const indicator = page.getByTestId(`status-indicator-${videoId}`)
      await expect(indicator).toBeVisible()
      await expect(indicator).toHaveAttribute('data-status', 'not-started')
    }
  })

  // AC1 + AC2: Some videos completed — green checks and progress bar
  test('AC1+AC2: shows completed indicators for completed videos and correct progress', async ({
    page,
  }) => {
    // Seed 2 of 4 videos as completed (>= 90%)
    await seedIndexedDBStore(page, 'ElearningDB', 'progress', [
      createVideoProgress('vid-1', 95),
      createVideoProgress('vid-3', 100),
    ])

    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    // Progress card shows 2 of 4 lessons completed
    const progressCard = page.getByTestId('course-progress-card')
    await expect(progressCard).toBeVisible()
    await expect(progressCard).toContainText('2 of 4 lessons completed')
    await expect(progressCard).toContainText('50%')

    // Completed videos have completed status
    await expect(page.getByTestId('status-indicator-vid-1')).toHaveAttribute(
      'data-status',
      'completed'
    )
    await expect(page.getByTestId('status-indicator-vid-3')).toHaveAttribute(
      'data-status',
      'completed'
    )

    // Not-started videos have not-started status
    await expect(page.getByTestId('status-indicator-vid-2')).toHaveAttribute(
      'data-status',
      'not-started'
    )
    await expect(page.getByTestId('status-indicator-vid-4')).toHaveAttribute(
      'data-status',
      'not-started'
    )
  })

  // All completed — 100%
  test('shows 100% progress when all videos completed', async ({ page }) => {
    // Seed all videos as completed
    await seedIndexedDBStore(
      page,
      'ElearningDB',
      'progress',
      VIDEO_IDS.map(id => createVideoProgress(id, 95))
    )

    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    // Progress card shows 4 of 4 lessons completed
    const progressCard = page.getByTestId('course-progress-card')
    await expect(progressCard).toContainText('4 of 4 lessons completed')

    // All indicators show completed
    for (const videoId of VIDEO_IDS) {
      await expect(page.getByTestId(`status-indicator-${videoId}`)).toHaveAttribute(
        'data-status',
        'completed'
      )
    }
  })

  // In-progress status indicator
  test('shows in-progress indicator for partially watched videos', async ({ page }) => {
    // Seed one video with partial progress (> 0% but < 90%)
    await seedIndexedDBStore(page, 'ElearningDB', 'progress', [createVideoProgress('vid-2', 45)])

    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    // In-progress video shows in-progress status
    await expect(page.getByTestId('status-indicator-vid-2')).toHaveAttribute(
      'data-status',
      'in-progress'
    )

    // Progress summary still shows 0 completed (in-progress is not completed)
    const progressCard = page.getByTestId('course-progress-card')
    await expect(progressCard).toContainText('0 of 4 lessons completed')
  })
})
