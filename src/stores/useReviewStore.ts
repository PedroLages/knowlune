import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { ReviewRating, ReviewRecord } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateNextReview, predictRetention, isDue } from '@/lib/spacedRepetition'

interface PendingRating {
  noteId: string
  rating: ReviewRating
}

interface ReviewState {
  allReviews: ReviewRecord[]
  isLoading: boolean
  error: string | null
  pendingRating: PendingRating | null

  loadReviews: () => Promise<void>
  rateNote: (noteId: string, rating: ReviewRating, now?: Date) => Promise<void>
  retryPendingRating: () => Promise<void>
  getDueReviews: (now?: Date) => ReviewRecord[]
  getNextReviewDate: () => string | null
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  allReviews: [],
  isLoading: false,
  error: null,
  pendingRating: null,

  loadReviews: async () => {
    set({ isLoading: true, error: null })
    try {
      const allReviews = await db.reviewRecords.toArray()
      set({ allReviews, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load reviews' })
      console.error('[ReviewStore] Failed to load reviews:', error)
    }
  },

  rateNote: async (noteId: string, rating: ReviewRating, now: Date = new Date()) => {
    const { allReviews } = get()
    const existing = allReviews.find(r => r.noteId === noteId)
    const { interval, easeFactor, nextReviewAt } = calculateNextReview(
      existing ?? null,
      rating,
      now
    )

    const updatedRecord: ReviewRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      noteId,
      rating,
      reviewedAt: now.toISOString(),
      nextReviewAt,
      interval,
      easeFactor,
      reviewCount: (existing?.reviewCount ?? 0) + 1,
    }

    // Optimistic update
    const updatedReviews = existing
      ? allReviews.map(r => (r.noteId === noteId ? updatedRecord : r))
      : [...allReviews, updatedRecord]

    set({ allReviews: updatedReviews, error: null, pendingRating: null })

    try {
      await persistWithRetry(async () => {
        await db.reviewRecords.put(updatedRecord)
      })
    } catch (error) {
      // Rollback optimistic update, preserve rating in memory for retry (AC5)
      set({
        allReviews,
        error: 'Failed to save rating',
        pendingRating: { noteId, rating },
      })
      console.error('[ReviewStore] Failed to persist rating:', error)

      toast('Failed to save rating', {
        action: {
          label: 'Retry',
          onClick: () => {
            get().retryPendingRating().catch(console.error)
          },
        },
      })
    }
  },

  retryPendingRating: async () => {
    const { pendingRating } = get()
    if (!pendingRating) return

    await get().rateNote(pendingRating.noteId, pendingRating.rating)
  },

  getDueReviews: (now: Date = new Date()) => {
    const { allReviews } = get()
    return allReviews
      .filter(r => isDue(r, now))
      .sort((a, b) => predictRetention(a, now) - predictRetention(b, now))
  },

  getNextReviewDate: () => {
    const { allReviews } = get()
    if (allReviews.length === 0) return null

    const sorted = [...allReviews].sort(
      (a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    )
    return sorted[0].nextReviewAt
  },
}))
