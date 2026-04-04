/**
 * E2E Smoke Tests: E65-S01 — Core Reading Mode Chrome Hiding and Content Layout
 *
 * Acceptance criteria covered:
 * - AC1: Reading mode toggle button is visible in the lesson player
 * - AC2: Keyboard shortcut Cmd+Shift+R activates reading mode (html has .reading-mode class)
 * - AC3: Escape key exits reading mode
 * - AC4: Status bar is visible when reading mode is active
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

const TEST_COURSE = createImportedCourse({
  id: 'e65-reading-mode-course',
  name: 'Reading Mode Test Course',
  videoCount: 1,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'e65-vid-01',
    courseId: 'e65-reading-mode-course',
    filename: '01-Intro.mp4',
    path: '/01-Intro.mp4',
    title: 'Introduction',
    duration: 120,
    position: 0,
  },
]

async function seedAndNavigate(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await navigateAndWait(page, '/courses/e65-reading-mode-course/lessons/e65-vid-01')
}

test.describe('E65-S01: Core Reading Mode', () => {
  test('reading mode toggle button is visible in lesson player', async ({ page }) => {
    await seedAndNavigate(page)

    const toggle = page.getByTestId('reading-mode-toggle')
    await expect(toggle).toBeVisible({ timeout: 8000 })
  })

  test('Cmd+Shift+R activates reading mode — html element gets .reading-mode class', async ({
    page,
  }) => {
    await seedAndNavigate(page)

    // Ensure page is focused
    await page.click('body')

    await page.keyboard.press('Meta+Shift+R')

    await expect(page.locator('html')).toHaveClass(/reading-mode/, { timeout: 5000 })

    // Cleanup — exit reading mode
    await page.keyboard.press('Escape')
  })

  test('Escape key exits reading mode', async ({ page }) => {
    await seedAndNavigate(page)

    // Activate reading mode first
    await page.click('body')
    await page.keyboard.press('Meta+Shift+R')
    await expect(page.locator('html')).toHaveClass(/reading-mode/, { timeout: 5000 })

    // Exit via Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('html')).not.toHaveClass(/reading-mode/, { timeout: 5000 })
  })

  test('reading mode status bar is visible when reading mode is active', async ({ page }) => {
    await seedAndNavigate(page)

    // Activate reading mode
    await page.click('body')
    await page.keyboard.press('Meta+Shift+R')
    await expect(page.locator('html')).toHaveClass(/reading-mode/, { timeout: 5000 })

    // Status bar (toolbar) should be visible
    const statusBar = page.getByRole('toolbar', { name: 'Reading mode controls' })
    await expect(statusBar).toBeVisible({ timeout: 5000 })

    // Cleanup
    await page.getByTestId('reading-mode-close').click()
  })
})
