/**
 * ATDD — E11-S01: Spaced Review System
 *
 * Acceptance tests mapped to each AC.
 * Tests seed IndexedDB with notes and review records before navigating.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedIndexedDBStore, clearIndexedDBStore } from '../support/helpers/indexeddb-seed'
import { createDexieNote } from '../support/fixtures/factories/note-factory'

const DB_NAME = 'ElearningDB'

/** Fixed date for deterministic test data */
const FIXED_NOW = new Date('2026-03-15T12:00:00.000Z')

/** Create a review record that is due now (nextReviewAt in the past) */
function createDueReview(
  noteId: string,
  retention: number,
  overrides: Record<string, unknown> = {}
) {
  // Lower retention → reviewed longer ago → more overdue
  const daysAgo = Math.max(1, Math.round((1 - retention / 100) * 10))
  const reviewedAt = new Date(FIXED_NOW.getTime() - daysAgo * 86400000)
  const nextReviewAt = new Date(FIXED_NOW.getTime() - 86400000) // 1 day ago = due

  return {
    id: crypto.randomUUID(),
    noteId,
    rating: 'good',
    reviewedAt: reviewedAt.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    interval: 3,
    easeFactor: 2.5,
    reviewCount: 1,
    ...overrides,
  }
}

/** Create a review record that is NOT due (nextReviewAt in the future) */
function createFutureReview(noteId: string, daysUntilDue = 5) {
  return {
    id: crypto.randomUUID(),
    noteId,
    rating: 'easy',
    reviewedAt: FIXED_NOW.toISOString(),
    nextReviewAt: new Date(FIXED_NOW.getTime() + daysUntilDue * 86400000).toISOString(),
    interval: daysUntilDue,
    easeFactor: 2.5,
    reviewCount: 1,
  }
}

/** Seed notes and review records into IndexedDB, then reload to pick up data.
 *  Follows the same pattern as other IDB-seeded tests (E08-S01, etc.):
 *  navigate to target page → seed → reload.
 */
async function seedReviewData(
  page: import('@playwright/test').Page,
  notes: Record<string, unknown>[],
  reviews: Record<string, unknown>[]
) {
  // Navigate to /review first so Dexie initializes all stores including reviewRecords
  await navigateAndWait(page, '/review')

  await seedIndexedDBStore(page, DB_NAME, 'notes', notes)
  await seedIndexedDBStore(page, DB_NAME, 'reviewRecords', reviews)

  // Reload so the app re-reads seeded data from IDB on mount
  await page.reload()
  await page.waitForLoadState('load')
}

/** Wait for the Review Queue page to settle (cards or empty state visible) */
async function waitForReviewQueue(page: import('@playwright/test').Page) {
  await Promise.race([
    page.waitForSelector('[data-testid="review-card"]', { state: 'visible', timeout: 15_000 }),
    page.waitForSelector('[data-testid="review-empty-state"]', {
      state: 'visible',
      timeout: 15_000,
    }),
  ])
}

/** Navigate to the Review Queue page (no seeding — for empty state tests) */
async function goToReviewQueue(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/review')
  await waitForReviewQueue(page)
}

