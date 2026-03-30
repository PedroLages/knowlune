/**
 * E89-S03: Consolidate Routes with Redirects
 *
 * Tests that old URL patterns redirect to unified /courses/ paths:
 * - AC2a: /imported-courses/:courseId → /courses/:courseId
 * - AC2b: /imported-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId
 * - AC2c: /youtube-courses/:courseId → /courses/:courseId
 * - AC2d: /youtube-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E89-S03: URL Redirects', () => {
  test('AC2a: /imported-courses/:courseId redirects to /courses/:courseId', async ({ page }) => {
    await navigateAndWait(page, '/imported-courses/test-course-123')
    await expect(page).toHaveURL(/\/courses\/test-course-123/)
  })

  test('AC2b: /imported-courses/:courseId/lessons/:lessonId redirects correctly', async ({
    page,
  }) => {
    await navigateAndWait(page, '/imported-courses/test-course-123/lessons/lesson-456')
    await expect(page).toHaveURL(/\/courses\/test-course-123\/lessons\/lesson-456/)
  })

  test('AC2c: /youtube-courses/:courseId redirects to /courses/:courseId', async ({ page }) => {
    await navigateAndWait(page, '/youtube-courses/yt-course-789')
    await expect(page).toHaveURL(/\/courses\/yt-course-789/)
  })

  test('AC2d: /youtube-courses/:courseId/lessons/:lessonId redirects correctly', async ({
    page,
  }) => {
    await navigateAndWait(page, '/youtube-courses/yt-course-789/lessons/yt-lesson-101')
    await expect(page).toHaveURL(/\/courses\/yt-course-789\/lessons\/yt-lesson-101/)
  })

  test('AC2: Redirects preserve query params and hash', async ({ page }) => {
    await navigateAndWait(page, '/imported-courses/test-course-123?tab=notes#section-2')
    const url = page.url()
    expect(url).toContain('/courses/test-course-123')
    expect(url).toContain('tab=notes')
    expect(url).toContain('#section-2')
  })
})
