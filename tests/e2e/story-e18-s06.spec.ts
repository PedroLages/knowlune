/**
 * ATDD E2E tests for E18-S06: Display Quiz Performance in Overview Dashboard
 *
 * Acceptance criteria:
 * AC1 — Overview shows Quiz Performance card with metrics when quizzes exist
 * AC2 — Card shows skeleton loading state before data resolves
 * AC3 — Clicking the card navigates to /reports?tab=quizzes
 * AC4 — Empty state shown when no quizzes completed
 */
import { test, expect } from '../support/fixtures'
import { makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { seedQuizAttempts } from '../support/helpers/indexeddb-seed'

/** Navigate to overview with sidebar collapsed */
async function navigateToOverview(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const attempt1 = makeAttempt({ id: 'e18s06-attempt-1', percentage: 80, passed: true })
const attempt2 = makeAttempt({ id: 'e18s06-attempt-2', percentage: 60, passed: false })
const attempt3 = makeAttempt({ id: 'e18s06-attempt-3', percentage: 100, passed: true })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E18-S06: Quiz Performance in Overview Dashboard', () => {
  test('AC1: Quiz Performance card shows metrics when quizzes completed', async ({ page }) => {
    // Navigate first so Dexie creates the DB
    await navigateToOverview(page)

    // Seed 3 attempts: 80, 60, 100 → average = 80
    await seedQuizAttempts(page, [attempt1, attempt2, attempt3])

    // Reload so the component re-fetches from Dexie
    await page.reload({ waitUntil: 'domcontentloaded' })

    const card = page.getByTestId('quiz-performance-card')
    await expect(card).toBeVisible()

    // Quizzes Completed = 3
    await expect(card.getByText('Quizzes Completed')).toBeVisible()
    await expect(card.getByText('3')).toBeVisible()

    // Average Score = 80%
    await expect(card.getByText('Average Score')).toBeVisible()
    await expect(card.getByText('80%')).toBeVisible()

    // Completion Rate = 100%
    await expect(card.getByText('Completion Rate')).toBeVisible()
    await expect(card.getByText('100%')).toBeVisible()
  })

  test('AC3: Clicking card navigates to /reports?tab=quizzes', async ({ page }) => {
    await navigateToOverview(page)
    await seedQuizAttempts(page, [attempt1])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const card = page.getByTestId('quiz-performance-card')
    await expect(card).toBeVisible()

    await card.click()

    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
  })

  test('AC4: Empty state shown when no quizzes completed', async ({ page }) => {
    await navigateToOverview(page)

    // Do NOT seed any quiz attempts — card should show empty state
    // Wait for card to be rendered (loading resolves to empty state)
    const emptyState = page.getByTestId('quiz-performance-empty')
    await expect(emptyState).toBeVisible({ timeout: 5000 })

    await expect(page.getByText(/No quizzes completed yet/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Find Quizzes/i })).toBeVisible()
  })

  test('AC3b: "View Detailed Analytics" link navigates to /reports?tab=quizzes', async ({
    page,
  }) => {
    await navigateToOverview(page)
    await seedQuizAttempts(page, [attempt1])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const analyticsLink = page.getByRole('link', { name: /View Detailed Analytics/i })
    await expect(analyticsLink).toBeVisible()

    await analyticsLink.click()

    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
  })
})