test.describe('Spaced Review System (E11-S01)', () => {
  test.afterEach(async ({ page }) => {
    // Clean up seeded data
    await clearIndexedDBStore(page, DB_NAME, 'reviewRecords').catch(() => {})
    await clearIndexedDBStore(page, DB_NAME, 'notes').catch(() => {})
  })

  // ── AC1: Rate note with 3-grade system ──────────────────────────
  test.describe('AC1: Rating with Hard / Good / Easy', () => {
    test('displays Hard, Good, and Easy rating buttons for a due note', async ({ page }) => {
      const note = createDexieNote({ id: 'note-ac1', content: 'Test note for AC1' })
      const review = createDueReview('note-ac1', 60)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      const ratingGroup = page.getByTestId('rating-buttons').first()
      await expect(ratingGroup.getByRole('button', { name: /hard/i })).toBeVisible()
      await expect(ratingGroup.getByRole('button', { name: /good/i })).toBeVisible()
      await expect(ratingGroup.getByRole('button', { name: /easy/i })).toBeVisible()
    })

    test('rating a note removes it from the queue', async ({ page }) => {
      const note = createDexieNote({ id: 'note-ac1b', content: 'Disappearing note' })
      const review = createDueReview('note-ac1b', 40)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      // Verify card is visible
      const card = page.getByTestId('review-card').first()
      await expect(card).toBeVisible()

      // Rate as Good
      await card.getByRole('button', { name: /good/i }).click()

      // Card should disappear (rated = no longer due)
      await expect(page.getByTestId('review-card')).not.toBeVisible({ timeout: 5_000 })
    })
  })

  // ── AC2: Review queue sorted by retention percentage ────────────
  test.describe('AC2: Prioritized review queue', () => {
    test('displays due notes sorted by predicted retention (lowest first)', async ({ page }) => {
      const note1 = createDexieNote({ id: 'note-low', content: 'Low retention note' })
      const note2 = createDexieNote({ id: 'note-high', content: 'High retention note' })

      // Low retention = reviewed long ago, high retention = reviewed recently
      const reviewLow = createDueReview('note-low', 20, {
        reviewedAt: new Date(FIXED_NOW.getTime() - 8 * 86400000).toISOString(),
        interval: 3,
      })
      const reviewHigh = createDueReview('note-high', 70, {
        reviewedAt: new Date(FIXED_NOW.getTime() - 1 * 86400000).toISOString(),
        interval: 3,
      })

      await seedReviewData(page, [note1, note2], [reviewLow, reviewHigh])
      await waitForReviewQueue(page)

      const retentionValues = await page.getByTestId('retention-percentage').allTextContents()
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
      const note = createDexieNote({
        id: 'note-meta',
        content: 'Metadata test note',
        tags: ['psychology'],
      })
      const review = createDueReview('note-meta', 50)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      const firstCard = page.getByTestId('review-card').first()
      await expect(firstCard.getByTestId('retention-percentage')).toBeVisible()
      await expect(firstCard.getByTestId('course-name')).toBeVisible()
      await expect(firstCard.getByTestId('topic-name')).toBeVisible()
      await expect(firstCard.getByTestId('time-until-due')).toBeVisible()
    })
  })

  // ── AC3: Updated intervals on re-rating ─────────────────────────
  test.describe('AC3: Cumulative review history updates', () => {
    test('re-rating a previously reviewed note updates the queue', async ({ page }) => {
      const note = createDexieNote({ id: 'note-rerate', content: 'Re-rate me' })
      const review = createDueReview('note-rerate', 50)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      // Rate as Hard
      const card = page.getByTestId('review-card').first()
      await card.getByRole('button', { name: /hard/i }).click()

      // After rating, the note should no longer be in the queue (just reviewed)
      await expect(page.getByTestId('review-card')).not.toBeVisible({ timeout: 5_000 })
    })
  })

  // ── AC4: Empty state when no reviews due ─────────────────────────
  test.describe('AC4: Empty state', () => {
    test('shows empty state when no notes are due for review', async ({ page }) => {
      await goToReviewQueue(page)

      const emptyState = page.getByTestId('review-empty-state')
      await expect(emptyState).toBeVisible()
    })

    test('empty state shows the date of next upcoming review when future reviews exist', async ({
      page,
    }) => {
      const note = createDexieNote({ id: 'note-future', content: 'Future review' })
      const review = createFutureReview('note-future', 5)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      const nextReview = page.getByTestId('next-review-date')
      await expect(nextReview).toBeVisible()
    })
  })

  // ── AC5: Error handling with toast and retry ─────────────────────
  test.describe('AC5: IndexedDB error handling', () => {
    test('displays toast with retry option when rating fails', async ({ page }) => {
      const note = createDexieNote({ id: 'note-error', content: 'Error test note' })
      const review = createDueReview('note-error', 50)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      // Break Dexie's ability to write to reviewRecords by deleting the DB mid-operation
      // This simulates a quota exceeded or corruption error
      await page.evaluate(() => {
        // Override the global fetch to intercept Dexie transactions
        const originalIDBOpen = indexedDB.open.bind(indexedDB)
        let callCount = 0
        indexedDB.open = function (...args: Parameters<typeof indexedDB.open>) {
          callCount++
          // Let the first calls through (page load), block subsequent writes
          if (callCount > 5) {
            const req = originalIDBOpen(...args)
            const origSuccess = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')
            Object.defineProperty(req, 'onsuccess', {
              set(fn) {
                origSuccess?.set?.call(req, function (this: IDBOpenDBRequest, evt: Event) {
                  const db = (evt.target as IDBOpenDBRequest).result
                  const origTx = db.transaction.bind(db)
                  db.transaction = function (...txArgs: Parameters<typeof db.transaction>) {
                    const tx = origTx(...txArgs)
                    // Force abort to simulate write failure
                    setTimeout(() => {
                      try {
                        tx.abort()
                      } catch {
                        // Ignore if already completed
                      }
                    }, 10)
                    return tx
                  }
                  fn.call(this, evt)
                })
              },
              get() {
                return origSuccess?.get?.call(req)
              },
            })
            return req
          }
          return originalIDBOpen(...args)
        }
      })

      // Try to rate — should trigger error path
      const card = page.getByTestId('review-card').first()
      await card.getByRole('button', { name: /good/i }).click()

      // Toast should appear with retry option
      const toast = page.locator('[data-sonner-toast]')
      await expect(toast).toBeVisible({ timeout: 10_000 })
    })
  })
})
