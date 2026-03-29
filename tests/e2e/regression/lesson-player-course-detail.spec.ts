/**
 * Story 2.1: Lesson Player - Course Detail Page Tests
 *
 * Tests verify:
 *   - AC4: Course detail page listing videos
 *   - Navigation flows (card to detail to player)
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

/** Navigate to imported course detail page. */
async function goToImportedCourseDetail(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}`)
}

// ===========================================================================
// AC-4: Course Detail Page - Navigation
// ===========================================================================

test.describe('AC-4: Course Detail Page - Navigation', () => {
  test('should display course detail page at imported course route', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the imported course detail page
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Course detail page is visible
    await expect(page.getByTestId('imported-course-detail')).toBeVisible()
  })

  test('should display course name on detail page', async ({ page, indexedDB }) => {
    // GIVEN: Imported course seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Course name is visible
    await expect(page.getByTestId('course-detail-title')).toHaveText('React Fundamentals')
  })

  test('should list all videos in the course', async ({ page, indexedDB }) => {
    // GIVEN: Course with 3 videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: 3 video items are listed
    const videoItems = page.getByTestId('course-content-item-video')
    await expect(videoItems).toHaveCount(3)
  })

  test('should display video filenames in the list', async ({ page, indexedDB }) => {
    // GIVEN: Course with known video filenames seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Video filenames are visible
    await expect(page.getByText('01-Introduction.mp4')).toBeVisible()
    await expect(page.getByText('02-React-Hooks.mp4')).toBeVisible()
    await expect(page.getByText('03-State-Management.mp4')).toBeVisible()
  })

  test('should display video duration in the list', async ({ page, indexedDB }) => {
    // GIVEN: Video with 320s duration seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Duration is formatted and visible (320s = 5:20)
    await expect(page.getByText('5:20')).toBeVisible()
  })

  test('should have clickable video items that navigate to lesson player', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with videos seeded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // WHEN: User clicks first video
    await page.getByText('01-Introduction.mp4').click()

    // THEN: Navigated to lesson player
    await page.waitForURL(/\/courses\/course-react-101\/lessons\/video-intro/)
  })

  test('should display back to courses link', async ({ page, indexedDB }) => {
    // GIVEN: Course detail page loaded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Back to Courses link is visible
    await expect(page.getByRole('link', { name: /back to courses/i })).toBeVisible()
  })

  test('should navigate back to courses page when back link clicked', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course detail page loaded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // WHEN: User clicks Back to Courses
    await page.getByRole('link', { name: /back to courses/i }).click()

    // THEN: Navigated to courses page
    await page.waitForURL(/\/courses/)
  })

  test('should display type icons for videos', async ({ page, indexedDB }) => {
    // GIVEN: Course with videos seeded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Video items have video type indicator
    const firstVideo = page.getByTestId('course-content-item-video').first()
    await expect(firstVideo.getByTestId('content-type-icon')).toBeVisible()
  })

  test('should render course detail list in single column on mobile', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Content list container is visible and takes full width
    const contentList = page.getByTestId('course-content-list')
    await expect(contentList).toBeVisible()
    const box = await contentList.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(375 * 0.85)
    }
  })
})

// ===========================================================================
// Navigation: Full Flow
// ===========================================================================

test.describe('Navigation: Full Flow', () => {
  test('should navigate from course card to detail to player', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded, on courses page
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User clicks the imported course card
    const card = page.getByTestId('imported-course-card').first()
    await card.click()

    // THEN: Navigated to course detail page
    await page.waitForURL(/\/courses\/course-react-101/)
    await expect(page.getByTestId('imported-course-detail')).toBeVisible()

    // WHEN: User clicks first video
    await page.getByText('01-Introduction.mp4').click()

    // THEN: Navigated to lesson player
    await page.waitForURL(/\/courses\/course-react-101\/lessons\/video-intro/)
  })

  test('should have keyboard accessible navigation through course items', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course detail page loaded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // WHEN: User tabs to first content item and presses Enter
    const firstItem = page.getByTestId('course-content-item-video').first()
    await firstItem.focus()
    await page.keyboard.press('Enter')

    // THEN: Navigated to lesson player
    await page.waitForURL(/\/courses\/course-react-101\/lessons\//)
  })
})
