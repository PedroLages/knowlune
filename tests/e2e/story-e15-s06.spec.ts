/**
 * ATDD E2E tests for E15-S06: Track Time-to-Completion for Each Attempt
 *
 * Uses Playwright page.clock.setFixedTime() to control Date.now() without
 * freezing browser timers — deterministic and fast.
 *
 * Pattern:
 *   1. setFixedTime(T_START) → startQuiz captures startTime = T_START
 *   2. setFixedTime(T_END) → submitQuiz calculates timeSpent = T_END - T_START
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts, clearIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s06'
const LESSON_ID = 'test-lesson-e15s06'
const QUIZ_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`

const T_START = new Date('2025-01-15T12:00:00.000Z')
const T_8M32S = new Date('2025-01-15T12:08:32.000Z') // 512000ms after T_START

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const questions = [
  makeQuestion({
    id: 'q1-e15s06',
    order: 1,
    text: 'What is 2 + 2?',
    options: ['4', '3', '5', '6'],
    correctAnswer: '4',
  }),
  makeQuestion({
    id: 'q2-e15s06',
    order: 2,
    text: 'What is 3 * 3?',
    options: ['9', '6', '12', '8'],
    correctAnswer: '9',
  }),
]

const timedQuiz = makeQuiz({
  id: 'quiz-e15s06-timed',
  lessonId: LESSON_ID,
  title: 'Timed Quiz E15S06',
  questions,
  timeLimit: 10,
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const untimedQuiz = makeQuiz({
  id: 'quiz-e15s06-untimed',
  lessonId: LESSON_ID,
  title: 'Untimed Quiz E15S06',
  questions,
  timeLimit: null,
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quiz: Record<string, unknown>,
  priorAttempts: Record<string, unknown>[] = [],
) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz])
  if (priorAttempts.length > 0) {
    await seedQuizAttempts(page, priorAttempts)
  }
  await page.goto(QUIZ_URL, { waitUntil: 'domcontentloaded' })
}

async function startOrRetakeQuiz(page: import('@playwright/test').Page) {
  // Label is "Retake Quiz" when prior attempts exist, "Start Quiz" otherwise
  const btn = page
    .getByRole('button', { name: /start quiz/i })
    .or(page.getByRole('button', { name: /retake quiz/i }))
  await btn.click()
}

async function answerQuestions(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: '4' }).click()
  await page.getByRole('button', { name: /next/i }).click()
  await page.getByRole('radio', { name: '9' }).click()
}

async function submitQuiz(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /submit quiz/i }).click()
  const confirmBtn = page.getByRole('button', { name: /submit anyway/i })
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click()
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterEach(async ({ page }) => {
  await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
  await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E15-S06: Time-to-Completion Tracking', () => {

  test.describe('AC2+AC3: Timed quiz shows time-to-completion on results', () => {
    test('displays formatted time on results after timed quiz', async ({ page }) => {
      // Fix Date.now() at T_START so startQuiz captures this as startTime
      await page.clock.setFixedTime(T_START)

      await navigateToQuiz(page, timedQuiz as unknown as Record<string, unknown>)
      await startOrRetakeQuiz(page)
      await answerQuestions(page)

      // Advance fixed time to T_8M32S so submitQuiz calculates timeSpent = 512000ms
      await page.clock.setFixedTime(T_8M32S)
      await submitQuiz(page)

      await page.waitForURL('**/quiz/results')

      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
    })
  })

  test.describe('AC4: Untimed quiz does NOT show time on results', () => {
    test('hides time display for untimed quiz results', async ({ page }) => {
      await page.clock.setFixedTime(T_START)

      await navigateToQuiz(page, untimedQuiz as unknown as Record<string, unknown>)
      await startOrRetakeQuiz(page)
      await answerQuestions(page)

      await page.clock.setFixedTime(new Date('2025-01-15T12:05:00.000Z'))
      await submitQuiz(page)

      await page.waitForURL('**/quiz/results')

      await expect(page.getByText(/Completed in/i)).not.toBeVisible()
    })
  })

  test.describe('AC5: Multi-attempt time comparison', () => {
    test('shows previous attempt time on second attempt results', async ({ page }) => {
      const priorAttempt = makeAttempt({
        id: 'prior-attempt-e15s06',
        quizId: timedQuiz.id,
        timeSpent: 615000, // 10m 15s
        percentage: 100,
        passed: true,
        completedAt: '2025-01-14T12:10:15.000Z',
        startedAt: '2025-01-14T12:00:00.000Z',
        timerAccommodation: 'standard',
      })

      await page.clock.setFixedTime(T_START)

      await navigateToQuiz(
        page,
        timedQuiz as unknown as Record<string, unknown>,
        [priorAttempt as unknown as Record<string, unknown>]
      )
      await startOrRetakeQuiz(page)
      await answerQuestions(page)

      await page.clock.setFixedTime(T_8M32S)
      await submitQuiz(page)

      await page.waitForURL('**/quiz/results')

      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
      await expect(page.getByText(/Previous: 10m 15s/)).toBeVisible()
    })

    test('does not show previous time on first attempt', async ({ page }) => {
      await page.clock.setFixedTime(T_START)
      await navigateToQuiz(page, timedQuiz as unknown as Record<string, unknown>)
      await startOrRetakeQuiz(page)
      await answerQuestions(page)

      await page.clock.setFixedTime(T_8M32S)
      await submitQuiz(page)

      await page.waitForURL('**/quiz/results')

      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
      await expect(page.getByText(/Previous:/)).not.toBeVisible()
    })
  })
})
