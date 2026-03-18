import { test, expect } from '../support/fixtures'
import { seedQuizzes } from '../support/helpers/indexeddb-seed'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

/**
 * E12-S05: Display Multiple Choice Questions
 *
 * Tests the QuestionDisplay and MultipleChoiceQuestion components
 * for rendering, selection, persistence, accessibility, and responsive behavior.
 *
 * Acceptance Criteria:
 * - AC1: Question text rendered as Markdown in a card with 2-6 radio button options
 * - AC2: Selecting an option shows brand styling, persists via store
 * - AC3: QuestionDisplay accepts mode prop (active/review modes — prop surface only in E12)
 * - AC4: Mobile (<640px) stacked layout with 48px touch targets
 * - AC5: Graceful degradation for <2 or >6 options with console warning
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-mc'
const LESSON_ID = 'test-lesson-mc'

function buildQuizWithQuestions(questionCount = 3) {
  const questions = Array.from({ length: questionCount }, (_, i) =>
    makeQuestion({
      id: `q-${i + 1}`,
      order: i + 1,
      text: `**Question ${i + 1}**: What is ${i + 1} + ${i + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
    })
  )

  return makeQuiz({
    id: 'quiz-mc-test',
    lessonId: LESSON_ID,
    title: 'Multiple Choice Test Quiz',
    description: 'Testing MC question display',
    questions,
  })
}

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  const quiz = buildQuizWithQuestions()

  // Navigate first so Dexie initializes the DB and localStorage is accessible
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Prevent sidebar overlay in tablet viewports (must be after navigation)
  await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

  // Seed quiz into IndexedDB
  await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

  // Navigate to quiz page
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

test.describe('E12-S05: Display Multiple Choice Questions', () => {
  test('AC1: Question text rendered as Markdown in styled card with radio options', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify question text is rendered (Markdown bold should produce <strong>)
    await expect(page.getByText('Question 1', { exact: true })).toBeVisible()

    // Verify radio group exists with options
    const radioGroup = page.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()

    // Verify all 4 options are displayed
    const options = page.getByRole('radio')
    await expect(options).toHaveCount(4)

    // Verify no option is pre-selected
    for (const option of await options.all()) {
      await expect(option).not.toBeChecked()
    }

    // Verify option labels are visible
    await expect(page.getByText('Option A')).toBeVisible()
    await expect(page.getByText('Option B')).toBeVisible()
    await expect(page.getByText('Option C')).toBeVisible()
    await expect(page.getByText('Option D')).toBeVisible()
  })

  test('AC2: Selecting an option updates visual state — single selection only', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Select first option via label
    const optionALabel = page.locator('label').filter({ hasText: 'Option A' })
    await optionALabel.click()

    const firstOption = page.getByRole('radio').first()
    await expect(firstOption).toBeChecked()

    // Verify selected label has brand styling
    await expect(optionALabel).toHaveClass(/border-brand/)
    await expect(optionALabel).toHaveClass(/bg-brand-soft/)

    // Verify unselected label has default styling
    const optionBLabel = page.locator('label').filter({ hasText: 'Option B' })
    await expect(optionBLabel).toHaveClass(/border-border/)
    await expect(optionBLabel).toHaveClass(/bg-card/)

    // Select second option — first should uncheck (radio group behavior)
    await optionBLabel.click()
    const secondOption = page.getByRole('radio').nth(1)
    await expect(secondOption).toBeChecked()
    await expect(firstOption).not.toBeChecked()

    // Verify styling swapped
    await expect(optionBLabel).toHaveClass(/border-brand/)
    await expect(optionALabel).toHaveClass(/border-border/)
  })

  test('AC2: Answer persists via store across navigation', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Select Option B
    const optionBLabel = page.locator('label').filter({ hasText: 'Option B' })
    await optionBLabel.click()
    await expect(page.getByRole('radio').nth(1)).toBeChecked()

    // Navigate away
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Navigate back to quiz
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)
    await page.getByRole('radiogroup').waitFor({ state: 'visible' })

    // Verify Option B is still selected
    await expect(page.getByRole('radio').nth(1)).toBeChecked()
  })

  test('AC4: Mobile viewport — options have min 48px touch targets', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify each option's clickable area has at least 48px height
    const radioGroup = page.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()

    const options = page.getByRole('radio')
    const count = await options.count()
    expect(count).toBeGreaterThanOrEqual(2)

    for (let i = 0; i < count; i++) {
      const option = options.nth(i)
      // Get the parent label element that provides the touch target
      const label = option.locator('xpath=ancestor::label')
      const box = await label.boundingBox()
      expect(box, `Option ${i} label should have a bounding box`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(48)
    }
  })

  test('AC1/AC4: Accessibility — radiogroup structure, aria-labelledby, and focusable options', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify radiogroup role exists
    const radioGroup = page.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()

    // Verify radiogroup has aria-labelledby pointing to the legend
    const ariaLabelledBy = await radioGroup.getAttribute('aria-labelledby')
    expect(ariaLabelledBy).toBeTruthy()
    const legend = page.locator(`#${ariaLabelledBy}`)
    await expect(legend).toBeVisible()

    // Verify individual radio items are focusable
    const firstRadio = page.getByRole('radio').first()
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()

    // Verify clicking an option selects it (label click = full touch target)
    const optionLabel = page.locator('label').filter({ hasText: 'Option C' })
    await optionLabel.click()
    const optionC = page.getByRole('radio').nth(2)
    await expect(optionC).toBeChecked()

    // Verify all radio items have role="radio" (semantic correctness)
    const radios = page.getByRole('radio')
    const count = await radios.count()
    expect(count).toBe(4)
  })
})
