/**
 * ATDD E2E tests for E16-S01: Review All Questions and Answers After Completion
 *
 * Tests the quiz review page (/quiz/review/:attemptId):
 * - Navigate to review from results page
 * - Questions display with feedback panel
 * - Navigate through questions (Previous/Next)
 * - Back to Results navigation
 * - Invalid attempt ID shows error state
 */
import { test, expect } from '../support/fixtures'
import {
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../support/fixtures/factories/quiz-factory'
import type { Quiz } from '../../src/types/quiz'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s01'
const LESSON_ID = 'test-lesson-e16s01'
const QUIZ_ID = 'quiz-e16s01'
const ATTEMPT_ID = 'attempt-e16s01'

const q1 = makeQuestion({
  id: 'q1-e16',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris is the capital and largest city of France.',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e16',
  order: 2,
  text: 'Which planet is closest to the sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctAnswer: 'Mercury',
  explanation: 'Mercury is the closest planet to the sun.',
  points: 1,
})

const quiz: Quiz = {
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'E16-S01 Review Quiz',
  description: 'A test quiz for E16-S01',
  questions: [q1, q2],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: null,
  createdAt: '2026-03-22T00:00:00Z',
  updatedAt: '2026-03-22T00:00:00Z',
}

const attempt = makeAttempt({
  id: ATTEMPT_ID,
  quizId: QUIZ_ID,
  answers: [
    makeCorrectAnswer('q1-e16', { userAnswer: 'Paris', pointsPossible: 1 }),
    makeWrongAnswer('q2-e16', { userAnswer: 'Venus', pointsPossible: 1 }),
  ],
  score: 1,
  percentage: 50,
  passed: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedStore(
  page: import('@playwright/test').Page,
  storeName: string,
  data: unknown[]
) {
  await page.evaluate(
    async ({ storeName, data, maxRetries, retryDelay }) => {
      for (let i = 0; i < maxRetries; i++) {
        const result = await new Promise<'ok' | 'missing'>((resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(storeName)) {
              db.close()
              resolve('missing')
              return
            }
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            for (const item of data) store.put(item)
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          req.onerror = () => reject(req.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "${storeName}" not found after retries`)
    },
    { storeName, data, maxRetries: 10, retryDelay: 200 }
  )
}

async function setupReviewPage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  // Navigate to app so Dexie initializes
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedStore(page, 'quizzes', [quiz])
  await seedStore(page, 'quizAttempts', [attempt])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E16-S01: Quiz Review Page', () => {
  test('AC1: navigate directly to review URL shows questions', async ({ page }) => {
    await setupReviewPage(page)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/review/${ATTEMPT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByText('E16-S01 Review Quiz — Review')).toBeVisible()
    await expect(page.getByTestId('question-text').first()).toContainText(
      'What is the capital of France?'
    )
    await expect(page.getByText('Question 1 of 2')).toBeVisible()
  })

  test('AC2: feedback panel (AnswerFeedback) is visible for question', async ({ page }) => {
    await setupReviewPage(page)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/review/${ATTEMPT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByTestId('answer-feedback')).toBeVisible()
    // Q1 was answered correctly
    await expect(page.getByText(/Correct!/i)).toBeVisible()
    // Explanation should be shown
    await expect(page.getByText(/Paris is the capital/i)).toBeVisible()
  })

  test('AC3: Next navigates to question 2, Previous returns to question 1', async ({ page }) => {
    await setupReviewPage(page)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/review/${ATTEMPT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByText('Question 1 of 2')).toBeVisible()

    // Next → Q2
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText('Question 2 of 2')).toBeVisible()
    await expect(page.getByTestId('question-text').first()).toContainText('Which planet is closest')

    // Previous → Q1
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByText('Question 1 of 2')).toBeVisible()
  })

  test('AC4: last question shows "Back to Results" button that navigates to results', async ({
    page,
  }) => {
    await setupReviewPage(page)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/review/${ATTEMPT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    // Go to last question
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText('Question 2 of 2')).toBeVisible()

    // "Back to Results" button replaces Next
    const backBtn = page.getByRole('button', { name: /back to results/i })
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    await expect(page).toHaveURL(
      new RegExp(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`)
    )
  })

  test('AC5: invalid attempt ID shows error state', async ({ page }) => {
    await setupReviewPage(page)
    await page.goto(
      `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/review/invalid-nonexistent-id`,
      { waitUntil: 'domcontentloaded' }
    )

    await expect(page.getByText(/Quiz attempt not found/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to Quiz/i })).toBeVisible()
  })
})
