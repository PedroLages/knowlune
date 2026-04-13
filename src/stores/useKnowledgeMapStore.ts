/**
 * Knowledge Map Store (E56-S02)
 *
 * Zustand store that orchestrates topic resolution + score calculation.
 * Computes per-topic knowledge scores from quiz attempts, flashcard retention,
 * content progress, and study session recency. No Dexie migration — pure
 * computation from existing data.
 *
 * Pattern reference: src/stores/useFlashcardStore.ts, src/stores/useContentProgressStore.ts
 */

import { create } from 'zustand'
import { db } from '@/db'
import {
  resolveTopics,
  normalizeTopic,
  canonicalize,
  type TopicCourseInput,
  type TopicQuestionInput,
} from '@/lib/topicResolver'
import {
  calculateTopicScore,
  computeUrgency,
  suggestActions,
  type TopicScoreResult,
  type SuggestedAction,
} from '@/lib/knowledgeScore'
import { predictRetention } from '@/lib/spacedRepetition'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoredTopic {
  /** Display name (title-cased) */
  name: string
  /** Normalized key */
  canonicalName: string
  /** Top-level category */
  category: string
  /** Course IDs associated with this topic */
  courseIds: string[]
  /** Computed score result */
  scoreResult: TopicScoreResult
  /** Urgency for prioritizing focus areas */
  urgency: number
  /** Days since last engagement */
  daysSinceLastEngagement: number
  /** Suggested review actions */
  suggestedActions: SuggestedAction[]
}

export interface CategoryGroup {
  /** Category name */
  category: string
  /** Topics in this category */
  topics: ScoredTopic[]
  /** Average score across topics */
  averageScore: number
}

