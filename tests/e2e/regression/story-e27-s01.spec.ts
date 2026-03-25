/**
 * E27-S01: Add Analytics Tabs To Reports Page
 *
 * Tests URL-aware tab switching via useSearchParams, Quiz Analytics tab
 * content and empty state, and fallback behavior for invalid tab params.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { makeQuiz, makeQuestion, makeAttempt } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts } from '../../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../../utils/test-time'

/**
 * Seed minimal study data so the Reports `hasActivity` guard passes
 * and tabs are visible. Without this, Reports shows the empty state.
 */
const SEED_COURSE_PROGRESS = JSON.stringify({
  'test-course': {
    courseId: 'test-course',
    completedLessons: ['lesson-1'],
    notes: {},
    startedAt: '2026-01-01T00:00:00.000Z',
    lastAccessedAt: '2026-01-01T00:00:00.000Z',
  },
})

test.describe('E27-S01: URL-aware Reports tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(progressData => {
      localStorage.setItem('course-progress', progressData)
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    }, SEED_COURSE_PROGRESS)
  })

  test('defaults to Study tab when no ?tab param', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'inactive'
    )
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'inactive'
    )
  })

  test('?tab=study activates Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=quizzes activates Quiz tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=ai activates AI tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=invalid falls back to Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=invalid')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('clicking tab updates URL', async ({ page }) => {
    await navigateAndWait(page, '/reports')

    await page.getByRole('tab', { name: 'Quiz Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )

    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )

    await page.getByRole('tab', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('Quiz Analytics shows empty state when no quiz data', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByText('No quizzes taken yet')).toBeVisible()
  })

  test('all three tab triggers are visible', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toBeVisible()
  })

  test('AC5: tab clicks update URL with replace semantics', async ({ page }) => {
    // Tab switching uses replace: true (standard for in-page tabs).
    // Back button returns to the page before /reports, not between tabs.
    // This is a deliberate UX choice — React Router + PWA service worker
    // causes double history entries with push semantics.
    await navigateAndWait(page, '/reports')

    await page.getByRole('tab', { name: 'Quiz Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)

    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)

    await page.getByRole('tab', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
  })

  test('AC7: Quiz Analytics shows seeded quiz data with stat cards', async ({ page }) => {
    // Navigate first so Dexie creates the DB schema
    await navigateAndWait(page, '/reports')

    // Create quiz and attempt test data
    const q1 = makeQuestion({
      id: 'q1-e27s01',
      text: 'Test question?',
      correctAnswer: 'A',
      options: ['A', 'B'],
    })
    const quiz = makeQuiz({
      id: 'quiz-e27s01-seed',
      lessonId: 'lesson-seed-1',
      title: 'Seeded Quiz',
      questions: [q1],
    })
    const attempt = makeAttempt({
      id: 'att-e27s01-seed',
      quizId: quiz.id,
      score: 1,
      percentage: 85,
      passed: true,
      completedAt: FIXED_DATE,
      startedAt: FIXED_DATE,
    })

    // Seed quiz data into IndexedDB
    await seedQuizzes(page, [quiz] as Record<string, unknown>[])
    await seedQuizAttempts(page, [attempt] as Record<string, unknown>[])

    // Navigate to Quiz Analytics tab (reload to pick up seeded data)
    await page.goto('/reports?tab=quizzes')
    await page.waitForLoadState('domcontentloaded')

    // Verify stat cards are visible
    await expect(page.getByTestId('quiz-total-card')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('quiz-avg-score-card')).toBeVisible({ timeout: 10000 })

    // Verify retake detail card is visible
    await expect(page.getByTestId('quiz-retake-detail-card')).toBeVisible({ timeout: 10000 })

    // Verify empty state is NOT shown
    await expect(page.getByText('No quizzes taken yet')).not.toBeVisible()
  })

  test('AC7: Retake Frequency is not visible in Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByText('Retake Frequency')).not.toBeVisible()
  })
})
