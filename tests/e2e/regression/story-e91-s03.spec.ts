/**
 * E2E Tests: E91-S03 — Theater Mode
 *
 * Tests acceptance criteria:
 * - AC1: Theater mode button expands video to full width, hides side panel
 * - AC2: Clicking again restores split-panel layout
 * - AC3: Theater mode persists across lesson navigation (localStorage)
 * - AC4: Theater mode button hidden on mobile (<1024px)
 * - AC5: Keyboard shortcut 'T' toggles theater mode
 * - AC6: Button uses Maximize2/Minimize2 icons in PlayerHeader
 * - AC7: data-theater-mode attribute on player container
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../../support/helpers/seed-helpers'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'e91-theater-course',
  name: 'Theater Mode Test Course',
  videoCount: 2,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'e91-vid-01',
    courseId: 'e91-theater-course',
    filename: '01-Intro.mp4',
    path: '/01-Intro.mp4',
    duration: 120,
    format: 'mp4',
    order: 0,
  },
  {
    id: 'e91-vid-02',
    courseId: 'e91-theater-course',
    filename: '02-Basics.mp4',
    path: '/02-Basics.mp4',
    duration: 300,
    format: 'mp4',
    order: 1,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAndNavigate(page: Page, lessonId: string): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await navigateAndWait(page, `/courses/e91-theater-course/lessons/${lessonId}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E91-S03: Theater Mode', () => {
  test('AC1+AC2: toggle theater mode expands video and collapses side panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedAndNavigate(page, 'e91-vid-01')

    const playerContent = page.getByTestId('lesson-player-content')
    const theaterBtn = page.getByTestId('theater-mode-toggle')

    // Initially not in theater mode
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'false')
    await expect(theaterBtn).toBeVisible()

    // Enter theater mode
    await theaterBtn.click()
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'true')

    // Exit theater mode
    await theaterBtn.click()
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'false')
  })

  test('AC3: theater mode persists across lesson navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedAndNavigate(page, 'e91-vid-01')

    const theaterBtn = page.getByTestId('theater-mode-toggle')
    const playerContent = page.getByTestId('lesson-player-content')

    // Enable theater mode
    await theaterBtn.click()
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'true')

    // Navigate to another lesson
    await navigateAndWait(page, '/courses/e91-theater-course/lessons/e91-vid-02')

    // Theater mode should persist
    await expect(page.getByTestId('lesson-player-content')).toHaveAttribute(
      'data-theater-mode',
      'true'
    )
  })

  test('AC4: theater mode button hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await seedAndNavigate(page, 'e91-vid-01')

    // Button should not be visible on mobile
    const theaterBtn = page.getByTestId('theater-mode-toggle')
    await expect(theaterBtn).toBeHidden()
  })

  test('AC5: keyboard shortcut T toggles theater mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedAndNavigate(page, 'e91-vid-01')

    const playerContent = page.getByTestId('lesson-player-content')

    // Click the player container to ensure keyboard focus is on the page (not an iframe/video)
    await playerContent.click()

    // Press T to enter theater mode
    await page.keyboard.press('t')
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'true')

    // Press T again to exit
    await page.keyboard.press('t')
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'false')
  })

  test('AC6: button shows correct icon based on theater state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedAndNavigate(page, 'e91-vid-01')

    const theaterBtn = page.getByTestId('theater-mode-toggle')

    // Not in theater mode — should say "Enter theater mode"
    await expect(theaterBtn).toHaveAttribute('aria-label', 'Enter theater mode')

    // Enter theater mode
    await theaterBtn.click()
    await expect(theaterBtn).toHaveAttribute('aria-label', 'Exit theater mode')

    // Exit theater mode
    await theaterBtn.click()
    await expect(theaterBtn).toHaveAttribute('aria-label', 'Enter theater mode')
  })

  test('AC7: data-theater-mode attribute reflects state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedAndNavigate(page, 'e91-vid-01')

    const playerContent = page.getByTestId('lesson-player-content')

    await expect(playerContent).toHaveAttribute('data-theater-mode', 'false')
    await page.getByTestId('theater-mode-toggle').click()
    await expect(playerContent).toHaveAttribute('data-theater-mode', 'true')
  })
})
