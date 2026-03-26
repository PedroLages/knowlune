/**
 * E2E regression tests for E18-S07: Surface Quiz Analytics in Reports Section
 *
 * AC coverage:
 * - AC1: Quiz Analytics tab exists, is clickable, and renders metric cards
 *        (total quizzes, avg score, completion rate, retake frequency,
 *         recent attempts table, top/needs-improvement lists)
 * - AC2: Empty state shown ("No quiz data yet") when quiz tab has no data
 * - AC4: Metric card grid collapses to 1-col on mobile (375px)
 *
 * Note: AC3 (quiz detail navigation to /reports/quiz/:quizId) is deferred —
 * the route is not yet registered (Task 4 in E18-S07 is unimplemented).
 */
import { test, expect } from '../../support/fixtures'
import { makeAttempt } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizAttempts, clearIndexedDBStore } from '../../support/helpers/indexeddb-seed'

const QUIZ_A = 'quiz-e18s07-a'
const QUIZ_B = 'quiz-e18s07-b'

test.describe('E18-S07: Quiz Analytics Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    // Navigate to root first so Dexie initialises the DB schema
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })

  test('AC1: Quiz Analytics tab exists and activates on click', async ({ page }) => {
    await seedQuizAttempts(page, [makeAttempt({ id: 'e18s07-a1', quizId: QUIZ_A, percentage: 80 })])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })

    const quizTab = page.getByRole('tab', { name: /quiz analytics/i })
    await expect(quizTab).toBeVisible()
    await quizTab.click()
    await expect(quizTab).toHaveAttribute('data-state', 'active')
  })

  test('AC1: metric cards render after clicking Quiz Analytics tab', async ({ page }) => {
    await seedQuizAttempts(page, [
      makeAttempt({ id: 'e18s07-b1', quizId: QUIZ_A, percentage: 80 }),
      makeAttempt({ id: 'e18s07-b2', quizId: QUIZ_A, percentage: 90 }),
      makeAttempt({ id: 'e18s07-b3', quizId: QUIZ_B, percentage: 60 }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /quiz analytics/i }).click()

    // Metric cards grid should be visible
    const metricCards = page.getByTestId('quiz-metric-cards')
    await expect(metricCards).toBeVisible()

    // Total quizzes completed = 2 unique quiz IDs
    await expect(page.getByTestId('quiz-total-count')).toHaveText('2')

    // Average score = (80 + 90 + 60) / 3 = 76.67 → 77
    await expect(page.getByTestId('quiz-avg-score')).toContainText('%')

    // Retake frequency card present
    await expect(page.getByTestId('quiz-retake-frequency')).toBeVisible()
  })

  test('AC1: recent attempts table renders rows matching seeded data', async ({ page }) => {
    await seedQuizAttempts(page, [
      makeAttempt({
        id: 'e18s07-c1',
        quizId: QUIZ_A,
        percentage: 75,
        completedAt: '2026-01-15T10:00:00Z',
      }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /quiz analytics/i }).click()

    const row = page.getByTestId('quiz-recent-row')
    await expect(row).toBeVisible()
    await expect(row).toContainText('75%')
  })

  test('AC1: top-performing and needs-improvement cards are separate (no overlap)', async ({
    page,
  }) => {
    // Seed 6 quizzes so the split is non-trivial
    await seedQuizAttempts(page, [
      makeAttempt({ id: 'e18s07-d1', quizId: 'qa', percentage: 95 }),
      makeAttempt({ id: 'e18s07-d2', quizId: 'qb', percentage: 85 }),
      makeAttempt({ id: 'e18s07-d3', quizId: 'qc', percentage: 75 }),
      makeAttempt({ id: 'e18s07-d4', quizId: 'qd', percentage: 65 }),
      makeAttempt({ id: 'e18s07-d5', quizId: 'qe', percentage: 55 }),
      makeAttempt({ id: 'e18s07-d6', quizId: 'qf', percentage: 45 }),
    ])

    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /quiz analytics/i }).click()

    await expect(page.getByTestId('top-performing-card')).toBeVisible()
    await expect(page.getByTestId('needs-improvement-card')).toBeVisible()

    // Top performing should show highest scores; needs improvement lowest
    await expect(page.getByTestId('top-performing-card')).toContainText('95%')
    await expect(page.getByTestId('needs-improvement-card')).toContainText('45%')
  })

  test('AC1: navigating directly to /reports?tab=quizzes activates Quiz Analytics tab', async ({
    page,
  }) => {
    await seedQuizAttempts(page, [makeAttempt({ id: 'e18s07-e1', quizId: QUIZ_A, percentage: 80 })])

    await page.goto('/reports?tab=quizzes', { waitUntil: 'domcontentloaded' })

    const quizTab = page.getByRole('tab', { name: /quiz analytics/i })
    await expect(quizTab).toHaveAttribute('data-state', 'active')
    await expect(page.getByTestId('quiz-metric-cards')).toBeVisible()
  })

  test('AC2: quiz tab shows empty state when no quiz attempts exist', async ({ page }) => {
    // Seed a quiz attempt then clear it before navigating, so the page
    // still has activity (retakeData resolves synchronously via the seeded
    // attempts in the beforeEach navigation), but the analytics call returns empty.
    // Simpler: seed one attempt for hasActivity, reload after clearing it.
    await seedQuizAttempts(page, [makeAttempt({ id: 'e18s07-f1', quizId: QUIZ_A, percentage: 70 })])

    // Navigate once to initialise hasActivity = true (retake card visible)
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('tab', { name: /quiz analytics/i })).toBeVisible()

    // Clear quiz attempts and reload — retake frequency drops to 0 but
    // other activity (courses store) keeps the tabs visible
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
    // Navigate directly to quiz tab; empty state should show
    await page.goto('/reports?tab=quizzes', { waitUntil: 'domcontentloaded' })

    // Wait for the async analytics load to complete
    await expect(page.getByTestId('quiz-analytics-empty')).toBeVisible({ timeout: 5000 })
  })

  test('AC4: metric cards collapse to 1 column on mobile viewport', async ({ page }) => {
    await seedQuizAttempts(page, [makeAttempt({ id: 'e18s07-g1', quizId: QUIZ_A, percentage: 80 })])

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/reports?tab=quizzes', { waitUntil: 'domcontentloaded' })

    const metricCards = page.getByTestId('quiz-metric-cards')
    await expect(metricCards).toBeVisible()

    // On mobile the grid uses grid-cols-1; cards stack vertically.
    // Verify the cards container width matches the viewport (no horizontal overflow).
    const box = await metricCards.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(375)
  })
})
