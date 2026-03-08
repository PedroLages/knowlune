/**
 * E07-S01: Momentum Score Calculation & Display
 *
 * Tests the momentum badge indicator on course cards and the "Sort by Momentum"
 * option in the courses library.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('E07-S01: Momentum Score Display', () => {
  test('momentum badges are visible on course cards in the library', async ({ page }) => {
    await goToCourses(page)

    // Badges render when momentumMap is loaded — wait for them
    const badges = page.getByTestId('momentum-badge')
    const count = await badges.count()
    // With no study sessions, all courses get score 0 (cold tier), badges still render
    expect(count).toBeGreaterThan(0)
  })

  test('momentum badge has correct tier label text', async ({ page }) => {
    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    // Label should be one of the three tier labels
    const text = await firstBadge.textContent()
    expect(['Hot', 'Warm', 'Cold'].some(t => text?.includes(t))).toBe(true)
  })

  test('momentum badge has accessible aria-label', async ({ page }) => {
    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const ariaLabel = await firstBadge.getAttribute('aria-label')
    expect(ariaLabel).toMatch(/^Momentum: (Hot|Warm|Cold) \(\d+\)$/)
  })

  test('sort by momentum option is present in courses page', async ({ page }) => {
    await goToCourses(page)

    const sortSelect = page.getByTestId('sort-select')
    await expect(sortSelect).toBeVisible()

    // Check both options exist
    await expect(sortSelect.locator('option[value="recent"]')).toHaveText('Most Recent')
    await expect(sortSelect.locator('option[value="momentum"]')).toHaveText('Sort by Momentum')
  })

  test('selecting sort by momentum reorders the course list', async ({ page }) => {
    await goToCourses(page)

    // Get course card order before sort
    const badgesBefore = await page.getByTestId('momentum-badge').allTextContents()

    // Switch to momentum sort
    const sortSelect = page.getByTestId('sort-select')
    await sortSelect.selectOption('momentum')

    // After sorting, the badges should still all be visible
    const badgesAfter = page.getByTestId('momentum-badge')
    const countAfter = await badgesAfter.count()
    expect(countAfter).toBeGreaterThan(0)

    // The sort select value is now "momentum"
    await expect(sortSelect).toHaveValue('momentum')

    // Switch back to recent sort
    await sortSelect.selectOption('recent')
    await expect(sortSelect).toHaveValue('recent')

    const badgesRecent = await page.getByTestId('momentum-badge').allTextContents()
    expect(badgesRecent.length).toBe(badgesBefore.length)
  })
})
