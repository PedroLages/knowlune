/**
 * ATDD tests for E04-S01: Mark Content Completion Status
 *
 * RED phase — these tests define expected behavior and should FAIL
 * until the feature is implemented. Maps 1:1 to acceptance criteria.
 *
 * Test strategy:
 *   - Seed a course with modules + lessons via IndexedDB
 *   - Navigate to course detail page (course structure panel)
 *   - Validate status indicator, selector, and cascading behavior
 */
import { test, expect } from '../support/fixtures'
import {
  createCourse,
  createModule,
  createLesson,
  createResource,
} from '../support/fixtures/factories/course-factory'

// --- Test data: a course with 1 module containing 2 lessons ---
const LESSON_1_ID = 'e04-s01-lesson-1'
const LESSON_2_ID = 'e04-s01-lesson-2'
const MODULE_ID = 'e04-s01-module-1'
const COURSE_ID = 'e04-s01-test-course'

function buildTestCourse() {
  return createCourse({
    id: COURSE_ID,
    title: 'Progress Test Course',
    modules: [
      createModule({
        id: MODULE_ID,
        title: 'Module One',
        lessons: [
          createLesson({
            id: LESSON_1_ID,
            title: 'Lesson One',
            order: 1,
            resources: [createResource({ type: 'video' })],
          }),
          createLesson({
            id: LESSON_2_ID,
            title: 'Lesson Two',
            order: 2,
            resources: [createResource({ type: 'video' })],
          }),
        ],
      }),
    ],
  })
}

test.describe('E04-S01: Mark Content Completion Status', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed to prevent overlay on tablet viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  // AC1: Status selector with three options
  test('AC1: clicking a status indicator opens a selector with 3 options', async ({
    page,
    indexedDB,
  }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await indexedDB.seedImportedCourses([buildTestCourse() as never])
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Find a lesson's status indicator in the course structure panel
    const statusIndicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await expect(statusIndicator).toBeVisible()
    await statusIndicator.click()

    // Status selector should appear with 3 options
    const selector = page.getByTestId('status-selector')
    await expect(selector).toBeVisible()

    await expect(selector.getByText('Not Started')).toBeVisible()
    await expect(selector.getByText('In Progress')).toBeVisible()
    await expect(selector.getByText('Completed')).toBeVisible()
  })

  // AC2: Optimistic state update persists to IndexedDB
  test('AC2: selecting a new status updates the indicator optimistically', async ({
    page,
    indexedDB,
  }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await indexedDB.seedImportedCourses([buildTestCourse() as never])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const statusIndicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await statusIndicator.click()

    // Select "Completed"
    const selector = page.getByTestId('status-selector')
    await selector.getByText('Completed').click()

    // Indicator should immediately reflect the new status (optimistic)
    await expect(statusIndicator).toHaveAttribute('data-status', 'completed')
  })

  // AC3: Color-coded visual indicators with accessibility
  test('AC3: status indicators display correct color coding and accessibility labels', async ({
    page,
    indexedDB,
  }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await indexedDB.seedImportedCourses([buildTestCourse() as never])
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Default status should be "Not Started" — gray indicator
    const indicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await expect(indicator).toHaveAttribute('data-status', 'not-started')

    // Accessibility: indicator should have an accessible label (tooltip or aria-label)
    const label = await indicator.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label?.toLowerCase()).toContain('not started')
  })

  // AC4: Auto-complete parent chapter when all children are completed
  test('AC4: completing all lessons in a module auto-completes the parent module', async ({
    page,
    indexedDB,
  }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await indexedDB.seedImportedCourses([buildTestCourse() as never])
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Mark lesson 1 as Completed
    const indicator1 = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('Completed').click()

    // Mark lesson 2 as Completed
    const indicator2 = page.getByTestId(`status-indicator-${LESSON_2_ID}`)
    await indicator2.click()
    await page.getByTestId('status-selector').getByText('Completed').click()

    // Parent module should auto-complete
    const moduleIndicator = page.getByTestId(`status-indicator-${MODULE_ID}`)
    await expect(moduleIndicator).toHaveAttribute('data-status', 'completed')
  })

  // AC5: Reverting a child reverts auto-completed parent
  test('AC5: changing a completed item back reverts the parent module to in-progress', async ({
    page,
    indexedDB,
  }) => {
    await page.goto(`/courses/${COURSE_ID}`)
    await indexedDB.seedImportedCourses([buildTestCourse() as never])
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Complete both lessons first
    const indicator1 = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('Completed').click()

    const indicator2 = page.getByTestId(`status-indicator-${LESSON_2_ID}`)
    await indicator2.click()
    await page.getByTestId('status-selector').getByText('Completed').click()

    // Verify parent is completed
    const moduleIndicator = page.getByTestId(`status-indicator-${MODULE_ID}`)
    await expect(moduleIndicator).toHaveAttribute('data-status', 'completed')

    // Now revert lesson 1 to "In Progress"
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('In Progress').click()

    // Parent module should revert to in-progress
    await expect(moduleIndicator).toHaveAttribute('data-status', 'in-progress')
  })
})
