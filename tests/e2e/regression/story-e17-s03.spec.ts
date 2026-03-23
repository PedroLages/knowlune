/**
 * ATDD E2E tests for E17-S03: Calculate Item Difficulty (P-Values)
 *
 * AC1: Questions ranked by difficulty (easiest to hardest) visible in quiz analytics
 * AC3: Difficulty labels (Easy/Medium/Difficult) visible per question
 * AC4: Questions with zero attempts excluded from difficulty list
 * AC5: Suggestion text for Difficult questions
 * AC6: QuizResults redirects when no quiz data present in store
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../../support/fixtures/factories/quiz-factory'
import {
  seedQuizzes,
  seedQuizAttempts,
  clearIndexedDBStore,
} from '../../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e17s03'
const LESSON_ID = 'test-lesson-e17s03'
const QUIZ_ID = 'quiz-e17s03'

const q1 = makeQuestion({
  id: 'q1-e17s03',
  order: 1,
  text: 'What is 2 + 2?',
  topic: 'Math',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e17s03',
  order: 2,
  text: 'What is the powerhouse of the cell?',
  topic: 'Biology',
  options: ['Nucleus', 'Mitochondria', 'Golgi', 'Ribosome'],
  correctAnswer: 'Mitochondria',
  points: 1,
})

// q3 is never answered in any attempt — AC4 verifies it is excluded from the difficulty list
const q3 = makeQuestion({
  id: 'q3-e17s03',
  order: 3,
  text: 'What is the boiling point of water?',
  topic: 'Chemistry',
  options: ['90°C', '100°C', '110°C', '120°C'],
  correctAnswer: '100°C',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Mixed Knowledge Quiz',
  questions: [q1, q2, q3],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// 3 attempts:
// q1 correct in all 3 (P = 1.0 → Easy)
// q2 correct in 1 of 3 (P = 0.33 → Difficult)
const attempt1 = makeAttempt({
  id: 'attempt1-e17s03',
  quizId: QUIZ_ID,
  score: 2,
  percentage: 100,
  passed: true,
  completedAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Mitochondria', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
  ],
})

const attempt2 = makeAttempt({
  id: 'attempt2-e17s03',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 50,
  passed: false,
  completedAt: '2026-01-02T10:00:00.000Z',
  startedAt: '2026-01-02T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Nucleus', isCorrect: false, pointsEarned: 0, pointsPossible: 1 },
  ],
})

const attempt3 = makeAttempt({
  id: 'attempt3-e17s03',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 50,
  passed: false,
  completedAt: '2026-01-03T10:00:00.000Z',
  startedAt: '2026-01-03T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Nucleus', isCorrect: false, pointsEarned: 0, pointsPossible: 1 },
  ],
})

// Most recent attempt first (Zustand sort order)
const allAttempts = [attempt3, attempt2, attempt1]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function navigateToResults(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz] as Record<string, unknown>[])
  await seedQuizAttempts(page, allAttempts as Record<string, unknown>[])

  // Inject Zustand quiz store state — key MUST match persist({ name: '...' }) in useQuizStore
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
    { q: quiz, attempts: allAttempts }
  )

  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E17-S03: Item Difficulty Analysis', () => {
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })

  test('AC1: shows Question Difficulty Analysis section', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText('Question Difficulty Analysis')).toBeVisible()
  })

  test('AC3: shows Easy badge for q1 (P=1.0, 3/3 correct)', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText('What is 2 + 2?')).toBeVisible()
    await expect(page.getByText(/Easy \(100%\)/)).toBeVisible()
  })

  test('AC3: shows Difficult badge for q2 (P=0.33, 1/3 correct)', async ({ page }) => {
    await navigateToResults(page)
    // Scope to the difficulty analysis section to avoid collision with AreasForGrowth
    const section = page.getByLabel('Questions ranked by difficulty')
    await expect(section.getByText('What is the powerhouse of the cell?')).toBeVisible()
    await expect(page.getByText(/Difficult \(33%\)/)).toBeVisible()
  })

  test('AC4: excludes q3 which has zero attempts from the difficulty list', async ({ page }) => {
    await navigateToResults(page)
    const section = page.getByLabel('Questions ranked by difficulty')
    // q3 was never answered in any attempt — it must not appear in the difficulty section
    await expect(section.getByText('What is the boiling point of water?')).not.toBeVisible()
  })

  test('AC5: shows suggestion text for Difficult questions', async ({ page }) => {
    await navigateToResults(page)
    // Suggestion text includes Biology topic — more specific than generic "Review question"
    await expect(page.getByText(/Review question 2 on Biology/i)).toBeVisible()
  })

  test('AC6: redirects to quiz when no quiz data in store', async ({ page }) => {
    // Navigate directly without seeding any Zustand quiz store state
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Explicitly set empty quiz store — no currentQuiz
      localStorage.setItem(
        'levelup-quiz-store',
        JSON.stringify({
          state: {
            currentQuiz: null,
            attempts: [],
            isLoading: false,
            currentAttempt: null,
            progress: null,
          },
          version: 0,
        })
      )
    })
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
      waitUntil: 'domcontentloaded',
    })
    // Should redirect back to the quiz page — not remain on /results
    await expect(page).not.toHaveURL(/\/results$/)
    await expect(page).toHaveURL(new RegExp(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`))
  })
})
