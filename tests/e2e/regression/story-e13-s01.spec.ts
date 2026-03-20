/**
 * ATDD E2E tests for E13-S01: Navigate Between Questions
 *
 * Tests navigation via Previous/Next buttons and the question grid bubbles:
 * - AC1/2: Previous/Next navigation and disabled state
 * - AC3: Submit Quiz appears on last question
 * - AC4: Click question bubble to jump directly to that question
 * - Answer persistence: navigate away and back preserves selected answer
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s01'
const LESSON_ID = 'test-lesson-e13s01'

const q1 = makeQuestion({
  id: 'q1-e13s01',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e13s01',
  order: 2,
  text: 'Which planet is closest to the sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctAnswer: 'Mercury',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-e13s01',
  order: 3,
  text: 'What is the chemical symbol for water?',
  options: ['H2O', 'CO2', 'NaCl', 'O2'],
  correctAnswer: 'H2O',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e13s01',
  lessonId: LESSON_ID,
  title: 'E13-S01 Navigation Quiz',
  description: 'A 3-question quiz for E13-S01 testing',
  questions: [q1, q2, q3],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function navigateToQuiz(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page, [quiz])
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

test.describe('E13-S01: Navigate Between Questions', () => {
  test('AC1/2: Next advances to Q2; Previous returns to Q1 and is disabled on Q1', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Q1: question counter shows "Question 1 of 3"
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible()

    // Previous is disabled on Q1
    const prevBtn = page.getByRole('button', { name: /previous/i })
    await expect(prevBtn).toBeDisabled()

    // Click Next → advances to Q2
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 2 of 3/i)).toBeVisible()

    // Click Previous → returns to Q1
    await prevBtn.click()
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible()
    await expect(prevBtn).toBeDisabled()
  })

  test('AC3: On last question Next is hidden, Submit Quiz is shown', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to Q3
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()

    // Next button should be gone, Submit Quiz visible
    await expect(page.getByRole('button', { name: /next/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /submit quiz/i })).toBeVisible()

    // Previous is still enabled
    await expect(page.getByRole('button', { name: /previous/i })).toBeEnabled()
  })

  test('AC4: Click question bubble 3 jumps from Q1 to Q3', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Currently on Q1
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible()

    // Click bubble for Q3
    await page.getByRole('button', { name: 'Question 3' }).click()

    // Should jump to Q3
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()

    // Bubble 3 has aria-current="true"
    await expect(page.getByRole('button', { name: 'Question 3' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  test('AC4: Answered bubble shows answered state after answering', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await page.getByRole('radio', { name: 'Paris' }).click()

    // Navigate to Q2 via Next
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 2 of 3/i)).toBeVisible()

    // Q1 bubble should now have aria-current undefined and answered styling
    const q1Bubble = page.getByRole('button', { name: 'Question 1' })
    await expect(q1Bubble).not.toHaveAttribute('aria-current')
    // The answered state uses bg-brand-soft — verify via class presence
    await expect(q1Bubble).toHaveClass(/bg-brand-soft/)
  })

  test('Answer persistence: answer on Q1, navigate to Q2, navigate back — answer still selected', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await page.getByRole('radio', { name: 'Paris' }).click()

    // Navigate to Q2
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 2 of 3/i)).toBeVisible()

    // Navigate back to Q1
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible()

    // Paris should still be selected
    await expect(page.getByRole('radio', { name: 'Paris' })).toBeChecked()
  })
})
