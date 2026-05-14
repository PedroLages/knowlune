/**
 * E2E tests: Learning Track syllabus reorder persistence.
 *
 * Seeds a learning track with 3 courses, enters syllabus edit mode, applies the same reorder
 * the UI uses (`reorderPathCourses` via a Playwright-only dev hook — synthetic drag is unreliable
 * for this @dnd-kit timeline), Done, then verifies order survives list → detail navigation.
 */
import { test, expect } from '../support/fixtures'
import {
  clearIndexedDBStore,
  clearLearningPath,
  seedIndexedDBStore,
} from '../support/helpers/seed-helpers'
import { navigateAndWait } from '../support/helpers/navigation'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

test.describe('Learning Track — Course Reorder', () => {
  // Same pathId + shared Dexie origin: parallel workers clobber each other's seeds.
  test.describe.configure({ mode: 'serial' })

  const pathId = 'e2e-reorder-path-1'
  const course1Id = 'reorder-course-1'
  const course2Id = 'reorder-course-2'
  const course3Id = 'reorder-course-3'

  test.beforeEach(async ({ page }) => {
    // Match other learning-track E2E routes: guest/session + dismiss overlays (see navigateAndWait).
    await navigateAndWait(page, '/learning-tracks')
    await clearLearningPath(page)
    await clearIndexedDBStore(page, DB_NAME, 'learningPathEntries')
    await clearIndexedDBStore(page, DB_NAME, 'importedCourses')

    // Seed imported courses referenced by the path entries (must match ImportedCourse / E2E factory shape)
    await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [
      {
        id: course1Id,
        name: 'Course Alpha',
        description: 'First course',
        importedAt: FIXED_DATE,
        category: '',
        tags: [],
        status: 'active',
        videoCount: 1,
        pdfCount: 0,
        directoryHandle: null,
      },
      {
        id: course2Id,
        name: 'Course Bravo',
        description: 'Second course',
        importedAt: FIXED_DATE,
        category: '',
        tags: [],
        status: 'active',
        videoCount: 1,
        pdfCount: 0,
        directoryHandle: null,
      },
      {
        id: course3Id,
        name: 'Course Charlie',
        description: 'Third course',
        importedAt: FIXED_DATE,
        category: '',
        tags: [],
        status: 'active',
        videoCount: 1,
        pdfCount: 0,
        directoryHandle: null,
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

    await page.reload({ waitUntil: 'load' })
    await navigateAndWait(page, '/learning-tracks')

    await expect(page.getByRole('link', { name: /Reorder Test Path — 3 courses/ })).toBeVisible({
      timeout: 20_000,
    })
  })

  /** Open track detail via card link — matches other learning-tracks E2E (SPA nav keeps store + entries in sync). */
  async function openReorderTrackFromList(page: import('@playwright/test').Page): Promise<void> {
    await page.getByRole('link', { name: /Reorder Test Path — 3 courses/ }).click()
    await expect(page).toHaveURL(new RegExp(`/learning-tracks/${pathId}`))
    await page.waitForLoadState('load')
  }

  test('shows Edit button in syllabus header', async ({ page }) => {
    await openReorderTrackFromList(page)

    // Syllabus header has "Edit" button
    const editButton = page.getByTestId('edit-syllabus-button')
    await expect(editButton).toBeVisible()
    await expect(editButton).toHaveText('Edit')
  })

  test('clicking Edit toggles to Done and shows drag handles', async ({ page }) => {
    await openReorderTrackFromList(page)

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
    await openReorderTrackFromList(page)

    // Enter edit mode
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Done')

    // Exit without dragging
    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Edit')

    // Drag handles hidden
    await expect(page.getByTestId(`drag-handle-${course1Id}`)).not.toBeVisible()
  })

  test('reordering modules applies to the syllabus and persists across navigation', async ({ page }) => {
    await openReorderTrackFromList(page)

    const syllabus = page.getByText('Syllabus')
    await expect(syllabus).toBeVisible()

    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Done')

    // @dnd-kit vertical sortable timeline does not reliably receive Playwright synthetic drags here
    // (nested controls + Droppable hit targets); drive the production reorderPathCourses path directly.
    await page.waitForFunction(
      () => {
        const s = (
          window as unknown as {
            __learningPathStore__?: {
              getState?: () => { reorderPathCourses?: (...a: unknown[]) => Promise<void> }
            }
          }
        ).__learningPathStore__
        return Boolean(s?.getState?.()?.reorderPathCourses)
      },
      {},
      { timeout: 30_000 }
    )

    const orderIds = await page.evaluate(
      async ({ pid, dragActive, dragOver }: { pid: string; dragActive: string; dragOver: string }) => {
        const store = (
          window as unknown as {
            __learningPathStore__: {
              getState: () => {
                reorderPathCourses: (p: string, a: string, b: string) => Promise<void>
                entries: Array<{ pathId: string; courseId: string; position: number }>
              }
            }
          }
        ).__learningPathStore__
        await store.getState().reorderPathCourses(pid, dragActive, dragOver)
        return store
          .getState()
          .entries.filter(e => e.pathId === pid)
          .sort((a, b) => a.position - b.position)
          .map(e => e.courseId)
      },
      { pid: pathId, dragActive: course1Id, dragOver: course2Id }
    )

    expect(orderIds).toEqual([course2Id, course1Id, course3Id])

    const syllabusTitles = page
      .getByRole('list', { name: 'Timeline' })
      .locator(':scope > [role="listitem"]')
      .getByRole('heading', { level: 3 })

    await expect(syllabusTitles.nth(0)).toHaveText('Course Bravo')

    await page.getByTestId('edit-syllabus-button').click()
    await expect(page.getByTestId('edit-syllabus-button')).toHaveText('Edit')

    await navigateAndWait(page, '/learning-tracks')
    await expect(page.getByRole('link', { name: /Reorder Test Path — 3 courses/ })).toBeVisible()

    await openReorderTrackFromList(page)

    await expect(syllabusTitles.nth(0)).toHaveText('Course Bravo')
    await expect(syllabusTitles.nth(1)).toHaveText('Course Alpha')
    await expect(syllabusTitles.nth(2)).toHaveText('Course Charlie')
  })
})
