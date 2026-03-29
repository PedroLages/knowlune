import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { ReviewRating, Flashcard } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateNextReview, predictRetention, isDue } from '@/lib/spacedRepetition'

export interface FlashcardSessionSummary {
  totalReviewed: number
  ratings: { again: number; hard: number; good: number; easy: number }
  nextReviewDate: string | null
}

interface FlashcardState {
  flashcards: Flashcard[]
  isLoading: boolean
  error: string | null

  // Review session state
  reviewQueue: Flashcard[]
  reviewIndex: number
  sessionRatings: ReviewRating[]
  isReviewActive: boolean

  // CRUD
  loadFlashcards: () => Promise<void>
  createFlashcard: (front: string, back: string, courseId: string, noteId?: string) => Promise<void>
  deleteFlashcard: (id: string) => Promise<void>

  // Review
  getDueFlashcards: (now?: Date) => Flashcard[]
  startReviewSession: (now?: Date) => void
  rateFlashcard: (rating: ReviewRating, now?: Date) => Promise<void>
  getSessionSummary: () => FlashcardSessionSummary
  resetReviewSession: () => void

  // Stats
  getStats: (now?: Date) => { total: number; dueToday: number; nextReviewDate: string | null }
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  flashcards: [],
  isLoading: false,
  error: null,

  reviewQueue: [],
  reviewIndex: 0,
  sessionRatings: [],
  isReviewActive: false,

  loadFlashcards: async () => {
    set({ isLoading: true, error: null })
    try {
      const flashcards = await db.flashcards.toArray()
      set({ flashcards, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load flashcards' })
      console.error('[FlashcardStore] Failed to load flashcards:', error)
    }
  },

  createFlashcard: async (front, back, courseId, noteId) => {
    const now = new Date().toISOString()
    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      courseId,
      noteId,
      front,
      back,
      interval: 0,
      easeFactor: 2.5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    // Optimistic update
    set(state => ({ flashcards: [...state.flashcards, newCard] }))

    try {
      await persistWithRetry(async () => {
        await db.flashcards.add(newCard)
      })
      toast.success('Flashcard created')
    } catch (error) {
      // Rollback on failure
      set(state => ({ flashcards: state.flashcards.filter(c => c.id !== newCard.id) }))
      toast.error('Failed to create flashcard')
      console.error('[FlashcardStore] Failed to create flashcard:', error)
    }
  },

  deleteFlashcard: async (id: string) => {
    const { flashcards } = get()
    const original = flashcards.find(c => c.id === id)
    if (!original) return

    // Optimistic update
    set(state => ({ flashcards: state.flashcards.filter(c => c.id !== id) }))

    try {
      await persistWithRetry(async () => {
        await db.flashcards.delete(id)
      })
    } catch (error) {
      // Rollback
      set(state => ({ flashcards: [...state.flashcards, original] }))
      toast.error('Failed to delete flashcard')
      console.error('[FlashcardStore] Failed to delete flashcard:', error)
    }
  },

  getDueFlashcards: (now: Date = new Date()) => {
    const { flashcards } = get()
    return flashcards
      .filter(
        card =>
          // Never reviewed (no nextReviewAt) = always due
          !card.nextReviewAt || isDue({ nextReviewAt: card.nextReviewAt }, now)
      )
      .sort((a, b) => {
        // Never-reviewed cards go first (retention = 0), then by ascending retention
        const retA = a.reviewedAt ? predictRetention({ ...a, reviewedAt: a.reviewedAt }, now) : 0
        const retB = b.reviewedAt ? predictRetention({ ...b, reviewedAt: b.reviewedAt }, now) : 0
        return retA - retB
      })
  },

  startReviewSession: (now: Date = new Date()) => {
    const queue = get().getDueFlashcards(now)
    set({
      reviewQueue: queue,
      reviewIndex: 0,
      sessionRatings: [],
      isReviewActive: true,
    })
  },

  rateFlashcard: async (rating: ReviewRating, now: Date = new Date()) => {
    const { reviewQueue, reviewIndex, sessionRatings, flashcards } = get()
    const currentCard = reviewQueue[reviewIndex]
    if (!currentCard) return

    const { interval, easeFactor, nextReviewAt } = calculateNextReview(
      currentCard.reviewCount > 0 ? currentCard : null,
      rating,
      now
    )

    const updatedCard: Flashcard = {
      ...currentCard,
      interval,
      easeFactor,
      nextReviewAt,
      reviewedAt: now.toISOString(),
      reviewCount: currentCard.reviewCount + 1,
      lastRating: rating,
      updatedAt: now.toISOString(),
    }

    // Optimistic update to flashcards list + advance queue
    set({
      flashcards: flashcards.map(c => (c.id === updatedCard.id ? updatedCard : c)),
      reviewIndex: reviewIndex + 1,
      sessionRatings: [...sessionRatings, rating],
    })

    try {
      await persistWithRetry(async () => {
        await db.flashcards.put(updatedCard)
      })
    } catch (error) {
      // Rollback — go back one step so user can retry
      set({
        flashcards,
        reviewIndex,
        sessionRatings,
      })
      toast('Failed to save rating', {
        action: {
          label: 'Retry',
          onClick: () => {
            get().rateFlashcard(rating, now).catch(console.error)
          },
        },
      })
      console.error('[FlashcardStore] Failed to persist flashcard rating:', error)
    }
  },

  getSessionSummary: (): FlashcardSessionSummary => {
    const { sessionRatings, flashcards } = get()
    const ratings = { hard: 0, good: 0, easy: 0 }
    for (const r of sessionRatings) {
      ratings[r]++
    }

    // Find the next due date across all cards
    const reviewed = flashcards.filter(c => c.nextReviewAt)
    const sorted = [...reviewed].sort(
      (a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime()
    )
    const nextReviewDate = sorted[0]?.nextReviewAt ?? null

    return {
      totalReviewed: sessionRatings.length,
      ratings,
      nextReviewDate,
    }
  },

  resetReviewSession: () => {
    set({
      reviewQueue: [],
      reviewIndex: 0,
      sessionRatings: [],
      isReviewActive: false,
    })
  },

  getStats: (now: Date = new Date()) => {
    const { flashcards } = get()
    const dueFlashcards = get().getDueFlashcards(now)

    const withNextReview = flashcards.filter(c => c.nextReviewAt)
    const sorted = [...withNextReview].sort(
      (a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime()
    )
    // Find next future review date (cards not yet due)
    const nextFuture = sorted.find(c => !isDue({ nextReviewAt: c.nextReviewAt! }, now))
    const nextReviewDate = nextFuture?.nextReviewAt ?? null

    return {
      total: flashcards.length,
      dueToday: dueFlashcards.length,
      nextReviewDate,
    }
  },
}))
