/**
 * E2E Smoke Tests: E65-S02 — Reading Mode Floating Toolbar and Progress Bar
 *
 * Acceptance criteria covered:
 * - AC1: Floating toolbar renders in reading mode (data-testid="reading-toolbar")
 * - AC2: Font size decrease/increase buttons work
 * - AC3: Progress bar is visible in reading mode (data-testid="reading-progress-bar")
 * - AC4: Theme cycling button is present and changes the theme label
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

const TEST_COURSE = createImportedCourse({
  id: 'e65-s02-toolbar-course',
  name: 'Toolbar Test Course',
  videoCount: 1,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'e65-s02-vid-01',
    courseId: 'e65-s02-toolbar-course',
    filename: '01-Toolbar.mp4',
    path: '/01-Toolbar.mp4',
    title: 'Toolbar Test Video',
    duration: 120,
    position: 0,
  },
]

async function seedAndNavigate(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await navigateAndWait(page, '/courses/e65-s02-toolbar-course/lessons/e65-s02-vid-01')
}

async function activateReadingMode(page: import('@playwright/test').Page): Promise<void> {
  const isMac = process.platform === 'darwin'
  await page.keyboard.press(isMac ? 'Meta+Shift+R' : 'Control+Shift+R')
  // Wait for reading mode class on html
  await page.waitForFunction(() => document.documentElement.classList.contains('reading-mode'), {
    timeout: 5000,
  })
}

test.describe('E65-S02: Reading Mode Floating Toolbar and Progress Bar', () => {
  test('reading toolbar is visible when reading mode is active', async ({ page }) => {
    await seedAndNavigate(page)
    await activateReadingMode(page)

    const toolbar = page.getByTestId('reading-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 8000 })
  })

  test('font size buttons decrease and increase font size', async ({ page }) => {
    await seedAndNavigate(page)
    await activateReadingMode(page)

    const toolbar = page.getByTestId('reading-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 8000 })

    // Get the font size label (shows current level like "1x")
    const fontSizeDisplay = toolbar.locator('[aria-live="polite"]').first()
    const initialLabel = await fontSizeDisplay.textContent()

    // Increase font size
    await toolbar.getByRole('button', { name: 'Increase font size' }).click()
    const increasedLabel = await fontSizeDisplay.textContent()
    expect(increasedLabel).not.toBe(initialLabel)

    // Decrease font size back
    await toolbar.getByRole('button', { name: 'Decrease font size' }).click()
    const restoredLabel = await fontSizeDisplay.textContent()
    expect(restoredLabel).toBe(initialLabel)
  })

  test('progress bar is visible in reading mode', async ({ page }) => {
    await seedAndNavigate(page)
    await activateReadingMode(page)

    const progressBar = page.getByTestId('reading-progress-bar')
    await expect(progressBar).toBeVisible({ timeout: 8000 })
    await expect(progressBar).toHaveAttribute('role', 'progressbar')
  })

  test('theme cycling button is present and cycles through themes', async ({ page }) => {
    await seedAndNavigate(page)
    await activateReadingMode(page)

    const toolbar = page.getByTestId('reading-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 8000 })

    const themeButton = toolbar.getByRole('button', { name: /reading theme/i })
    await expect(themeButton).toBeVisible()

    // Cycle theme once
    const initialAriaLabel = await themeButton.getAttribute('aria-label')
    await themeButton.click()
    const updatedAriaLabel = await themeButton.getAttribute('aria-label')
    expect(updatedAriaLabel).not.toBe(initialAriaLabel)
  })
})
