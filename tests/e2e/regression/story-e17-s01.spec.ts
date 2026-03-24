/**
 * ATDD E2E tests for E17-S01: Track and Display Quiz Completion Rate
 *
 * Tests the Quiz Completion Rate card on the Reports page:
 * - AC4: Completion rate displayed with progress bar and raw numbers
 * - AC5: Empty state when no quiz data exists
 * - Calculation: 3 completed + 1 in-progress = 75% (3/4)
 */
import { test, expect } from '../../support/fixtures'
import {
  makeQuiz,
  makeQuestion,
  makeAttempt,
} from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts } from '../../support/helpers/indexeddb-seed'
import { goToReports } from '../../support/helpers/navigation'
import { FIXED_DATE } from '../../utils/test-time'

// ---------------------------------------------------------------------------
// Test data — 4 unique quizzes, 3 completed, 1 in-progress only
// ---------------------------------------------------------------------------

const q1 = makeQuestion({ id: 'q1-e17s01', text: 'Q1?', correctAnswer: 'A', options: ['A', 'B'] })

const quiz1 = makeQuiz({ id: 'quiz-e17s01-1', lessonId: 'lesson-1', title: 'Quiz 1', questions: [q1] })
const quiz2 = makeQuiz({ id: 'quiz-e17s01-2', lessonId: 'lesson-2', title: 'Quiz 2', questions: [q1] })
const quiz3 = makeQuiz({ id: 'quiz-e17s01-3', lessonId: 'lesson-3', title: 'Quiz 3', questions: [q1] })
const quiz4 = makeQuiz({ id: 'quiz-e17s01-4', lessonId: 'lesson-4', title: 'Quiz 4', questions: [q1] })

const attempt1 = makeAttempt({ id: 'att-e17s01-1', quizId: quiz1.id, score: 1, percentage: 100, passed: true, completedAt: FIXED_DATE, startedAt: FIXED_DATE })
const attempt2 = makeAttempt({ id: 'att-e17s01-2', quizId: quiz2.id, score: 1, percentage: 100, passed: true, completedAt: FIXED_DATE, startedAt: FIXED_DATE })
const attempt3 = makeAttempt({ id: 'att-e17s01-3', quizId: quiz3.id, score: 1, percentage: 100, passed: true, completedAt: FIXED_DATE, startedAt: FIXED_DATE })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E17-S01: Quiz Completion Rate', () => {
  test('AC4/5: complete 3 quizzes, start 1 — displays 75% completion rate', async ({ page }) => {
    // Navigate to app first so Dexie creates the DB
    await goToReports(page)

    // Seed 4 quizzes and 3 completed attempts
    await seedQuizzes(page, [quiz1, quiz2, quiz3, quiz4] as Record<string, unknown>[])
    await seedQuizAttempts(page, [attempt1, attempt2, attempt3] as Record<string, unknown>[])

    // Set quiz4 as in-progress in localStorage (not yet submitted)
    await page.evaluate(
      ({ quizId }) => {
        localStorage.setItem(
          'levelup-quiz-store',
          JSON.stringify({
            state: {
              currentProgress: { quizId },
            },
            version: 0,
          })
        )
      },
      { quizId: quiz4.id }
    )

    // Reload so the Reports page reads the seeded data
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Verify the completion rate percentage (3 completed / 4 started = 75%)
    const percentage = page.getByTestId('quiz-completion-percentage')
    await expect(percentage).toBeVisible()
    await expect(percentage).toHaveText('75%')

    // Verify the summary text
    const summary = page.getByTestId('quiz-completion-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toHaveText('3 of 4 started quizzes completed')

    // Verify progress bar exists
    const progressBar = page.getByRole('progressbar', { name: /quiz completion rate/i })
    await expect(progressBar).toBeVisible()
  })

  test('AC4: view Reports section — see metric displayed', async ({ page }) => {
    // Navigate and seed completed attempts only (no in-progress)
    await goToReports(page)
    await seedQuizzes(page, [quiz1, quiz2, quiz3] as Record<string, unknown>[])
    await seedQuizAttempts(page, [attempt1, attempt2, attempt3] as Record<string, unknown>[])

    await page.reload({ waitUntil: 'domcontentloaded' })

    // 3 completed, 0 in-progress = 100%
    const percentage = page.getByTestId('quiz-completion-percentage')
    await expect(percentage).toBeVisible()
    await expect(percentage).toHaveText('100%')

    const summary = page.getByTestId('quiz-completion-summary')
    await expect(summary).toHaveText('3 of 3 started quizzes completed')
  })

  test('AC5: no quiz data — shows empty state message', async ({ page }) => {
    await goToReports(page)

    // No quizzes seeded — should show empty state
    const emptyState = page.getByTestId('quiz-completion-empty')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveText('No quizzes started yet')

    // Percentage and summary should NOT be visible
    await expect(page.getByTestId('quiz-completion-percentage')).not.toBeVisible()
    await expect(page.getByTestId('quiz-completion-summary')).not.toBeVisible()
  })
})
