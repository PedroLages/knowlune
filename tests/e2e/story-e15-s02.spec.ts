/**
 * ATDD E2E tests for E15-S02: Configure Timer Duration and Accommodations
 *
 * Tests the timer accommodation flow:
 * - AC1: Quiz start screen shows default time limit + "Accessibility Accommodations" button
 * - AC2: Accommodations modal with radio options (standard, 150%, 200%, untimed)
 * - AC3: Selected accommodation applies multiplier to timer
 * - AC4: "Untimed" hides timer, tracks time internally
 * - AC5: Accommodation preference persists across retakes
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data — timed quiz with 2 questions, 15-minute time limit
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s02'
const LESSON_ID = 'test-lesson-e15s02'

const q1 = makeQuestion({
  id: 'q1-accommodation-test',
  order: 1,
  type: 'multiple-choice',
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-accommodation-test',
  order: 2,
  type: 'multiple-choice',
  text: 'What is 3 + 3?',
  options: ['5', '6', '7', '8'],
  correctAnswer: '6',
  points: 1,
})

const timedQuiz = makeQuiz({
  id: 'quiz-e15s02-timed',
  lessonId: LESSON_ID,
  title: 'Accommodation Test Quiz',
  description: 'A timed quiz for E15-S02 accommodation tests',
  questions: [q1, q2],
  timeLimit: 15, // 15 minutes
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAndNavigateToQuiz(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [timedQuiz])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E15-S02: Configure Timer Duration and Accommodations', () => {
  test('AC1: Quiz start screen shows default time limit and accommodations button', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)

    // Default time limit is visible (15 min)
    await expect(page.getByText('15 min')).toBeVisible()

    // "Accessibility Accommodations" button/link is visible
    const accommodationsBtn = page.getByRole('button', {
      name: /accessibility accommodations/i,
    })
    await expect(accommodationsBtn).toBeVisible()

    // Clicking opens a modal/dialog
    await accommodationsBtn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
  })

  test('AC2: Accommodations modal shows radio options with explanation', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    // Open accommodations modal
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Verify radio group with 4 options
    const radioGroup = dialog.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()

    const radios = dialog.getByRole('radio')
    await expect(radios).toHaveCount(4)

    // Verify option labels
    await expect(dialog.getByText(/standard time/i)).toBeVisible()
    await expect(dialog.getByText(/150%/i)).toBeVisible()
    await expect(dialog.getByText(/200%/i)).toBeVisible()
    await expect(dialog.getByText(/untimed/i)).toBeVisible()

    // Verify explanation text
    await expect(dialog.getByText(/extended time is available for learners/i)).toBeVisible()
  })

  test('AC3: 150% accommodation applies multiplier — timer shows 22:30 with annotation', async ({
    page,
  }) => {
    await seedAndNavigateToQuiz(page)

    // Open accommodations and select 150%
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()
    const dialog = page.getByRole('dialog')

    // Select 150% extended time
    const extendedOption = dialog.getByRole('radio', { name: /150%/i })
    await extendedOption.click()
    await expect(extendedOption).toBeChecked()

    // Close/confirm the modal
    const confirmBtn = dialog.getByRole('button', { name: 'Save' })
    await confirmBtn.click()

    // Start the quiz
    await startQuiz(page)

    // Timer should show 22:30 (150% of 15 min = 22.5 min)
    await expect(page.getByText('22:30')).toBeVisible()

    // Timer header should indicate accommodation
    await expect(page.getByText(/extended time/i)).toBeVisible()
  })

  test('AC4: Untimed mode hides timer display', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    // Open accommodations and select Untimed
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()
    const dialog = page.getByRole('dialog')

    const untimedOption = dialog.getByRole('radio', { name: /untimed/i })
    await untimedOption.click()
    await expect(untimedOption).toBeChecked()

    // Close/confirm the modal
    const confirmBtn = dialog.getByRole('button', { name: 'Save' })
    await confirmBtn.click()

    // Start the quiz
    await startQuiz(page)

    // No timer should be displayed (no MM:SS countdown visible)
    // The timer element should not exist or be hidden
    const timerDisplay = page.locator('[data-testid="quiz-timer"]')
    await expect(timerDisplay).toBeHidden()

    // Question content should still be visible (quiz is running)
    await expect(page.getByText('What is 2 + 2?')).toBeVisible()
  })

  test('AC5: Accommodation preference persists across retakes', async ({ page }) => {
    await seedAndNavigateToQuiz(page)

    // Open accommodations and select 150%
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()
    let dialog = page.getByRole('dialog')

    const extendedOption = dialog.getByRole('radio', { name: /150%/i })
    await extendedOption.click()

    const confirmBtn = dialog.getByRole('button', { name: 'Save' })
    await confirmBtn.click()

    // Start, answer, and submit the quiz to complete it
    await startQuiz(page)

    // Answer Q1 — use radio role with exact name to avoid ambiguous label matches
    await page.getByRole('radio', { name: '4' }).click()
    await page.getByRole('button', { name: /next/i }).click()

    // Answer Q2
    await page.getByRole('radio', { name: '6' }).click()
    await page.getByRole('button', { name: /submit/i }).click()

    // Handle confirmation if present
    const submitConfirm = page.getByRole('button', { name: /confirm|submit|yes/i })
    if (await submitConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitConfirm.click()
    }

    // Wait for results page, then navigate back to quiz start screen
    await page.waitForURL(/\/quiz\/results/)

    // Clear quiz state so we see the start screen again
    await page.evaluate(() => localStorage.removeItem('levelup-quiz-store'))
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // On start screen, open accommodations modal again
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()
    dialog = page.getByRole('dialog')

    // 150% option should still be pre-selected
    const savedOption = dialog.getByRole('radio', { name: /150%/i })
    await expect(savedOption).toBeChecked()
  })
})
