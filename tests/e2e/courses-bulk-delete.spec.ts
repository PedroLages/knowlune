/**
 * E2E tests: bulk course delete with undo — verifies selection mode,
 * sequential batch deletion, undo toast, and Escape exit.
 *
 * Covers R1-R11 from the bulk course delete plan.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse, createImportedCourses } from '../support/fixtures/factories/imported-course-factory'

test.describe('Bulk course delete', () => {
  test('full flow: select, delete, undo', async ({ page, indexedDB }) => {
    const courses = createImportedCourses(5, i => ({
      id: `e2e-bulk-${i + 1}`,
      name: `Bulk Course ${i + 1}`,
    }))

    // Navigate first so Dexie creates the importedCourses store, then seed.
    await page.goto('/')
    await page.waitForLoadState('load')
    await indexedDB.seedImportedCourses(courses)
    await page.reload()
    await page.waitForLoadState('load')

    // Navigate to the courses listing.
    await page.goto('/courses')
    await page.waitForLoadState('load')

    // Wait for imported courses to render (the "Your Courses" heading is
    // only visible when imported courses exist).
    await expect(page.getByText('Your Courses')).toBeVisible({ timeout: 5000 })

    // Verify the "Select" button is visible in the control bar.
    const selectBtn = page.getByTestId('enter-selection-mode-btn')
    await expect(selectBtn).toBeVisible()

    // Click "Select" to enter selection mode.
    await selectBtn.click()

    // Action bar should replace the control bar.
    await expect(page.getByTestId('selection-action-bar')).toBeVisible()
    await expect(page.getByTestId('selected-count')).toHaveText('0 selected')

    // "Delete Selected" should be disabled when nothing is selected.
    const deleteBtn = page.getByTestId('delete-selected-btn')
    await expect(deleteBtn).toBeDisabled()

    // Click course cards to select them. In grid view, clicking the
    // article element toggles selection via handleCardClick.
    const card = page.getByTestId('imported-course-card').first()
    await card.click()
    await expect(page.getByTestId('selected-count')).toHaveText('1 selected')

    // Click the second card.
    const card2 = page.getByTestId('imported-course-card').nth(1)
    await card2.click()
    await expect(page.getByTestId('selected-count')).toHaveText('2 selected')

    // "Delete Selected" should now be enabled and show the count.
    await expect(deleteBtn).toBeEnabled()
    await expect(deleteBtn).toContainText('Delete Selected (2)')

    // Click "Select All" — should select all 5 courses.
    await page.getByTestId('select-all-btn').click()
    await expect(page.getByTestId('selected-count')).toHaveText('5 selected')

    // Click "Deselect All" — should clear selection.
    await page.getByTestId('deselect-all-btn').click()
    await expect(page.getByTestId('selected-count')).toHaveText('0 selected')

    // Select 2 courses again, then click "Delete Selected".
    await card.click()
    await card2.click()
    await expect(page.getByTestId('selected-count')).toHaveText('2 selected')

    await deleteBtn.click()

    // Wait for deletion to complete — cards should disappear.
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 1' })
    ).toHaveCount(0, { timeout: 5000 })
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 2' })
    ).toHaveCount(0, { timeout: 5000 })
    // Other courses should still be visible.
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 3' })
    ).toHaveCount(1)
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 4' })
    ).toHaveCount(1)
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 5' })
    ).toHaveCount(1)

    // Selection mode should exit after deletion completes.
    // Action bar should be gone; control bar should be back.
    await expect(page.getByTestId('selection-action-bar')).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('enter-selection-mode-btn')).toBeVisible()

    // Undo toast should appear with action button.
    const undoButton = page.getByRole('button', { name: 'Undo' })
    await expect(undoButton).toBeVisible({ timeout: 5000 })

    // Click Undo to restore the deleted courses.
    await undoButton.click()
    // Wait for restoration toast.
    await expect(page.getByText(/courses restored/)).toBeVisible({ timeout: 5000 })

    // Both deleted courses should reappear in the list.
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 1' })
    ).toHaveCount(1, { timeout: 5000 })
    await expect(
      page.getByTestId('imported-course-card').filter({ hasText: 'Bulk Course 2' })
    ).toHaveCount(1, { timeout: 5000 })
  })

  test('Escape exits selection mode', async ({ page, indexedDB }) => {
    const course = createImportedCourse({
      id: 'e2e-escape-test',
      name: 'Escape Test Course',
    })

    await page.goto('/')
    await page.waitForLoadState('load')
    await indexedDB.seedImportedCourses([course])
    await page.reload()
    await page.waitForLoadState('load')
    await page.goto('/courses')
    await page.waitForLoadState('load')

    await expect(page.getByText('Your Courses')).toBeVisible({ timeout: 5000 })

    // Enter selection mode.
    await page.getByTestId('enter-selection-mode-btn').click()
    await expect(page.getByTestId('selection-action-bar')).toBeVisible()

    // Press Escape.
    await page.keyboard.press('Escape')

    // Selection mode should exit; control bar should reappear.
    await expect(page.getByTestId('selection-action-bar')).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('enter-selection-mode-btn')).toBeVisible()
  })
})
