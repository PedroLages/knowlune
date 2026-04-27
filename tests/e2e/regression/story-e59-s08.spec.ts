/**
 * ATDD — E59-S08: E2E Tests and Test Factory Updates
 *
 * Validates that FSRS scheduling works end-to-end:
 * - Flashcard creation seeds with FSRS defaults
 * - Review rating updates FSRS fields in IndexedDB
 * - Due date filtering works with FSRS `due` field
 * - Review queue shows cards with `due` in the past
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import {
  clearIndexedDBStore,
  seedNotes,
  seedReviewRecords,
  seedFlashcards,
  seedImportedCourses,
} from '../../support/helpers/seed-helpers'
import { createDexieNote } from '../../support/fixtures/factories/note-factory'
import {
  createDueReviewRecord,
  createFutureReviewRecord,
} from '../../support/fixtures/factories/review-factory'
import {
  createFlashcard,
  createDueFlashcard,
  createFutureFlashcard,
} from '../../support/fixtures/factories/flashcard-factory'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

test.describe('E59-S08: FSRS Scheduling E2E Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze browser clock to FIXED_DATE so FSRS due-date filtering is deterministic.
    // Without this, test data dates (relative to FIXED_DATE = 2025-01-15) are all
    // in the past relative to real time, making "future" reviews appear due.
    await page.clock.install({ time: new Date(FIXED_DATE) })
    // Navigate to initialise the app and database
    await page.goto('/')
    // Prevent sidebar overlay in tablet viewports
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))
  })

  test.afterEach(async ({ page }) => {
    // Clean up IndexedDB stores
    await clearIndexedDBStore(page, DB_NAME, 'reviewRecords').catch(e =>
      console.warn('[cleanup]', e)
    )
    await clearIndexedDBStore(page, DB_NAME, 'notes').catch(e => console.warn('[cleanup]', e))
    await clearIndexedDBStore(page, DB_NAME, 'flashcards').catch(e => console.warn('[cleanup]', e))
    await clearIndexedDBStore(page, DB_NAME, 'importedCourses').catch(e =>
      console.warn('[cleanup]', e)
    )
  })

  // ── AC1: Review records with FSRS fields are recognized as due ──────
  test('review queue shows cards where FSRS due date is in the past', async ({ page }) => {
    const note = createDexieNote({ id: 'note-due-fsrs', content: 'FSRS due note' })
    const dueReview = createDueReviewRecord({
      id: 'review-due-fsrs',
      noteId: 'note-due-fsrs',
      due: getRelativeDate(-1),
      last_review: getRelativeDate(-5),
      stability: 4.0,
    })

    await navigateAndWait(page, '/review')
    await seedNotes(page, [note])
    await seedReviewRecords(page, [dueReview])
    await page.reload()
    await page.waitForLoadState('load')

    // Wait for review card to appear
    await expect(page.getByTestId('review-card')).toBeVisible({ timeout: 15_000 })

    // Card should display retention percentage (computed from FSRS stability + last_review)
    await expect(page.getByTestId('retention-percentage').first()).toBeVisible()
  })

  // ── AC2: Future review records (FSRS due in future) are not shown ───
  test('review queue does not show cards where FSRS due date is in the future', async ({
    page,
  }) => {
    const note = createDexieNote({ id: 'note-future-fsrs', content: 'FSRS future note' })
    const futureReview = createFutureReviewRecord({
      id: 'review-future-fsrs',
      noteId: 'note-future-fsrs',
      due: getRelativeDate(3),
      last_review: FIXED_DATE,
      stability: 10.0,
    })

    await navigateAndWait(page, '/review')
    await seedNotes(page, [note])
    await seedReviewRecords(page, [futureReview])
    await page.reload()
    await page.waitForLoadState('load')

    // Empty state should appear (no cards due)
    await expect(page.getByTestId('review-empty-state')).toBeVisible({ timeout: 15_000 })

    // Next review date should be visible
    await expect(page.getByTestId('next-review-date')).toBeVisible()
  })

  // ── AC3: Rating a review card updates FSRS fields in IDB ────────────
  test('rating a review card persists FSRS fields (stability, due, reps) to IndexedDB', async ({
    page,
  }) => {
    const note = createDexieNote({ id: 'note-rate-fsrs', content: 'Rate this FSRS note' })
    const review = createDueReviewRecord({
      id: 'review-rate-fsrs',
      noteId: 'note-rate-fsrs',
      stability: 3.0,
      reps: 1,
      due: getRelativeDate(-1),
      last_review: getRelativeDate(-3),
    })

    await navigateAndWait(page, '/review')
    await seedNotes(page, [note])
    await seedReviewRecords(page, [review])
    await page.reload()
    await page.waitForLoadState('load')

    // Wait for review card
    const card = page.getByTestId('review-card').first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    // Rate as "Good"
    await card.getByRole('button', { name: /good/i }).click()

    // Wait for rating to persist (empty state means card was rated away)
    await expect(page.getByTestId('review-empty-state')).toBeVisible({ timeout: 10_000 })

    // Read the updated record from IndexedDB and verify FSRS fields
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- reading IDB for verification
    const updated = await page.evaluate(async () => {
      const dbReq = indexedDB.open('ElearningDB')
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        dbReq.onsuccess = () => resolve(dbReq.result)
        dbReq.onerror = () => reject(dbReq.error)
      })
      const tx = db.transaction('reviewRecords', 'readonly')
      const store = tx.objectStore('reviewRecords')
      const all: Array<{
        id: string
        stability: number
        difficulty: number
        reps: number
        state: number
        due: string
        last_review: string
      }> = await new Promise((resolve, reject) => {
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      db.close()
      return all.find(r => r.id === 'review-rate-fsrs') ?? null
    })

    expect(updated).not.toBeNull()
    // After Good rating, FSRS should increase stability
    expect(updated!.stability).toBeGreaterThan(0)
    // Reps should be incremented
    expect(updated!.reps).toBeGreaterThanOrEqual(2)
    // Due date should be in the future (relative to FIXED_DATE)
    expect(new Date(updated!.due).getTime()).toBeGreaterThan(new Date(FIXED_DATE).getTime())
    // last_review should be recent
    expect(updated!.last_review).toBeDefined()
    // State should transition from New/Learning to Review (2) or stay in Review
    expect([1, 2, 3]).toContain(updated!.state)
  })

  // ── AC4: Flashcard seeding with FSRS defaults shows on dashboard ────
  test('flashcards seeded with FSRS fields appear on flashcards dashboard', async ({ page }) => {
    const course = createImportedCourse({ id: 'course-fc-test', name: 'FC Test Course' })
    const dueCard = createDueFlashcard({
      id: 'fc-due',
      courseId: 'course-fc-test',
      front: 'What is FSRS?',
      back: 'Free Spaced Repetition Scheduler',
    })
    const futureCard = createFutureFlashcard({
      id: 'fc-future',
      courseId: 'course-fc-test',
      front: 'What is stability?',
      back: 'Memory strength in days',
    })

    await seedImportedCourses(page, [course])
    await seedFlashcards(page, [dueCard, futureCard])
    await page.goto('/flashcards')
    await page.waitForLoadState('load')

    // Stats should show total cards
    const totalStat = page.getByTestId('flashcard-stats-total')
    await expect(totalStat).toBeVisible({ timeout: 15_000 })
    await expect(totalStat).toContainText('2')

    // Due today should show 1 (only the due card)
    const dueStat = page.getByTestId('flashcard-stats-due')
    await expect(dueStat).toBeVisible()
    await expect(dueStat).toContainText('1')
  })

  test('course-scoped flashcards route renders only that course deck', async ({ page }) => {
    const courseOne = createImportedCourse({ id: 'course-scoped-one', name: 'Scoped Course One' })
    const courseTwo = createImportedCourse({ id: 'course-scoped-two', name: 'Scoped Course Two' })
    const courseOneDue = createDueFlashcard({
      id: 'fc-course-one-due',
      courseId: courseOne.id,
      front: 'Course one due card',
      back: 'Due answer',
    })
    const courseOneFuture = createFutureFlashcard({
      id: 'fc-course-one-future',
      courseId: courseOne.id,
      front: 'Course one future card',
      back: 'Future answer',
    })
    const courseTwoDue = createDueFlashcard({
      id: 'fc-course-two-due',
      courseId: courseTwo.id,
      front: 'Course two due card',
      back: 'Other answer',
    })

    await seedImportedCourses(page, [courseOne, courseTwo])
    await seedFlashcards(page, [courseOneDue, courseOneFuture, courseTwoDue])
    await page.goto(`/courses/${courseOne.id}/flashcards`)
    await page.waitForLoadState('load')

    await expect(page.getByText('Scoped Course One deck')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('flashcard-stats-total')).toContainText('2')
    await expect(page.getByTestId('flashcard-stats-due')).toContainText('1')
    await expect(page.getByTestId('course-decks-section')).toBeHidden()
  })

  test('global flashcards dashboard links to course decks', async ({ page }) => {
    const courseOne = createImportedCourse({ id: 'course-decks-one', name: 'Deck Course One' })
    const courseTwo = createImportedCourse({ id: 'course-decks-two', name: 'Deck Course Two' })
    await seedImportedCourses(page, [courseOne, courseTwo])
    await seedFlashcards(page, [
      createDueFlashcard({ id: 'fc-deck-one', courseId: courseOne.id }),
      createFutureFlashcard({ id: 'fc-deck-two', courseId: courseTwo.id }),
    ])

    await page.goto('/flashcards')
    await page.waitForLoadState('load')

    await expect(page.getByTestId('course-decks-section')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId(`course-deck-card-${courseOne.id}`)).toContainText(
      'Deck Course One'
    )
    await expect(page.getByTestId(`course-deck-card-${courseTwo.id}`)).toContainText(
      'Deck Course Two'
    )

    await page.getByTestId(`course-deck-link-${courseOne.id}`).click()
    await expect(page).toHaveURL(new RegExp(`/courses/${courseOne.id}/flashcards$`))
    await expect(page.getByText('Deck Course One deck')).toBeVisible()
  })

  // ── AC5: New flashcard defaults have correct FSRS state ─────────────
  test('new flashcard created via factory has state=0, stability=0, reps=0', () => {
    const card = createFlashcard()
    expect(card.state).toBe(0) // New
    expect(card.stability).toBe(0)
    expect(card.difficulty).toBe(0)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.due).toBe(FIXED_DATE)
    expect(card.last_review).toBeUndefined()
  })

  // ── AC6: Due flashcard has correct FSRS review state ────────────────
  test('due flashcard created via factory has state=2, due in the past', () => {
    const card = createDueFlashcard()
    expect(card.state).toBe(2) // Review
    expect(card.stability).toBeGreaterThan(0)
    expect(card.reps).toBeGreaterThan(0)
    expect(new Date(card.due).getTime()).toBeLessThan(new Date(FIXED_DATE).getTime())
    expect(card.last_review).toBeDefined()
  })

  // ── AC7: Future flashcard has due date in the future ────────────────
  test('future flashcard created via factory has due in the future', () => {
    const card = createFutureFlashcard()
    expect(card.state).toBe(2) // Review
    expect(new Date(card.due).getTime()).toBeGreaterThan(new Date(FIXED_DATE).getTime())
    expect(card.last_review).toBe(FIXED_DATE)
  })

  // ── AC8: Review factory creates FSRS-compatible records ─────────────
  test('review factory creates records with all required FSRS fields', () => {
    const record = createDueReviewRecord({ id: 'test-review', noteId: 'test-note' })

    // All FSRS fields should be present
    expect(record.stability).toBeDefined()
    expect(record.difficulty).toBeDefined()
    expect(record.reps).toBeDefined()
    expect(record.lapses).toBeDefined()
    expect(record.state).toBeDefined()
    expect(record.elapsed_days).toBeDefined()
    expect(record.scheduled_days).toBeDefined()
    expect(record.due).toBeDefined()
    expect(record.last_review).toBeDefined()

    // SM-2 fields should NOT be present
    expect((record as Record<string, unknown>).nextReviewAt).toBeUndefined()
    expect((record as Record<string, unknown>).easeFactor).toBeUndefined()
    expect((record as Record<string, unknown>).reviewCount).toBeUndefined()
    expect((record as Record<string, unknown>).interval).toBeUndefined()
    expect((record as Record<string, unknown>).reviewedAt).toBeUndefined()
  })
})
