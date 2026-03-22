/**
 * ATDD E2E tests for E16-S03: Calculate and Display Score Improvement
 *
 * Tests the 4-state improvement panel on the quiz results screen:
 * - AC1: First attempt → no comparison, "First attempt complete!" message
 * - AC2: Second attempt with higher score → "+X%" improvement in green
 * - AC3: New personal best → "New personal best!" with trophy icon
 * - AC4: Regression → neutral best-score display, no red/negative messaging
 *
 * Seed strategy: Seed quiz into Dexie + attempts into Dexie + currentQuiz in
 * localStorage (Zustand persist store), then navigate directly to results URL.
 * This avoids completing multiple quiz flows per scenario.
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s03'
const LESSON_ID = 'test-lesson-e16s03'

const question = makeQuestion({
  id: 'q1-e16s03',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e16s03',
  lessonId: LESSON_ID,
  title: 'Improvement Test Quiz',
  description: 'Quiz for E16-S03 improvement panel testing',
  questions: [question],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Attempt factories for each scenario
// ---------------------------------------------------------------------------

const attempt1Low = makeAttempt({
  id: 'attempt-1-low',
  quizId: quiz.id,
  percentage: 60,
  passed: false,
  completedAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T09:55:00.000Z',
})

const attempt2High = makeAttempt({
  id: 'attempt-2-high',
  quizId: quiz.id,
  percentage: 85,
  passed: true,
  completedAt: '2026-01-02T10:00:00.000Z',
  startedAt: '2026-01-02T09:55:00.000Z',
})

const attempt3Best = makeAttempt({
  id: 'attempt-3-best',
  quizId: quiz.id,
  percentage: 90,
  passed: true,
  completedAt: '2026-01-03T10:00:00.000Z',
  startedAt: '2026-01-03T09:55:00.000Z',
})

const attempt3Regression = makeAttempt({
  id: 'attempt-3-regression',
  quizId: quiz.id,
  percentage: 70,
  passed: true,
  completedAt: '2026-01-03T10:00:00.000Z',
  startedAt: '2026-01-03T09:55:00.000Z',
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AttemptData = typeof attempt1Low

/**
 * Set up page for results: seed quiz + attempts into Dexie, seed Zustand
 * store's currentQuiz in localStorage, then navigate to results URL.
 */
async function setupResultsPage(page: import('@playwright/test').Page, attempts: AttemptData[]) {
  // Seed Zustand persist store + sidebar state before page load
  const quizStoreState = JSON.stringify({
    state: { currentQuiz: quiz, currentProgress: null },
    version: 0,
  })

  await page.addInitScript(
    ({ storeState }) => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
      localStorage.setItem('levelup-quiz-store', storeState)
    },
    { storeState: quizStoreState }
  )

  // Navigate to app so Dexie initializes the DB
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz + attempts into IndexedDB
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
  await seedIndexedDBStore(
    page,
    'ElearningDB',
    'quizAttempts',
    attempts as Record<string, unknown>[]
  )

  // Navigate directly to results page
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E16-S03: Score Improvement Panel', () => {
  test('AC1: first attempt shows "First attempt complete!" message, no comparison', async ({
    page,
  }) => {
    await setupResultsPage(page, [attempt1Low])

    // Improvement panel should be present
    await expect(page.getByTestId('improvement-summary')).toBeVisible()

    // First-attempt message shown
    await expect(
      page.getByText(/First attempt complete! Retake to track improvement\./)
    ).toBeVisible()

    // No comparison rows (no "First attempt:" label row)
    await expect(page.getByText('First attempt:')).not.toBeVisible()
    await expect(page.getByText('Improvement:')).not.toBeVisible()

    // No "New personal best!" trophy in the visible panel
    await expect(
      page.getByTestId('improvement-summary').getByText(/New personal best/)
    ).not.toBeVisible()
  })

  test('AC2: second attempt with higher score shows "+X%" improvement', async ({ page }) => {
    await setupResultsPage(page, [attempt1Low, attempt2High])

    const panel = page.getByTestId('improvement-summary')
    await expect(panel).toBeVisible()

    // Comparison rows present
    await expect(page.getByText('First attempt:')).toBeVisible()
    await expect(page.getByText('Current attempt:')).toBeVisible()
    await expect(page.getByText('Improvement:')).toBeVisible()

    // Positive delta shown with + sign
    await expect(panel.getByText('+25%')).toBeVisible()

    // "New personal best!" should appear (85 > 60) — scoped to panel to avoid sr-only region
    await expect(
      page.getByTestId('improvement-summary').getByText('New personal best!')
    ).toBeVisible()
  })

  test('AC3: third attempt as new personal best shows trophy and "New personal best!"', async ({
    page,
  }) => {
    // 60 → 85 → 90: current (90) beats previous best (85)
    await setupResultsPage(page, [attempt1Low, attempt2High, attempt3Best])

    await expect(page.getByTestId('improvement-summary')).toBeVisible()
    await expect(
      page.getByTestId('improvement-summary').getByText('New personal best!')
    ).toBeVisible()

    // Improvement value: 90 - 60 = +30%
    await expect(page.getByTestId('improvement-summary').getByText('+30%')).toBeVisible()
  })

  test('AC4: regression shows best score with attempt number, neutral encouragement, no red', async ({
    page,
  }) => {
    // 60 → 85 → 70: current (70) is below best (85, attempt #2)
    await setupResultsPage(page, [attempt1Low, attempt2High, attempt3Regression])

    const panel = page.getByTestId('improvement-summary')
    await expect(panel).toBeVisible()

    // Neutral messaging
    await expect(page.getByText(/Your best: 85%/)).toBeVisible()
    await expect(page.getByText(/attempt #2/)).toBeVisible()
    await expect(page.getByText(/Keep practicing to beat your best!/)).toBeVisible()

    // No "New personal best!" in the visible panel
    await expect(
      page.getByTestId('improvement-summary').getByText(/New personal best/)
    ).not.toBeVisible()

    // No red/destructive color classes in the panel
    const panelEl = await panel.elementHandle()
    const hasDestructive = await page.evaluate(el => {
      const allEls = el?.querySelectorAll('*') ?? []
      return Array.from(allEls).some(e => e.className?.includes?.('text-destructive'))
    }, panelEl)
    expect(hasDestructive).toBe(false)
  })
})
