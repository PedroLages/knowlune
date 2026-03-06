/**
 * Story 2.1: Lesson Player Page with Video Playback — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Video playback from imported course via blob URL
 *   - AC2: File access error recovery (locate file, back to course)
 *   - AC3: File permission re-request on lost permission
 *   - AC4: Course detail page listing videos and PDFs
 *   - AC5: Responsive mobile layout with touch targets
 *   - AC6: Blob URL cleanup on navigation away
 *
 * Data seeding:
 *   - Imported courses seeded via IndexedDB fixture (Dexie 'ElearningDB')
 *   - Imported videos seeded via inline helper (importedVideos table)
 *   - Page reloaded after seeding to trigger Zustand store load
 *
 * Note: FileSystemFileHandle cannot be seeded in E2E tests (browser-only API).
 * Tests focus on navigation, layout, and UI states rather than actual file I/O.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../support/helpers/navigation'
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

interface ImportedPdfTestData {
  id: string
  courseId: string
  filename: string
  pageCount?: number
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

const TEST_PDFS: ImportedPdfTestData[] = [
  {
    id: 'pdf-cheatsheet',
    courseId: 'course-react-101',
    filename: 'React-Cheatsheet.pdf',
    pageCount: 12,
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

/** Seed imported PDFs into IndexedDB via page.evaluate. */
async function seedImportedPdfs(page: Page, pdfs: ImportedPdfTestData[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, data }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('importedPdfs')) {
            db.close()
            reject(new Error('Store "importedPdfs" not found'))
            return
          }
          const tx = db.transaction('importedPdfs', 'readwrite')
          const store = tx.objectStore('importedPdfs')
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
    { dbName: DB_NAME, data: pdfs }
  )
}

/** Navigate to Courses page, seed course + videos + PDFs, reload. */
async function seedCourseAndReload(
  page: Page,
  indexedDB: {
    seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  }
) {
  // Navigate first so Dexie creates the database
  await goToCourses(page)
  // Seed course, videos, and PDFs
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await seedImportedPdfs(page, TEST_PDFS)
  // Reload so stores pick up seeded data
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Navigate to imported course detail page. */
async function goToImportedCourseDetail(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/imported-courses/${courseId}`)
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

    // THEN: Video title is displayed in the header
    await expect(page.getByTestId('lesson-header-title')).toContainText('01-Introduction.mp4')
  })

  test('should display course name in header', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to the lesson player
    await goToImportedLessonPlayer(page, 'course-react-101', 'video-intro')

    // THEN: Course name is displayed in the header
    await expect(page.getByTestId('lesson-header-course')).toContainText('React Fundamentals')
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

// ===========================================================================
// AC-4: Course Detail Page for Imported Courses
// ===========================================================================

test.describe('AC-4: Course Detail Page', () => {
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

  test('should list PDFs in the course', async ({ page, indexedDB }) => {
    // GIVEN: Course with 1 PDF seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: PDF item is listed
    const pdfItems = page.getByTestId('course-content-item-pdf')
    await expect(pdfItems).toHaveCount(1)
    await expect(page.getByText('React-Cheatsheet.pdf')).toBeVisible()
  })

  test('should display PDF page count', async ({ page, indexedDB }) => {
    // GIVEN: PDF with 12 pages seeded
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User navigates to course detail
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Page count is visible
    await expect(page.getByText(/12 pages/i)).toBeVisible()
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
    await page.waitForURL(/\/imported-courses\/course-react-101\/lessons\/video-intro/)
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

  test('should display type icons for videos and PDFs', async ({ page, indexedDB }) => {
    // GIVEN: Course with videos and PDFs seeded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: Video items have video type indicator
    const firstVideo = page.getByTestId('course-content-item-video').first()
    await expect(firstVideo.getByTestId('content-type-icon')).toBeVisible()

    // AND: PDF items have PDF type indicator
    const firstPdf = page.getByTestId('course-content-item-pdf').first()
    await expect(firstPdf.getByTestId('content-type-icon')).toBeVisible()
  })
})

// ===========================================================================
// AC-5: Responsive Layout
// ===========================================================================

test.describe('AC-5: Responsive Layout', () => {
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
    await goToImportedCourseDetail(page, 'course-react-101')
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

// ===========================================================================
// Navigation: Card to Detail to Player Flow
// ===========================================================================

test.describe('Navigation: Full Flow', () => {
  test('should navigate from course card to detail to player', async ({ page, indexedDB }) => {
    // GIVEN: Imported course with videos seeded, on courses page
    await seedCourseAndReload(page, indexedDB)

    // WHEN: User clicks the imported course card
    const card = page.getByTestId('imported-course-card').first()
    await card.click()

    // THEN: Navigated to course detail page
    await page.waitForURL(/\/imported-courses\/course-react-101/)
    await expect(page.getByTestId('imported-course-detail')).toBeVisible()

    // WHEN: User clicks first video
    await page.getByText('01-Introduction.mp4').click()

    // THEN: Navigated to lesson player
    await page.waitForURL(/\/imported-courses\/course-react-101\/lessons\/video-intro/)
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
    await page.waitForURL(/\/imported-courses\/course-react-101\/lessons\//)
  })
})
