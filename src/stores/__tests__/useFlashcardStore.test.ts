import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Flashcard } from '@/data/types'

let useFlashcardStore: (typeof import('@/stores/useFlashcardStore'))['useFlashcardStore']
let db: (typeof import('@/db/schema'))['db']

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    front: 'What is spaced repetition?',
    back: 'A technique that spaces reviews at increasing intervals.',
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    ...overrides,
  }
}

function makeDueFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return makeFlashcard({
    reviewCount: 1,
    reviewedAt: new Date(FIXED_DATE.getTime() - 4 * 86400000).toISOString(),
    nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(), // 1 day ago
    interval: 3,
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
  it('should create flashcard with default SM-2 values', async () => {
    await useFlashcardStore.getState().createFlashcard('front', 'back', 'course-1')

    const state = useFlashcardStore.getState()
    expect(state.flashcards).toHaveLength(1)
    const card = state.flashcards[0]
    expect(card.front).toBe('front')
    expect(card.back).toBe('back')
    expect(card.courseId).toBe('course-1')
    expect(card.interval).toBe(0)
    expect(card.easeFactor).toBe(2.5)
    expect(card.reviewCount).toBe(0)
    expect(card.nextReviewAt).toBeUndefined()
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
  it('should return never-reviewed cards (no nextReviewAt)', () => {
    const neverReviewed = makeFlashcard({ id: 'new-card' })
    const futureCard = makeFlashcard({
      id: 'future',
      nextReviewAt: new Date(FIXED_DATE.getTime() + 86400000).toISOString(),
    })

    useFlashcardStore.setState({ flashcards: [neverReviewed, futureCard] })

    const due = useFlashcardStore.getState().getDueFlashcards(FIXED_DATE)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('new-card')
  })

  it('should return cards with past nextReviewAt', () => {
    const dueCard = makeDueFlashcard({ id: 'due' })
    const futureCard = makeFlashcard({
      id: 'future',
      nextReviewAt: new Date(FIXED_DATE.getTime() + 7 * 86400000).toISOString(),
    })

    useFlashcardStore.setState({ flashcards: [dueCard, futureCard] })

    const due = useFlashcardStore.getState().getDueFlashcards(FIXED_DATE)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('due')
  })

  it('should sort by ascending retention (lowest retention first)', () => {
    const lowRetention = makeDueFlashcard({
      id: 'low',
      interval: 1,
      reviewedAt: new Date(FIXED_DATE.getTime() - 5 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 4 * 86400000).toISOString(),
    })
    const highRetention = makeDueFlashcard({
      id: 'high',
      interval: 30,
      reviewedAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 3600000).toISOString(),
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
      nextReviewAt: new Date(FIXED_DATE.getTime() + 86400000).toISOString(),
    })
    useFlashcardStore.setState({ flashcards: [dueCard, futureCard] })

    useFlashcardStore.getState().startReviewSession(FIXED_DATE)

    const { reviewQueue, isReviewActive, reviewIndex } = useFlashcardStore.getState()
    expect(reviewQueue).toHaveLength(1)
    expect(isReviewActive).toBe(true)
    expect(reviewIndex).toBe(0)
  })

  it('rateFlashcard advances reviewIndex and updates SM-2 fields', async () => {
    const card = makeFlashcard()
    await db.flashcards.put(card)
    useFlashcardStore.setState({ flashcards: [card], reviewQueue: [card], reviewIndex: 0 })

    await useFlashcardStore.getState().rateFlashcard('good', FIXED_DATE)

    const state = useFlashcardStore.getState()
    expect(state.reviewIndex).toBe(1)
    expect(state.sessionRatings).toEqual(['good'])

    const updatedCard = state.flashcards.find(c => c.id === card.id)!
    expect(updatedCard.reviewCount).toBe(1)
    expect(updatedCard.interval).toBe(3) // first-review 'good' = 3 days
    expect(updatedCard.nextReviewAt).toBeTruthy()
    expect(updatedCard.lastRating).toBe('good')
  })

  it('SM-2 interval ordering: Easy > Good > Hard', async () => {
    async function getIntervalForRating(rating: 'hard' | 'good' | 'easy') {
      await Dexie.delete('ElearningDB')
      vi.resetModules()
      const { useFlashcardStore: store } = await import('@/stores/useFlashcardStore')
      const { db: freshDb } = await import('@/db/schema')
      const card = makeFlashcard({ id: `card-${rating}` })
      await freshDb.flashcards.put(card)
      store.setState({ flashcards: [card], reviewQueue: [card], reviewIndex: 0 })
      await store.getState().rateFlashcard(rating, FIXED_DATE)
      const updated = store.getState().flashcards.find(c => c.id === card.id)!
      return updated.interval
    }

    const hardInterval = await getIntervalForRating('hard')
    const goodInterval = await getIntervalForRating('good')
    const easyInterval = await getIntervalForRating('easy')

    expect(easyInterval).toBeGreaterThan(goodInterval)
    expect(goodInterval).toBeGreaterThan(hardInterval)
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
      nextReviewAt: new Date(FIXED_DATE.getTime() + 3 * 86400000).toISOString(),
      reviewCount: 1,
    })
    const neverReviewedCard = makeFlashcard()

    useFlashcardStore.setState({ flashcards: [dueCard, futureCard, neverReviewedCard] })

    const stats = useFlashcardStore.getState().getStats(FIXED_DATE)
    expect(stats.total).toBe(3)
    expect(stats.dueToday).toBe(2) // dueCard + neverReviewedCard
    expect(stats.nextReviewDate).toBe(futureCard.nextReviewAt)
  })

  it('returns nextReviewDate null when no cards have future reviews', () => {
    useFlashcardStore.setState({ flashcards: [] })
    const stats = useFlashcardStore.getState().getStats(FIXED_DATE)
    expect(stats.nextReviewDate).toBeNull()
  })
})
