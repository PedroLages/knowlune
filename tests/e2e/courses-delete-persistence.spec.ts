/**
 * E2E tests: delete persistence — verifies that deleted courses stay
 * deleted after page reload (local Dexie durability).
 *
 * The Supabase round-trip (delete → upload → download → not re-inserted)
 * is covered by sync engine unit tests (syncEngine.test.ts). This spec
 * validates the local durability guarantee at the Dexie layer.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

/** Helper: delete a course via the card dropdown menu on the /courses page. */
async function deleteCourseViaCard(page: any, courseName: string) {
  // Find the card containing this course name, then open its status dropdown.
  const card = page
    .getByTestId('imported-course-card')
    .filter({ hasText: courseName })
    .first()

  // Open the dropdown via the status badge trigger.
  await card.getByTestId('status-badge').click()

  // Click "Delete course" in the dropdown.
  const deleteMenuItem = page.getByTestId('delete-course-menu-item')
  await deleteMenuItem.waitFor({ state: 'visible', timeout: 5000 })
  await deleteMenuItem.click()

  // Confirm in the dialog.
  const confirmButton = page.getByTestId('delete-confirm-button').filter({ hasText: 'Delete' })
  await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
  await confirmButton.click()
}

test.describe('Course delete persistence', () => {
  test('deleted course stays deleted after page reload', async ({
    page,
    indexedDB,
  }) => {
    const course = createImportedCourse({
      id: 'e2e-delete-test-course',
      name: 'E2E Delete Persistence Test',
    })

    // Navigate first so Dexie creates the importedCourses store, then seed.
    await page.goto('/')
    await page.waitForLoadState('load')
    await indexedDB.seedImportedCourses([course])

    // Reload so Zustand's loadImportedCourses() picks up the seeded data.
    await page.reload()
    await page.waitForLoadState('load')

    // Navigate to the courses listing where course cards are rendered.
    await page.goto('/courses')
    await page.waitForLoadState('load')

    await deleteCourseViaCard(page, course.name)

    // After successful delete, the card disappears from the list.
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: course.name })
    ).toHaveCount(0, { timeout: 5000 })

    // Reload to verify local durability — the course must not reappear.
    await page.reload()
    await page.waitForLoadState('load')

    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: course.name })
    ).toHaveCount(0, { timeout: 5000 })
  })

  test('multiple deleted courses stay deleted after reload', async ({
    page,
    indexedDB,
  }) => {
    const courses = [
      createImportedCourse({
        id: 'e2e-delete-multi-1',
        name: 'E2E Multi-Delete Course 1',
      }),
      createImportedCourse({
        id: 'e2e-delete-multi-2',
        name: 'E2E Multi-Delete Course 2',
      }),
    ]

    await page.goto('/')
    await page.waitForLoadState('load')
    await indexedDB.seedImportedCourses(courses)
    await page.reload()
    await page.waitForLoadState('load')
    await page.goto('/courses')
    await page.waitForLoadState('load')

    // Delete both courses.
    await deleteCourseViaCard(page, courses[0].name)
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: courses[0].name })
    ).toHaveCount(0, { timeout: 5000 })

    await deleteCourseViaCard(page, courses[1].name)
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: courses[1].name })
    ).toHaveCount(0, { timeout: 5000 })

    // Reload and verify both are gone.
    await page.reload()
    await page.waitForLoadState('load')

    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: courses[0].name })
    ).toHaveCount(0, { timeout: 5000 })
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: courses[1].name })
    ).toHaveCount(0, { timeout: 5000 })
  })

  test('delete course, immediately reload before sync — course stays deleted', async ({
    page,
    indexedDB,
  }) => {
    const course = createImportedCourse({
      id: 'e2e-delete-immediate',
      name: 'E2E Immediate Reload Delete Test',
    })

    await page.goto('/')
    await page.waitForLoadState('load')
    await indexedDB.seedImportedCourses([course])
    await page.reload()
    await page.waitForLoadState('load')
    await page.goto('/courses')
    await page.waitForLoadState('load')

    await deleteCourseViaCard(page, course.name)

    // Reload immediately without waiting for any sync nudge.
    await page.reload()
    await page.waitForLoadState('load')

    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: course.name })
    ).toHaveCount(0, { timeout: 5000 })
  })
})
