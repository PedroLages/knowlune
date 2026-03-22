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
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore, clearIndexedDBStore } from '../../support/helpers/indexeddb-seed'

test.afterEach(async ({ page }) => {
  await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
})

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
    const feedback = page.locator('[data-testid="answer-feedback"]')
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
    const feedback = page.locator('[data-testid="answer-feedback"]')
    await expect(feedback).toBeVisible()

    // Orange "Not quite" message (not red X — non-judgmental)
    await expect(feedback.getByText('Not quite')).toBeVisible()

    // Explanation displayed
    await expect(feedback.getByText(/Paris has been the capital/)).toBeVisible()

    // Correct answer indicated
    await expect(feedback.getByText(/Correct answer:.*Paris/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: Partial credit (Multiple Select) → points earned display
// ---------------------------------------------------------------------------
test.describe('AC3: Partial credit feedback', () => {
  test('shows how many correct and per-option feedback for multiple-select', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Navigate to question 3 (multiple-select) — answer q1 and q2 first
    await page.getByText('Paris').click()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByText('4', { exact: true }).first().click()
    await page.getByRole('button', { name: /next/i }).click()

    // Select only 2 of 3 correct answers (partial credit)
    // Use exact match to avoid hitting feedback text from previous questions
    // Feedback shows immediately after each selection (no separate submit per question)
    await page.getByText('Red', { exact: true }).first().click()
    await page.getByText('Blue', { exact: true }).first().click()

    // Verify partial credit feedback
    const feedback = page.locator('[data-testid="answer-feedback"]')
    await expect(feedback).toBeVisible()

    // Shows "2 of 3 correct" heading
    await expect(feedback.getByRole('heading', { name: /of 3 correct/i })).toBeVisible()

    // Explanation displayed
    await expect(feedback.getByText(/primary colors/i)).toBeVisible()
  })

  test('shows incorrectly selected options in breakdown', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Navigate to question 3 (multiple-select) — answer q1 and q2 first
    await page.getByText('Paris').click()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByText('4', { exact: true }).first().click()
    await page.getByRole('button', { name: /next/i }).click()

    // Select 2 correct + 1 incorrect (Red, Blue, Green)
    // PCM: (2-1)/3 * 3 = 1 point → partial credit with breakdown
    await page.getByText('Red', { exact: true }).first().click()
    await page.getByText('Blue', { exact: true }).first().click()
    await page.getByText('Green', { exact: true }).first().click()

    const feedback = page.locator('[data-testid="answer-feedback"]')
    await expect(feedback).toBeVisible()

    // "Green" should appear in the breakdown as incorrectly selected
    await expect(feedback.getByText('Green')).toBeVisible()
    // Missed correct option should show
    await expect(feedback.getByText(/Yellow.*missed/)).toBeVisible()
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
    const feedback = page.locator('[data-testid="answer-feedback"]')
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
  test('unanswered questions show correct answer and "not answered in time"', async ({ page }) => {
    // Install fake timers before navigating so Date.now is controlled
    await page.clock.install()

    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    // Wait for timer to be visible (confirms timer effect has started)
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible()

    // Fast-forward time past the 1-minute limit
    await page.clock.fastForward(90_000) // 90 seconds (past 60s limit)

    // Quiz auto-submits and navigates to results page
    await expect(page).toHaveURL(/quiz\/results/, { timeout: 15000 })

    // Expand the Question Breakdown to see per-question details
    await page.getByText('Question Breakdown').click()

    // Unanswered questions show Clock icon with "Not answered in time" aria-label
    await expect(page.getByRole('img', { name: /not answered in time/i }).first()).toBeVisible()

    // Click the first unanswered question to expand its details
    await page.getByRole('button', { name: /Q1.*What is the capital/ }).click()

    // Expanded details show "not answered in time" text and correct answer
    // Use .first() to handle duplicate text in QuestionBreakdown vs "Areas to Review"
    await expect(page.getByText(/not answered in time/i).first()).toBeVisible()
    await expect(page.getByText(/Correct answer:.*Paris/).first()).toBeVisible()
    await expect(page.getByText(/Paris has been the capital/).first()).toBeVisible()
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
    const feedback = page.locator(
      '[data-testid="answer-feedback"][role="status"][aria-live="polite"]'
    )
    await expect(feedback).toBeVisible()
  })

  test('feedback uses icon + text, not color alone', async ({ page }) => {
    await navigateToQuiz(page, feedbackQuiz)
    await startQuiz(page)

    // Correct answer
    await page.getByText('Paris').click()

    const feedback = page.locator('[data-testid="answer-feedback"]')
    // Must have both icon (SVG) and text — color not sole indicator
    await expect(feedback.locator('svg')).toBeVisible()
    await expect(feedback.getByText('Correct!')).toBeVisible()
  })
})
