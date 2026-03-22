/**
 * E2E tests for E17-S02: Track Average Retake Frequency
 *
 * Tests that the Average Retake Frequency card renders correctly on the
 * Reports page Study Analytics tab.
 *
 * AC coverage:
 * - AC1/AC2: Quiz A×3 + Quiz B×2 = 2.5 average
 * - AC3/AC7: Frequency = 1.0 → "No retakes yet" interpretation
 * - AC5/AC7: Frequency = 2.5 → "Active practice" interpretation
 * - AC6/AC7: Frequency = 3.0 → "Deep practice" interpretation
 * - Zero attempts → empty state shown, retake card not visible
 */
import { test, expect } from '../../support/fixtures'
import { makeAttempt } from '../../support/fixtures/factories/quiz-factory'
import {
  seedQuizAttempts,
  clearIndexedDBStore,
} from '../../support/helpers/indexeddb-seed'

const QUIZ_A = 'quiz-e17s02-a'
const QUIZ_B = 'quiz-e17s02-b'

test.describe('E17-S02: Average Retake Frequency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    // Navigate to app so Dexie initializes the database schema
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })

  test('AC6: quiz A × 4 → retake frequency 4.0 with Deep Practice text', async ({ page }) => {
    // Average > 3.0 triggers "Deep practice" band
    await seedQuizAttempts(page, [
      makeAttempt({ id: 'r1-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r2-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r3-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r4-e17s02', quizId: QUIZ_A }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('4.0')
    await expect(card).toContainText('attempts per quiz')
    await expect(card).toContainText('Deep practice')
  })

  test('AC3/AC7: two different quizzes once each → retake frequency 1.0 with No Retakes text', async ({ page }) => {
    await seedQuizAttempts(page, [
      makeAttempt({ id: 'r4-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r5-e17s02', quizId: QUIZ_B }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('1.0')
    await expect(card).toContainText('No retakes yet')
  })

  test('AC2/AC5/AC7: quiz A × 3 + quiz B × 2 → 2.5 with Active Practice text', async ({ page }) => {
    await seedQuizAttempts(page, [
      makeAttempt({ id: 'r6-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r7-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r8-e17s02', quizId: QUIZ_A }),
      makeAttempt({ id: 'r9-e17s02', quizId: QUIZ_B }),
      makeAttempt({ id: 'r10-e17s02', quizId: QUIZ_B }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('2.5')
    await expect(card).toContainText('attempts per quiz')
    await expect(card).toContainText('Active practice')
  })

  test('AC: zero attempts → Reports shows empty state, retake card not visible', async ({ page }) => {
    // No data seeded — DB is empty for quizAttempts
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })

    // Empty state is shown because hasActivity is false
    await expect(page.getByTestId('empty-state-sessions')).toBeVisible()
    await expect(page.getByTestId('quiz-retake-card')).not.toBeVisible()
  })
})
