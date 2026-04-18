import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { ReviewRating, Flashcard, CardState } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateNextReview, predictRetention, isDue } from '@/lib/spacedRepetition'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'

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
      // FSRS defaults for a new card (state 0 = New)
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      state: 0 as CardState,
      elapsed_days: 0,
      scheduled_days: 0,
      due: now, // New cards are immediately due
      createdAt: now,
      updatedAt: now,
    }

    // Optimistic update
    set(state => ({ flashcards: [...state.flashcards, newCard] }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('flashcards', 'add', newCard as unknown as SyncableRecord)
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
        await syncableWrite('flashcards', 'delete', id)
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
      .filter(card => isDue(card, now))
      .sort((a, b) => {
        // Cards with no last_review (never reviewed) go first (retention = 0)
        const retA = a.last_review ? predictRetention(a, now) : 0
        const retB = b.last_review ? predictRetention(b, now) : 0
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

    // Pass full FSRS card state (or null for never-reviewed cards)
    const fsrsResult = calculateNextReview(currentCard.reps > 0 ? currentCard : null, rating, now)

    const updatedCard: Flashcard = {
      ...currentCard,
      stability: fsrsResult.stability,
      difficulty: fsrsResult.difficulty,
      reps: fsrsResult.reps,
      lapses: fsrsResult.lapses,
      state: fsrsResult.state,
      elapsed_days: fsrsResult.elapsed_days,
      scheduled_days: fsrsResult.scheduled_days,
      due: fsrsResult.due,
      last_review: fsrsResult.last_review,
      lastRating: rating,
      updatedAt: now.toISOString(),
    }

    // Optimistic update to flashcards list + advance queue
    set({
      flashcards: flashcards.map(c => (c.id === updatedCard.id ? updatedCard : c)),
      reviewIndex: reviewIndex + 1,
      sessionRatings: [...sessionRatings, rating],
    })

    // Capture review event UUID outside persistWithRetry so retries use the same UUID.
    // A 23505 unique_violation on retry is swallowed as idempotent success.
    const reviewEventId = crypto.randomUUID()

    try {
      await persistWithRetry(async () => {
        await syncableWrite('flashcards', 'put', updatedCard as unknown as SyncableRecord)

        // Conditional Supabase INSERT for the review event — authenticated only.
        // flashcard_reviews is Supabase-only (no Dexie table, no tableRegistry entry).
        const user = useAuthStore.getState().user
        if (user && supabase) {
          const reviewEvent = {
            id: reviewEventId,
            user_id: user.id,
            flashcard_id: currentCard.id,
            rating,
            reviewed_at: now.toISOString(),
          }
          const { error: insertError } = await supabase
            .from('flashcard_reviews')
            .insert(reviewEvent)

          // Swallow 23505 unique_violation — same UUID on retry = idempotent success.
          if (insertError && insertError.code !== '23505') {
            throw insertError
          }
        }
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
    const ratings = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const r of sessionRatings) {
      ratings[r]++
    }

    // Find the next due date across all cards that have been reviewed
    const reviewed = flashcards.filter(c => c.last_review)
    const sorted = [...reviewed].sort(
      (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()
    )
    const nextReviewDate = sorted[0]?.due ?? null

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

    // Find next future review date (cards not yet due)
    const withReview = flashcards.filter(c => c.last_review)
    const sorted = [...withReview].sort(
      (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()
    )
    const nextFuture = sorted.find(c => !isDue(c, now))
    const nextReviewDate = nextFuture?.due ?? null

    return {
      total: flashcards.length,
      dueToday: dueFlashcards.length,
      nextReviewDate,
    }
  },
}))
