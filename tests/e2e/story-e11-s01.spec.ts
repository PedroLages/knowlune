/**
 * ATDD — E11-S01: Spaced Review System
 *
 * Failing acceptance tests mapped to each AC.
 * RED phase: these tests define expected behavior before implementation.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

/** Navigate to the Review Queue page. */
async function goToReviewQueue(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/review')
  await page.waitForSelector('[data-testid="review-queue"]', {
    state: 'visible',
    timeout: 10_000,
  })
}

test.describe('Spaced Review System (E11-S01)', () => {
  // ── AC1: Rate note with 3-grade system ──────────────────────────
  test.describe('AC1: Rating with Hard / Good / Easy', () => {
    test('displays Hard, Good, and Easy rating buttons for a due note', async ({ page }) => {
      await goToReviewQueue(page)

      // A note card should show rating buttons
      const ratingGroup = page.getByTestId('rating-buttons')
      await expect(ratingGroup.getByRole('button', { name: /hard/i })).toBeVisible()
      await expect(ratingGroup.getByRole('button', { name: /good/i })).toBeVisible()
      await expect(ratingGroup.getByRole('button', { name: /easy/i })).toBeVisible()
    })

    test('records rating and calculates next review interval', async ({ page }) => {
      await goToReviewQueue(page)

      // Rate a note as "Good"
      const firstCard = page.getByTestId('review-card').first()
      await firstCard.getByRole('button', { name: /good/i }).click()

      // Card should be removed from queue (reviewed)
      await expect(firstCard).not.toBeVisible()
    })
  })

  // ── AC2: Review queue sorted by retention percentage ────────────
  test.describe('AC2: Prioritized review queue', () => {
    test('displays due notes sorted by predicted retention (lowest first)', async ({ page }) => {
      await goToReviewQueue(page)

      const retentionValues = await page
        .getByTestId('retention-percentage')
        .allTextContents()

      // Should have at least 2 notes to verify sorting
      expect(retentionValues.length).toBeGreaterThanOrEqual(2)

      // Verify ascending sort (lowest retention first)
      const percentages = retentionValues.map(v => parseFloat(v))
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1])
      }
    })

    test('each note shows retention percentage, course name, topic, and time until due', async ({
      page,
    }) => {
      await goToReviewQueue(page)

      const firstCard = page.getByTestId('review-card').first()
      await expect(firstCard.getByTestId('retention-percentage')).toBeVisible()
      await expect(firstCard.getByTestId('course-name')).toBeVisible()
      await expect(firstCard.getByTestId('topic-name')).toBeVisible()
      await expect(firstCard.getByTestId('time-until-due')).toBeVisible()
    })
  })

  // ── AC3: Updated intervals on re-rating ─────────────────────────
  test.describe('AC3: Cumulative review history updates', () => {
    test('re-rating a previously reviewed note updates the interval', async ({ page }) => {
      await goToReviewQueue(page)

      // Rate first note as "Hard" (short interval)
      const firstCard = page.getByTestId('review-card').first()
      await firstCard.getByRole('button', { name: /hard/i }).click()

      // Queue should re-sort after rating
      await expect(page.getByTestId('review-card').first()).toBeVisible()
    })
  })

  // ── AC4: Empty state when no reviews due ─────────────────────────
  test.describe('AC4: Empty state', () => {
    test('shows empty state when no notes are due for review', async ({ page }) => {
      // Navigate without seeding any review data
      await navigateAndWait(page, '/review')

      const emptyState = page.getByTestId('review-empty-state')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText(/no reviews/i)
    })

    test('empty state shows the date and time of next upcoming review', async ({ page }) => {
      await navigateAndWait(page, '/review')

      const nextReview = page.getByTestId('next-review-date')
      await expect(nextReview).toBeVisible()
    })
  })

  // ── AC5: Error handling with toast and retry ─────────────────────
  test.describe('AC5: IndexedDB error handling', () => {
    test('displays toast with retry option when IndexedDB write fails', async ({ page }) => {
      await goToReviewQueue(page)

      // Simulate IndexedDB failure by breaking the database
      await page.evaluate(() => {
        // Override indexedDB.open to simulate write failure
        const originalOpen = indexedDB.open.bind(indexedDB)
        indexedDB.open = (...args: Parameters<typeof indexedDB.open>) => {
          const req = originalOpen(...args)
          const originalOnSuccess = req.onsuccess
          req.onsuccess = function (event) {
            const db = (event.target as IDBOpenDBRequest).result
            const originalTransaction = db.transaction.bind(db)
            db.transaction = (...txArgs: Parameters<typeof db.transaction>) => {
              const tx = originalTransaction(...txArgs)
              // Make put operations fail
              const originalObjectStore = tx.objectStore.bind(tx)
              tx.objectStore = (...osArgs: Parameters<typeof tx.objectStore>) => {
                const store = originalObjectStore(...osArgs)
                const originalPut = store.put.bind(store)
                store.put = () => {
                  const failReq = originalPut({})
                  setTimeout(() => {
                    if (failReq.onerror) {
                      failReq.onerror(new Event('error'))
                    }
                  }, 0)
                  return failReq
                }
                return store
              }
              return tx
            }
            if (originalOnSuccess) originalOnSuccess.call(req, event)
          }
          return req
        }
      })

      // Try to rate a note — should trigger error
      const firstCard = page.getByTestId('review-card').first()
      await firstCard.getByRole('button', { name: /good/i }).click()

      // Toast should appear with retry option
      const toast = page.locator('[data-sonner-toast]')
      await expect(toast).toBeVisible({ timeout: 5_000 })
      await expect(toast).toContainText(/retry/i)
    })
  })
})
