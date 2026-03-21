import { test, expect } from '../support/fixtures'
import { seedQuizzes } from '../support/helpers/indexeddb-seed'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

/**
 * E14-S01: Display True/False Questions
 *
 * Tests the TrueFalseQuestion component for rendering, selection,
 * scoring, responsive layout, and accessibility.
 *
 * Acceptance Criteria:
 * - AC1: Question text with "True" and "False" radio button options
 * - AC2: Selection visually indicated, saved to state, changeable
 * - AC3: Scored all-or-nothing (0% or 100%)
 * - AC4: Responsive — 2-column grid desktop, stacked mobile
 * - AC5: Accessibility — fieldset/legend, radiogroup, keyboard nav, ≥44px targets
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-tf'
const LESSON_ID = 'test-lesson-tf'

function buildTrueFalseQuiz() {
  const questions = [
    makeQuestion({
      id: 'q-tf-1',
      order: 1,
      type: 'true-false',
      text: '**Photosynthesis** requires sunlight.',
      options: ['True', 'False'],
      correctAnswer: 'True',
      points: 1,
    }),
    makeQuestion({
      id: 'q-tf-2',
      order: 2,
      type: 'true-false',
      text: 'The Earth is flat.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      points: 1,
    }),
  ]

  return makeQuiz({
    id: 'quiz-tf-test',
    lessonId: LESSON_ID,
    title: 'True/False Test Quiz',
    description: 'Testing true/false question display',
    questions,
    passingScore: 50,
  })
}

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  const quiz = buildTrueFalseQuiz()

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

test.describe('E14-S01: Display True/False Questions', () => {
  test('AC1: Question text with exactly two radio options — True and False', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify question text renders (Markdown bold)
    await expect(page.getByText('Photosynthesis', { exact: false })).toBeVisible()

    // Verify radiogroup with exactly 2 options
    const radioGroup = page.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(2)

    // Verify option labels (exact match avoids quiz title "True/False Test Quiz")
    await expect(page.getByText('True', { exact: true })).toBeVisible()
    await expect(page.getByText('False', { exact: true })).toBeVisible()

    // No pre-selection
    for (const option of await options.all()) {
      await expect(option).not.toBeChecked()
    }
  })

  test('AC2: Selection visually indicated with brand styling, changeable', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Select "True"
    const trueLabel = page.locator('label').filter({ hasText: 'True' })
    await trueLabel.click()

    const trueRadio = page.getByRole('radio', { name: 'True' })
    await expect(trueRadio).toBeChecked()

    // Verify selected has brand styling
    await expect(trueLabel).toHaveClass(/border-brand/)
    await expect(trueLabel).toHaveClass(/bg-brand-soft/)

    // Verify "False" has default styling
    const falseLabel = page.locator('label').filter({ hasText: 'False' })
    await expect(falseLabel).toHaveClass(/border-border/)

    // Change selection to "False"
    await falseLabel.click()
    const falseRadio = page.getByRole('radio', { name: 'False' })
    await expect(falseRadio).toBeChecked()
    await expect(trueRadio).not.toBeChecked()

    // Verify styling swapped
    await expect(falseLabel).toHaveClass(/border-brand/)
    await expect(trueLabel).toHaveClass(/border-border/)
  })

  test('AC3: True/False questions scored all-or-nothing after submission', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Select correct answer "True"
    const trueLabel = page.locator('label').filter({ hasText: 'True' })
    await trueLabel.click()

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Select incorrect answer "True" (correct is "False")
    const trueLabel2 = page.locator('label').filter({ hasText: 'True' })
    await trueLabel2.click()

    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify score: 1 correct out of 2 (target visible <p>, not sr-only div)
    await expect(page.locator('p').filter({ hasText: '1 of 2 correct' })).toBeVisible()
  })

  test('AC3b: 0% score when all answers are incorrect', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Select incorrect answer "False" (correct is "True")
    await page.locator('label').filter({ hasText: 'False' }).click()

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Select incorrect answer "True" (correct is "False")
    await page.locator('label').filter({ hasText: 'True' }).click()

    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify score: 0 correct out of 2
    await expect(page.locator('p').filter({ hasText: '0 of 2 correct' })).toBeVisible()
  })

  test('AC4: Desktop 2-column grid, mobile stacked layout', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify both options are visible and side-by-side on desktop
    const trueLabel = page.locator('label').filter({ hasText: 'True' })
    const falseLabel = page.locator('label').filter({ hasText: 'False' })
    const trueBox = await trueLabel.boundingBox()
    const falseBox = await falseLabel.boundingBox()
    expect(trueBox).not.toBeNull()
    expect(falseBox).not.toBeNull()

    // On desktop (2-column): options should be roughly at the same Y (side-by-side)
    expect(Math.abs(trueBox!.y - falseBox!.y)).toBeLessThan(10)

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    // Wait for layout reflow by checking element is still visible
    await expect(trueLabel).toBeVisible()

    const trueMobileBox = await trueLabel.boundingBox()
    const falseMobileBox = await falseLabel.boundingBox()
    expect(trueMobileBox).not.toBeNull()
    expect(falseMobileBox).not.toBeNull()

    // On mobile (stacked): False should be below True
    expect(falseMobileBox!.y).toBeGreaterThan(trueMobileBox!.y + trueMobileBox!.height - 5)
  })

  test('AC5: Accessibility — fieldset, radiogroup, keyboard nav, touch targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify radiogroup role with aria-labelledby
    const radioGroup = page.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()
    const ariaLabelledBy = await radioGroup.getAttribute('aria-labelledby')
    expect(ariaLabelledBy).toBeTruthy()

    // Verify legend is accessible (use attribute selector — useId() generates colon-containing IDs)
    const legend = page.locator(`[id="${ariaLabelledBy}"]`)
    await expect(legend).toBeVisible()

    // Keyboard focus: Tab to first radio, verify focus
    const firstRadio = page.getByRole('radio', { name: 'True' })
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()

    // Arrow key navigation within radiogroup (Radix roving tabindex)
    await page.keyboard.press('ArrowRight')
    const secondRadio = page.getByRole('radio', { name: 'False' })
    await expect(secondRadio).toBeFocused()

    // Touch targets ≥44px (we use min-h-12 = 48px)
    const options = page.getByRole('radio')
    const count = await options.count()
    for (let i = 0; i < count; i++) {
      const label = options.nth(i).locator('xpath=ancestor::label')
      const box = await label.boundingBox()
      expect(box, `Option ${i} label should have a bounding box`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})
