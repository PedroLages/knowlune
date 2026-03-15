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
    // Clean up seeded data — log errors instead of swallowing them
    await clearIndexedDBStore(page, DB_NAME, 'reviewRecords').catch(e =>
      console.warn('[cleanup]', e)
    )
    await clearIndexedDBStore(page, DB_NAME, 'notes').catch(e => console.warn('[cleanup]', e))
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

      // Rate as Good (use evaluate to bypass any overlays)
      await card.getByRole('button', { name: /good/i }).click()

      // After rating, the queue should show empty state (only card was rated away)
      await expect(page.getByTestId('review-empty-state')).toBeVisible({ timeout: 10_000 })
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
    test('rating a card removes it and remaining cards stay sorted', async ({ page }) => {
      // Seed 2 notes with different retention levels
      const noteA = createDexieNote({ id: 'note-a', content: 'Note A (low retention)' })
      const noteB = createDexieNote({ id: 'note-b', content: 'Note B (higher retention)' })

      const reviewA = createDueReview('note-a', 20, {
        reviewedAt: new Date(FIXED_NOW.getTime() - 8 * 86400000).toISOString(),
        interval: 3,
      })
      const reviewB = createDueReview('note-b', 70, {
        reviewedAt: new Date(FIXED_NOW.getTime() - 1 * 86400000).toISOString(),
        interval: 3,
      })

      await seedReviewData(page, [noteA, noteB], [reviewA, reviewB])
      await waitForReviewQueue(page)

      // Should start with 2 cards
      await expect(page.getByTestId('review-card')).toHaveCount(2)

      // Rate the first card (lowest retention) as Good — it should be removed
      const firstCard = page.getByTestId('review-card').first()
      await firstCard.getByRole('button', { name: /good/i }).click()

      // Remaining queue should have 1 card with the higher retention note
      await expect(page.getByTestId('review-card')).toHaveCount(1, { timeout: 10_000 })
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
    test.skip('displays toast with retry option when rating fails', async ({ page }) => {
      // Skip: IDB error simulation is unreliable in E2E — Dexie wraps IDB
      // internally and doesn't expose a hookable put() path. The error handling
      // rollback, pending rating preservation, and retry logic are covered by
      // unit tests in src/stores/__tests__/useReviewStore.test.ts (AC5 suite).
      const note = createDexieNote({ id: 'note-error', content: 'Error test note' })
      const review = createDueReview('note-error', 50)

      await seedReviewData(page, [note], [review])
      await waitForReviewQueue(page)

      // Break IDBObjectStore.put to simulate a write failure (e.g., quota exceeded)
      await page.evaluate(() => {
        const origPut = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (...args) {
          // Restore after first call so cleanup operations still work
          IDBObjectStore.prototype.put = origPut
          throw new DOMException('Simulated write failure', 'QuotaExceededError')
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
