import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import { useBookReviewStore } from '../useBookReviewStore'

// Reset Dexie + store between tests
beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  useBookReviewStore.setState({
    reviews: [],
    isLoaded: false,
  })
  vi.restoreAllMocks()
})

describe('useBookReviewStore', () => {
  it('loads reviews and marks isLoaded', async () => {
    const { loadReviews } = useBookReviewStore.getState()
    await loadReviews()
    expect(useBookReviewStore.getState().isLoaded).toBe(true)
    expect(useBookReviewStore.getState().reviews).toEqual([])
  })

  it('skips reload if already loaded', async () => {
    await useBookReviewStore.getState().loadReviews()
    // Second call should be a no-op
    await useBookReviewStore.getState().loadReviews()
    expect(useBookReviewStore.getState().isLoaded).toBe(true)
  })

  it('sets a rating for a new book', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setRating('book-1', 4)

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review).toBeDefined()
    expect(review!.rating).toBe(4)
    expect(review!.bookId).toBe('book-1')
  })

  it('supports half-star ratings', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setRating('book-1', 3.5)

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review!.rating).toBe(3.5)
  })

  it('clamps invalid ratings to valid range', async () => {
    await useBookReviewStore.getState().loadReviews()

    await useBookReviewStore.getState().setRating('book-1', 0)
    expect(useBookReviewStore.getState().getReviewForBook('book-1')!.rating).toBe(0.5)

    await useBookReviewStore.getState().setRating('book-2', 6)
    expect(useBookReviewStore.getState().getReviewForBook('book-2')!.rating).toBe(5)

    await useBookReviewStore.getState().setRating('book-3', 3.3)
    expect(useBookReviewStore.getState().getReviewForBook('book-3')!.rating).toBe(3.5)
  })

  it('updates an existing rating', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setRating('book-1', 3)
    await useBookReviewStore.getState().setRating('book-1', 5)

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review!.rating).toBe(5)
    expect(review!.updatedAt).toBeDefined()
    // Should still be one review, not two
    expect(useBookReviewStore.getState().reviews.filter(r => r.bookId === 'book-1')).toHaveLength(1)
  })

  it('sets review text after rating', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setRating('book-1', 4)
    await useBookReviewStore.getState().setReviewText('book-1', 'Great **book**!')

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review!.reviewText).toBe('Great **book**!')
  })

  it('rejects review text without a rating', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setReviewText('book-1', 'No rating yet')

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review).toBeUndefined()
  })

  it('deletes a review', async () => {
    await useBookReviewStore.getState().loadReviews()
    await useBookReviewStore.getState().setRating('book-1', 4)
    await useBookReviewStore.getState().deleteReview('book-1')

    const review = useBookReviewStore.getState().getReviewForBook('book-1')
    expect(review).toBeUndefined()
  })

  it('returns undefined for unreviewed book', async () => {
    await useBookReviewStore.getState().loadReviews()
    expect(useBookReviewStore.getState().getReviewForBook('nonexistent')).toBeUndefined()
  })
})
