import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { ReviewRating, ReviewRecord, Note } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateNextReview, predictRetention, isDue } from '@/lib/spacedRepetition'
import { interleaveReviews } from '@/lib/interleave'

interface PendingRating {
  noteId: string
  rating: ReviewRating
}

export interface InterleavedSessionSummary {
  totalReviewed: number
  ratings: { hard: number; good: number; easy: number }
  coursesCount: number
  courseNames: string[]
  averageRetentionBefore: number
  averageRetentionAfter: number
}

interface ReviewState {
  allReviews: ReviewRecord[]
  isLoading: boolean
  error: string | null
  pendingRating: PendingRating | null

  // Interleaved session state
  interleavedQueue: ReviewRecord[]
  interleavedIndex: number
  interleavedRatings: ReviewRating[]
  interleavedCourseIds: string[]
  interleavedRetentionsBefore: number[]
  isInterleavedActive: boolean

  loadReviews: () => Promise<void>
  rateNote: (noteId: string, rating: ReviewRating, now?: Date) => Promise<void>
  retryPendingRating: () => Promise<void>
  getDueReviews: (now?: Date) => ReviewRecord[]
  getNextReviewDate: () => string | null

  // Interleaved session actions
  startInterleavedSession: (noteMap: Map<string, Note>, now?: Date) => void
  rateInterleavedNote: (
    rating: ReviewRating,
    noteMap: Map<string, Note>,
    now?: Date
  ) => Promise<void>
  endInterleavedSession: (courseNameMap: Map<string, string>) => InterleavedSessionSummary
  resetInterleavedSession: () => void
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  allReviews: [],
  isLoading: false,
  error: null,
  pendingRating: null,

  // Interleaved session defaults
  interleavedQueue: [],
  interleavedIndex: 0,
  interleavedRatings: [],
  interleavedCourseIds: [],
  interleavedRetentionsBefore: [],
  isInterleavedActive: false,

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

  // --- Interleaved session actions ---

  startInterleavedSession: (noteMap: Map<string, Note>, now: Date = new Date()) => {
    const dueReviews = get().getDueReviews(now)
    const queue = interleaveReviews(dueReviews, noteMap, now)

    // Pre-compute retention before review for summary
    const retentionsBefore = queue.map(r => predictRetention(r, now))

    // Collect unique course IDs from the queue
    const courseIds = [
      ...new Set(queue.map(r => noteMap.get(r.noteId)?.courseId).filter(Boolean) as string[]),
    ]

    set({
      interleavedQueue: queue,
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: courseIds,
      interleavedRetentionsBefore: retentionsBefore,
      isInterleavedActive: true,
    })
  },

  rateInterleavedNote: async (
    rating: ReviewRating,
    noteMap: Map<string, Note>,
    now: Date = new Date()
  ) => {
    const { interleavedQueue, interleavedIndex, interleavedRatings, interleavedCourseIds } = get()
    const currentRecord = interleavedQueue[interleavedIndex]
    if (!currentRecord) return

    // Delegate to existing rateNote for persistence + optimistic update
    await get().rateNote(currentRecord.noteId, rating, now)

    // Track the course for this card
    const note = noteMap.get(currentRecord.noteId)
    const courseId = note?.courseId
    const updatedCourseIds =
      courseId && !interleavedCourseIds.includes(courseId)
        ? [...interleavedCourseIds, courseId]
        : interleavedCourseIds

    set({
      interleavedIndex: interleavedIndex + 1,
      interleavedRatings: [...interleavedRatings, rating],
      interleavedCourseIds: updatedCourseIds,
    })
  },

  endInterleavedSession: (courseNameMap: Map<string, string>) => {
    const { interleavedRatings, interleavedCourseIds, interleavedRetentionsBefore } = get()

    const ratings = { hard: 0, good: 0, easy: 0 }
    for (const r of interleavedRatings) {
      ratings[r]++
    }

    const avgBefore =
      interleavedRetentionsBefore.length > 0
        ? interleavedRetentionsBefore.reduce((a, b) => a + b, 0) /
          interleavedRetentionsBefore.length
        : 0

    // Estimate "after" retention: assume reviewing bumps retention to ~95%
    // weighted by how many of the queued notes were actually reviewed
    const reviewed = interleavedRatings.length
    const total = interleavedRetentionsBefore.length
    const avgAfter = total > 0 ? (reviewed * 95 + (total - reviewed) * avgBefore) / total : 95

    const courseNames = interleavedCourseIds.map(id => courseNameMap.get(id) ?? 'Unknown Course')

    const summary: InterleavedSessionSummary = {
      totalReviewed: reviewed,
      ratings,
      coursesCount: interleavedCourseIds.length,
      courseNames,
      averageRetentionBefore: Math.round(avgBefore),
      averageRetentionAfter: Math.round(avgAfter),
    }

    // Reset session state
    set({
      interleavedQueue: [],
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: [],
      interleavedRetentionsBefore: [],
      isInterleavedActive: false,
    })

    return summary
  },

  resetInterleavedSession: () => {
    set({
      interleavedQueue: [],
      interleavedIndex: 0,
      interleavedRatings: [],
      interleavedCourseIds: [],
      interleavedRetentionsBefore: [],
      isInterleavedActive: false,
    })
  },
}))
