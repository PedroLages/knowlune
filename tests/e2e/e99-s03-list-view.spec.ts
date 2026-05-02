/**
 * E99-S03: List View
 *
 * Validates that switching `courseViewMode` to `list` renders courses as
 * dense rows (one per row) with required metadata, that clicking a row
 * navigates to the course detail page, that keyboard activation works,
 * and that interacting with the overflow menu does not bubble to the row
 * navigation handler.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createImportedCourses } from '../support/fixtures/factories/imported-course-factory'

async function setupListView(page: Parameters<typeof goToCourses>[0]) {
  // Enable guest mode so the auth-gated routes render (post-E92 auth gate).
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
  })
  await page.goto('/')
  await seedImportedCourses(page, createImportedCourses(3))
  await goToCourses(page)
  await page.getByRole('radio', { name: 'List view' }).click()
  await expect(page.getByRole('radio', { name: 'List view' })).toHaveAttribute(
    'data-state',
    'on'
  )
}

test.describe('E99-S03 List View', () => {
  test('renders rows for all seeded courses', async ({ page }) => {
    await setupListView(page)

    const list = page.getByTestId('imported-courses-list')
    await expect(list).toBeVisible()

    const rows = page.getByTestId('imported-course-list-row')
    await expect(rows).toHaveCount(3)

    // Each row exposes title, status, and overflow trigger
    await expect(page.getByTestId('course-list-row-title').first()).toBeVisible()
    await expect(page.getByTestId('course-list-row-status').first()).toBeVisible()
    await expect(page.getByTestId('course-list-row-overflow-trigger').first()).toBeVisible()
  })

  test('clicking a row navigates to course detail', async ({ page }) => {
    await setupListView(page)

    const firstRow = page.getByTestId('imported-course-list-row').first()
    await firstRow.click()

    await expect(page).toHaveURL(/\/courses\/[^/]+\/overview/)
  })

  test('pressing Enter on focused row navigates to course detail', async ({ page }) => {
    await setupListView(page)

    const firstRow = page.getByTestId('imported-course-list-row').first()
    await firstRow.focus()
    await expect(firstRow).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/courses\/[^/]+\/overview/)
  })

  test('clicking overflow menu opens menu without navigating', async ({ page }) => {
    await setupListView(page)

    const initialUrl = page.url()
    const firstTrigger = page.getByTestId('course-list-row-overflow-trigger').first()
    await firstTrigger.click()

    // Menu shows status options + edit/delete
    await expect(page.getByRole('menuitem', { name: /Edit details/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Delete course/i })).toBeVisible()

    // URL did NOT change — overflow click did not bubble to row navigation
    expect(page.url()).toBe(initialUrl)
  })
})
