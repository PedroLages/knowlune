/**
 * ATDD E2E tests for E16-S05: Display Score Improvement Trajectory Chart
 *
 * Tests the trajectory chart appearing on the QuizResults page:
 * - AC1: Chart appears when 2+ attempts exist
 * - AC2: Passing score reference line is labeled correctly
 * - AC3: Chart is hidden with only 1 attempt
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s05'
const LESSON_ID = 'test-lesson-e16s05'
const QUIZ_ID = 'quiz-e16s05'

const q1 = makeQuestion({
  id: 'q1-e16s05',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Math Basics',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// Two attempts: first at 60% (below passing), second at 100% (above passing)
const attempt1 = makeAttempt({
  id: 'attempt1-e16s05',
  quizId: QUIZ_ID,
  score: 0,
  percentage: 60,
  passed: false,
  answers: [{ questionId: q1.id, userAnswer: '3', isCorrect: false, pointsEarned: 0, pointsPossible: 1 }],
})

const attempt2 = makeAttempt({
  id: 'attempt2-e16s05',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 100,
  passed: true,
  answers: [{ questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 }],
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedData(
  page: import('@playwright/test').Page,
  quizzes: unknown[],
  attempts: unknown[]
) {
  await page.evaluate(
    async ({ quizData, attemptData, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (
              !db.objectStoreNames.contains('quizzes') ||
              !db.objectStoreNames.contains('quizAttempts')
            ) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(['quizzes', 'quizAttempts'], 'readwrite')
            for (const item of quizData) tx.objectStore('quizzes').put(item)
            for (const item of attemptData) tx.objectStore('quizAttempts').put(item)
            tx.oncomplete = () => { db.close(); resolve('ok') }
            tx.onerror = () => { db.close(); reject(tx.error) }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error('Required stores not found after retries')
    },
    { quizData: quizzes, attemptData: attempts, maxRetries: 10, retryDelay: 200 }
  )
}

async function navigateToResults(
  page: import('@playwright/test').Page,
  attemptsForStore: unknown[]
) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedData(page, [quiz], attemptsForStore)
  // Inject Zustand quiz store state so QuizResults doesn't redirect.
  // Key must match the `name` in useQuizStore's persist({ name: 'levelup-quiz-store' })
  await page.evaluate(
    ({ q, attempts }) => {
      localStorage.setItem(
        'levelup-quiz-store',
        JSON.stringify({
          state: {
            currentQuiz: { ...q },
            attempts: attempts,
            isLoading: false,
            currentAttempt: null,
            progress: null,
          },
          version: 0,
        })
      )
    },
    { q: quiz, attempts: attemptsForStore }
  )
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E16-S05: Score Trajectory Chart', () => {
  test('AC1: chart appears after 2+ attempts', async ({ page }) => {
    await navigateToResults(page, [attempt1, attempt2])
    await expect(page.getByText('Score Trajectory')).toBeVisible()
  })

  test('AC2: passing score reference line is labeled correctly', async ({ page }) => {
    await navigateToResults(page, [attempt1, attempt2])
    // Label "Passing: 70%" appears in the recharts SVG text element inside the chart section
    await expect(page.locator('[aria-label="Score trajectory chart"]').getByText(/Passing: 70%/i)).toBeVisible()
  })

  test('AC3: chart is hidden with only 1 attempt', async ({ page }) => {
    await navigateToResults(page, [attempt2])
    // Chart heading should NOT be visible with only 1 attempt
    await expect(page.getByText('Score Trajectory')).not.toBeVisible()
  })
})
