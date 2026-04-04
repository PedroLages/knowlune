/**
 * E2E Smoke Tests: E65-S03 — Focus Mode Overlay, Focus Trap, and Exit
 *
 * Acceptance criteria covered:
 * - AC1: Cmd+Shift+F activates focus mode when [data-focus-target] is present
 * - AC2: Escape key exits focus mode
 * - AC3: Close button (X) on overlay exits focus mode
 * - AC9: Toast shown when no focus target available
 */
import { test, expect } from '../../support/fixtures'
import { seedQuizzes } from '../../support/helpers/seed-helpers'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'e65-s03-course'
const LESSON_ID = 'e65-s03-lesson'

function buildTestQuiz() {
  const questions = [
    makeQuestion({
      id: 'q1',
      order: 1,
      type: 'multiple-choice',
      text: 'Which shortcut activates focus mode?',
      options: ['Cmd+Shift+F', 'Cmd+Shift+R', 'Cmd+Shift+P', 'Cmd+Shift+S'],
      correctAnswer: 'Cmd+Shift+F',
    }),
  ]

  return makeQuiz({
    id: 'quiz-e65-s03',
    lessonId: LESSON_ID,
    title: 'Focus Mode Test Quiz',
    description: 'Quiz for focus mode testing',
    questions,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    timeLimit: null,
  })
}

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  const quiz = buildTestQuiz()

  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))
  await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)
  await page.getByRole('button', { name: /start quiz/i }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: /start quiz/i }).click()
  await page.getByTestId('quiz-active-container').waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E65-S03: Focus Mode Overlay', () => {
  test('Cmd+Shift+F activates focus mode overlay on quiz page', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    await page.keyboard.press('Meta+Shift+F')

    // Overlay backdrop should be visible
    await expect(page.getByTestId('focus-overlay-backdrop')).toBeVisible({ timeout: 5000 })
    // Close button should appear
    await expect(page.getByTestId('focus-overlay-close')).toBeVisible({ timeout: 5000 })
  })

  test('Escape key exits focus mode', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    await page.keyboard.press('Meta+Shift+F')
    await expect(page.getByTestId('focus-overlay-backdrop')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')

    await expect(page.getByTestId('focus-overlay-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('Close button on overlay exits focus mode', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    await page.keyboard.press('Meta+Shift+F')
    await expect(page.getByTestId('focus-overlay-close')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('focus-overlay-close').click()

    await expect(page.getByTestId('focus-overlay-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('toast shown when no focus target available', async ({ page }) => {
    // Navigate to a page without [data-focus-target] — e.g. the overview
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await page.keyboard.press('Meta+Shift+F')

    // Sonner toast with the message
    await expect(
      page.getByText('No interactive component to focus')
    ).toBeVisible({ timeout: 5000 })
  })
})
