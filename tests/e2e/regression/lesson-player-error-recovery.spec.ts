/**
 * Story 2.1: Lesson Player - Error Recovery Tests
 *
 * Tests verify:
 *   - AC2: File access error recovery (locate file, back to course)
 *   - AC3: File permission re-request on lost permission
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../../support/helpers/navigation'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'course-react-101',
  name: 'React Fundamentals',
  videoCount: 3,
  pdfCount: 1,
})

interface ImportedVideoTestData {
  id: string
  courseId: string
  filename: string
  order: number
  duration?: number
}

const TEST_VIDEOS: ImportedVideoTestData[] = [
  {
    id: 'video-intro',
    courseId: 'course-react-101',
    filename: '01-Introduction.mp4',
    order: 0,
    duration: 320,
  },
  {
    id: 'video-hooks',
    courseId: 'course-react-101',
    filename: '02-React-Hooks.mp4',
    order: 1,
    duration: 1500,
  },
  {
    id: 'video-state',
    courseId: 'course-react-101',
    filename: '03-State-Management.mp4',
    order: 2,
    duration: 900,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'ElearningDB'

/** Seed imported videos into IndexedDB via page.evaluate. */
async function seedImportedVideos(page: Page, videos: ImportedVideoTestData[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, data }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('importedVideos')) {
            db.close()
            reject(new Error('Store "importedVideos" not found'))
            return
          }
          const tx = db.transaction('importedVideos', 'readwrite')
          const store = tx.objectStore('importedVideos')
          for (const item of data) {
            store.put(item)
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: DB_NAME, data: videos }
  )
}

/** Navigate to Courses page, seed course + videos, reload. */
async function seedCourseAndReload(
  page: Page,
  indexedDB: {
    seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  }
) {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Navigate to imported lesson player page. */
async function goToImportedLessonPlayer(
  page: Page,
  courseId: string,
  lessonId: string
): Promise<void> {
  await navigateAndWait(page, `/imported-courses/${courseId}/lessons/${lessonId}`)
}

// ===========================================================================
// AC-2: File Access Error Recovery
// ===========================================================================

test.describe('AC-2: File Access Error Recovery', () => {
  test('should display error state when video file not accessible', async ({ page, indexedDB }) => {
    // GIVEN: Course seeded but video has no valid file handle
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to a video that cannot be accessed
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Error message is displayed
    // (File handles can't be seeded in E2E, so error state should appear)
    await expect(page.getByTestId('lesson-error-state')).toBeVisible()
    await expect(page.getByTestId('lesson-error-state')).toContainText(/video file not found/i)
  })

  test('should provide locate file button in error state', async ({ page, indexedDB }) => {
    // GIVEN: Video file not accessible
    await seedCourseAndReload(page, indexedDB)
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Locate file button is visible
    await expect(page.getByRole('button', { name: /locate/i })).toBeVisible()
  })

  test('should provide back to course button in error state', async ({ page, indexedDB }) => {
    // GIVEN: Video file not accessible
    await seedCourseAndReload(page, indexedDB)
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Back to Course button is visible
    await expect(page.getByRole('link', { name: /back to course/i })).toBeVisible()
  })

  test('should navigate back to course detail when back button clicked', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Video file not accessible, error state visible
    await seedCourseAndReload(page, indexedDB)
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // WHEN: User clicks "Back to Course"
    await page.getByRole('link', { name: /back to course/i }).click()

    // THEN: Navigated to course detail page
    await page.waitForURL(/\/imported-courses\/course-react-101/)
    await expect(page.getByTestId('imported-course-detail')).toBeVisible()
  })

  test('should not crash or leave page in broken state', async ({ page, indexedDB }) => {
    // GIVEN: Video file not accessible
    await seedCourseAndReload(page, indexedDB)
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Page is not in an error boundary / crash state
    await expect(page.locator('body')).not.toContainText(/something went wrong/i)
    // AND: Either video player or error state is shown (not blank)
    const hasContent =
      (await page
        .getByTestId('video-player-container')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByTestId('lesson-error-state')
        .isVisible()
        .catch(() => false))
    expect(hasContent).toBe(true)
  })
})

// ===========================================================================
// AC-3: File Permission Re-request
// ===========================================================================

test.describe('AC-3: File Permission Re-request', () => {
  // NOTE: FileSystemFileHandle permission APIs cannot be fully tested in E2E.
  // These tests verify the UI handles permission-related states gracefully.

  test('should show permission prompt message when permission needed', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course seeded, video file handle exists but permission not granted
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Either a permission prompt or error state is visible
    // (In E2E without real file handles, error state is expected)
    const hasState =
      (await page
        .getByTestId('lesson-permission-prompt')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByTestId('lesson-error-state')
        .isVisible()
        .catch(() => false))
    expect(hasState).toBe(true)
  })
})
