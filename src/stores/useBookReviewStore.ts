/**
 * Zustand store for book reviews & ratings (E113-S01).
 *
 * Manages personal book reviews with star ratings (1-5, half-star support)
 * and optional markdown-formatted review text. One review per book.
 *
 * @module useBookReviewStore
 * @since E113-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { BookReview } from '@/data/types'
import { db } from '@/db/schema'

const now = () => new Date().toISOString()

interface BookReviewStoreState {
  reviews: BookReview[]
  isLoaded: boolean

  loadReviews: () => Promise<void>
  getReviewForBook: (bookId: string) => BookReview | undefined
  setRating: (bookId: string, rating: number) => Promise<void>
  setReviewText: (bookId: string, reviewText: string) => Promise<void>
  deleteReview: (bookId: string) => Promise<void>
}

export const useBookReviewStore = create<BookReviewStoreState>((set, get) => ({
  reviews: [],
  isLoaded: false,

  loadReviews: async () => {
    if (get().isLoaded) return
    try {
      const reviews = await db.bookReviews.toArray()
      set({ reviews, isLoaded: true })
    } catch {
      set({ isLoaded: true }) // prevent infinite retry loops on corrupted DB
      toast.error('Failed to load book reviews')
    }
  },

  getReviewForBook: (bookId: string) => {
    return get().reviews.find(r => r.bookId === bookId)
  },

  setRating: async (bookId: string, rating: number) => {
    // Clamp to valid range: 0.5 to 5, in 0.5 increments
    const clamped = Math.round(Math.max(0.5, Math.min(5, rating)) * 2) / 2
    const snapshot = get().reviews
    const existing = snapshot.find(r => r.bookId === bookId)

    const review: BookReview = existing
      ? { ...existing, rating: clamped, updatedAt: now() }
      : {
          id: crypto.randomUUID(),
          bookId,
          rating: clamped,
          createdAt: now(),
        }

    // Optimistic update using callback to avoid stale closure
    set(state => ({
      reviews: existing
        ? state.reviews.map(r => (r.bookId === bookId ? review : r))
        : [...state.reviews, review],
    }))

    try {
      await db.bookReviews.put(review)
    } catch {
      set({ reviews: snapshot }) // rollback to pre-optimistic snapshot
      toast.error('Failed to save rating')
    }
  },

  setReviewText: async (bookId: string, reviewText: string) => {
    const snapshot = get().reviews
    const existing = snapshot.find(r => r.bookId === bookId)

    if (!existing) {
      // Cannot set review text without a rating first
      toast.error('Rate the book first before writing a review')
      return
    }

    const review: BookReview = { ...existing, reviewText, updatedAt: now() }

    // Optimistic update using callback to avoid stale closure
    set(state => ({
      reviews: state.reviews.map(r => (r.bookId === bookId ? review : r)),
    }))

    try {
      await db.bookReviews.put(review)
    } catch {
      set({ reviews: snapshot }) // rollback to pre-optimistic snapshot
      toast.error('Failed to save review')
    }
  },

  deleteReview: async (bookId: string) => {
    const snapshot = get().reviews
    const existing = snapshot.find(r => r.bookId === bookId)
    if (!existing) return

    // Optimistic delete using callback to avoid stale closure
    set(state => ({ reviews: state.reviews.filter(r => r.bookId !== bookId) }))

    try {
      await db.bookReviews.delete(existing.id)
      toast.success('Review removed')
    } catch {
      set({ reviews: snapshot }) // rollback to pre-optimistic snapshot
      toast.error('Failed to remove review')
    }
  },
}))
