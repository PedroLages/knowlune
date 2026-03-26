/**
 * ATDD E2E tests for E17-S04: Calculate Discrimination Indices
 *
 * AC1: 5+ attempts → discrimination analysis section visible with rpb values
 * AC2: < 5 attempts → "Need at least 5 attempts" message shown
 * AC3: High discrimination question shows "High discriminator" text
 * AC4: Moderate discrimination question shows "Moderate discriminator" text
 * AC5: Low discrimination question shows "Low discriminator" text
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

const COURSE_ID = 'test-course-e17s04'
const LESSON_ID = 'test-lesson-e17s04'
const QUIZ_ID = 'quiz-e17s04'

const q1 = makeQuestion({
  id: 'q1-e17s04',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Discrimination Test Quiz',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// 5 attempts: q1 correct in last 3 (high scorers), wrong in first 2 (low scorers)
// This yields high discrimination (rpb ≈ 0.894 > 0.3)
const fiveAttempts = [
  makeAttempt({
    id: 'att1-e17s04',
    quizId: QUIZ_ID,
    score: 0,
    percentage: 0,
    passed: false,
    completedAt: '2026-01-01T10:00:00.000Z',
    startedAt: '2026-01-01T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'att2-e17s04',
    quizId: QUIZ_ID,
    score: 0,
    percentage: 0,
    passed: false,
    completedAt: '2026-01-02T10:00:00.000Z',
    startedAt: '2026-01-02T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'att3-e17s04',
    quizId: QUIZ_ID,
    score: 1,
    percentage: 100,
    passed: true,
    completedAt: '2026-01-03T10:00:00.000Z',
    startedAt: '2026-01-03T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'att4-e17s04',
    quizId: QUIZ_ID,
    score: 1,
    percentage: 100,
    passed: true,
    completedAt: '2026-01-04T10:00:00.000Z',
    startedAt: '2026-01-04T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'att5-e17s04',
    quizId: QUIZ_ID,
    score: 1,
    percentage: 100,
    passed: true,
    completedAt: '2026-01-05T10:00:00.000Z',
    startedAt: '2026-01-05T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
]

// 5 attempts yielding moderate discrimination (rpb ≈ 0.293, in 0.2–0.3 range):
// group1 (correct) scores [4,5,6] mean=5.0, group0 (incorrect) scores [4,5] mean=4.5
// SD ≈ 0.837, rpb ≈ 0.293 → Moderate discriminator
const moderateAttempts = [
  makeAttempt({
    id: 'mod1-e17s04',
    quizId: QUIZ_ID,
    score: 4,
    percentage: 40,
    passed: false,
    completedAt: '2026-01-01T10:00:00.000Z',
    startedAt: '2026-01-01T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'mod2-e17s04',
    quizId: QUIZ_ID,
    score: 4,
    percentage: 40,
    passed: false,
    completedAt: '2026-01-02T10:00:00.000Z',
    startedAt: '2026-01-02T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'mod3-e17s04',
    quizId: QUIZ_ID,
    score: 5,
    percentage: 50,
    passed: false,
    completedAt: '2026-01-03T10:00:00.000Z',
    startedAt: '2026-01-03T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'mod4-e17s04',
    quizId: QUIZ_ID,
    score: 5,
    percentage: 50,
    passed: false,
    completedAt: '2026-01-04T10:00:00.000Z',
    startedAt: '2026-01-04T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'mod5-e17s04',
    quizId: QUIZ_ID,
    score: 6,
    percentage: 60,
    passed: false,
    completedAt: '2026-01-05T10:00:00.000Z',
    startedAt: '2026-01-05T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
]

// 5 attempts yielding low discrimination (rpb ≈ 0.193 < 0.2):
// group1 (correct) scores [3,3], group0 (incorrect) scores [2,2,4]
// mean1=3.0, mean0≈2.67, SD≈0.837, rpb≈0.193 → Low discriminator
const lowAttempts = [
  makeAttempt({
    id: 'low1-e17s04',
    quizId: QUIZ_ID,
    score: 2,
    percentage: 20,
    passed: false,
    completedAt: '2026-01-01T10:00:00.000Z',
    startedAt: '2026-01-01T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'low2-e17s04',
    quizId: QUIZ_ID,
    score: 2,
    percentage: 20,
    passed: false,
    completedAt: '2026-01-02T10:00:00.000Z',
    startedAt: '2026-01-02T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'low3-e17s04',
    quizId: QUIZ_ID,
    score: 3,
    percentage: 30,
    passed: false,
    completedAt: '2026-01-03T10:00:00.000Z',
    startedAt: '2026-01-03T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'low4-e17s04',
    quizId: QUIZ_ID,
    score: 3,
    percentage: 30,
    passed: false,
    completedAt: '2026-01-04T10:00:00.000Z',
    startedAt: '2026-01-04T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '4',
        isCorrect: true,
        pointsEarned: 1,
        pointsPossible: 1,
      },
    ],
  }),
  makeAttempt({
    id: 'low5-e17s04',
    quizId: QUIZ_ID,
    score: 4,
    percentage: 40,
    passed: false,
    completedAt: '2026-01-05T10:00:00.000Z',
    startedAt: '2026-01-05T10:00:00.000Z',
    answers: [
      {
        questionId: 'q1-e17s04',
        userAnswer: '3',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
  }),
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function navigateToResults(
  page: import('@playwright/test').Page,
  attempts: ReturnType<typeof makeAttempt>[]
) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz] as Record<string, unknown>[])
  await seedQuizAttempts(page, attempts as Record<string, unknown>[])

  // Inject Zustand quiz store state — key MUST match persist({ name: '...' }) in useQuizStore
  await page.evaluate(
    ({ q, atts }) => {
      localStorage.setItem(
        'levelup-quiz-store',
        JSON.stringify({
          state: {
            currentQuiz: { ...q },
            attempts: atts,
            isLoading: false,
            currentAttempt: null,
            progress: null,
          },
          version: 0,
        })
      )
    },
    { q: quiz, atts: attempts }
  )

  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E17-S04: Discrimination Indices', () => {
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })

  test('AC1: 5 attempts → discrimination analysis section visible', async ({ page }) => {
    await navigateToResults(page, fiveAttempts)
    const section = page.locator('[data-testid="discrimination-analysis"]')
    await expect(section).toBeVisible()
    await expect(section).toContainText('Question Discrimination Analysis')
  })

  test('AC3: High discriminator question shows correct interpretation', async ({ page }) => {
    await navigateToResults(page, fiveAttempts)
    const section = page.locator('[data-testid="discrimination-analysis"]')
    await expect(section).toBeVisible()
    // rpb ≈ 0.894 > 0.3 → High discriminator
    await expect(section).toContainText('High discriminator')
  })

  test('AC2: Fewer than 5 attempts → "Need at least 5 attempts" message', async ({ page }) => {
    const twoAttempts = fiveAttempts.slice(0, 2)
    await navigateToResults(page, twoAttempts)
    const emptyMsg = page.locator('[data-testid="discrimination-empty"]')
    await expect(emptyMsg).toBeVisible()
    await expect(emptyMsg).toContainText('Need at least 5 attempts')
    // Full discrimination card should not be rendered
    await expect(page.locator('[data-testid="discrimination-analysis"]')).not.toBeAttached()
  })

  test('AC4: Moderate discriminator question shows correct interpretation', async ({ page }) => {
    await navigateToResults(page, moderateAttempts)
    const section = page.locator('[data-testid="discrimination-analysis"]')
    await expect(section).toBeVisible()
    // rpb ≈ 0.293 (0.2 ≤ rpb ≤ 0.3) → Moderate discriminator
    await expect(section).toContainText('Moderate discriminator')
  })

  test('AC5: Low discriminator question shows correct interpretation', async ({ page }) => {
    await navigateToResults(page, lowAttempts)
    const section = page.locator('[data-testid="discrimination-analysis"]')
    await expect(section).toBeVisible()
    // rpb ≈ 0.193 (< 0.2) → Low discriminator
    await expect(section).toContainText('Low discriminator')
  })
})
