/**
 * E01-S06: Delete Imported Course — ATDD acceptance tests
 *
 * Maps to acceptance criteria AC1–AC4.
 * AC5 (error rollback) is not covered — forcing Dexie failures
 * in a browser E2E context is impractical (verify manually).
 *
 * Serial mode: IndexedDB is shared state in Chromium.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { seedImportedCourses, clearIndexedDBStore } from '../support/helpers/indexeddb-seed'
import { goToCourses } from '../support/helpers/navigation'

const TEST_COURSE = createImportedCourse({ name: 'Test Course To Delete' })

test.describe('E01-S06: Delete Imported Course', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // Navigate first so Dexie initialises the DB schema
    await goToCourses(page)
    // Seed a single imported course
    await seedImportedCourses(page, [TEST_COURSE])
    // Reload to pick up seeded data
    await page.reload()
    await page.waitForLoadState('load')
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedPdfs')
  })

  // AC1 — Delete option in course card dropdown
  test('AC1: shows delete option in course card dropdown', async ({ page }) => {
    // Open the status dropdown on the course card
    const courseCard = page.locator(`text=${TEST_COURSE.name}`).first()
    await expect(courseCard).toBeVisible()

    // Open dropdown (status button on ImportedCourseCard)
    const dropdownTrigger = courseCard.locator('..').locator('[data-testid="status-badge"]').first()
    await dropdownTrigger.click()

    // Assert delete option is visible with destructive styling
    const deleteItem = page.getByTestId('delete-course-menu-item')
    await expect(deleteItem).toBeVisible()
    await expect(deleteItem).toHaveClass(/text-destructive/)
  })

  // AC2 — Confirmation dialog
  test('AC2: shows confirmation dialog with course name', async ({ page }) => {
    // Open dropdown and click delete
    const courseCard = page.locator(`text=${TEST_COURSE.name}`).first()
    await courseCard.locator('..').locator('[data-testid="status-badge"]').first().click()
    await page.getByTestId('delete-course-menu-item').click()

    // Assert confirmation dialog appears
    const dialog = page.getByTestId('delete-confirm-dialog')
    await expect(dialog).toBeVisible()

    // Dialog shows course name
    await expect(dialog).toContainText(TEST_COURSE.name)

    // Cancel and Delete buttons are visible
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByTestId('delete-confirm-button')).toBeVisible()
  })

  // AC3 — Deletion executes correctly
  test('AC3: confirming delete removes course and shows toast', async ({ page }) => {
    // Open dropdown → delete → confirm
    const courseCard = page.locator(`text=${TEST_COURSE.name}`).first()
    await courseCard.locator('..').locator('[data-testid="status-badge"]').first().click()
    await page.getByTestId('delete-course-menu-item').click()
    await page.getByTestId('delete-confirm-button').click()

    // Course disappears from library
    await expect(page.locator(`text=${TEST_COURSE.name}`)).not.toBeVisible()

    // Success toast appears
    await expect(page.locator('text=Course removed')).toBeVisible()

    // Remains on Courses page
    expect(page.url()).toContain('/courses')

    // IndexedDB importedCourses store is empty
    const count = await page.evaluate(async () => {
      return new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('importedCourses', 'readonly')
          const store = tx.objectStore('importedCourses')
          const countReq = store.count()
          countReq.onsuccess = () => {
            db.close()
            resolve(countReq.result)
          }
          countReq.onerror = () => {
            db.close()
            reject(countReq.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    })
    expect(count).toBe(0)
  })

  // AC4 — Cancellation
  test('AC4: cancelling preserves the course', async ({ page }) => {
    // Open dropdown → delete → cancel
    const courseCard = page.locator(`text=${TEST_COURSE.name}`).first()
    await courseCard.locator('..').locator('[data-testid="status-badge"]').first().click()
    await page.getByTestId('delete-course-menu-item').click()

    const dialog = page.getByTestId('delete-confirm-dialog')
    await expect(dialog).toBeVisible()

    // Click Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Dialog closes
    await expect(dialog).not.toBeVisible()

    // Course still in library
    await expect(page.locator(`text=${TEST_COURSE.name}`).first()).toBeVisible()
  })
})
