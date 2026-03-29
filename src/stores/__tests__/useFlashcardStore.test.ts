import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Flashcard, CardState } from '@/data/types'

let useFlashcardStore: (typeof import('@/stores/useFlashcardStore'))['useFlashcardStore']
let db: (typeof import('@/db/schema'))['db']

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    front: 'What is spaced repetition?',
    back: 'A technique that spaces reviews at increasing intervals.',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0 as CardState,
    elapsed_days: 0,
    scheduled_days: 0,
    due: FIXED_DATE.toISOString(), // New cards are due immediately
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    ...overrides,
  }
}

function makeDueFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return makeFlashcard({
    reps: 1,
    stability: 3,
    difficulty: 5,
    state: 2 as CardState, // Review state
    last_review: new Date(FIXED_DATE.getTime() - 4 * 86400000).toISOString(),
    due: new Date(FIXED_DATE.getTime() - 86400000).toISOString(), // 1 day ago
    scheduled_days: 3,
    elapsed_days: 4,
    ...overrides,
  })
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeModule = await import('@/stores/useFlashcardStore')
  useFlashcardStore = storeModule.useFlashcardStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
})

describe('loadFlashcards', () => {
  it('should load flashcards from IndexedDB', async () => {
    const card = makeFlashcard({ front: 'Test front' })
    await db.flashcards.put(card)

    await useFlashcardStore.getState().loadFlashcards()

    const state = useFlashcardStore.getState()
    expect(state.flashcards).toHaveLength(1)
    expect(state.flashcards[0].front).toBe('Test front')
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set error state on load failure', async () => {
    vi.spyOn(db.flashcards, 'toArray').mockRejectedValueOnce(new Error('DB error'))

    await useFlashcardStore.getState().loadFlashcards()

    const state = useFlashcardStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Failed to load flashcards')
  })
})

describe('createFlashcard', () => {
  it('should create flashcard with default FSRS values', async () => {
    await useFlashcardStore.getState().createFlashcard('front', 'back', 'course-1')

    const state = useFlashcardStore.getState()
    expect(state.flashcards).toHaveLength(1)
    const card = state.flashcards[0]
    expect(card.front).toBe('front')
    expect(card.back).toBe('back')
    expect(card.courseId).toBe('course-1')
    expect(card.stability).toBe(0)
    expect(card.difficulty).toBe(0)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.state).toBe(0)
    expect(card.elapsed_days).toBe(0)
    expect(card.scheduled_days).toBe(0)
    expect(card.due).toBeTruthy()
    expect(card.last_review).toBeUndefined()
  })

  it('should persist to IndexedDB', async () => {
    await useFlashcardStore.getState().createFlashcard('Q', 'A', 'course-1', 'note-1')

    const cards = await db.flashcards.toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0].noteId).toBe('note-1')
  })

  it('should rollback optimistic update on persist failure', async () => {
    vi.spyOn(db.flashcards, 'add').mockRejectedValue(new Error('DB full'))

    await useFlashcardStore.getState().createFlashcard('Q', 'A', 'course-1')

    const state = useFlashcardStore.getState()
    expect(state.flashcards).toHaveLength(0)
  })
})

describe('deleteFlashcard', () => {
  it('should remove flashcard from store and IndexedDB', async () => {
    const card = makeFlashcard()
    await db.flashcards.put(card)
    await useFlashcardStore.getState().loadFlashcards()

    await useFlashcardStore.getState().deleteFlashcard(card.id)

    expect(useFlashcardStore.getState().flashcards).toHaveLength(0)
    const inDb = await db.flashcards.get(card.id)
    expect(inDb).toBeUndefined()
  })
})

describe('getDueFlashcards', () => {
  it('should return new cards (never reviewed, due <= now)', () => {
    const neverReviewed = makeFlashcard({ id: 'new-card' })
    const futureCard = makeFlashcard({
      id: 'future',
      due: new Date(FIXED_DATE.getTime() + 86400000).toISOString(),
    })

    useFlashcardStore.setState({ flashcards: [neverReviewed, futureCard] })

    const due = useFlashcardStore.getState().getDueFlashcards(FIXED_DATE)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('new-card')
  })

  it('should return cards with past due date', () => {
    const dueCard = makeDueFlashcard({ id: 'due' })
    const futureCard = makeFlashcard({
      id: 'future',
      due: new Date(FIXED_DATE.getTime() + 7 * 86400000).toISOString(),
    })

    useFlashcardStore.setState({ flashcards: [dueCard, futureCard] })

    const due = useFlashcardStore.getState().getDueFlashcards(FIXED_DATE)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('due')
  })

  it('should sort by ascending retention (lowest retention first)', () => {
    const lowRetention = makeDueFlashcard({
      id: 'low',
      stability: 1,
      last_review: new Date(FIXED_DATE.getTime() - 5 * 86400000).toISOString(),
      due: new Date(FIXED_DATE.getTime() - 4 * 86400000).toISOString(),
    })
    const highRetention = makeDueFlashcard({
      id: 'high',
      stability: 30,
      last_review: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      due: new Date(FIXED_DATE.getTime() - 3600000).toISOString(),
    })

    useFlashcardStore.setState({ flashcards: [highRetention, lowRetention] })

    const due = useFlashcardStore.getState().getDueFlashcards(FIXED_DATE)
    expect(due[0].id).toBe('low')
  })
})

