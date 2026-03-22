/**
 * ATDD E2E tests for E17-S01: Track and Display Quiz Completion Rate
 *
 * Verifies:
 * - Empty state ("No quizzes started yet") when no quiz data
 * - 75% completion rate when 3 completed, 1 in-progress
 * - 100% completion rate when 2 completed, none in-progress
 */
import { test, expect } from '../support/fixtures'
import { goToReports } from '../support/helpers/navigation'
import { seedQuizAttempts } from '../support/helpers/indexeddb-seed'
import { FIXED_TIMESTAMP } from '../utils/test-time'

test.describe('E17-S01 Quiz Completion Rate', () => {
  test('shows "No quizzes started yet" when no quiz data', async ({ page }) => {
    await goToReports(page)

    const quizCard = page.getByTestId('quiz-completion-card')
    const pageEmptyState = page.getByTestId('empty-state-sessions')

    const isPageEmpty = await pageEmptyState.isVisible()
    if (!isPageEmpty) {
      await expect(quizCard).toBeVisible()
      await expect(quizCard.getByText('No quizzes started yet')).toBeVisible()
    }
  })

  test('shows 75% completion rate with 3 completed and 1 in-progress', async ({ page }) => {
    // Navigate first to initialize IndexedDB
    await page.goto('/')

    await seedQuizAttempts(page, [
      { id: 'a1', quizId: 'q1', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
      { id: 'a2', quizId: 'q2', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
      { id: 'a3', quizId: 'q3', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
    ])

    await page.addInitScript(() => {
      localStorage.setItem(
        'levelup-quiz-store',
        JSON.stringify({
          state: {
            currentProgress: { quizId: 'q4', currentQuestionIndex: 1 },
            currentQuiz: { id: 'q4' },
          },
        })
      )
    })

    await goToReports(page)

    const quizCard = page.getByTestId('quiz-completion-card')
    await expect(quizCard).toBeVisible()
    await expect(quizCard.getByText('75%')).toBeVisible()
    await expect(quizCard.getByText(/3 of 4 started quizzes completed/)).toBeVisible()
  })

  test('shows 100% completion rate with 2 completed quizzes', async ({ page }) => {
    // Navigate first to initialize IndexedDB
    await page.goto('/')

    await seedQuizAttempts(page, [
      { id: 'b1', quizId: 'q1', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
      { id: 'b2', quizId: 'q2', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
    ])

    await goToReports(page)

    const quizCard = page.getByTestId('quiz-completion-card')
    await expect(quizCard).toBeVisible()
    await expect(quizCard.getByText('100%')).toBeVisible()
    await expect(quizCard.getByText(/2 of 2 started quizzes completed/)).toBeVisible()
  })
})
