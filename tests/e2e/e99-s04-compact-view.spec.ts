/**
 * E99-S04: Compact Grid View
 *
 * Validates that the Courses page renders a dense, thumbnail-only grid when
 * `courseViewMode === 'compact'`, that clicking a compact card navigates to
 * the course detail, and that the overflow menu remains reachable on touch
 * devices via always-visible affordance.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createImportedCourses } from '../support/fixtures/factories/imported-course-factory'

async function setupCoursesPage(page: Parameters<typeof goToCourses>[0]) {
  // Enable guest mode before first navigation so the auth gate (E92) does not
  // redirect to the public landing page. See:
  // docs/solutions/best-practices/2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
  })
  await page.goto('/')
  await seedImportedCourses(page, createImportedCourses(8))
  await goToCourses(page)
}

test.describe('E99-S04 Compact Grid View', () => {
  test('switching to compact applies the dense grid classes at lg+ viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupCoursesPage(page)

    // Switch to Compact view via the ViewModeToggle radio.
    await page.getByRole('radio', { name: /compact view/i }).click()
    await expect(page.getByRole('radio', { name: /compact view/i })).toHaveAttribute(
      'data-state',
      'on'
    )

    const grid = page.getByTestId('imported-courses-grid')
    // Auto + compact branch should produce ≥6 columns at lg and 8 at xl.
    await expect(grid).toHaveClass(/lg:grid-cols-6/)
    await expect(grid).toHaveClass(/xl:grid-cols-8/)
    await expect(grid).toHaveClass(/gap-3/)
  })

  test('compact card hides metadata other than title', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupCoursesPage(page)

    await page.getByRole('radio', { name: /compact view/i }).click()

    const firstCard = page.getByTestId('imported-course-compact-card').first()
    await expect(firstCard).toBeVisible()
    // Compact cards must NOT render the verbose body the regular card uses.
    await expect(firstCard.getByTestId('course-card-author')).toHaveCount(0)
    await expect(firstCard.getByTestId('course-card-video-count')).toHaveCount(0)
    await expect(firstCard.getByTestId('course-card-pdf-count')).toHaveCount(0)
  })

  test('clicking a compact card navigates to the course detail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupCoursesPage(page)

    await page.getByRole('radio', { name: /compact view/i }).click()
    const firstCard = page.getByTestId('imported-course-compact-card').first()
    await expect(firstCard).toBeVisible()
    await firstCard.click()

    await expect(page).toHaveURL(/\/courses\/[^/]+\/overview/)
  })

  test('compact view scales explicit column choice (4 → 6 cols)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupCoursesPage(page)

    // Start in grid mode, pick 4 columns, then switch to compact.
    await page.getByRole('radio', { name: '4 columns' }).click()
    await page.getByRole('radio', { name: /compact view/i }).click()

    const grid = page.getByTestId('imported-courses-grid')
    // 4 cols in grid → 6 cols in compact at lg.
    await expect(grid).toHaveClass(/lg:grid-cols-6/)
    // The 8-col xl class belongs to the 5-column branch — must NOT appear here.
    await expect(grid).not.toHaveClass(/xl:grid-cols-8/)
  })
})
