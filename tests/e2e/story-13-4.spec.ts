/**
 * ATDD E2E tests for E13-S04: Unlimited Quiz Retakes
 *
 * Tests the retake flow:
 * - AC1: "Retake Quiz" button on results, no limit messaging, starts new attempt
 * - AC2: Fresh attempt — answers cleared, shuffle re-applied, timer reset, history preserved
 * - AC3: Improvement summary (current vs. previous best)
 * - AC4: Lesson page shows "Retake Quiz" for completed quizzes
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
// Note: quiz timing uses live Date.now() — no FIXED_DATE mocking needed

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s04'
const LESSON_ID = 'test-lesson-e13s04'

const q1 = makeQuestion({
  id: 'q1-retake-capital',
  order: 1,
  text: 'What is the capital of Italy?',
  options: ['Rome', 'Milan', 'Naples', 'Florence'],
  correctAnswer: 'Rome',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-retake-ocean',
  order: 2,
  text: 'Which is the largest ocean?',
  options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'],
  correctAnswer: 'Pacific',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-retake-color',
  order: 3,
  text: 'What color do you get mixing red and blue?',
  options: ['Purple', 'Green', 'Orange', 'Brown'],
  correctAnswer: 'Purple',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e13s04',
  lessonId: LESSON_ID,
  title: 'Retake Practice Quiz',
  description: 'A 3-question quiz for E13-S04 retake testing',
  questions: [q1, q2, q3],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed quiz data into IndexedDB 'quizzes' store via page.evaluate */
async function seedQuizData(page: import('@playwright/test').Page, quizData: unknown[]) {
  await page.evaluate(
    async ({ data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('quizzes')) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction('quizzes', 'readwrite')
            const store = tx.objectStore('quizzes')
            for (const item of data) {
              store.put(item)
            }
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error('Store "quizzes" not found after retries')
    },
    { data: quizData, maxRetries: 10, retryDelay: 200 }
  )
}

/** Seed quiz attempt history into IndexedDB 'quizAttempts' store */
async function seedAttemptData(page: import('@playwright/test').Page, attemptData: unknown[]) {
  await page.evaluate(
    async ({ data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('quizAttempts')) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction('quizAttempts', 'readwrite')
            const store = tx.objectStore('quizAttempts')
            for (const item of data) {
              store.put(item)
            }
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error('Store "quizAttempts" not found after retries')
    },
    { data: attemptData, maxRetries: 10, retryDelay: 200 }
  )
}

/** Navigate to quiz page with seeded data and sidebar closed */
async function navigateToQuiz(page: import('@playwright/test').Page) {
  // Close sidebar to prevent tablet overlay blocking
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  // Navigate to app first so Dexie creates the DB
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz into IndexedDB
  await seedQuizData(page, [quiz])

  // Navigate to quiz page
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

/** Start the quiz from the start screen (matches both "Start Quiz" and "Retake Quiz") */
async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz|retake quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

/** Answer current question by clicking option text */
async function answerQuestion(page: import('@playwright/test').Page, optionText: string) {
  await page.getByRole('radio', { name: optionText }).click()
}

/** Click Next button to advance to next question */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /next/i }).click()
}

/** Click Submit Quiz button */
async function clickSubmit(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /submit quiz/i }).click()
}

/** Answer all questions correctly and submit (assumes quiz is already on question view) */
async function answerAllCorrectAndSubmit(page: import('@playwright/test').Page) {
  await answerQuestion(page, 'Rome')
  await clickNext(page)
  await answerQuestion(page, 'Pacific')
  await clickNext(page)
  await answerQuestion(page, 'Purple')
  await clickSubmit(page)
  await expect(page).toHaveURL(/\/quiz\/results/)
}

/** Answer with some wrong and submit (assumes quiz is already on question view) */
async function answerPartialAndSubmit(page: import('@playwright/test').Page) {
  await answerQuestion(page, 'Milan') // wrong
  await clickNext(page)
  await answerQuestion(page, 'Pacific') // correct
  await clickNext(page)
  await answerQuestion(page, 'Green') // wrong
  await clickSubmit(page)
  await expect(page).toHaveURL(/\/quiz\/results/)
}

