/**
 * p1-flashcard-sync.test.ts — E93-S04 integration tests for flashcard sync wiring.
 *
 * Verifies the end-to-end wiring:
 *   Store mutation → syncableWrite → Dexie write + syncQueue entry
 *   rateFlashcard → syncableWrite (card state) + supabase INSERT (review event)
 *   replayFlashcardReviews → Supabase SELECT → calculateNextReview replay → Dexie put
 *
 * Test structure:
 *   1. useFlashcardStore — authenticated writes (createFlashcard, deleteFlashcard, rateFlashcard)
 *   2. useFlashcardStore — unauthenticated writes (no queue entries, no Supabase INSERT)
 *   3. replayFlashcardReviews (FSRS replay correctness + guard conditions)
 *
 * Follows the p1-notes-bookmarks-sync.test.ts pattern:
 *   fake-indexeddb/auto, vi.resetModules() in beforeEach, Dexie.delete('ElearningDB').
 *
 * @module p1-flashcard-sync
 * @since E93-S04
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import { calculateNextReview, fsrsTest } from '@/lib/spacedRepetition'
import type { ReviewRating, Flashcard } from '@/data/types'

// ---------------------------------------------------------------------------
// Deterministic date — never use new Date() or Date.now() in tests.
// ---------------------------------------------------------------------------
const FIXED_DATE = new Date('2026-04-18T10:00:00Z')

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-e93-s04'
const TEST_COURSE_ID = 'course-s04'
const TEST_CARD_ID = 'card-e93-s04'

// ---------------------------------------------------------------------------
// Supabase mock — controls INSERT and SELECT responses per test.
// Using module-level mutable state so vi.resetModules() + re-import works.
// ---------------------------------------------------------------------------
type MockInsertResponse = {
  data: unknown[] | null
  error: { code?: string; message?: string } | null
}
type MockSelectResponse = {
  data: Record<string, unknown>[] | null
  error: { message: string } | null
}

let mockInsertResponse: MockInsertResponse = { data: [], error: null }
let mockSelectResponse: MockSelectResponse = { data: [], error: null }
const mockInsert = vi.fn(async () => mockInsertResponse)
const mockSelect = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'flashcard_reviews') {
        return {
          insert: mockInsert,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockImplementation(async () => mockSelectResponse),
        }
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
    }),
  },
}))

// ---------------------------------------------------------------------------
// Module-level re-import handles (refreshed per test by vi.resetModules)
// ---------------------------------------------------------------------------
let useFlashcardStore: (typeof import('@/stores/useFlashcardStore'))['useFlashcardStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']
let replayFlashcardReviews: (typeof import('@/lib/sync/flashcardReplayService'))['replayFlashcardReviews']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlashcard(overrides?: Partial<Flashcard>): Flashcard {
  return {
    id: TEST_CARD_ID,
    courseId: TEST_COURSE_ID,
    front: 'What is FSRS?',
    back: 'Free Spaced Repetition Scheduler',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    due: FIXED_DATE.toISOString(),
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    ...overrides,
  }
}

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  // Reset mock responses to safe defaults.
  mockInsertResponse = { data: [], error: null }
  mockSelectResponse = { data: [], error: null }
  mockInsert.mockClear()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  // Seed a signed-in user by default — individual tests override for unauthenticated.
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 's04-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const flashcardMod = await import('@/stores/useFlashcardStore')
  useFlashcardStore = flashcardMod.useFlashcardStore

  const dbMod = await import('@/db')
  db = dbMod.db

  const replayMod = await import('@/lib/sync/flashcardReplayService')
  replayFlashcardReviews = replayMod.replayFlashcardReviews
})

// ===========================================================================
// 1. useFlashcardStore — authenticated writes
// ===========================================================================

describe('E93-S04 — useFlashcardStore authenticated writes', () => {
  it('createFlashcard: Dexie record created with userId stamped; syncQueue add entry', async () => {
    await useFlashcardStore.getState().createFlashcard('Q?', 'A.', TEST_COURSE_ID)

    const cards = await db.flashcards.toArray()
    expect(cards).toHaveLength(1)
    expect((cards[0] as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('flashcards')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.tableName).toBe('flashcards')
    expect(addEntry!.status).toBe('pending')
  })

  it('deleteFlashcard: Dexie record removed; syncQueue delete entry with correct payload', async () => {
    // First create a card so we have something to delete.
    const card = makeFlashcard({ id: crypto.randomUUID() })
    await db.flashcards.add(card)

    await useFlashcardStore.getState().loadFlashcards()
    await useFlashcardStore.getState().deleteFlashcard(card.id)

    const stored = await db.flashcards.get(card.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('flashcards')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: card.id })
  })

  it('rateFlashcard: syncQueue put entry; Supabase INSERT called with correct fields', async () => {
    const card = makeFlashcard()
    await db.flashcards.add(card)
    await useFlashcardStore.getState().loadFlashcards()

    // Start a review session to populate the review queue.
    useFlashcardStore.setState({ reviewQueue: [card], reviewIndex: 0, isReviewActive: true })

    await useFlashcardStore.getState().rateFlashcard('good', FIXED_DATE)

    // syncQueue should have a put entry for flashcards.
    const entries = await getQueueEntries('flashcards')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.tableName).toBe('flashcards')
    expect(putEntry!.status).toBe('pending')

    // Supabase INSERT should have been called for flashcard_reviews.
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertPayload = (mockInsert.mock.calls as unknown as [Record<string, unknown>][])[0][0]
    expect(insertPayload.flashcard_id).toBe(TEST_CARD_ID)
    expect(insertPayload.rating).toBe('good')
    expect(insertPayload.user_id).toBe(TEST_USER_ID)
    expect(insertPayload.reviewed_at).toBe(FIXED_DATE.toISOString())
    expect(typeof insertPayload.id).toBe('string') // UUID
  })
})

// ===========================================================================
// 2. useFlashcardStore — unauthenticated writes
// ===========================================================================

describe('E93-S04 — useFlashcardStore unauthenticated writes', () => {
  beforeEach(() => {
    // Override auth to unauthenticated for all tests in this block.
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)
  })

  it('createFlashcard unauthenticated: Dexie record created; zero syncQueue entries', async () => {
    await useFlashcardStore.getState().createFlashcard('Q?', 'A.', TEST_COURSE_ID)

    const cards = await db.flashcards.toArray()
    expect(cards).toHaveLength(1)

    const entries = await getQueueEntries('flashcards')
    expect(entries).toHaveLength(0)
  })

  it('deleteFlashcard unauthenticated: Dexie record removed; zero syncQueue entries', async () => {
    const card = makeFlashcard({ id: crypto.randomUUID() })
    await db.flashcards.add(card)
    await useFlashcardStore.getState().loadFlashcards()

    await useFlashcardStore.getState().deleteFlashcard(card.id)

    const stored = await db.flashcards.get(card.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('flashcards')
    expect(entries).toHaveLength(0)
  })

  it('rateFlashcard unauthenticated: Dexie put occurs; zero syncQueue entries; no Supabase INSERT', async () => {
    const card = makeFlashcard()
    await db.flashcards.add(card)
    await useFlashcardStore.getState().loadFlashcards()

    useFlashcardStore.setState({ reviewQueue: [card], reviewIndex: 0, isReviewActive: true })

    await useFlashcardStore.getState().rateFlashcard('good', FIXED_DATE)

    // Dexie write should have occurred (card state updated).
    const stored = await db.flashcards.get(TEST_CARD_ID)
    expect(stored).toBeDefined()
    expect(stored!.reps).toBeGreaterThan(0) // FSRS fields updated

    // No syncQueue entries.
    const entries = await getQueueEntries('flashcards')
    expect(entries).toHaveLength(0)

    // No Supabase INSERT called.
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// 3. replayFlashcardReviews — FSRS replay correctness + guard conditions
// ===========================================================================

describe('E93-S04 — replayFlashcardReviews', () => {
  it('3-review replay: final FSRS state matches manual calculateNextReview(fsrsTest) chain', async () => {
    // Seed the card in Dexie (as if just downloaded by the sync engine).
    const card = makeFlashcard({ last_review: FIXED_DATE.toISOString() })
    await db.flashcards.add(card)

    // Define three review events in chronological order.
    const r1Date = new Date('2026-04-18T10:00:00Z')
    const r2Date = new Date('2026-04-19T10:00:00Z')
    const r3Date = new Date('2026-04-22T10:00:00Z')
    const reviews = [
      {
        id: 'rev-1',
        flashcard_id: TEST_CARD_ID,
        user_id: TEST_USER_ID,
        rating: 'again' as ReviewRating,
        reviewed_at: r1Date.toISOString(),
      },
      {
        id: 'rev-2',
        flashcard_id: TEST_CARD_ID,
        user_id: TEST_USER_ID,
        rating: 'good' as ReviewRating,
        reviewed_at: r2Date.toISOString(),
      },
      {
        id: 'rev-3',
        flashcard_id: TEST_CARD_ID,
        user_id: TEST_USER_ID,
        rating: 'easy' as ReviewRating,
        reviewed_at: r3Date.toISOString(),
      },
    ]

    // Mock Supabase to return these reviews.
    mockSelectResponse = { data: reviews, error: null }

    await replayFlashcardReviews(TEST_CARD_ID)

    // Manually compute expected FSRS state using the same fsrsTest instance.
    let expected = null
    expected = calculateNextReview(expected, 'again', r1Date, fsrsTest)
    expected = calculateNextReview(expected, 'good', r2Date, fsrsTest)
    expected = calculateNextReview(expected, 'easy', r3Date, fsrsTest)

    // Assert the replayed card in Dexie matches the manually computed state.
    const stored = await db.flashcards.get(TEST_CARD_ID)
    expect(stored).toBeDefined()
    expect(stored!.stability).toBeCloseTo(expected.stability, 5)
    expect(stored!.difficulty).toBeCloseTo(expected.difficulty, 5)
    expect(stored!.reps).toBe(expected.reps)
    expect(stored!.lapses).toBe(expected.lapses)
    expect(stored!.state).toBe(expected.state)
    expect(stored!.due).toBe(expected.due)
    expect(stored!.last_review).toBe(expected.last_review)

    // Non-FSRS fields should be preserved from the original card.
    expect(stored!.front).toBe(card.front)
    expect(stored!.back).toBe(card.back)
    expect(stored!.courseId).toBe(TEST_COURSE_ID)
  })

  it('zero reviews: returns without writing to Dexie; existing card unchanged', async () => {
    const card = makeFlashcard()
    await db.flashcards.add(card)

    // Mock: no reviews returned.
    mockSelectResponse = { data: [], error: null }

    await replayFlashcardReviews(TEST_CARD_ID)

    // Card should be unchanged (no syncQueue write either).
    const stored = await db.flashcards.get(TEST_CARD_ID)
    expect(stored?.stability).toBe(0)
    expect(stored?.reps).toBe(0)

    const entries = await getQueueEntries('flashcards')
    expect(entries).toHaveLength(0)
  })

  it('Supabase fetch error: logs warning and returns; existing card unchanged', async () => {
    const card = makeFlashcard()
    await db.flashcards.add(card)

    // Mock: Supabase returns an error.
    mockSelectResponse = { data: null, error: { message: 'Network error' } }

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await replayFlashcardReviews(TEST_CARD_ID)
    consoleSpy.mockRestore()

    // Card unchanged.
    const stored = await db.flashcards.get(TEST_CARD_ID)
    expect(stored?.reps).toBe(0)
  })

  it('unauthenticated: returns early, no Supabase call, no Dexie write', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const card = makeFlashcard()
    await db.flashcards.add(card)

    // Snapshot queue length before — replay should add no entries.
    const queueBefore = await db.syncQueue.toArray()

    await replayFlashcardReviews(TEST_CARD_ID)

    // Card should be unchanged (no FSRS replay applied).
    const stored = await db.flashcards.get(TEST_CARD_ID)
    expect(stored?.reps).toBe(0)
    expect(stored?.stability).toBe(0)

    // No new syncQueue entries should have been created.
    const queueAfter = await db.syncQueue.toArray()
    expect(queueAfter.length).toBe(queueBefore.length)
  })
})
