import { test, expect } from './support/fixtures'
import { seedQuizzes } from './support/helpers/indexeddb-seed'
import { makeQuiz, makeQuestion } from './support/fixtures/factories/quiz-factory'

/**
 * E14-S03: Display Fill-in-Blank Questions
 *
 * Tests the FillInBlankQuestion component for rendering, input behavior,
 * debounced state saving, scoring, and accessibility.
 *
 * Acceptance Criteria:
 * - AC1: Question text displayed with text input, placeholder, appropriate size
 * - AC2: Input saved with 300ms debounce, persists on nav, 500-char limit, counter
 * - AC3: Case-insensitive, whitespace-trimmed, all-or-nothing scoring
 * - AC4: Semantic HTML — fieldset/legend structure
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-fib'
const LESSON_ID = 'test-lesson-fib'

function buildFillInBlankQuiz() {
  const questions = [
    makeQuestion({
      id: 'q-fib-1',
      order: 1,
      type: 'fill-in-blank',
      text: 'What JavaScript framework is maintained by **Meta**?',
      correctAnswer: 'React',
      points: 2,
    }),
    makeQuestion({
      id: 'q-fib-2',
      order: 2,
      type: 'fill-in-blank',
      text: 'What does **CSS** stand for?',
      correctAnswer: 'Cascading Style Sheets',
      points: 3,
    }),
  ]

  return makeQuiz({
    id: 'quiz-fib-test',
    lessonId: LESSON_ID,
    title: 'Fill-in-Blank Test Quiz',
    description: 'Testing fill-in-blank question display',
    questions,
    passingScore: 50,
  })
}

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  const quiz = buildFillInBlankQuiz()

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

test.describe('E14-S03: Display Fill-in-Blank Questions', () => {
  test('AC1: Question text displayed with text input and placeholder', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify question text renders (Markdown bold)
    await expect(page.getByText('Meta', { exact: false })).toBeVisible()

    // Verify text input is present within a fieldset
    const fieldset = page.locator('fieldset')
    const input = fieldset.getByRole('textbox')
    await expect(input).toBeVisible()

    // Verify placeholder text
    await expect(input).toHaveAttribute('placeholder', /type your answer/i)

    // Verify no radios or checkboxes present
    await expect(fieldset.getByRole('radio')).toHaveCount(0)
    await expect(fieldset.getByRole('checkbox')).toHaveCount(0)
  })

  test('AC2: Typing updates input and character counter displays', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    const input = page.locator('fieldset').getByRole('textbox')

    // Type an answer
    await input.fill('React')

    // Verify input value
    await expect(input).toHaveValue('React')

    // Verify character counter updates
    await expect(page.getByText('5 / 500')).toBeVisible()
  })

  test('AC2: Answer persists when navigating away and back', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    const input = page.locator('fieldset').getByRole('textbox')
    await input.fill('React')

    // Wait for debounce to save (300ms + buffer)
    await page.waitForTimeout(500) // justified: waiting for 300ms debounce

    // Navigate to next question
    await page.getByRole('button', { name: /next/i }).click()

    // Navigate back
    await page.getByRole('button', { name: /previous|prev|back/i }).click()

    // Verify answer persisted
    const restoredInput = page.locator('fieldset').getByRole('textbox')
    await expect(restoredInput).toHaveValue('React')
  })

  test('AC2: Input enforces 500 character maximum', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    const input = page.locator('fieldset').getByRole('textbox')

    // Verify maxLength attribute
    await expect(input).toHaveAttribute('maxLength', '500')

    // Type a long string
    const longText = 'a'.repeat(500)
    await input.fill(longText)

    // Verify counter shows 500 / 500
    await expect(page.getByText('500 / 500')).toBeVisible()
  })

  test('AC3: Case-insensitive scoring — "react" matches "React"', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Type lowercase answer (correct answer is "React")
    const input = page.locator('fieldset').getByRole('textbox')
    await input.fill('react')

    // Wait for debounce
    await page.waitForTimeout(500) // justified: waiting for 300ms debounce

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Type correct answer with extra whitespace
    const input2 = page.locator('fieldset').getByRole('textbox')
    await input2.fill('  Cascading Style Sheets  ')

    // Wait for debounce
    await page.waitForTimeout(500) // justified: waiting for 300ms debounce

    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify perfect score (2 + 3 = 5 points)
    await expect(page.locator('p').filter({ hasText: '5 of 5 correct' })).toBeVisible()
  })

  test('AC3: Wrong answer scores 0 points (all-or-nothing)', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Q1: Type wrong answer
    const input = page.locator('fieldset').getByRole('textbox')
    await input.fill('Angular')

    await page.waitForTimeout(500) // justified: waiting for 300ms debounce

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()

    // Q2: Leave blank
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify 0 score
    await expect(page.locator('p').filter({ hasText: '0 of 5 correct' })).toBeVisible()
  })

  test('AC4: Semantic HTML — fieldset/legend structure', async ({ page }) => {
    await seedAndNavigateToQuiz(page)
    await startQuiz(page)

    // Verify fieldset exists
    const fieldset = page.locator('fieldset')
    await expect(fieldset).toBeVisible()

    // Verify legend contains question text
    const legend = fieldset.locator('legend')
    await expect(legend).toBeVisible()
    await expect(legend).toContainText('Meta')

    // Verify input is inside the fieldset
    await expect(fieldset.getByRole('textbox')).toBeVisible()
  })
})
