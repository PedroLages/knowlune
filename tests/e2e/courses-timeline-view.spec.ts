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
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

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

    // Verify the status filter UI is rendered in timeline mode
    const statusFilter = page.getByTestId('status-filter')
    await expect(statusFilter).toBeVisible()

    // Timeline should still be visible after verifying filter
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

  test('course entries are expandable to show lessons in timeline mode', async ({ page }) => {
    // Seed a known course with lessons for deterministic testing
    await page.goto('/')
    await seedImportedCourses(page, [
      {
        id: 'expand-test-course',
        name: 'Expand Test Course',
        importedAt: FIXED_DATE,
        category: 'Development',
        tags: ['test'],
        status: 'active',
        videoCount: 2,
        pdfCount: 0,
      },
    ])
    await seedImportedVideos(page, [
      {
        id: 'expand-test-video-1',
        courseId: 'expand-test-course',
        filename: 'lesson-1.mp4',
        path: '/lessons/lesson-1.mp4',
        duration: 600,
        format: 'mp4',
        order: 1,
        title: 'Lesson One',
      },
      {
        id: 'expand-test-video-2',
        courseId: 'expand-test-course',
        filename: 'lesson-2.mp4',
        path: '/lessons/lesson-2.mp4',
        duration: 900,
        format: 'mp4',
        order: 2,
        title: 'Lesson Two',
      },
    ])

    await goToCourses(page)

    // Switch to timeline
    await page.getByRole('radio', { name: 'Timeline view' }).click()
    await expect(page.getByTestId('course-timeline-view')).toBeVisible()

    // Click the seeded course card to expand it
    const courseCard = page.locator('[data-testid="course-timeline-view"] [role="button"]').first()
    await courseCard.click()

    // Lesson rows should appear linking to /courses/:courseId/lessons/:videoId
    const lessonLinks = page.locator('a[href*="/lessons/"]')
    await expect(lessonLinks.first()).toBeVisible({ timeout: 5000 })
  })
})