describe('review session', () => {
  it('startReviewSession populates reviewQueue with due cards', () => {
    const dueCard = makeDueFlashcard()
    const futureCard = makeFlashcard({
      due: new Date(FIXED_DATE.getTime() + 86400000).toISOString(),
    })
    useFlashcardStore.setState({ flashcards: [dueCard, futureCard] })

    useFlashcardStore.getState().startReviewSession(FIXED_DATE)

    const { reviewQueue, isReviewActive, reviewIndex } = useFlashcardStore.getState()
    expect(reviewQueue).toHaveLength(1)
    expect(isReviewActive).toBe(true)
    expect(reviewIndex).toBe(0)
  })

  it('rateFlashcard advances reviewIndex and updates FSRS fields', async () => {
    const card = makeFlashcard()
    await db.flashcards.put(card)
    useFlashcardStore.setState({ flashcards: [card], reviewQueue: [card], reviewIndex: 0 })

    await useFlashcardStore.getState().rateFlashcard('good', FIXED_DATE)

    const state = useFlashcardStore.getState()
    expect(state.reviewIndex).toBe(1)
    expect(state.sessionRatings).toEqual(['good'])

    const updatedCard = state.flashcards.find(c => c.id === card.id)!
    expect(updatedCard.reps).toBe(1)
    expect(updatedCard.stability).toBeGreaterThan(0)
    expect(updatedCard.difficulty).toBeGreaterThan(0)
    expect(updatedCard.due).toBeTruthy()
    expect(updatedCard.last_review).toBeTruthy()
    expect(updatedCard.lastRating).toBe('good')
  })

  it('FSRS due date ordering: Easy > Good > Hard (later due = longer interval)', async () => {
    async function getDueDateForRating(rating: 'hard' | 'good' | 'easy') {
      await Dexie.delete('ElearningDB')
      vi.resetModules()
      const { useFlashcardStore: store } = await import('@/stores/useFlashcardStore')
      const { db: freshDb } = await import('@/db/schema')
      const card = makeFlashcard({ id: `card-${rating}` })
      await freshDb.flashcards.put(card)
      store.setState({ flashcards: [card], reviewQueue: [card], reviewIndex: 0 })
      await store.getState().rateFlashcard(rating, FIXED_DATE)
      const updated = store.getState().flashcards.find(c => c.id === card.id)!
      return new Date(updated.due).getTime()
    }

    const hardDue = await getDueDateForRating('hard')
    const goodDue = await getDueDateForRating('good')
    const easyDue = await getDueDateForRating('easy')

    expect(easyDue).toBeGreaterThan(goodDue)
    expect(goodDue).toBeGreaterThan(hardDue)
  })

  it('getSessionSummary returns correct rating counts', () => {
    useFlashcardStore.setState({
      sessionRatings: ['hard', 'good', 'good', 'easy'],
      flashcards: [],
    })

    const summary = useFlashcardStore.getState().getSessionSummary()
    expect(summary.totalReviewed).toBe(4)
    expect(summary.ratings.hard).toBe(1)
    expect(summary.ratings.good).toBe(2)
    expect(summary.ratings.easy).toBe(1)
  })

  it('resetReviewSession clears session state', () => {
    useFlashcardStore.setState({
      reviewQueue: [makeFlashcard()],
      reviewIndex: 1,
      sessionRatings: ['good'],
      isReviewActive: true,
    })

    useFlashcardStore.getState().resetReviewSession()

    const state = useFlashcardStore.getState()
    expect(state.reviewQueue).toHaveLength(0)
    expect(state.reviewIndex).toBe(0)
    expect(state.sessionRatings).toHaveLength(0)
    expect(state.isReviewActive).toBe(false)
  })
})

describe('getStats', () => {
  it('returns total, dueToday, and nextReviewDate', () => {
    const dueCard = makeDueFlashcard()
    const futureCard = makeFlashcard({
      due: new Date(FIXED_DATE.getTime() + 3 * 86400000).toISOString(),
      last_review: FIXED_DATE.toISOString(),
      reps: 1,
    })
    const neverReviewedCard = makeFlashcard()

    useFlashcardStore.setState({ flashcards: [dueCard, futureCard, neverReviewedCard] })

    const stats = useFlashcardStore.getState().getStats(FIXED_DATE)
    expect(stats.total).toBe(3)
    expect(stats.dueToday).toBe(2) // dueCard + neverReviewedCard
    expect(stats.nextReviewDate).toBe(futureCard.due)
  })

  it('returns nextReviewDate null when no cards have future reviews', () => {
    useFlashcardStore.setState({ flashcards: [] })
    const stats = useFlashcardStore.getState().getStats(FIXED_DATE)
    expect(stats.nextReviewDate).toBeNull()
  })
})
