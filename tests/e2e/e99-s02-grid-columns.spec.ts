/**
 * E99-S02: Grid Column Control
 *
 * Validates that the Courses page exposes a grid-only column-count selector
 * (Auto / 2 / 3 / 4 / 5), that selecting a value applies the correct Tailwind
 * class to the grid container, that the selection persists across reloads
 * via the AppSettings bridge, and that the control is hidden in non-grid views.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createImportedCourses } from '../support/fixtures/factories/imported-course-factory'

async function setupCoursesPage(page: Parameters<typeof goToCourses>[0]) {
  // Enable guest mode so the auth-gated routes render (post-E92 auth gate).
  // Must use addInitScript so the flag is set before the auth store initializes.
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
  })
  // Need at least one imported course so VirtualizedGrid renders the grid
  // container we assert classes on (otherwise the empty-state UI is shown).
  await page.goto('/')
  await seedImportedCourses(page, createImportedCourses(3))
  await goToCourses(page)
}

test.describe('E99-S02 Grid Column Control', () => {
  test('renders all five options when in grid view (default)', async ({ page }) => {
    await setupCoursesPage(page)

    const control = page.getByTestId('course-grid-column-control')
    await expect(control).toBeVisible()

    await expect(page.getByRole('radio', { name: 'Auto columns' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '2 columns' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '3 columns' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '4 columns' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '5 columns' })).toBeVisible()

    // Default is "auto"
    await expect(page.getByRole('radio', { name: 'Auto columns' })).toHaveAttribute(
      'data-state',
      'on'
    )
  })

  test('selecting "3 columns" applies lg:grid-cols-3 to the grid', async ({ page }) => {
    await setupCoursesPage(page)

    await page.getByRole('radio', { name: '3 columns' }).click()
    await expect(page.getByRole('radio', { name: '3 columns' })).toHaveAttribute(
      'data-state',
      'on'
    )

    const grid = page.getByTestId('imported-courses-grid')
    await expect(grid).toHaveClass(/lg:grid-cols-3/)
    // The 4-column lg class should NOT be present when capped at 3.
    await expect(grid).not.toHaveClass(/lg:grid-cols-4/)
  })

  test('column selection persists across reload', async ({ page }) => {
    await setupCoursesPage(page)

    await page.getByRole('radio', { name: '5 columns' }).click()
    await expect(page.getByRole('radio', { name: '5 columns' })).toHaveAttribute(
      'data-state',
      'on'
    )

    await page.reload()
    await expect(page.getByTestId('course-grid-column-control')).toBeVisible()
    await expect(page.getByRole('radio', { name: '5 columns' })).toHaveAttribute(
      'data-state',
      'on'
    )
    await expect(page.getByTestId('imported-courses-grid')).toHaveClass(/xl:grid-cols-5/)
  })

  test('control is hidden when view mode is List', async ({ page }) => {
    await setupCoursesPage(page)

    // Switch to List view
    await page.getByRole('radio', { name: 'List view' }).click()
    await expect(page.getByRole('radio', { name: 'List view' })).toHaveAttribute(
      'data-state',
      'on'
    )

    // Column control should no longer be in the DOM
    await expect(page.getByTestId('course-grid-column-control')).toHaveCount(0)
  })

  test('selecting "Auto" restores the canonical responsive default', async ({ page }) => {
    await setupCoursesPage(page)

    // First switch to a non-default
    await page.getByRole('radio', { name: '2 columns' }).click()
    await expect(page.getByTestId('imported-courses-grid')).toHaveClass(
      /grid-cols-1 sm:grid-cols-2 gap-/
    )

    // Then back to Auto
    await page.getByRole('radio', { name: 'Auto columns' }).click()
    await expect(page.getByRole('radio', { name: 'Auto columns' })).toHaveAttribute(
      'data-state',
      'on'
    )

    const grid = page.getByTestId('imported-courses-grid')
    await expect(grid).toHaveClass(/sm:grid-cols-2/)
    await expect(grid).toHaveClass(/md:grid-cols-3/)
    await expect(grid).toHaveClass(/lg:grid-cols-4/)
    await expect(grid).toHaveClass(/xl:grid-cols-5/)
  })
})
