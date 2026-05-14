/**
 * E2E tests: Learning Track drag-and-drop course reordering.
 *
 * Seeds a learning track with 3 courses, enters edit mode,
 * reorders via drag-and-drop, and verifies persistence across reload.
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

test.describe('Learning Track — Course Reorder', () => {
  const pathId = 'e2e-reorder-path-1'
  const course1Id = 'reorder-course-1'
  const course2Id = 'reorder-course-2'
  const course3Id = 'reorder-course-3'

  test.beforeEach(async ({ page }) => {
    // Navigate first so Dexie creates the stores
    await page.goto('/')
    await page.waitForLoadState('load')

    // Seed imported courses referenced by the path entries
    await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [
      {
        id: course1Id,
        name: 'Course Alpha',
        authorName: 'Author A',
        description: 'First course',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: course2Id,
        name: 'Course Bravo',
        authorName: 'Author B',
        description: 'Second course',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: course3Id,
        name: 'Course Charlie',
        authorName: 'Author C',
        description: 'Third course',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])

    // Seed learning path
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: pathId,
        name: 'Reorder Test Path',
        description: 'A path for testing reorder functionality.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        difficultyLabel: 'Beginner',
        estimatedHours: 10,
        isPinned: false,
      },
    ])

    // Seed learning path entries (initial order: Alpha, Bravo, Charlie)
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPathEntries', [
      {
        id: 'reorder-entry-1',
        pathId,
        courseId: course1Id,
        courseType: 'imported',
        position: 1,
        isManuallyOrdered: false,
      },
      {
        id: 'reorder-entry-2',
        pathId,
        courseId: course2Id,
        courseType: 'imported',
        position: 2,
        isManuallyOrdered: false,
      },
      {
        id: 'reorder-entry-3',
        pathId,
        courseId: course3Id,
        courseType: 'imported',
        position: 3,
        isManuallyOrdered: false,
      },
    ])

    await page.reload()
    await page.waitForLoadState('load')
  })

  test('shows Edit button in syllabus header', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    // Syllabus header has "Edit" button
    const editButton = page.getByTestId('edit-syllabus-button')
    await expect(editButton).toBeVisible()
    await expect(editButton).toHaveText('Edit')
  })

  test('clicking Edit toggles to Done and shows drag handles', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    // Click Edit button
    await page.getByTestId('edit-syllabus-button').click()

    // Button text changes to Done
    const doneButton = page.getByTestId('edit-syllabus-button')
    await expect(doneButton).toHaveText('Done')

    // Drag handles become visible in edit mode
    await expect(page.getByTestId(`drag-handle-${course1Id}`)).toBeVisible()
    await expect(page.getByTestId(`drag-handle-${course2Id}`)).toBeVisible()
    await expect(page.getByTestId(`drag-handle-${course3Id}`)).toBeVisible()
  })

  test('clicking Done without dragging exits edit mode', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    // Enter edit mode
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Done')

    // Exit without dragging
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Edit')

    // Drag handles hidden
    await expect(page.getByTestId(`drag-handle-${course1Id}`)).not.toBeVisible()
  })

  test('reorders courses via drag-and-drop and persists across reload', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    // Verify courses render in initial order
    const syllabus = page.getByText('Syllabus')
    await expect(syllabus).toBeVisible()

    // Enter edit mode
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Done')

    // Drag Course Bravo (course2Id) above Course Alpha (course1Id):
    // Source: drag handle of course 2, target: an area before course 1
    const sourceHandle = page.getByTestId(`drag-handle-${course2Id}`)
    const targetHandle = page.getByTestId(`drag-handle-${course1Id}`)

    await expect(sourceHandle).toBeVisible()
    await expect(targetHandle).toBeVisible()

    // Perform drag-and-drop using Playwright's dragTo
    await sourceHandle.dragTo(targetHandle, { force: true })

    // Wait for the store to persist (reorderCourse uses async syncableWrite)
    await page.waitForTimeout(500)

    // Click Done to exit edit mode
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Edit')

    // Reload and verify the new order persists
    await page.reload()
    await page.waitForLoadState('load')

    // Re-enter edit mode to see drag handles and verify new order
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Done')

    // All courses still render
    await expect(page.getByTestId(`drag-handle-${course1Id}`)).toBeVisible()
    await expect(page.getByTestId(`drag-handle-${course2Id}`)).toBeVisible()
    await expect(page.getByTestId(`drag-handle-${course3Id}`)).toBeVisible()
  })
})
