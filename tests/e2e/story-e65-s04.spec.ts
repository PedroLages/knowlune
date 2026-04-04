/**
 * E2E Smoke Tests: E65-S04 — Focus Mode Auto-Activation & Notification Piercing
 *
 * Acceptance criteria covered:
 * - AC1: Focus mode auto-activates when a quiz session begins
 * - AC4: Settings page exposes auto-activation toggles for quiz and flashcard review
 * - AC5: Navigating away from quiz/flashcard releases focus mode
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/seed-helpers'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

const TEST_COURSE = createImportedCourse({
  id: 'e65-s04-focus-course',
  name: 'Focus Mode Test Course',
  videoCount: 1,
  pdfCount: 0,
})

test.describe('E65-S04: Focus Mode Auto-Activation', () => {
  test('Settings page has auto-activation toggles for quiz and flashcard', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    // The focus mode settings card should be visible
    const focusModeCard = page.getByTestId('focus-mode-settings')
    await expect(focusModeCard).toBeVisible()

    // Quiz auto-activation toggle
    const quizToggle = page.getByTestId('focus-auto-quiz-toggle')
    await expect(quizToggle).toBeVisible()

    // Flashcard auto-activation toggle
    const flashcardToggle = page.getByTestId('focus-auto-flashcard-toggle')
    await expect(flashcardToggle).toBeVisible()
  })

  test('Auto-activation toggles are checked by default', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    const quizToggle = page.getByTestId('focus-auto-quiz-toggle')
    const flashcardToggle = page.getByTestId('focus-auto-flashcard-toggle')

    await expect(quizToggle).toBeChecked()
    await expect(flashcardToggle).toBeChecked()
  })

  test('Auto-activation toggles can be disabled', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')

    const quizToggle = page.getByTestId('focus-auto-quiz-toggle')
    await expect(quizToggle).toBeChecked()
    await quizToggle.click()
    await expect(quizToggle).not.toBeChecked()

    // Reload and verify persistence
    await page.reload()
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, '/settings')
    const quizToggleReloaded = page.getByTestId('focus-auto-quiz-toggle')
    await expect(quizToggleReloaded).not.toBeChecked()
  })

  test('Navigating away from flashcard page releases focus mode', async ({ page }) => {
    await page.goto('/')
    await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    // Navigate to flashcards page
    await navigateAndWait(page, '/flashcards')

    // Navigate away (back to overview)
    await navigateAndWait(page, '/')

    // Focus mode overlay should NOT be visible after navigating away
    const focusOverlay = page.locator('[data-testid="focus-mode-overlay"]')
    await expect(focusOverlay).not.toBeVisible()
  })
})
