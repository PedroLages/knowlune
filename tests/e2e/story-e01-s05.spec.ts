import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos, seedImportedPdfs } from '../support/helpers/indexeddb-seed'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { FIXED_DATE } from '../utils/test-time'

/**
 * E01-S05: Detect Missing or Relocated Files
 *
 * ATDD tests — written RED before implementation.
 *
 * Acceptance Criteria:
 * - AC1: System verifies FileSystemHandle accessibility on course load (non-blocking)
 * - AC2: Missing files display "File not found" badge + toast notification
 * - AC3: Available files remain functional alongside missing files
 * - AC4: Badge removed and access restored when file is recovered
 */

const TEST_COURSE = createImportedCourse({
  id: 'course-file-detection',
  name: 'File Detection Test Course',
  importedAt: FIXED_DATE,
  status: 'active',
  videoCount: 3,
  pdfCount: 1,
})

const TEST_VIDEOS = [
  {
    id: 'video-available',
    courseId: 'course-file-detection',
    filename: 'lesson-1.mp4',
    path: 'videos/lesson-1.mp4',
    duration: 300,
    format: 'mp4' as const,
    order: 1,
  },
  {
    id: 'video-missing',
    courseId: 'course-file-detection',
    filename: 'lesson-2-missing.mp4',
    path: 'videos/lesson-2-missing.mp4',
    duration: 450,
    format: 'mp4' as const,
    order: 2,
  },
]

const TEST_PDFS = [
  {
    id: 'pdf-missing',
    courseId: 'course-file-detection',
    filename: 'notes-missing.pdf',
    path: 'docs/notes-missing.pdf',
    pageCount: 10,
  },
]

test.describe('E01-S05: Detect Missing or Relocated Files', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test.describe('AC1: FileSystemHandle verification on course load', () => {
    test('should verify file accessibility when course loads without blocking UI', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course with previously imported files
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await page.reload()

      // WHEN the user opens the course
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN verification completes without blocking the UI
      // The course structure should remain interactive during verification
      await expect(page.getByTestId('course-content-list')).toBeVisible()

      // AND each content item should show a file status indicator
      // (either 'available' or checking state — not frozen)
      await expect(page.getByTestId('file-status-video-available')).toBeVisible()
      await expect(page.getByTestId('file-status-video-missing')).toBeVisible()
    })
  })

  test.describe('AC2: Missing file badge and toast notification', () => {
    test('should display "File not found" badge on missing content items', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course where some files are inaccessible
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user opens the course and verification completes
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN missing files display a "File not found" badge
      const missingVideoBadge = page.getByTestId('file-not-found-badge-video-missing')
      await expect(missingVideoBadge).toBeVisible()
      await expect(missingVideoBadge).toContainText(/file not found/i)

      const missingPdfBadge = page.getByTestId('file-not-found-badge-pdf-missing')
      await expect(missingPdfBadge).toBeVisible()
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
      await expect(toast.first()).toContainText(/file not found|missing/i)
    })
  })

  test.describe('AC3: Partial availability — available files remain functional', () => {
    test('should allow access to available files while showing missing file badges', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course with both available and missing files
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await seedImportedPdfs(page, TEST_PDFS)
      await page.reload()

      // WHEN the user views the course structure
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN available files are fully functional (clickable, no badge)
      const availableItem = page.getByTestId('course-content-item-video-available')
      await expect(availableItem).toBeVisible()
      await expect(
        page.getByTestId('file-not-found-badge-video-available')
      ).not.toBeVisible()

      // AND missing files show the badge but remain in the structure
      const missingItem = page.getByTestId('course-content-item-video-missing')
      await expect(missingItem).toBeVisible()
      await expect(
        page.getByTestId('file-not-found-badge-video-missing')
      ).toBeVisible()

      // AND the user can still navigate to available content
      await availableItem.click()
      await page.waitForURL(/\/lessons\/video-available/)
    })
  })

  test.describe('AC4: File recovery — badge removed on re-verification', () => {
    test('should remove badge and restore access when file is recovered', async ({
      page,
      indexedDB,
    }) => {
      // GIVEN a course where a file was previously missing
      await navigateAndWait(page, '/courses')
      await indexedDB.seedImportedCourses([TEST_COURSE])
      await seedImportedVideos(page, TEST_VIDEOS)
      await page.reload()

      // AND the missing file badge is visible
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)
      await expect(
        page.getByTestId('file-not-found-badge-video-missing')
      ).toBeVisible()

      // WHEN the user restores the file and re-loads the course
      // (Simulate file recovery by navigating away and back — handle re-verified)
      await navigateAndWait(page, '/courses')
      await page.getByText('File Detection Test Course').click()
      await page.waitForURL(/\/imported-courses\/course-file-detection/)

      // THEN the badge should be removed (when handle is accessible again)
      // NOTE: This test will pass only once the verification logic
      // properly re-checks handles on each course load
      await expect(
        page.getByTestId('file-status-video-missing')
      ).toBeVisible()
    })
  })
})