interface KnowledgeMapState {
  /** All scored topics */
  topics: ScoredTopic[]
  /** Topics grouped by category */
  categories: CategoryGroup[]
  /** Top 3 highest-urgency topics */
  focusAreas: ScoredTopic[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Timestamp of last computation */
  lastComputedAt: string | null

  /** Compute/recompute all knowledge scores */
  computeScores: (now?: Date) => Promise<void>
  /** Invalidate the 30-second cache, forcing recomputation on next computeScores() call */
  invalidateCache: () => void
  /** Get topics filtered by category, sorted by score ascending */
  getTopicsByCategory: (category: string) => ScoredTopic[]
  /** Get a single topic by canonical name */
  getTopicByName: (canonicalName: string) => ScoredTopic | undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute days between two dates */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, ms / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useKnowledgeMapStore = create<KnowledgeMapState>((set, get) => ({
  topics: [],
  categories: [],
  focusAreas: [],
  isLoading: false,
  error: null,
  lastComputedAt: null,

  computeScores: async (now?: Date) => {
    const currentTime = now ?? new Date()

    // Cache check: skip if computed within the last 30 seconds
    const lastComputed = get().lastComputedAt
    if (lastComputed) {
      const elapsed = currentTime.getTime() - new Date(lastComputed).getTime()
      if (elapsed < 30_000) return
    }

    set({ isLoading: true, error: null })

    try {
      // ── Step 1: Fetch raw data from Dexie ──────────────────────
      const [importedCourses, allQuizzes, allAttempts, allFlashcards, allSessions, allProgress] =
        await Promise.all([
          db.importedCourses.toArray(),
          db.quizzes.toArray(),
          db.quizAttempts.toArray(),
          db.flashcards.toArray(),
          db.studySessions.toArray(),
          db.contentProgress.toArray(),
        ])

      // ── Step 2: Resolve topics ─────────────────────────────────
      // Build TopicCourseInput from ImportedCourses
      const courseInputs: TopicCourseInput[] = importedCourses.map((c) => ({
        id: c.id,
        category: c.category,
        tags: c.tags,
      }))

      // Build quiz-to-course mapping via contentProgress: quiz.lessonId → courseId
      // Since the legacy courses table was dropped (v30), we derive the mapping from
      // contentProgress records which track (courseId, itemId) for imported courses.
      const lessonToCourseId = new Map<string, string>()
      for (const progress of allProgress) {
        lessonToCourseId.set(progress.itemId, progress.courseId)
      }

      const quizToCourseId = new Map<string, string>()
      for (const quiz of allQuizzes) {
        const courseId = lessonToCourseId.get(quiz.lessonId)
        if (courseId) {
          quizToCourseId.set(quiz.id, courseId)
        }
      }

      // Build TopicQuestionInput from all quiz questions
      const questionInputs: TopicQuestionInput[] = []
      for (const quiz of allQuizzes) {
        const courseId = quizToCourseId.get(quiz.id)
        if (!courseId) continue
        for (const question of quiz.questions) {
          if (question.topic) {
            questionInputs.push({ topic: question.topic, courseId })
          }
        }
      }

      const resolvedTopics = resolveTopics(courseInputs, questionInputs)

      if (resolvedTopics.length === 0) {
        set({
          topics: [],
          categories: [],
          focusAreas: [],
          isLoading: false,
          lastComputedAt: currentTime.toISOString(),
        })
        return
      }

      // ── Step 3: Aggregate signals per topic ────────────────────

      // 3a. Quiz scores per topic
      // Build: canonicalTopic → { totalCorrect, totalQuestions }
      const quizScoreByTopic = new Map<string, { correct: number; total: number }>()
      for (const attempt of allAttempts) {
        const quizId = attempt.quizId
        const quiz = allQuizzes.find((q) => q.id === quizId)
        if (!quiz) continue

        for (const answer of attempt.answers) {
          const question = quiz.questions.find((q) => q.id === answer.questionId)
          if (!question?.topic) continue

          const normalized = normalizeTopic(question.topic)
          const canonical = canonicalize(normalized)

          const existing = quizScoreByTopic.get(canonical) ?? { correct: 0, total: 0 }
          existing.total += 1
          if (answer.isCorrect) existing.correct += 1
          quizScoreByTopic.set(canonical, existing)
        }
      }

      // 3b. Flashcard retention per topic (by courseId)
      // Build: courseId → Flashcard[]
      const flashcardsByCourseId = new Map<string, typeof allFlashcards>()
      for (const card of allFlashcards) {
        if (!card.courseId) continue
        const existing = flashcardsByCourseId.get(card.courseId) ?? []
        existing.push(card)
        flashcardsByCourseId.set(card.courseId, existing)
      }

      // 3c. Completion per topic
      // Build: courseId → { completed, total } from contentProgress records
      const completionByCourse = new Map<string, { completed: number; total: number }>()
      for (const progress of allProgress) {
        const existing = completionByCourse.get(progress.courseId) ?? { completed: 0, total: 0 }
        existing.total += 1
        if (progress.status === 'completed') existing.completed += 1
        completionByCourse.set(progress.courseId, existing)
      }

      // 3d. Most recent engagement timestamps
      // Build: courseId → most recent ISO timestamp
      const lastEngagementByCourse = new Map<string, string>()
      for (const session of allSessions) {
        const existing = lastEngagementByCourse.get(session.courseId)
        const sessionTime = session.endTime ?? session.startTime
        if (!existing || sessionTime > existing) {
          lastEngagementByCourse.set(session.courseId, sessionTime)
        }
      }
      // Also consider quiz attempt timestamps
      for (const attempt of allAttempts) {
        const courseId = quizToCourseId.get(attempt.quizId)
        if (!courseId) continue
        const existing = lastEngagementByCourse.get(courseId)
        if (!existing || attempt.completedAt > existing) {
          lastEngagementByCourse.set(courseId, attempt.completedAt)
        }
      }
      // Also consider flashcard last_review timestamps
      for (const card of allFlashcards) {
        if (!card.courseId || !card.last_review) continue
        const existing = lastEngagementByCourse.get(card.courseId)
        if (!existing || card.last_review > existing) {
          lastEngagementByCourse.set(card.courseId, card.last_review)
        }
      }

      // ── Step 4: Score each topic ───────────────────────────────
      const scoredTopics: ScoredTopic[] = resolvedTopics.map((topic) => {
        // Quiz score for this topic
        const quizData = quizScoreByTopic.get(topic.canonicalName)
        const quizScore =
          quizData && quizData.total > 0
            ? Math.round((quizData.correct / quizData.total) * 100)
            : null

        // Flashcard retention for this topic's courses
        let flashcardRetention: number | null = null
        const retentions: number[] = []
        for (const courseId of topic.courseIds) {
          const cards = flashcardsByCourseId.get(courseId) ?? []
          for (const card of cards) {
            if (!card.last_review) {
              // EC-HIGH: unreviewed flashcard → retention 0
              retentions.push(0)
            } else {
              const retention = predictRetention(
                { last_review: card.last_review, stability: card.stability },
                currentTime
              )
              retentions.push(retention)
            }
          }
        }
        if (retentions.length > 0) {
          flashcardRetention = Math.round(
            retentions.reduce((sum, r) => sum + r, 0) / retentions.length
          )
        }

        // Completion across topic's courses
        let totalLessons = 0
        let completedLessons = 0
        for (const courseId of topic.courseIds) {
          const progress = completionByCourse.get(courseId)
          if (progress) {
            totalLessons += progress.total
            completedLessons += progress.completed
          }
        }
        const completionPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

        // Days since last engagement (most recent across topic's courses)
        let mostRecentEngagement: string | null = null
        for (const courseId of topic.courseIds) {
          const timestamp = lastEngagementByCourse.get(courseId)
          if (timestamp && (!mostRecentEngagement || timestamp > mostRecentEngagement)) {
            mostRecentEngagement = timestamp
          }
        }
        const daysAgo = mostRecentEngagement
          ? daysBetween(new Date(mostRecentEngagement), currentTime)
          : 365 // Default to very stale if no engagement data

        // Calculate score
        const scoreResult = calculateTopicScore({
          quizScore,
          flashcardRetention,
          completionPercent,
          daysSinceLastEngagement: daysAgo,
        })

        // Calculate urgency
        const urgency = computeUrgency(scoreResult.score, daysAgo)

        // Suggest actions
        const actions = suggestActions({
          quizScore,
          flashcardRetention,
          completionPercent,
        })

        return {
          name: topic.name,
          canonicalName: topic.canonicalName,
          category: topic.category,
          courseIds: topic.courseIds,
          scoreResult,
          urgency,
          daysSinceLastEngagement: Math.round(daysAgo),
          suggestedActions: actions,
        }
      })

      // ── Step 5: Group by category ──────────────────────────────
      const categoryMap = new Map<string, ScoredTopic[]>()
      for (const topic of scoredTopics) {
        const existing = categoryMap.get(topic.category) ?? []
        existing.push(topic)
        categoryMap.set(topic.category, existing)
      }

      const categories: CategoryGroup[] = [...categoryMap.entries()]
        .map(([category, topics]) => ({
          category,
          topics: topics.sort((a, b) => a.scoreResult.score - b.scoreResult.score),
          averageScore: Math.round(
            topics.reduce((sum, t) => sum + t.scoreResult.score, 0) / topics.length
          ),
        }))
        .sort((a, b) => a.category.localeCompare(b.category))

      // ── Step 6: Focus areas (top 3 by urgency) ────────────────
      const focusAreas = [...scoredTopics]
        .sort((a, b) => b.urgency - a.urgency)
        .slice(0, 3)

      set({
        topics: scoredTopics,
        categories,
        focusAreas,
        isLoading: false,
        lastComputedAt: currentTime.toISOString(),
      })
    } catch (error) {
      console.error('[KnowledgeMapStore] Failed to compute scores:', error)
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to compute knowledge scores',
      })
    }
  },

  invalidateCache: () => {
    set({ lastComputedAt: null })
  },

  getTopicsByCategory: (category: string) => {
    return get()
      .topics.filter((t) => t.category === category)
      .sort((a, b) => a.scoreResult.score - b.scoreResult.score)
  },

  getTopicByName: (canonicalName: string) => {
    return get().topics.find((t) => t.canonicalName === canonicalName)
  },
}))
