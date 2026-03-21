/**
 * ATDD E2E tests for E13-S05: Randomize Question Order with Fisher-Yates Shuffle
 *
 * Tests quiz question randomization behavior:
 * - Shuffle enabled → questions appear in random order
 * - Retake → different order on each attempt
 * - Shuffle disabled → original order preserved
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data — 5 questions to make randomization observable
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s05'
const LESSON_ID = 'test-lesson-e13s05'

const questions = Array.from({ length: 5 }, (_, i) =>
  makeQuestion({
    id: `q${i + 1}-e13s05`,
    order: i + 1,
    text: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    points: 1,
  })
)

const shuffledQuiz = makeQuiz({
  id: 'quiz-e13s05-shuffle',
  lessonId: LESSON_ID,
  title: 'Shuffle Test Quiz',
  description: 'A 5-question quiz for E13-S05 shuffle testing',
  questions,
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: true,
  shuffleAnswers: false,
})

const unshuffledQuiz = makeQuiz({
  id: 'quiz-e13s05-noshuffle',
  lessonId: 'test-lesson-e13s05-noshuffle',
  title: 'No Shuffle Test Quiz',
  description: 'A 5-question quiz with shuffle disabled',
  questions,
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
      throw new Error('quizzes store not found after retries')
    },
    { data: quizData, maxRetries: 10, retryDelay: 200 }
  )
}

/** Read the current question text displayed on the quiz page */
async function getCurrentQuestionText(page: import('@playwright/test').Page): Promise<string> {
  const heading = page.locator('[data-testid="question-text"]')
  return heading.textContent() as Promise<string>
}

/** Collect the order of all questions by navigating through them */
async function collectQuestionOrder(page: import('@playwright/test').Page, count: number): Promise<string[]> {
  const order: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await getCurrentQuestionText(page)
    order.push(text)
    if (i < count - 1) {
      await page.getByRole('button', { name: /next/i }).click()
    }
  }
  return order
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E13-S05: Randomize Question Order', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed for tablet viewports
    await page.evaluate(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC1: shuffle enabled → questions appear in randomized order', async ({ page }) => {
    await page.goto('/')
    await seedQuizData(page, [shuffledQuiz])

    await page.goto(`/courses/${COURSE_ID}/${LESSON_ID}`)

    // Start the quiz
    await page.getByRole('button', { name: /start quiz/i }).click()

    const order = await collectQuestionOrder(page, 5)
    const originalOrder = questions.map(q => q.text)

    // With 5 questions, probability of getting original order by chance is 1/120 (0.83%)
    // This is an acceptable flakiness rate for verifying randomization
    expect(order).not.toEqual(originalOrder)
  })

  test('AC2: retake quiz → different order on each attempt', async ({ page }) => {
    await page.goto('/')
    await seedQuizData(page, [shuffledQuiz])

    await page.goto(`/courses/${COURSE_ID}/${LESSON_ID}`)

    // First attempt
    await page.getByRole('button', { name: /start quiz/i }).click()
    const firstOrder = await collectQuestionOrder(page, 5)

    // Answer all and submit to complete first attempt
    for (let i = 0; i < 5; i++) {
      await page.getByRole('radio', { name: 'A' }).first().click()
      if (i < 4) await page.getByRole('button', { name: /next/i }).click()
    }
    await page.getByRole('button', { name: /submit/i }).click()

    // Retake
    await page.getByRole('button', { name: /retake/i }).click()
    const secondOrder = await collectQuestionOrder(page, 5)

    // Two independent shuffles of 5 items — probability of same order is 1/120
    expect(secondOrder).not.toEqual(firstOrder)
  })

  test('AC3: shuffle disabled → original order preserved', async ({ page }) => {
    await page.goto('/')
    await seedQuizData(page, [unshuffledQuiz])

    await page.goto(`/courses/${COURSE_ID}/test-lesson-e13s05-noshuffle`)

    await page.getByRole('button', { name: /start quiz/i }).click()

    const order = await collectQuestionOrder(page, 5)
    const originalOrder = questions.map(q => q.text)

    expect(order).toEqual(originalOrder)
  })
})
