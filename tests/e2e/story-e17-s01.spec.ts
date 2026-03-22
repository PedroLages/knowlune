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
import { seedQuizAttempts, seedNotes } from '../support/helpers/indexeddb-seed'
import { FIXED_TIMESTAMP } from '../utils/test-time'

test.describe('E17-S01 Quiz Completion Rate', () => {
  test('shows "No quizzes started yet" when no quiz data', async ({ page }) => {
    // Navigate first to initialize IndexedDB
    await page.goto('/')

    // Seed a note so studyNotes > 0 — this makes hasActivity = true and the page
    // renders its full content rather than the global empty state. Quiz data is
    // intentionally absent so the quiz card shows its own empty state.
    await seedNotes(page, [
      {
        id: 'note-empty-quiz-test',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        content: 'test note',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ])

    await goToReports(page)

    const quizCard = page.getByTestId('quiz-completion-card')
    await expect(quizCard).toBeVisible()
    await expect(quizCard.getByText('No quizzes started yet')).toBeVisible()
  })

  test('shows 75% completion rate with 3 completed and 1 in-progress', async ({ page }) => {
    // Set localStorage before first navigation so it is available when Reports mounts
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

    // Navigate to initialize IndexedDB
    await page.goto('/')

    await seedQuizAttempts(page, [
      { id: 'a1', quizId: 'q1', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
      { id: 'a2', quizId: 'q2', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
      { id: 'a3', quizId: 'q3', answers: [], score: 1, percentage: 100, passed: true, timeSpent: 30000, completedAt: FIXED_TIMESTAMP, startedAt: FIXED_TIMESTAMP, timerAccommodation: 'standard' },
    ])

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
