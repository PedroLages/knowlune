/**
 * ATDD E2E tests for E15-S04: Provide Immediate Explanatory Feedback per Question
 *
 * Tests feedback display after answering quiz questions:
 * - AC1: Correct answer → green checkmark + "Correct!" + explanation
 * - AC2: Incorrect answer → orange "Not quite" + explanation + correct answer
 * - AC3: Partial credit (Multiple Select) → points earned + per-option feedback
 * - AC4: Feedback appears immediately, does not block navigation
 * - AC5: Timer-expired → unanswered questions show correct answer feedback
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s04'
const LESSON_ID = 'test-lesson-e15s04'

const mcQuestion = makeQuestion({
  id: 'q1-feedback-mc',
  order: 1,
  type: 'multiple-choice',
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris has been the capital of France since the 10th century.',
  points: 1,
})

const mcQuestion2 = makeQuestion({
  id: 'q2-feedback-mc',
  order: 2,
  type: 'multiple-choice',
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  explanation: 'Basic arithmetic: 2 + 2 equals 4.',
  points: 1,
})

const msQuestion = makeQuestion({
  id: 'q3-feedback-ms',
  order: 3,
  type: 'multiple-select',
  text: 'Which are primary colors?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: ['Red', 'Blue', 'Yellow'],
  explanation: 'The traditional primary colors are red, blue, and yellow.',
  points: 3,
})

const feedbackQuiz = makeQuiz({
  id: 'quiz-e15s04-feedback',
  lessonId: LESSON_ID,
  title: 'Feedback Test Quiz',
  description: 'A quiz to test answer feedback display',
  questions: [mcQuestion, mcQuestion2, msQuestion],
  timeLimit: null,
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const timedQuiz = makeQuiz({
  id: 'quiz-e15s04-timed',
  lessonId: LESSON_ID,
  title: 'Timed Feedback Quiz',
  description: 'A timed quiz for timer-expired feedback tests',
  questions: [mcQuestion, mcQuestion2],
  timeLimit: 1, // 1 minute — short for testing
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedQuizData(
  page: import('@playwright/test').Page,
  quiz: ReturnType<typeof makeQuiz>
) {
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
}

async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quiz: ReturnType<typeof makeQuiz>
) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page, quiz)
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
// AC1: Correct answer → green feedback
// ---------------------------------------------------------------------------
test.describe('AC1: Correct answer feedback', () => {
  test('shows green checkmark and "Correct!" with explanation', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Select correct answer
    await page.getByText('Paris').click()

    // Verify feedback appears
    const feedback = page.locator('[role="status"]')
    await expect(feedback).toBeVisible()

    // Green "Correct!" message
    await expect(feedback.getByText('Correct!')).toBeVisible()

    // Explanation displayed
    await expect(feedback.getByText(/Paris has been the capital/)).toBeVisible()

    // Green checkmark icon present (CheckCircle from lucide)
    await expect(feedback.locator('svg')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Incorrect answer → orange feedback with correct answer
// ---------------------------------------------------------------------------
test.describe('AC2: Incorrect answer feedback', () => {
  test('shows orange "Not quite" with explanation and correct answer', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Select incorrect answer
    await page.getByText('London').click()

    // Verify feedback appears
    const feedback = page.locator('[role="status"]')
    await expect(feedback).toBeVisible()

    // Orange "Not quite" message (not red X — non-judgmental)
    await expect(feedback.getByText('Not quite')).toBeVisible()

    // Explanation displayed
    await expect(feedback.getByText(/Paris has been the capital/)).toBeVisible()

    // Correct answer indicated
    await expect(feedback.getByText(/correct answer/i)).toBeVisible()
    await expect(feedback.getByText('Paris')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: Partial credit (Multiple Select) → points earned display
// ---------------------------------------------------------------------------
test.describe('AC3: Partial credit feedback', () => {
  test('shows how many correct and per-option feedback for multiple-select', async ({
    page,
  }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Navigate to question 3 (multiple-select) — answer q1 and q2 first
    await page.getByText('Paris').click()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByText('4').click()
    await page.getByRole('button', { name: /next/i }).click()

    // Select only 2 of 3 correct answers (partial credit)
    await page.getByText('Red').click()
    await page.getByText('Blue').click()
    // Submit partial answer
    await page.getByRole('button', { name: /submit|check/i }).click()

    // Verify partial credit feedback
    const feedback = page.locator('[role="status"]')
    await expect(feedback).toBeVisible()

    // Shows "2 of 3 correct" or similar partial credit indicator
    await expect(feedback.getByText(/2.*of.*3/i)).toBeVisible()

    // Explanation displayed
    await expect(feedback.getByText(/primary colors/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4: Feedback does not block navigation
// ---------------------------------------------------------------------------
test.describe('AC4: Feedback navigation behavior', () => {
  test('feedback appears immediately and does not block Next Question', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Answer question
    await page.getByText('Paris').click()

    // Feedback visible
    const feedback = page.locator('[role="status"]')
    await expect(feedback).toBeVisible()

    // Can still click "Next Question" — not blocked
    const nextBtn = page.getByRole('button', { name: /next/i })
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()

    // Now on question 2 — feedback from q1 dismissed
    await expect(page.getByText('What is 2 + 2?')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC5: Timer expired → unanswered questions show feedback
// ---------------------------------------------------------------------------
test.describe('AC5: Timer-expired feedback', () => {
  test('unanswered questions show correct answer and "not answered in time"', async ({
    page,
  }) => {
    await navigateToQuiz(page, timedQuiz)

    // Save real Date.now before manipulating
    await page.evaluate(() => {
      ;(window as unknown as Record<string, unknown>).__realDateNow = Date.now
    })

    await startQuiz(page)

    // Don't answer — fast-forward time past the limit
    await page.evaluate(() => {
      const realNow = (window as unknown as Record<string, () => number>).__realDateNow
      ;(Date as { now: () => number }).now = () => realNow() + 2 * 60 * 1000 // 2 minutes past
    })

    // Trigger timer check (visibility change forces re-evaluation)
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Quiz should auto-submit — look for feedback on unanswered questions
    // The results/review should show feedback with correct answers
    await expect(page.getByText(/not answered in time|time expired|unanswered/i)).toBeVisible({
      timeout: 10000,
    })

    // Correct answer should be shown for unanswered question
    await expect(page.getByText('Paris')).toBeVisible()
    await expect(page.getByText(/Paris has been the capital/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Accessibility: ARIA live region
// ---------------------------------------------------------------------------
test.describe('Accessibility', () => {
  test('feedback is announced via ARIA live region', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Answer a question
    await page.getByText('Paris').click()

    // Feedback should have role="status" and aria-live="polite"
    const feedback = page.locator('[role="status"][aria-live="polite"]')
    await expect(feedback).toBeVisible()
  })

  test('feedback uses icon + text, not color alone', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Correct answer
    await page.getByText('Paris').click()

    const feedback = page.locator('[role="status"]')
    // Must have both icon (SVG) and text — color not sole indicator
    await expect(feedback.locator('svg')).toBeVisible()
    await expect(feedback.getByText('Correct!')).toBeVisible()
  })
})
