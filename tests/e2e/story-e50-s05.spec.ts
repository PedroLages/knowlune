/**
 * E50-S05: Schedule Editor — Course Integration
 *
 * Tests cover:
 * - AC1: "Schedule study time" button visible on course detail page
 * - AC2: Clicking button opens StudyScheduleEditor sheet
 * - AC3: Course is pre-selected when opened from course page
 * - AC4: Validation errors shown for missing required fields
 * - AC5: Saving a schedule persists to IndexedDB
 */
import { test, expect } from '../support/fixtures'
import { FIXED_DATE } from '../utils/test-time'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_ID = 'e50-s05-test-course'
const COURSE_NAME = 'React Testing Patterns'
const DB_NAME = 'ElearningDB'
const SCHEDULES_STORE = 'studySchedules'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedTestCourse(page: import('@playwright/test').Page) {
  await seedImportedCourses(page, [
    {
      id: COURSE_ID,
      name: COURSE_NAME,
      importedAt: FIXED_DATE,
      category: 'Development',
      tags: ['react', 'testing'],
      status: 'active' as const,
      videoCount: 5,
      pdfCount: 0,
    },
  ])
}

async function getAllSchedules(page: import('@playwright/test').Page) {
  return page.evaluate(
    ({ dbName, storeName }) => {
      return new Promise<unknown[]>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            resolve([])
            return
          }
          const tx = db.transaction(storeName, 'readonly')
          const getReq = tx.objectStore(storeName).getAll()
          getReq.onsuccess = () => {
            db.close()
            resolve(getReq.result)
          }
          getReq.onerror = () => {
            db.close()
            reject(getReq.error)
          }
        }
      })
    },
    { dbName: DB_NAME, storeName: SCHEDULES_STORE }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E50-S05: Schedule Editor — Course Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed to avoid overlay
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await seedTestCourse(page)
  })

  test('AC1: Schedule study time button is visible on course detail page', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await expect(page.getByTestId('course-overview-page')).toBeVisible()
    await expect(page.getByTestId('schedule-study-time-button')).toBeVisible()
  })

  test('AC2: Clicking button opens StudyScheduleEditor sheet', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await expect(page.getByTestId('schedule-study-time-button')).toBeVisible()

    await page.getByTestId('schedule-study-time-button').click()

    // Sheet should be visible with form elements
    await expect(page.getByTestId('schedule-title-input')).toBeVisible()
    await expect(page.getByTestId('schedule-save-button')).toBeVisible()
    await expect(page.getByTestId('schedule-cancel-button')).toBeVisible()
  })

  test('AC3: Course is pre-selected when opened from course page', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await page.getByTestId('schedule-study-time-button').click()

    // Title should be auto-populated with course name
    const titleInput = page.getByTestId('schedule-title-input')
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toHaveValue(`Study: ${COURSE_NAME}`)

    // Course select should show the course (not "Free study block")
    const courseSelect = page.getByTestId('schedule-course-select')
    await expect(courseSelect).toBeVisible()
    await expect(courseSelect).toContainText(COURSE_NAME)
  })

  test('AC4: Validation errors shown for missing required fields', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await page.getByTestId('schedule-study-time-button').click()

    // Clear the auto-populated title
    const titleInput = page.getByTestId('schedule-title-input')
    await titleInput.clear()

    // Try to save without title or days selected
    await page.getByTestId('schedule-save-button').click()

    // Should show validation errors
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByText('Title is required.')).toBeVisible()
    await expect(page.getByText('Select at least one day.')).toBeVisible()
  })

  test('AC5: Saving a schedule persists to IndexedDB', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await page.getByTestId('schedule-study-time-button').click()

    // Fill in valid data — title is auto-populated
    await expect(page.getByTestId('schedule-title-input')).toHaveValue(`Study: ${COURSE_NAME}`)

    // Select Monday
    await page.getByRole('button', { name: /Mon/i }).click()

    // Save
    await page.getByTestId('schedule-save-button').click()

    // Sheet should close
    await expect(page.getByTestId('schedule-title-input')).not.toBeVisible()

    // Verify persisted to IndexedDB
    const schedules = (await getAllSchedules(page)) as Array<{
      title: string
      courseId: string
      days: string[]
    }>
    const saved = schedules.find(s => s.courseId === COURSE_ID)
    expect(saved).toBeDefined()
    expect(saved!.title).toBe(`Study: ${COURSE_NAME}`)
    expect(saved!.days).toContain('monday')
  })
})
