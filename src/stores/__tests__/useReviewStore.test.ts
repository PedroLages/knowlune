import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { ReviewRecord } from '@/data/types'

let useReviewStore: (typeof import('@/stores/useReviewStore'))['useReviewStore']
let db: (typeof import('@/db/schema'))['db']

const FIXED_DATE = new Date('2026-03-15T12:00:00.000Z')

function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    noteId: 'note-1',
    rating: 'good',
    reviewedAt: new Date(FIXED_DATE.getTime() - 3 * 86400000).toISOString(),
    nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(), // 1 day ago = due
    interval: 3,
    easeFactor: 2.5,
    reviewCount: 1,
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeModule = await import('@/stores/useReviewStore')
  useReviewStore = storeModule.useReviewStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
})

describe('loadReviews', () => {
  it('should load reviews from IndexedDB', async () => {
    const review = makeReview()
    await db.reviewRecords.put(review)

    await useReviewStore.getState().loadReviews()

    const state = useReviewStore.getState()
    expect(state.allReviews).toHaveLength(1)
    expect(state.allReviews[0].noteId).toBe('note-1')
    expect(state.isLoading).toBe(false)
  })
})

describe('rateNote (happy path)', () => {
  it('should update allReviews with new interval and increment reviewCount on success', async () => {
    const review = makeReview({ id: 'review-hp', noteId: 'note-hp', reviewCount: 1 })
    useReviewStore.setState({ allReviews: [review] })

    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    await useReviewStore.getState().rateNote('note-hp', 'good', FIXED_DATE)

    const state = useReviewStore.getState()
    const updated = state.allReviews.find(r => r.noteId === 'note-hp')
    expect(updated).toBeDefined()
    expect(updated!.reviewCount).toBe(2)
    expect(new Date(updated!.nextReviewAt).getTime()).toBeGreaterThan(FIXED_DATE.getTime())
    expect(state.pendingRating).toBeNull()
    expect(state.error).toBeNull()
  })

  it('should create a new review record for a first-time rating', async () => {
    useReviewStore.setState({ allReviews: [] })

    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    await useReviewStore.getState().rateNote('note-new', 'easy', FIXED_DATE)

    const state = useReviewStore.getState()
    expect(state.allReviews).toHaveLength(1)
    expect(state.allReviews[0].noteId).toBe('note-new')
    expect(state.allReviews[0].rating).toBe('easy')
    expect(state.allReviews[0].reviewCount).toBe(1)
    expect(new Date(state.allReviews[0].nextReviewAt).getTime()).toBeGreaterThan(
      FIXED_DATE.getTime()
    )
  })
})

describe('rateNote (AC5 — error handling)', () => {
  it('should rollback optimistic update on persistence failure', async () => {
    const review = makeReview({ id: 'review-1', noteId: 'note-fail' })

    // Pre-populate the store with one review
    useReviewStore.setState({ allReviews: [review] })

    // Mock db.reviewRecords.put to reject (simulating IDB write failure)
    vi.spyOn(db.reviewRecords, 'put').mockRejectedValue(new Error('QuotaExceededError'))

    await useReviewStore.getState().rateNote('note-fail', 'good')

    const state = useReviewStore.getState()

    // allReviews should be rolled back to the original state
    expect(state.allReviews).toHaveLength(1)
    expect(state.allReviews[0].id).toBe('review-1')
    // Original nextReviewAt (in the past), not the new one
    expect(state.allReviews[0].nextReviewAt).toBe(review.nextReviewAt)
    expect(state.error).toBe('Failed to save rating')
  })

  it('should preserve pending rating in memory on failure', async () => {
    const review = makeReview({ noteId: 'note-pending' })
    useReviewStore.setState({ allReviews: [review] })

    vi.spyOn(db.reviewRecords, 'put').mockRejectedValue(new Error('DB write failed'))

    await useReviewStore.getState().rateNote('note-pending', 'hard')

    const state = useReviewStore.getState()
    expect(state.pendingRating).toEqual({ noteId: 'note-pending', rating: 'hard' })
  })

  it('should retry pending rating via retryPendingRating', async () => {
    const review = makeReview({ noteId: 'note-retry' })
    useReviewStore.setState({
      allReviews: [review],
      pendingRating: { noteId: 'note-retry', rating: 'easy' },
    })

    // Allow retry to succeed
    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    await useReviewStore.getState().retryPendingRating()

    const state = useReviewStore.getState()
    // After successful retry, pendingRating should be cleared
    expect(state.pendingRating).toBeNull()
    // The review should be updated (new nextReviewAt in the future)
    const updatedReview = state.allReviews.find(r => r.noteId === 'note-retry')
    expect(updatedReview).toBeDefined()
    expect(new Date(updatedReview!.nextReviewAt).getTime()).toBeGreaterThan(FIXED_DATE.getTime())
  })

  it('should do nothing when retryPendingRating called with no pending', async () => {
    useReviewStore.setState({ pendingRating: null })

    await useReviewStore.getState().retryPendingRating()

    // No error, no state change
    expect(useReviewStore.getState().error).toBeNull()
  })
})

