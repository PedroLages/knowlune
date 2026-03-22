/**
 * ATDD E2E tests for E12-S06: Calculate and Display Quiz Score
 *
 * Tests the quiz submission flow and results page:
 * - Submit quiz with all questions answered → score display
 * - Submit with unanswered questions → confirmation dialog
 * - Results page: score ring, pass/fail messaging, action buttons
 * - QFR23: no "Failed" word anywhere on results screen
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
// Note: quiz timing uses live Date.now() — no FIXED_DATE mocking needed

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e12s06'
const LESSON_ID = 'test-lesson-e12s06'

const q1 = makeQuestion({
  id: 'q1-capital',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-planet',
  order: 2,
  text: 'Which planet is closest to the sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctAnswer: 'Mercury',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-element',
  order: 3,
  text: 'What is the chemical symbol for water?',
  options: ['H2O', 'CO2', 'NaCl', 'O2'],
  correctAnswer: 'H2O',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e12s06',
  lessonId: LESSON_ID,
  title: 'Science Basics Quiz',
  description: 'A 3-question quiz for E12-S06 testing',
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

/** Navigate to quiz page with seeded data and sidebar closed */
async function navigateToQuiz(page: import('@playwright/test').Page) {
  // Close sidebar to prevent tablet overlay blocking
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
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

/** Start the quiz from the start screen */
async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E12-S06: Quiz Score Display', () => {
  test('AC1: submit quiz with all answered shows score page', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer all 3 questions correctly
    await answerQuestion(page, 'Paris')
    await clickNext(page)
    await answerQuestion(page, 'Mercury')
    await clickNext(page)
    await answerQuestion(page, 'H2O')

    // Submit
    await clickSubmit(page)

    // Should navigate to results page
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Score percentage should be visible (100%)
    await expect(
      page.locator('[data-testid="main-scroll-container"]').getByText('100%')
    ).toBeVisible()

    // "X of Y correct" subtitle (scoped to avoid matching sr-only aria-live region)
    await expect(page.locator('p').getByText(/3 of 3 correct/)).toBeVisible()

    // Pass message (tier redesign: EXCELLENT tier for 100%)
    await expect(page.getByText(/mastered this material/)).toBeVisible()
  })

  test('AC2: submit with unanswered shows confirmation dialog, Continue Reviewing returns', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer only the first question
    await answerQuestion(page, 'Paris')
    await clickNext(page)

    // Skip to last question without answering
    await clickNext(page)

    // Click submit without answering q3
    await clickSubmit(page)

    // AlertDialog should appear with unanswered count
    await expect(page.getByText(/unanswered question/i)).toBeVisible()

    // Click "Continue Reviewing" to go back
    await page.getByRole('button', { name: /continue reviewing/i }).click()

    // Should still be on quiz page (not results)
    await expect(page).not.toHaveURL(/\/quiz\/results/)
  })

  test('AC3: submit with unanswered, Submit Anyway goes to results', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer only first question correctly
    await answerQuestion(page, 'Paris')
    await clickNext(page)
    await clickNext(page) // skip q2

    // Submit on last question (unanswered)
    await clickSubmit(page)

    // AlertDialog appears
    await expect(page.getByText(/unanswered question/i)).toBeVisible()

    // Click "Submit Anyway"
    await page.getByRole('button', { name: /submit anyway/i }).click()

    // Should navigate to results
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Score should reflect 1 of 3 correct (scoped to avoid matching sr-only aria-live region)
    await expect(page.locator('p').getByText(/1 of 3 correct/)).toBeVisible()
  })

  test('AC4: results page shows Retake, Review Answers, and Back to Lesson', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer all correctly and submit
    await answerQuestion(page, 'Paris')
    await clickNext(page)
    await answerQuestion(page, 'Mercury')
    await clickNext(page)
    await answerQuestion(page, 'H2O')
    await clickSubmit(page)

    // Wait for results page
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Retake Quiz button (outline variant)
    await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible()

    // Review Answers button
    await expect(page.getByRole('button', { name: /review answers/i })).toBeVisible()

    // Back to Lesson link
    await expect(page.getByRole('link', { name: /back to lesson/i })).toBeVisible()
  })

  test('AC5: QFR23 — "Failed" never appears on results screen', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer all incorrectly to trigger not-pass state
    await answerQuestion(page, 'London') // wrong
    await clickNext(page)
    await answerQuestion(page, 'Venus') // wrong
    await clickNext(page)
    await answerQuestion(page, 'CO2') // wrong
    await clickSubmit(page)

    // Results page
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Score should show 0 of 3 (scoped to avoid matching sr-only aria-live region)
    await expect(page.locator('p').getByText(/0 of 3 correct/)).toBeVisible()

    // Should show encouraging not-pass message (tier redesign: NEEDS WORK tier)
    await expect(page.getByText(/Keep practicing/)).toBeVisible()

    // "Failed" MUST NOT appear anywhere on the page
    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.toLowerCase()).not.toContain('failed')
  })

  test('AC6: time spent displayed in human-readable format', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer quickly and submit
    await answerQuestion(page, 'Paris')
    await clickNext(page)
    await answerQuestion(page, 'Mercury')
    await clickNext(page)
    await answerQuestion(page, 'H2O')
    await clickSubmit(page)

    // Results page
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Time spent should be visible in valid formatDuration output (e.g. "8m 32s", "45s", "1m")
    await expect(
      page.getByText(/Completed in (\d+h\s?)?\d+m\s?\d+s|Completed in \d+s|Completed in \d+m/)
    ).toBeVisible()
  })

  test('AC4b: Retake Quiz navigates back to quiz start screen', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer and submit
    await answerQuestion(page, 'Paris')
    await clickNext(page)
    await answerQuestion(page, 'Mercury')
    await clickNext(page)
    await answerQuestion(page, 'H2O')
    await clickSubmit(page)

    await expect(page).toHaveURL(/\/quiz\/results/)

    // Click retake
    await page.getByRole('button', { name: /retake quiz/i }).click()

    // Should navigate back to quiz page (not results)
    await expect(page).toHaveURL(/\/quiz$/)

    // Should show quiz start screen or first question
    await expect(
      page.getByRole('button', { name: /start quiz/i }).or(page.getByText(q1.text))
    ).toBeVisible()
  })
})
