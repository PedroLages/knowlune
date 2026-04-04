/**
 * E2E Smoke Tests: E65-S05 — Settings Integration and First-Time Discovery
 *
 * Acceptance criteria covered:
 * - AC1: Settings page shows "Reading & Focus Modes" section
 * - AC1: Font size select exists with expected options
 * - AC1: Focus auto-activation toggles exist and are checked by default
 * - AC5: First-time discovery tooltip appears on first lesson visit (localStorage flag)
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/seed-helpers'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

const TEST_COURSE = createImportedCourse({
  id: 'e65-s05-test-course',
  name: 'Reading Mode Settings Test Course',
  videoCount: 1,
  pdfCount: 0,
})

test.describe('E65-S05: Settings Integration and First-Time Discovery', () => {
  test('Settings page shows "Reading & Focus Modes" section', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    const section = page.getByTestId('reading-focus-modes-section')
    await expect(section).toBeVisible()
    await expect(section).toContainText('Reading & Focus Modes')
  })

  test('Font size select exists with expected options', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    // Font size trigger should be present
    const fontSizeTrigger = page.locator('#reading-font-size')
    await expect(fontSizeTrigger).toBeVisible()

    // Open the select and verify options are present
    await fontSizeTrigger.click()
    await expect(page.getByRole('option', { name: '1x' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1.25x' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1.5x' })).toBeVisible()
    await expect(page.getByRole('option', { name: '2x' })).toBeVisible()
    // Close the select
    await page.keyboard.press('Escape')
  })

  test('Focus auto-activation toggles exist and are checked by default', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    const quizToggle = page.getByRole('switch', {
      name: 'Auto-activate focus mode for quizzes',
    })
    const flashcardToggle = page.getByRole('switch', {
      name: 'Auto-activate focus mode for flashcards',
    })

    await expect(quizToggle).toBeVisible()
    await expect(flashcardToggle).toBeVisible()
    await expect(quizToggle).toBeChecked()
    await expect(flashcardToggle).toBeChecked()
  })

  test('First-time discovery tooltip appears on first lesson visit (no localStorage flag)', async ({
    page,
  }) => {
    await page.goto('/')
    await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Ensure the dismissed flag is NOT set (first-time user)
      localStorage.removeItem('reading-mode-tooltip-dismissed')
    })

    // Navigate to a lesson page
    await navigateAndWait(page, `/courses/${TEST_COURSE.id}/lessons/${TEST_COURSE.id}-lesson-0`)

    // Discovery tooltip should appear for first-time users
    const tooltip = page.getByTestId('reading-mode-discovery-tooltip')
    await expect(tooltip).toBeVisible()
  })

  test('Discovery tooltip does not appear when localStorage flag is set', async ({ page }) => {
    await page.goto('/')
    await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Mark tooltip as already dismissed
      localStorage.setItem('reading-mode-tooltip-dismissed', 'true')
    })

    await navigateAndWait(page, `/courses/${TEST_COURSE.id}/lessons/${TEST_COURSE.id}-lesson-0`)

    const tooltip = page.getByTestId('reading-mode-discovery-tooltip')
    await expect(tooltip).not.toBeVisible()
  })
})