describe('getDueReviews', () => {
  it('should filter and sort by retention (lowest first)', () => {
    const reviewOld = makeReview({
      id: 'old',
      noteId: 'note-old',
      reviewedAt: new Date(FIXED_DATE.getTime() - 8 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      interval: 3,
    })
    const reviewRecent = makeReview({
      id: 'recent',
      noteId: 'note-recent',
      reviewedAt: new Date(FIXED_DATE.getTime() - 1 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      interval: 3,
    })

    useReviewStore.setState({ allReviews: [reviewRecent, reviewOld] })

    const due = useReviewStore.getState().getDueReviews(FIXED_DATE)
    expect(due).toHaveLength(2)
    // Old review has lower retention (reviewed longer ago) → comes first
    expect(due[0].noteId).toBe('note-old')
    expect(due[1].noteId).toBe('note-recent')
  })

  it('should exclude reviews not yet due', () => {
    const futureReview = makeReview({
      nextReviewAt: new Date(FIXED_DATE.getTime() + 5 * 86400000).toISOString(),
    })

    useReviewStore.setState({ allReviews: [futureReview] })

    const due = useReviewStore.getState().getDueReviews(FIXED_DATE)
    expect(due).toHaveLength(0)
  })
})

describe('AC3 — queue re-sorts after rating', () => {
  it('should re-sort due reviews by retention after a rating', async () => {
    const reviewA = makeReview({
      id: 'a',
      noteId: 'note-a',
      reviewedAt: new Date(FIXED_DATE.getTime() - 8 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      interval: 3,
    })
    const reviewB = makeReview({
      id: 'b',
      noteId: 'note-b',
      reviewedAt: new Date(FIXED_DATE.getTime() - 2 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
      interval: 3,
    })

    useReviewStore.setState({ allReviews: [reviewA, reviewB] })

    // Before rating: note-a has lower retention (reviewed longer ago) → first
    const dueBefore = useReviewStore.getState().getDueReviews(FIXED_DATE)
    expect(dueBefore[0].noteId).toBe('note-a')

    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    // Rate note-a as 'good' — pushes it to the future, leaving only note-b due
    await useReviewStore.getState().rateNote('note-a', 'good', FIXED_DATE)

    const dueAfter = useReviewStore.getState().getDueReviews(FIXED_DATE)
    expect(dueAfter).toHaveLength(1)
    expect(dueAfter[0].noteId).toBe('note-b')
  })
})

describe('loadReviews error handling', () => {
  it('should set error on DB failure', async () => {
    vi.spyOn(db.reviewRecords, 'toArray').mockRejectedValue(new Error('DB fail'))

    await useReviewStore.getState().loadReviews()

    expect(useReviewStore.getState().error).toBe('Failed to load reviews')
    expect(useReviewStore.getState().isLoading).toBe(false)
  })
})

describe('startInterleavedSession', () => {
  it('should initialize interleaved session with due reviews', () => {
    const review1 = makeReview({
      id: 'r1',
      noteId: 'note-1',
      reviewedAt: new Date(FIXED_DATE.getTime() - 5 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
    })
    const review2 = makeReview({
      id: 'r2',
      noteId: 'note-2',
      reviewedAt: new Date(FIXED_DATE.getTime() - 3 * 86400000).toISOString(),
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
    })

    useReviewStore.setState({ allReviews: [review1, review2] })

    const noteMap = new Map([
      ['note-1', { id: 'note-1', courseId: 'c1', videoId: 'v1', content: '', createdAt: '', updatedAt: '', tags: [] }],
      ['note-2', { id: 'note-2', courseId: 'c2', videoId: 'v2', content: '', createdAt: '', updatedAt: '', tags: [] }],
    ])

    useReviewStore.getState().startInterleavedSession(noteMap, FIXED_DATE)

    const state = useReviewStore.getState()
    expect(state.isInterleavedActive).toBe(true)
    expect(state.interleavedQueue.length).toBeGreaterThan(0)
    expect(state.interleavedIndex).toBe(0)
    expect(state.interleavedRatings).toEqual([])
    expect(state.interleavedCourseIds.length).toBeGreaterThan(0)
  })
})

describe('rateInterleavedNote', () => {
  it('should advance index on successful rating', async () => {
    const review = makeReview({ noteId: 'note-1' })
    useReviewStore.setState({
      allReviews: [review],
      interleavedQueue: [review],
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: [],
      isInterleavedActive: true,
      interleavedRetentionsBefore: [0.5],
    })

    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    const noteMap = new Map([
      ['note-1', { id: 'note-1', courseId: 'c1', videoId: 'v1', content: '', createdAt: '', updatedAt: '', tags: [] }],
    ])

    await useReviewStore.getState().rateInterleavedNote('good', noteMap, FIXED_DATE)

    const state = useReviewStore.getState()
    expect(state.interleavedIndex).toBe(1)
    expect(state.interleavedRatings).toEqual(['good'])
    expect(state.interleavedCourseIds).toContain('c1')
  })

  it('should not advance on rating failure', async () => {
    const review = makeReview({ noteId: 'note-1' })
    useReviewStore.setState({
      allReviews: [review],
      interleavedQueue: [review],
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: [],
      isInterleavedActive: true,
      interleavedRetentionsBefore: [0.5],
    })

    vi.spyOn(db.reviewRecords, 'put').mockRejectedValue(new Error('fail'))

    const noteMap = new Map([
      ['note-1', { id: 'note-1', courseId: 'c1', videoId: 'v1', content: '', createdAt: '', updatedAt: '', tags: [] }],
    ])

    await useReviewStore.getState().rateInterleavedNote('good', noteMap, FIXED_DATE)

    expect(useReviewStore.getState().interleavedIndex).toBe(0) // Did not advance
  })

  it('should handle empty queue gracefully', async () => {
    useReviewStore.setState({
      interleavedQueue: [],
      interleavedIndex: 0,
      isInterleavedActive: true,
    })

    await useReviewStore.getState().rateInterleavedNote('good', new Map(), FIXED_DATE)
    // No crash
  })

  it('should not duplicate courseId in interleavedCourseIds', async () => {
    const review1 = makeReview({ noteId: 'note-1' })
    const review2 = makeReview({ noteId: 'note-2' })
    useReviewStore.setState({
      allReviews: [review1, review2],
      interleavedQueue: [review1, review2],
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: ['c1'], // c1 already tracked
      isInterleavedActive: true,
      interleavedRetentionsBefore: [0.5, 0.5],
    })

    vi.spyOn(db.reviewRecords, 'put').mockResolvedValue(undefined as never)

    const noteMap = new Map([
      ['note-1', { id: 'note-1', courseId: 'c1', videoId: 'v1', content: '', createdAt: '', updatedAt: '', tags: [] }],
    ])

    await useReviewStore.getState().rateInterleavedNote('good', noteMap, FIXED_DATE)

    // c1 should not be duplicated
    expect(useReviewStore.getState().interleavedCourseIds).toEqual(['c1'])
  })
})

describe('endInterleavedSession', () => {
  it('should return summary and reset session state', () => {
    const review = makeReview({ noteId: 'note-1' })
    useReviewStore.setState({
      allReviews: [review],
      interleavedQueue: [review],
      interleavedRatings: ['good'],
      interleavedCourseIds: ['c1'],
      interleavedRetentionsBefore: [0.8],
      interleavedIndex: 1,
      isInterleavedActive: true,
    })

    const courseNameMap = new Map([['c1', 'React Course']])
    const summary = useReviewStore.getState().endInterleavedSession(courseNameMap)

    expect(summary.totalReviewed).toBe(1)
    expect(summary.ratings.good).toBe(1)
    expect(summary.coursesCount).toBe(1)
    expect(summary.courseNames).toEqual(['React Course'])
    expect(summary.averageRetentionBefore).toBe(Math.round(0.8))

    // Session should be reset
    const state = useReviewStore.getState()
    expect(state.isInterleavedActive).toBe(false)
    expect(state.interleavedQueue).toHaveLength(0)
    expect(state.interleavedRatings).toHaveLength(0)
  })

  it('should handle empty session', () => {
    useReviewStore.setState({
      allReviews: [],
      interleavedQueue: [],
      interleavedRatings: [],
      interleavedCourseIds: [],
      interleavedRetentionsBefore: [],
      interleavedIndex: 0,
      isInterleavedActive: true,
    })

    const summary = useReviewStore.getState().endInterleavedSession(new Map())
    expect(summary.totalReviewed).toBe(0)
    expect(summary.averageRetentionAfter).toBe(95) // default
  })

  it('should handle unknown courseId in courseNameMap', () => {
    useReviewStore.setState({
      allReviews: [],
      interleavedQueue: [],
      interleavedRatings: [],
      interleavedCourseIds: ['unknown-id'],
      interleavedRetentionsBefore: [],
      interleavedIndex: 0,
      isInterleavedActive: true,
    })

    const summary = useReviewStore.getState().endInterleavedSession(new Map())
    expect(summary.courseNames).toEqual(['Unknown Course'])
  })
})

describe('resetInterleavedSession', () => {
  it('should reset all interleaved state', () => {
    useReviewStore.setState({
      interleavedQueue: [makeReview()],
      interleavedIndex: 5,
      interleavedRatings: ['good', 'easy'],
      interleavedCourseIds: ['c1'],
      interleavedRetentionsBefore: [0.8],
      isInterleavedActive: true,
    })

    useReviewStore.getState().resetInterleavedSession()

    const state = useReviewStore.getState()
    expect(state.interleavedQueue).toHaveLength(0)
    expect(state.interleavedIndex).toBe(0)
    expect(state.interleavedRatings).toHaveLength(0)
    expect(state.interleavedCourseIds).toHaveLength(0)
    expect(state.isInterleavedActive).toBe(false)
  })
})

describe('getNextReviewDate', () => {
  it('should return earliest nextReviewAt', () => {
    const r1 = makeReview({ nextReviewAt: '2026-03-20T00:00:00Z' })
    const r2 = makeReview({ noteId: 'note-2', nextReviewAt: '2026-03-18T00:00:00Z' })

    useReviewStore.setState({ allReviews: [r1, r2] })

    expect(useReviewStore.getState().getNextReviewDate()).toBe('2026-03-18T00:00:00Z')
  })

  it('should return null when no reviews exist', () => {
    useReviewStore.setState({ allReviews: [] })
    expect(useReviewStore.getState().getNextReviewDate()).toBeNull()
  })
})
