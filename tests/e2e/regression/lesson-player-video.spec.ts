/**
 * Story 2.1: Lesson Player - Video Playback Tests
 *
 * Tests verify:
 *   - AC1: Video playback from imported course via blob URL
 *   - Responsive video layout and controls
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
  await navigateAndWait(page, `/courses/${courseId}/lessons/${lessonId}`)
}

// ===========================================================================
// AC-1: Video Playback from Imported Course
// ===========================================================================

test.describe('AC-1: Video Playback from Imported Course', () => {
  test('should render video player on lesson page', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Video player is visible
    await expect(page.getByTestId('video-player-container')).toBeVisible()
  })

  test('should display video title in header', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Video title is displayed in the breadcrumb
    await expect(page.getByTestId('course-breadcrumb')).toContainText('01-Introduction.mp4')
  })

  test('should display course name in breadcrumb', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Course name is displayed in the breadcrumb
    await expect(page.getByTestId('course-breadcrumb')).toContainText('React Fundamentals')
  })

  test('should have clean distraction-free layout', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: The lesson player main content area is visible
    await expect(page.getByTestId('lesson-player-content')).toBeVisible()

    // AND: No sidebar clutter visible on the lesson player page
    await expect(page.getByTestId('sidebar-navigation')).not.toBeVisible()
  })

  test('should start video in paused state', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Play button is visible (indicating paused state)
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible()
  })
})

// ===========================================================================
// AC-5: Responsive Layout - Video Player
// ===========================================================================

test.describe('AC-5: Responsive Layout - Video Player', () => {
  test('should render video player full width on mobile', async ({ page, indexedDB }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Video player container takes full width
    const playerContainer = page.getByTestId('video-player-container')
    const box = await playerContainer.boundingBox()
    // Allow some padding (player should be at least 90% of viewport width)
    expect(box).toBeTruthy()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(375 * 0.9)
    }
  })

  test('should have touch-friendly control buttons on mobile (>= 44x44px)', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Play button meets minimum touch target size
    const playButton = page.getByRole('button', { name: /play/i })
    const box = await playButton.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})

// ===========================================================================
// AC-6: Blob URL Cleanup
// ===========================================================================

test.describe('AC-6: Blob URL Cleanup', () => {
  // NOTE: Blob URL cleanup is primarily verified via unit tests for the
  // useVideoFromHandle hook. E2E tests verify no memory leak symptoms.

  test('should not accumulate blob URLs after navigation away and back', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: Navigate to lesson player and then away
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')
    // Wait for page to settle
    await page.waitForLoadState('domcontentloaded')

    // Navigate back to course detail
    await navigateAndWait(page, '/courses/course-react-101')
    await page.waitForLoadState('domcontentloaded')

    // THEN: Page should not have any errors (memory leak would eventually cause issues)
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Navigate back to lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')
    await page.waitForLoadState('domcontentloaded')

    // No error messages related to blob URLs
    const blobErrors = consoleErrors.filter(e => e.toLowerCase().includes('blob'))
    expect(blobErrors).toHaveLength(0)
  })
})
