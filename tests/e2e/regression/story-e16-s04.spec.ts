/**
 * ATDD E2E tests for E16-S04: Calculate Normalized Gain (Hake's Formula)
 *
 * Tests that normalized gain is computed and displayed on the quiz results page:
 * - AC1: Two attempts → normalized gain displayed
 * - AC2: One attempt only → normalized gain NOT displayed
 * - AC2 (5.2): High initial score → correct percentage shown
 * - AC2 (5.3): Score regression → encouraging message shown (not red)
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s04'
const LESSON_ID = 'test-lesson-e16s04'

const q1 = makeQuestion({
  id: 'q1-e16s04',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e16s04',
  lessonId: LESSON_ID,
  title: 'Normalized Gain Test Quiz',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
})

// Dates: attempt 1 = first (older), attempt 2 = second (newer)
const ATTEMPT_1_DATE = FIXED_DATE
const ATTEMPT_2_DATE = getRelativeDate(1)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed data into an IndexedDB store via page.evaluate */
async function seedIDBStore(
  page: import('@playwright/test').Page,
  storeName: string,
  data: unknown[]
) {
  await page.evaluate(
    async ({ storeName, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(storeName)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
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
      throw new Error(`Store "${storeName}" not found after retries`)
    },
    { storeName, data, maxRetries: 10, retryDelay: 200 }
  )
}

/** Navigate to the results page with seeded quiz + attempts in IDB */
async function setupResultsPage(page: import('@playwright/test').Page, attempts: unknown[]) {
  // Close sidebar and seed Zustand currentQuiz via localStorage before navigation
  await page.addInitScript(
    ({ quizData }) => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
      localStorage.setItem(
        'levelup-quiz-store',
        JSON.stringify({ state: { currentQuiz: quizData, currentProgress: null }, version: 0 })
      )
    },
    { quizData: quiz }
  )

  // Navigate to app root first so Dexie initializes the DB schema
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz and attempts into IndexedDB
  await seedIDBStore(page, 'quizzes', [quiz])
  await seedIDBStore(page, 'quizAttempts', attempts)

  // Navigate directly to the results page
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("E16-S04: Normalized Gain (Hake's Formula)", () => {
  test('AC1 + 5.1: two attempts show normalized gain section', async ({ page }) => {
    const attempt1 = makeAttempt({
      id: 'attempt1-e16s04',
      quizId: quiz.id,
      percentage: 60,
      score: 3,
      passed: false,
      completedAt: ATTEMPT_1_DATE,
      startedAt: ATTEMPT_1_DATE,
    })

    const attempt2 = makeAttempt({
      id: 'attempt2-e16s04',
      quizId: quiz.id,
      percentage: 80,
      score: 4,
      passed: true,
      completedAt: ATTEMPT_2_DATE,
      startedAt: ATTEMPT_2_DATE,
    })

    await setupResultsPage(page, [attempt1, attempt2])

    // Normalized gain section should be visible
    const gainSection = page.locator('[data-testid="normalized-gain"]')
    await expect(gainSection).toBeVisible()

    // (80 - 60) / (100 - 60) = 20/40 = 0.5 → 50% medium gain
    await expect(gainSection).toContainText('50%')
    await expect(gainSection).toContainText('Good learning progress!')
  })

  test('AC4 + 5.1 (one attempt): normalized gain NOT displayed', async ({ page }) => {
    const singleAttempt = makeAttempt({
      id: 'attempt1-only-e16s04',
      quizId: quiz.id,
      percentage: 80,
      score: 4,
      passed: true,
      completedAt: ATTEMPT_1_DATE,
      startedAt: ATTEMPT_1_DATE,
    })

    await setupResultsPage(page, [singleAttempt])

    // Normalized gain section must NOT be present
    await expect(page.locator('[data-testid="normalized-gain"]')).not.toBeVisible()
  })

  test('AC3 + 5.2: high initial score → small improvement shows large normalized gain', async ({
    page,
  }) => {
    // initial=95, final=97 → (97-95)/(100-95) = 2/5 = 0.4 → 40% medium
    const attempt1 = makeAttempt({
      id: 'attempt1-high-e16s04',
      quizId: quiz.id,
      percentage: 95,
      score: 9,
      passed: true,
      completedAt: ATTEMPT_1_DATE,
      startedAt: ATTEMPT_1_DATE,
    })

    const attempt2 = makeAttempt({
      id: 'attempt2-high-e16s04',
      quizId: quiz.id,
      percentage: 97,
      score: 10,
      passed: true,
      completedAt: ATTEMPT_2_DATE,
      startedAt: ATTEMPT_2_DATE,
    })

    await setupResultsPage(page, [attempt1, attempt2])

    const gainSection = page.locator('[data-testid="normalized-gain"]')
    await expect(gainSection).toBeVisible()
    // 40% gain shown
    await expect(gainSection).toContainText('40%')
    // Medium gain tier — message confirms formula-to-display round-trip
    await expect(gainSection).toContainText('Good learning progress!')
  })

  test('5.3: score regression shows encouraging message (not destructive color)', async ({
    page,
  }) => {
    // initial=80, final=50 → regression
    const attempt1 = makeAttempt({
      id: 'attempt1-regress-e16s04',
      quizId: quiz.id,
      percentage: 80,
      score: 8,
      passed: true,
      completedAt: ATTEMPT_1_DATE,
      startedAt: ATTEMPT_1_DATE,
    })

    const attempt2 = makeAttempt({
      id: 'attempt2-regress-e16s04',
      quizId: quiz.id,
      percentage: 50,
      score: 5,
      passed: false,
      completedAt: ATTEMPT_2_DATE,
      startedAt: ATTEMPT_2_DATE,
    })

    await setupResultsPage(page, [attempt1, attempt2])

    const gainSection = page.locator('[data-testid="normalized-gain"]')
    await expect(gainSection).toBeVisible()

    // Encouraging regression message displayed
    await expect(gainSection).toContainText('Score decreased')
    await expect(gainSection).toContainText('review the material')

    // Must NOT use destructive/red color — uses text-muted-foreground (neutral)
    // Verify the percentage span doesn't have text-destructive class
    const percentageSpan = gainSection.locator('[data-testid="normalized-gain-value"]')
    await expect(percentageSpan).not.toHaveClass(/text-destructive/)
  })
})
