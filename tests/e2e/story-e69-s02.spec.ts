/**
 * E2E Smoke Tests: E69-S02 — Per-Course Storage Table
 *
 * Acceptance criteria covered:
 * - AC1: Per-course storage table renders in Settings when course data exists
 * - AC2: Sortable "Total Size" column header is present
 * - AC3: Show more pagination (>10 courses)
 * - AC4: Row action menu available per course
 * - AC7: Empty state when no courses imported
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/seed-helpers'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const SINGLE_COURSE = createImportedCourse({
  id: 'e69s02-course-1',
  name: 'React Fundamentals',
  videoCount: 5,
  pdfCount: 2,
})

function makeManyCourses(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createImportedCourse({
      id: `e69s02-course-${i + 1}`,
      name: `Course ${String(i + 1).padStart(2, '0')} — Learning Path`,
      videoCount: 1,
      pdfCount: 0,
    })
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAndNavigate(page: Page, courses: Record<string, unknown>[]): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, courses as Parameters<typeof seedImportedCourses>[1])
  await navigateAndWait(page, '/settings')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E69-S02: Per-Course Storage Table', () => {
  test('table renders with seeded course data', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    // Wait for per-course table — it renders after async load
    const table = page.getByTestId('per-course-storage-table')
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  test('course name appears in table row', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('React Fundamentals')).toBeVisible()
  })

  test('Total Size sortable column header is present', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    const sortBtn = page.getByRole('button', { name: /sort by total size/i })
    await expect(sortBtn).toBeVisible()
  })

  test('clicking sort button cycles sort direction', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    const sortBtn = page.getByRole('button', { name: /sort by total size/i })

    // Click to ascending
    await sortBtn.click()
    const th = page.locator('th[aria-sort]')
    await expect(th).toHaveAttribute('aria-sort', 'ascending')

    // Click again to descending
    await sortBtn.click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
  })

  test('row action menu button is present', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    const actionsBtn = page.getByRole('button', { name: /actions for react fundamentals/i })
    await expect(actionsBtn).toBeVisible()
  })

  test('action menu shows Clear thumbnails and Delete course data options', async ({ page }) => {
    await seedAndNavigate(page, [SINGLE_COURSE as unknown as Record<string, unknown>])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /actions for react fundamentals/i }).click()

    await expect(page.getByText('Clear thumbnails')).toBeVisible()
    await expect(page.getByText('Delete course data')).toBeVisible()
  })

  test('empty state shows when no courses imported', async ({ page }) => {
    // Navigate to settings without seeding any courses
    await navigateAndWait(page, '/settings')

    const emptyState = page.getByTestId('per-course-table-empty')
    await expect(emptyState).toBeVisible({ timeout: 10000 })
    await expect(emptyState).toContainText(/no courses imported yet/i)
  })

  test('Show more button appears when more than 10 courses exist', async ({ page }) => {
    const courses = makeManyCourses(12)
    await seedAndNavigate(page, courses as unknown as Record<string, unknown>[])

    await expect(page.getByTestId('per-course-storage-table')).toBeVisible({ timeout: 10000 })
    const showMoreBtn = page.getByRole('button', { name: /show more/i })
    await expect(showMoreBtn).toBeVisible()
  })
})
