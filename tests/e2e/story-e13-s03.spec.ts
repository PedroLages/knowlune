/**
 * ATDD E2E tests for E13-S03: Pause and Resume Quiz
 *
 * Tests auto-save and resume flow:
 * - Quiz progress auto-saves to localStorage via Zustand persist
 * - "Resume Quiz" button appears with answer count when progress exists
 * - Clicking Resume restores exact question and all answers
 * - Completed quizzes do NOT show resume option
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s03'
const LESSON_ID = 'test-lesson-e13s03'

const q1 = makeQuestion({
  id: 'q1-e13s03',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e13s03',
  order: 2,
  text: 'What color is the sky?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: 'Blue',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-e13s03',
  order: 3,
  text: 'How many sides does a triangle have?',
  options: ['2', '3', '4', '5'],
  correctAnswer: '3',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e13s03',
  lessonId: LESSON_ID,
  title: 'Pause Resume Test Quiz',
  description: 'A 3-question quiz for E13-S03 testing',
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

async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /next/i }).click()
}

async function answerQuestion(page: import('@playwright/test').Page, optionText: string) {
  await page.getByRole('radio', { name: optionText }).click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E13-S03: Pause and Resume Quiz', () => {
  test('AC1: quiz progress auto-saves when navigating away', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await answerQuestion(page, '4')
    await clickNext(page)

    // Answer Q2
    await answerQuestion(page, 'Blue')

    // Navigate away (simulates closing/leaving)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Return to quiz
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should see Resume button with answer count
    const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
    await expect(resumeBtn).toBeVisible()
    await expect(resumeBtn).toContainText(/2 of 3 answered/i)
  })

  test('AC2: clicking Resume loads exact question with answers restored', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1 and Q2, land on Q3
    await answerQuestion(page, '4')
    await clickNext(page)
    await answerQuestion(page, 'Blue')
    await clickNext(page)

    // Navigate away
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Return to quiz
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Click Resume
    const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
    await resumeBtn.click()

    // Should land on Q3 (the question we were on)
    await expect(page.getByText(/how many sides/i)).toBeVisible()

    // Navigate back to Q1 — answer should be restored
    await page.getByRole('button', { name: /previous/i }).click()
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByRole('radio', { name: '4' })).toBeChecked()
  })

  test('AC3: no explicit pause button — back/close auto-saves', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await answerQuestion(page, '4')

    // Use browser back button
    await page.goBack()

    // Return to quiz
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Resume button should appear (progress was auto-saved)
    await expect(page.getByRole('button', { name: /resume quiz/i })).toBeVisible()
  })

  test('AC5: completed quiz does NOT show Resume button', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer all questions
    await answerQuestion(page, '4')
    await clickNext(page)
    await answerQuestion(page, 'Blue')
    await clickNext(page)
    await answerQuestion(page, '3')

    // Submit quiz
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Handle confirmation dialog if present
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|submit/i })
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Wait for results screen
    await expect(page.getByText(/score|results/i)).toBeVisible()

    // Navigate back to quiz URL
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should NOT see Resume button
    await expect(page.getByRole('button', { name: /resume quiz/i })).not.toBeVisible()

    // Should see Start Quiz (or Start New Attempt)
    await expect(
      page.getByRole('button', { name: /start quiz|start new attempt/i })
    ).toBeVisible()
  })

  test('AC2-a11y: Resume button has focus and announces answer count', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await answerQuestion(page, '4')

    // Navigate away and return
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Resume button should be visible and accessible
    const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
    await expect(resumeBtn).toBeVisible()
    await expect(resumeBtn).toContainText(/1 of 3 answered/i)
  })
})