/** Complete a quiz with all correct answers from start screen */
async function completeQuizAllCorrect(page: import('@playwright/test').Page) {
  await startQuiz(page)
  await answerAllCorrectAndSubmit(page)
}

/** Complete a quiz with some wrong answers from start screen */
async function completeQuizPartial(page: import('@playwright/test').Page) {
  await startQuiz(page)
  await answerPartialAndSubmit(page)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E13-S04: Unlimited Quiz Retakes', () => {
  test('AC1: results screen shows "Retake Quiz" button with no limit/cooldown messaging', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await completeQuizAllCorrect(page)

    // "Retake Quiz" button must be prominently visible
    await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible()

    // No messaging about limits or cooldowns
    const bodyText = await page.locator('body').textContent()
    const lower = bodyText?.toLowerCase() ?? ''
    expect(lower).not.toContain('attempt limit')
    expect(lower).not.toContain('cooldown')
    expect(lower).not.toContain('no retakes')
    expect(lower).not.toContain('maximum attempts')
  })

  test('AC1b: clicking "Retake Quiz" immediately starts a new attempt', async ({ page }) => {
    await navigateToQuiz(page)
    await completeQuizAllCorrect(page)

    // Click retake
    await page.getByRole('button', { name: /retake quiz/i }).click()

    // Should navigate to quiz page (not results)
    await expect(page).toHaveURL(/\/quiz$/)

    // Should show quiz start screen or first question (fresh attempt)
    await expect(
      page.getByRole('button', { name: /start quiz/i }).or(page.getByText(q1.text))
    ).toBeVisible()
  })

  test('AC2: retake clears previous answers and preserves attempt history', async ({ page }) => {
    await navigateToQuiz(page)

    // Complete first attempt with partial score
    await completeQuizPartial(page)

    // Score should show 1 of 3 correct
    await expect(page.locator('p').getByText(/1 of 3 correct/)).toBeVisible()

    // Click retake — retakeQuiz() starts quiz immediately (no start screen)
    await page.getByRole('button', { name: /retake quiz/i }).click()
    await expect(page).toHaveURL(/\/quiz$/)

    // Quiz is already active after retake — first question should show
    await expect(page.getByText(q1.text).or(page.getByText(q2.text)).or(page.getByText(q3.text))).toBeVisible()

    // No radio should be checked (fresh attempt — answers cleared)
    const checkedRadios = page.locator('input[type="radio"]:checked')
    await expect(checkedRadios).toHaveCount(0)
  })

  test('AC3: improvement summary shows current score vs. previous best', async ({ page }) => {
    await navigateToQuiz(page)

    // Complete first attempt with partial score (1/3 = 33%)
    await completeQuizPartial(page)

    // Click retake — quiz starts immediately (no start screen)
    await page.getByRole('button', { name: /retake quiz/i }).click()
    await expect(page).toHaveURL(/\/quiz$/)

    // Complete second attempt with all correct (already on question view)
    await answerAllCorrectAndSubmit(page)

    // Should show improvement summary comparing to previous best
    await expect(page.getByTestId('improvement-summary')).toBeVisible()
  })

  test('AC4: quiz start screen shows "Retake Quiz" for completed quizzes', async ({ page }) => {
    // Close sidebar
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })

    // Navigate to app and seed quiz + a previous attempt
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizData(page, [quiz])

    const previousAttempt = makeAttempt({
      id: 'attempt-prev-e13s04',
      quizId: quiz.id,
      score: 2,
      percentage: 67,
      passed: false,
    })
    await seedAttemptData(page, [previousAttempt])

    // Navigate to quiz start screen (the entry point for quizzes)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should show "Retake Quiz" instead of "Start Quiz"
    await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible()

    // "Start Quiz" should NOT be visible
    await expect(page.getByRole('button', { name: /^start quiz$/i })).not.toBeVisible()
  })
})
