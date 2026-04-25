/**
 * E99-S01: View Mode Toggle and Settings Infrastructure
 *
 * Validates that the Courses page exposes a three-option view-mode toggle
 * (Grid / List / Compact), that the selection persists across reloads via the
 * AppSettings bridge, and that the toggle is keyboard-accessible.
 *
 * NOTE: List/Compact renderers ship in S03/S04. This spec only validates the
 * infrastructure — selection state, persistence, and a11y.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('E99-S01 View Mode Toggle', () => {
  test('renders three labelled options', async ({ page }) => {
    await goToCourses(page)

    const toggle = page.getByTestId('course-view-mode-toggle')
    await expect(toggle).toBeVisible()

    await expect(page.getByRole('radio', { name: 'Grid view' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'List view' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Compact view' })).toBeVisible()

    // Default is grid
    await expect(page.getByRole('radio', { name: 'Grid view' })).toHaveAttribute('data-state', 'on')
  })

  test('persists selection across reload', async ({ page }) => {
    await goToCourses(page)

    await page.getByRole('radio', { name: 'List view' }).click()
    await expect(page.getByRole('radio', { name: 'List view' })).toHaveAttribute('data-state', 'on')

    await page.reload()
    await expect(page.getByTestId('course-view-mode-toggle')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'List view' })).toHaveAttribute('data-state', 'on')
  })

  test('supports keyboard arrow navigation', async ({ page }) => {
    await goToCourses(page)

    const grid = page.getByRole('radio', { name: 'Grid view' })
    await grid.focus()
    await expect(grid).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'List view' })).toBeFocused()
  })
})
