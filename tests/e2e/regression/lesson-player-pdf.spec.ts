/**
 * Story 2.1: Lesson Player - PDF Viewer Tests
 *
 * Tests verify:
 *   - AC4: Course detail page listing PDFs
 *   - PDF viewing functionality
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

interface ImportedPdfTestData {
  id: string
  courseId: string
  filename: string
  pageCount?: number
}

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

/** Navigate to Courses page, seed course + PDFs, reload. */
async function seedCourseAndReload(
  page: Page,
  indexedDB: {
    seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  }
) {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedPdfs(page, TEST_PDFS)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Navigate to imported course detail page. */
async function goToImportedCourseDetail(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/imported-courses/${courseId}`)
}

// ===========================================================================
// AC-4: Course Detail Page - PDF Listing
// ===========================================================================

test.describe('AC-4: Course Detail Page - PDF Listing', () => {
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

  test('should display type icons for PDFs', async ({ page, indexedDB }) => {
    // GIVEN: Course with PDFs seeded
    await seedCourseAndReload(page, indexedDB)
    await goToImportedCourseDetail(page, 'course-react-101')

    // THEN: PDF items have PDF type indicator
    const firstPdf = page.getByTestId('course-content-item-pdf').first()
    await expect(firstPdf.getByTestId('content-type-icon')).toBeVisible()
  })
})
