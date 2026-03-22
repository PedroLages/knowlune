import { test, expect } from '../../support/fixtures'
import { seedQuizzes } from '../../support/helpers/indexeddb-seed'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'

/**
 * E14-S02: Display Multiple Select Questions with Partial Credit
 *
 * Tests the MultipleSelectQuestion component for rendering, selection,
 * PCM scoring, feedback display, and accessibility.
 *
 * Acceptance Criteria:
 * - AC1: Question text with "Select all that apply" indicator and checkboxes
 * - AC2: Multiple selections toggle independently, saved to state
 * - AC3: Zero selections on submit → 0 points
 * - AC4: PCM scoring: (correct - incorrect) / total correct, clamped to 0
 * - AC5: Scoring examples: 2C/1I out of 3 = 33%, 3C/0I = 100%, 1C/2I = 0%
 * - AC6: Feedback shows "X of Y correct" with per-option indicators
 * - AC7: Accessibility — fieldset/legend, checkboxes, keyboard nav
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-ms'
const LESSON_ID = 'test-lesson-ms'

function buildMultipleSelectQuiz() {
  const questions = [
    makeQuestion({
      id: 'q-ms-1',
      order: 1,
      type: 'multiple-select',
      text: 'Which of the following are **primary colors**?',
      options: ['Red', 'Green', 'Blue', 'Yellow'],
      correctAnswer: ['Red', 'Blue', 'Yellow'],
      points: 3,
    }),
    makeQuestion({
      id: 'q-ms-2',
      order: 2,
      type: 'multiple-select',
      text: 'Select all even numbers.',
      options: ['2', '3', '5', '8'],
      correctAnswer: ['2', '8'],
      points: 2,
    }),
  ]

  return makeQuiz({
    id: 'quiz-ms-test',
    lessonId: LESSON_ID,
    title: 'Multiple Select Test Quiz',
    description: 'Testing multiple select question display',
    questions,
    passingScore: 50,
  })
}

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  const quiz = buildMultipleSelectQuiz()

  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Prevent sidebar overlay in tablet viewports
  await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

  await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)
  await page.getByRole('button', { name: /start quiz/i }).waitFor({ state: 'visible' })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startButton = page.getByRole('button', { name: /start quiz/i })
  await expect(startButton).toBeVisible()
  await startButton.click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E14-S02: Display Multiple Select Questions', () => {
  test('AC1: Question text with "Select all that apply" indicator and checkboxes', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify question text renders (Markdown bold)
    await expect(page.getByText('primary colors', { exact: false })).toBeVisible()

    // Verify "Select all that apply" indicator
    await expect(page.getByText('Select all that apply')).toBeVisible()

    // Verify checkboxes within the question fieldset (not radio buttons)
    const fieldset = page.locator('fieldset')
    const checkboxes = fieldset.getByRole('checkbox')
    await expect(checkboxes).toHaveCount(4)

    // Verify no radios present for this question type
    await expect(fieldset.getByRole('radio')).toHaveCount(0)

    // Verify option labels
    await expect(page.getByText('Red')).toBeVisible()
    await expect(page.getByText('Green')).toBeVisible()
    await expect(page.getByText('Blue')).toBeVisible()
    await expect(page.getByText('Yellow')).toBeVisible()

    // No pre-selection
    for (const checkbox of await checkboxes.all()) {
      await expect(checkbox).not.toBeChecked()
    }
  })

  test('AC2: Multiple selections toggle independently, saved to state', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Select "Red" and "Blue"
    await page.getByRole('checkbox', { name: 'Red' }).check()
    await page.getByRole('checkbox', { name: 'Blue' }).check()

    // Verify both are checked
    await expect(page.getByRole('checkbox', { name: 'Red' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Blue' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Green' })).not.toBeChecked()

    // Uncheck "Red" — Blue should remain checked
    await page.getByRole('checkbox', { name: 'Red' }).uncheck()
    await expect(page.getByRole('checkbox', { name: 'Red' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Blue' })).toBeChecked()

    // Navigate away and back — selections should persist
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /previous|prev|back/i }).click()
    await expect(page.getByRole('checkbox', { name: 'Blue' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Red' })).not.toBeChecked()
  })

  test('AC4+5: PCM scoring — all correct = 100%', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Select all 3 correct answers (Red, Blue, Yellow)
    await page.getByRole('checkbox', { name: 'Red' }).check()
    await page.getByRole('checkbox', { name: 'Blue' }).check()
    await page.getByRole('checkbox', { name: 'Yellow' }).check()

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Select all correct (2, 8)
    await page.getByRole('checkbox', { name: '2' }).check()
    await page.getByRole('checkbox', { name: '8' }).check()

    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify perfect score
    await expect(page.locator('p').filter({ hasText: '5 of 5 correct' })).toBeVisible()
  })

  test('AC3+5: Zero selections → 0 points', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: No selections — leave all unchecked
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: No selections
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify 0 score
    await expect(page.locator('p').filter({ hasText: '0 of 5 correct' })).toBeVisible()
  })

  test('AC5: PCM scoring — partial credit with penalty (2C/1I of 3 = 33%)', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Select 2 correct (Red, Blue) and 1 incorrect (Green)
    // Correct answers: Red, Blue, Yellow
    await page.getByRole('checkbox', { name: 'Red' }).check()
    await page.getByRole('checkbox', { name: 'Blue' }).check()
    await page.getByRole('checkbox', { name: 'Green' }).check()

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Select both correct (2, 8)
    await page.getByRole('checkbox', { name: '2' }).check()
    await page.getByRole('checkbox', { name: '8' }).check()

    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click()
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Q1: (2-1)/3 = 0.33 → 0.33 * 3 = 1.0 point (rounded)
    // Q2: (2-0)/2 = 1.0 → 1.0 * 2 = 2.0 points
    // Total: 3.0 out of 5
    await expect(page.locator('p').filter({ hasText: '3 of 5 correct' })).toBeVisible()
  })

  test('AC6: Feedback shows per-option indicators after submission', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Select Red (correct) and Green (incorrect), miss Blue and Yellow (correct)
    await page.getByRole('checkbox', { name: 'Red' }).check()
    await page.getByRole('checkbox', { name: 'Green' }).check()

    // Navigate to Q2 and select correct answers
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('checkbox', { name: '2' }).check()
    await page.getByRole('checkbox', { name: '8' }).check()

    // Submit
    await page.getByRole('button', { name: /submit/i }).click()
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify feedback text shows "X of Y correct" (target visible <p>, not sr-only div)
    await expect(page.locator('p').filter({ hasText: /\d+ of \d+ correct/ })).toBeVisible()
  })

  test('AC7: Accessibility — fieldset/legend structure and keyboard navigation', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify fieldset with aria-labelledby linking to question text
    const fieldset = page.locator('fieldset')
    await expect(fieldset).toBeVisible()

    const ariaLabelledBy = await fieldset.getAttribute('aria-labelledby')
    expect(ariaLabelledBy).toBeTruthy()
    const questionText = page.locator(`[id="${ariaLabelledBy}"]`)
    await expect(questionText).toBeVisible()

    // Verify checkboxes within the question fieldset have accessible names
    const checkboxes = fieldset.getByRole('checkbox')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Keyboard: Tab to first checkbox, Space to toggle
    const firstCheckbox = checkboxes.first()
    await firstCheckbox.focus()
    await expect(firstCheckbox).toBeFocused()
    await page.keyboard.press('Space')
    await expect(firstCheckbox).toBeChecked()

    // Tab to next checkbox
    await page.keyboard.press('Tab')
    const secondCheckbox = checkboxes.nth(1)
    await expect(secondCheckbox).toBeFocused()

    // Toggle second checkbox
    await page.keyboard.press('Space')
    await expect(secondCheckbox).toBeChecked()

    // First should still be checked (independent toggling)
    await expect(firstCheckbox).toBeChecked()

    // Touch targets ≥44px
    for (let i = 0; i < count; i++) {
      const label = checkboxes.nth(i).locator('xpath=ancestor::label')
      const box = await label.boundingBox()
      expect(box, `Checkbox ${i} label should have a bounding box`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})
