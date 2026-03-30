/**
 * E91-S02: Local Course Visual Parity (Progress Bars + Thumbnails)
 *
 * Verifies local course items display progress bars, completion badges,
 * and thumbnail placeholders matching YouTube course visual styling.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
  clearIndexedDBStore,
} from '../support/helpers/seed-helpers'
import { goToCourse, goToCourses } from '../support/helpers/navigation'

const COURSE_ID = 'e91s02-local-course'
const VIDEO_IDS = ['vid-a', 'vid-b', 'vid-c']

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Local Visual Parity Test',
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

function createProgress(videoId: string, pct: number): Record<string, unknown> {
  return {
    courseId: COURSE_ID,
    videoId,
    currentTime: 0,
    completionPercentage: pct,
  }
}

test.describe('E91-S02: Local Course Visual Parity', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await goToCourses(page)
    await seedImportedCourses(page, [TEST_COURSE])
    await seedImportedVideos(page, TEST_VIDEOS)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'progress')
  })

  // AC3: Thumbnail placeholders visible for each video
  test('AC3: shows thumbnail placeholders for local video items', async ({ page }) => {
    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    for (const videoId of VIDEO_IDS) {
      const placeholder = page.getByTestId(`thumbnail-placeholder-${videoId}`)
      await expect(placeholder).toBeVisible()
    }
  })

  // AC1: In-progress video shows progress bar
  test('AC1: shows progress bar for in-progress local video', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'progress', [
      createProgress('vid-a', 65),
    ])
    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    const progressBar = page.getByTestId('progress-bar-vid-a')
    await expect(progressBar).toBeVisible()

    const badge = page.getByTestId('progress-badge-vid-a')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('65%')
  })

  // AC4: Not-started video shows no progress bar
  test('AC4: no progress bar for not-started local video', async ({ page }) => {
    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    const progressBar = page.getByTestId('progress-bar-vid-b')
    await expect(progressBar).not.toBeVisible()
  })

  // AC2: Completed video shows completion badge
  test('AC2: shows completion badge for completed local video', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'progress', [
      createProgress('vid-b', 100),
    ])
    await goToCourse(page, COURSE_ID)
    await page.waitForSelector('[data-testid="unified-course-detail"]', { state: 'visible' })

    const badge = page.getByTestId('completion-badge-vid-b')
    await expect(badge).toBeVisible()
  })
})
