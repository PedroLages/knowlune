import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedVideos, seedImportedPdfs } from '../support/helpers/indexeddb-seed'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { FIXED_DATE } from '../utils/test-time'

/**
 * E01-S05: Detect Missing or Relocated Files
 *
 * Acceptance Criteria:
 * - AC1: System verifies FileSystemHandle accessibility on course load (non-blocking)
 * - AC2: Missing files display "File not found" badge + toast notification
 * - AC3: Available files remain functional alongside missing files
 * - AC4: Badge removed and access restored when file is recovered
 *
 * Test strategy:
 * FileSystemHandle is a browser-only API — seeded test data has no handles,
 * so verifyFileHandle(null) returns 'missing' for all items. This naturally
 * exercises the missing-file detection path (AC1, AC2).
 *
 * AC3 (available files functional) and AC4 (recovery) require real
 * FileSystemHandles and must be validated manually with actual file imports.
 */

const TEST_COURSE = createImportedCourse({
  id: 'course-file-detection',
  name: 'File Detection Test Course',
  importedAt: FIXED_DATE,
  status: 'active',
  videoCount: 2,
  pdfCount: 1,
})

const TEST_VIDEOS = [
  {
    id: 'video-1',
    courseId: 'course-file-detection',
    filename: 'lesson-1.mp4',
    path: 'videos/lesson-1.mp4',
    duration: 300,
    format: 'mp4' as const,
    order: 1,
  },
  {
    id: 'video-2',
    courseId: 'course-file-detection',
    filename: 'lesson-2.mp4',
    path: 'videos/lesson-2.mp4',
    duration: 450,
    format: 'mp4' as const,
    order: 2,
  },
]

const TEST_PDFS = [
  {
    id: 'pdf-1',
    courseId: 'course-file-detection',
    filename: 'course-notes.pdf',
    path: 'docs/course-notes.pdf',
    pageCount: 10,
  },
]

test.describe('E01-S05: Detect Missing or Relocated Files', () => {
  // IndexedDB is shared per origin across browser contexts in Chromium.
  // With fullyParallel: true, parallel tests corrupt each other's seeded data.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test.afterEach(async ({ indexedDB }) => {
    await indexedDB.clearStore('importedVideos')
    await indexedDB.clearStore('importedPdfs')
  })

  test.describe('AC1: FileSystemHandle verification on course load', () => {
    test('should verify file accessibility and show status indicators without blocking UI', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course with previously imported files (no real handles in test)
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user opens the course
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN the course structure renders without blocking (non-blocking verification)
      await expect(page.getByTestId('course-content-list')).toBeVisible()

      // AND each content item has a file status indicator with resolved status
      const videoStatus1 = page.getByTestId('file-status-video-1')
      await expect(videoStatus1).toBeVisible()
      await expect(videoStatus1).toHaveAttribute('data-status', 'missing')

      const videoStatus2 = page.getByTestId('file-status-video-2')
      await expect(videoStatus2).toBeVisible()
      await expect(videoStatus2).toHaveAttribute('data-status', 'missing')

      // AND PDF items also have status indicators
      const pdfStatus = page.getByTestId('file-status-pdf-1')
      await expect(pdfStatus).toBeVisible()
      await expect(pdfStatus).toHaveAttribute('data-status', 'missing')
    })
  })

  test.describe('AC2: Missing file badge and toast notification', () => {
    test('should display "File not found" badge on content items without valid handles', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course where files have no valid FileSystemHandle (simulating missing files)
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user opens the course and verification completes
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN missing videos display a "File not found" badge
      const videoBadge1 = page.getByTestId('file-not-found-badge-video-1')
      await expect(videoBadge1).toBeVisible()
      await expect(videoBadge1).toContainText(/file not found/i)

      const videoBadge2 = page.getByTestId('file-not-found-badge-video-2')
      await expect(videoBadge2).toBeVisible()

      // AND missing PDFs also display a badge
      const pdfBadge = page.getByTestId('file-not-found-badge-pdf-1')
      await expect(pdfBadge).toBeVisible()
    })

    test('should show toast notification identifying affected files', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course with missing files
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user opens the course
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN a toast notification identifies the affected files within 2 seconds (NFR11)
      const toast = page.locator('[data-sonner-toast]')
      await expect(toast.first()).toBeVisible({ timeout: 2000 })
      await expect(toast.first()).toContainText(/files? unavailable/i)
    })
  })

  test.describe('AC3: Missing files remain visible in structure', () => {
    test('should keep missing files in the content list with disabled state', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course where all files are missing (no handles in test data)
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user views the course structure
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN all content items are still visible in the list (not removed)
      await expect(page.getByTestId('course-content-item-video-video-1')).toBeVisible()
      await expect(page.getByTestId('course-content-item-video-video-2')).toBeVisible()
      await expect(page.getByTestId('course-content-item-pdf-pdf-1')).toBeVisible()

      // AND missing video items are rendered as disabled (div, not link)
      const videoItem = page.getByTestId('course-content-item-video-video-1')
      const disabledDiv = videoItem.locator('[aria-disabled="true"]')
      await expect(disabledDiv).toBeVisible()

      // AND missing items are not clickable (no link navigation)
      const links = videoItem.locator('a')
      await expect(links).toHaveCount(0)
    })
  })

  test.describe('AC4: Re-verification on course reload', () => {
    test('should re-verify file status on each course load', async ({ page, indexedDB }) => {
      // GIVEN a course that has been loaded and shows missing badges
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await page.reload()

      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)
      await expect(page.getByTestId('file-not-found-badge-video-1')).toBeVisible()

      // WHEN the user navigates away and returns (triggering re-verification)
      await navigateAndWait(page, '/courses')
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN verification runs again (status indicators present)
      // In test context, handles are still null so badges persist.
      // With real handles, recovery would clear them (manual test required).
      // AC4 badge-removal behavior is fully covered by unit test
      // (ImportedCourseDetail.test.tsx: "badge removed when file status changes to available").
      await expect(page.getByTestId('file-status-video-1')).toBeVisible()
      await expect(page.getByTestId('file-status-video-2')).toBeVisible()
    })
  })
})
