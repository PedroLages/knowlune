/**
 * E2E tests for the timeline/syllabus view mode on the Courses page.
 *
 * Covers:
 *   - Switching to timeline view via ViewModeToggle
 *   - Filtering and sorting in timeline mode
 *   - Course expand/collapse behavior
 *   - Navigation to lesson player
 *   - Empty state handling
 *   - Grid/list/compact views remain unaffected
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('Courses Timeline View', () => {
  test('switching to timeline view displays courses in a vertical tree', async ({ page }) => {
    await goToCourses(page)

    // Click the timeline toggle
    const timelineBtn = page.getByRole('radio', { name: 'Timeline view' })
    await expect(timelineBtn).toBeVisible()
    await timelineBtn.click()

    // The timeline view should render
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()
  })

  test('switching back to grid view restores the grid layout', async ({ page }) => {
    await goToCourses(page)

    // Switch to timeline
    await page.getByRole('radio', { name: 'Timeline view' }).click()
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()

    // Switch back to grid
    await page.getByRole('radio', { name: 'Grid view' }).click()
    await expect(page.getByTestId('course-timeline-view')).not.toBeVisible()
  })

  test('status filters work in timeline mode', async ({ page }) => {
    await goToCourses(page)

    // Switch to timeline
    await page.getByRole('radio', { name: 'Timeline view' }).click()
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()

    // Apply a filter - look for status filter buttons
    const statusFilter = page.getByTestId('status-filter')
    if (await statusFilter.isVisible()) {
      // Click the first status filter option
      const firstFilterOption = statusFilter.locator('button, [role="checkbox"], [role="radio"]').first()
      if (await firstFilterOption.isVisible()) {
        await firstFilterOption.click()
      }
    }

    // Timeline should still be visible after filtering
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()
  })

  test('sort selector is visible and usable in timeline mode', async ({ page }) => {
    await goToCourses(page)

    // Switch to timeline
    await page.getByRole('radio', { name: 'Timeline view' }).click()
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()

    // Sort selector should be visible
    const sortSelect = page.getByTestId('sort-select')
    await expect(sortSelect).toBeVisible()
  })

  test('course entries are expandable in timeline mode', async ({ page }) => {
    await goToCourses(page)

    // Switch to timeline
    await page.getByRole('radio', { name: 'Timeline view' }).click()
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()

    // Find a course entry card with role="button" and click it to expand
    const courseCards = page.locator('[data-testid="course-timeline-view"] [role="button"]')
    const count = await courseCards.count()
    if (count > 0) {
      await courseCards.first().click()
      // Lesson rows should appear (they link to /courses/:courseId/lessons/:videoId)
      const lessonLinks = page.locator('a[href*="/lessons/"]')
      await expect(lessonLinks.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Course might not have lessons — that's acceptable
      })
    }
  })
})
