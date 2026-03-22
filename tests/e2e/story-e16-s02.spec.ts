/**
 * ATDD E2E tests for E16-S02: Display Score History Across All Attempts
 *
 * Tests the AttemptHistory component on the quiz results page:
 * - "View Attempt History" trigger is visible
 * - Expanding shows all attempts with correct data fields
 * - Attempts sorted most-recent-first (#3 first)
 * - Current attempt highlighted with "Current" badge
 * - Each attempt has a Review button
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeAttempt } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s02'
const LESSON_ID = 'test-lesson-e16s02'

const quiz = makeQuiz({
  id: 'quiz-e16s02',
  lessonId: LESSON_ID,
  title: 'History Quiz E16-S02',
  passingScore: 70,
})

// Three attempts in ascending chronological order (IDB will sort them, store reverses)
const attempt1 = makeAttempt({
  id: 'attempt-e16s02-1',
  quizId: quiz.id,
  completedAt: '2025-01-10T10:00:00.000Z', // oldest
  percentage: 60,
  passed: false,
  timeSpent: 45000,
})

const attempt2 = makeAttempt({
  id: 'attempt-e16s02-2',
  quizId: quiz.id,
  completedAt: '2025-01-12T10:00:00.000Z', // middle
  percentage: 80,
  passed: true,
  timeSpent: 90000,
})

const attempt3 = makeAttempt({
  id: 'attempt-e16s02-3',
  quizId: quiz.id,
  completedAt: '2025-01-15T12:00:00.000Z', // most recent (current)
  percentage: 100,
  passed: true,
  timeSpent: 30000,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedIdbStore(
  page: import('@playwright/test').Page,
  storeName: string,
  data: unknown[]
) {
  await page.evaluate(
    async ({ storeName, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(storeName)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            for (const item of data) {
              store.put(item)
            }
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "${storeName}" not found after retries`)
    },
    { storeName, data, maxRetries: 10, retryDelay: 200 }
  )
}

async function navigateToResults(page: import('@playwright/test').Page) {
  // Prevent sidebar overlay on tablet
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  // Navigate to app first so Dexie creates the DB
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz into IndexedDB
  await seedIdbStore(page, 'quizzes', [quiz])

  // Seed all three attempts into IndexedDB
  await seedIdbStore(page, 'quizAttempts', [attempt1, attempt2, attempt3])

  // Seed Zustand persisted state (currentQuiz required so results page doesn't redirect)
  await page.evaluate(
    ({ key, serialized }) => {
      localStorage.setItem(key, serialized)
    },
    {
      key: 'levelup-quiz-store',
      serialized: JSON.stringify({
        state: { currentQuiz: quiz, currentProgress: null },
        version: 0,
      }),
    }
  )

  // Navigate to results page
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E16-S02: Display Score History Across All Attempts', () => {
  test('AC1: "View Attempt History" trigger is visible on results page', async ({ page }) => {
    await navigateToResults(page)

    await expect(
      page.getByRole('button', { name: /view attempt history/i })
    ).toBeVisible()
  })

  test('AC2: trigger label shows correct plural count', async ({ page }) => {
    await navigateToResults(page)

    await expect(
      page.getByRole('button', { name: /view attempt history \(3 attempts\)/i })
    ).toBeVisible()
  })

  test('AC3: expand shows 3 attempts with attempt numbers, scores, and statuses', async ({
    page,
  }) => {
    await navigateToResults(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // Attempt numbers (most-recent-first: #3 first, #1 last)
    await expect(page.getByText('#3').first()).toBeVisible()
    await expect(page.getByText('#2').first()).toBeVisible()
    await expect(page.getByText('#1').first()).toBeVisible()

    // Score percentages
    await expect(page.getByText('100%').first()).toBeVisible()
    await expect(page.getByText('80%').first()).toBeVisible()
    await expect(page.getByText('60%').first()).toBeVisible()

    // Status badges
    await expect(page.getByText('Passed').first()).toBeVisible()
    await expect(page.getByText('Not Passed').first()).toBeVisible()
  })

  test('AC4: most-recent attempt (#3) appears first', async ({ page }) => {
    await navigateToResults(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // Get all attempt number cells — first should be #3
    const attemptNumbers = page.locator('td').filter({ hasText: /^#\d+/ })
    await expect(attemptNumbers.first()).toContainText('#3')
  })

  test('AC5: current attempt is highlighted with "Current" badge', async ({ page }) => {
    await navigateToResults(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // "Current" badge should appear (may appear in desktop + mobile renders)
    await expect(page.getByText('Current').first()).toBeVisible()
  })

  test('AC6: each attempt has a Review button', async ({ page }) => {
    await navigateToResults(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // At least 3 review buttons (desktop table has one per attempt)
    const reviewButtons = page.getByRole('button', { name: /review/i })
    await expect(reviewButtons.first()).toBeVisible()
    expect(await reviewButtons.count()).toBeGreaterThanOrEqual(3)
  })

  test('AC7: collapsed by default — attempt numbers not visible before click', async ({
    page,
  }) => {
    await navigateToResults(page)

    // Do NOT click the trigger
    await expect(page.locator('text=#3')).not.toBeVisible()
    await expect(page.locator('text=#1')).not.toBeVisible()
  })
})
