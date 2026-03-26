/**
 * ATDD E2E tests for E16-S02: Display Score History Across All Attempts
 *
 * Tests that the QuizResults page shows a collapsible attempt history
 * with all attempts sorted most-recent-first, the current attempt highlighted,
 * and a Review button per row.
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s02'
const LESSON_ID = 'test-lesson-e16s02'
const QUIZ_ID = 'quiz-e16s02'

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'History Test Quiz',
  questions: [],
  passingScore: 70,
})

// Three attempts: oldest → middle → newest (we seed them in various orders to
// verify the store correctly reverses and the UI shows newest first)
const ATTEMPT_OLD_ID = 'attempt-old-e16s02'
const ATTEMPT_MID_ID = 'attempt-mid-e16s02'
const ATTEMPT_NEW_ID = 'attempt-new-e16s02'

const attemptOld = {
  id: ATTEMPT_OLD_ID,
  quizId: QUIZ_ID,
  answers: [],
  score: 0,
  percentage: 50,
  passed: false,
  timeSpent: 45000,
  completedAt: '2025-01-10T08:00:00.000Z',
  startedAt: '2025-01-10T07:55:00.000Z',
  timerAccommodation: 'standard',
}

const attemptMid = {
  id: ATTEMPT_MID_ID,
  quizId: QUIZ_ID,
  answers: [],
  score: 1,
  percentage: 75,
  passed: true,
  timeSpent: 60000,
  completedAt: '2025-01-15T10:00:00.000Z',
  startedAt: '2025-01-15T09:55:00.000Z',
  timerAccommodation: 'standard',
}

const attemptNew = {
  id: ATTEMPT_NEW_ID,
  quizId: QUIZ_ID,
  answers: [],
  score: 1,
  percentage: 100,
  passed: true,
  timeSpent: 30000,
  completedAt: '2025-01-20T14:00:00.000Z',
  startedAt: '2025-01-20T13:55:00.000Z',
  timerAccommodation: 'standard',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedIdbStore(
  page: import('@playwright/test').Page,
  storeName: string,
  data: unknown[]
) {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
  await page.evaluate(
    async ({ storeName: sName, data: d, maxRetries, retryDelay: _retryDelay }) => {
      for (let i = 0; i < maxRetries; i++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(sName)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(sName, 'readwrite')
            const store = tx.objectStore(sName)
            for (const item of d) {
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
          req.onerror = () => reject(req.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, 200))
      }
      throw new Error(`Store "${sName}" not found after retries`)
    },
    { storeName, data, maxRetries: 10, retryDelay: 200 }
  )
}

async function setupResultsPage(page: import('@playwright/test').Page) {
  // Prevent sidebar overlay on tablet viewports
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  // Navigate to app root so Dexie initialises the DB
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz + attempts into IndexedDB
  await seedIdbStore(page, 'quizzes', [quiz])
  await seedIdbStore(page, 'quizAttempts', [attemptOld, attemptMid, attemptNew])

  // Seed Zustand persisted state so QuizResults doesn't redirect away.
  // `currentQuiz` is required; `attempts` is loaded from IDB on mount via loadAttempts.
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [
      'levelup-quiz-store',
      JSON.stringify({
        state: { currentQuiz: quiz, currentProgress: null },
        version: 0,
      }),
    ] as [string, string]
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
  test('AC: "View Attempt History" trigger is visible on results screen', async ({ page }) => {
    await setupResultsPage(page)

    await expect(page.getByRole('button', { name: /view attempt history/i })).toBeVisible()
  })

  test('AC: Expanding shows all 3 attempts', async ({ page }) => {
    await setupResultsPage(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // Should show 3 attempt numbers (#1, #2, #3) in the desktop table
    // (duplicate text from mobile layout is acceptable)
    await expect(page.getByText('#3').first()).toBeVisible()
    await expect(page.getByText('#2').first()).toBeVisible()
    await expect(page.getByText('#1').first()).toBeVisible()
  })

  test('AC: Attempts sorted most-recent-first — #3 appears before #1 in table', async ({
    page,
  }) => {
    await setupResultsPage(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // In the hidden-on-mobile desktop table, #3 should appear before #1
    const tableBody = page.locator('[data-slot="table-body"]')
    await expect(tableBody).toBeVisible()

    const rows = tableBody.locator('tr')
    const firstRowText = await rows.first().textContent()
    expect(firstRowText).toContain('#3')
  })

  test('AC: Current attempt (newest) is marked "Current"', async ({ page }) => {
    await setupResultsPage(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // "Current" badge should be visible
    await expect(page.getByText('Current').first()).toBeVisible()
  })

  test('AC: Review button present per attempt row', async ({ page }) => {
    await setupResultsPage(page)

    await page.getByRole('button', { name: /view attempt history/i }).click()

    // At least 3 Review buttons (one per attempt in desktop table;
    // mobile duplicates are acceptable)
    const reviewButtons = page.getByRole('button', { name: /^review$/i })
    await expect(reviewButtons.first()).toBeVisible()
    expect(await reviewButtons.count()).toBeGreaterThanOrEqual(3)
  })
})
