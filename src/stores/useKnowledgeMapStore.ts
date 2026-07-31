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
  calculateAggregateRetention,
  calculateDecayDate,
  type TopicScoreResult,
  type SuggestedAction,
} from '@/lib/knowledgeScore'
import {
  generateActionSuggestions,
  type ActionSuggestion,
  type ActionType,
  type TopicActionTarget,
  type TopicLesson,
  type TopicWithScore,
} from '@/lib/actionSuggestions'
// predictRetention is now called via calculateAggregateRetention in knowledgeScore.ts

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
  /** Valid destinations for actions available on this topic. */
  actionTargets?: Partial<Record<ActionType, TopicActionTarget>>
  /** FSRS aggregate retention 0-100, or null if no reviewed flashcards */
  aggregateRetention: number | null
  /** Predicted date when retention drops below 70%, or null */
  predictedDecayDate: string | null
  /** Average FSRS stability in days across reviewed flashcards, or null */
  avgStability: number | null
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
  /** Pre-computed action suggestions for declining topics (reactive state) */
  suggestions: ActionSuggestion[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Timestamp of last computation */
  lastComputedAt: string | null
  /** Most recent engagement timestamp across ALL session types (incl. book/audio) */
  globalLastEngagement: string | null
  /** Number of imported courses available when no topics resolve. */
  sourceCourseCount: number

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

const ACTION_TYPE_BY_LABEL: Record<SuggestedAction, ActionType> = {
  'Review Flashcards': 'flashcard-review',
  'Retake Quiz': 'quiz-refresh',
  'Rewatch Lesson': 'lesson-rewatch',
}

function progressPercent(progress: { status: string; progressPct?: number }): number {
  if (typeof progress.progressPct === 'number') return progress.progressPct
  return progress.status === 'completed' ? 100 : 0
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useKnowledgeMapStore = create<KnowledgeMapState>((set, get) => ({
  topics: [],
  categories: [],
  focusAreas: [],
  suggestions: [],
  isLoading: false,
  error: null,
  lastComputedAt: null,
  globalLastEngagement: null,
  sourceCourseCount: 0,

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
      const [
        importedCourses,
        allQuizzes,
        allAttempts,
        allFlashcards,
        allSessions,
        allProgress,
        allVideos,
      ] = await Promise.all([
        db.importedCourses.toArray(),
        db.quizzes.toArray(),
        db.quizAttempts.toArray(),
        db.flashcards.toArray(),
        db.studySessions.toArray(),
        db.contentProgress.toArray(),
        db.importedVideos.toArray(),
      ])

      // ── Step 2: Resolve topics ─────────────────────────────────
      // Build TopicCourseInput from ImportedCourses
      const courseInputs: TopicCourseInput[] = importedCourses.map(c => ({
        id: c.id,
        category: c.category,
        tags: c.tags,
      }))

      const courseById = new Map(importedCourses.map(course => [course.id, course]))
      const videosByCourseId = new Map<string, typeof allVideos>()
      for (const video of allVideos) {
        const existing = videosByCourseId.get(video.courseId) ?? []
        existing.push(video)
        videosByCourseId.set(video.courseId, existing)
      }

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
          suggestions: [],
          isLoading: false,
          lastComputedAt: currentTime.toISOString(),
          sourceCourseCount: importedCourses.length,
        })
        return
      }

      // ── Step 3: Aggregate signals per topic ────────────────────

      // 3a. Quiz scores per topic
      // Build: canonicalTopic → { totalCorrect, totalQuestions }
      const quizScoreByTopic = new Map<string, { correct: number; total: number }>()
      for (const attempt of allAttempts) {
        const quizId = attempt.quizId
        const quiz = allQuizzes.find(q => q.id === quizId)
        if (!quiz) continue

        for (const answer of attempt.answers) {
          const question = quiz.questions.find(q => q.id === answer.questionId)
          if (!question?.topic) continue

          const normalized = normalizeTopic(question.topic)
          const canonical = canonicalize(normalized)

          const existing = quizScoreByTopic.get(canonical) ?? { correct: 0, total: 0 }
          existing.total += 1
          if (answer.isCorrect) existing.correct += 1
          quizScoreByTopic.set(canonical, existing)
        }
      }

      // 3a.1 Real quiz destinations per topic. When several quizzes cover a
      // topic, prefer the lowest-scoring one, then the most recently attempted
      // one, so the action points to the most useful remediation path.
      const quizTargetsByTopic = new Map<
        string,
        Array<{
          courseId: string
          lessonId: string
          title: string
          score: number | null
          latestAttempt: string | null
        }>
      >()
      for (const quiz of allQuizzes) {
        const courseId = quizToCourseId.get(quiz.id)
        if (!courseId) continue

        const topicCanonicals = new Set(
          quiz.questions
            .filter(question => question.topic)
            .map(question => canonicalize(normalizeTopic(question.topic!)))
        )
        const quizAttempts = allAttempts.filter(attempt => attempt.quizId === quiz.id)

        for (const canonical of topicCanonicals) {
          let correct = 0
          let total = 0
          let latestAttempt: string | null = null
          for (const attempt of quizAttempts) {
            if (!latestAttempt || attempt.completedAt > latestAttempt) {
              latestAttempt = attempt.completedAt
            }
            for (const answer of attempt.answers) {
              const question = quiz.questions.find(q => q.id === answer.questionId)
              if (!question?.topic) continue
              if (canonicalize(normalizeTopic(question.topic)) !== canonical) continue
              total += 1
              if (answer.isCorrect) correct += 1
            }
          }

          const candidates = quizTargetsByTopic.get(canonical) ?? []
          candidates.push({
            courseId,
            lessonId: quiz.lessonId,
            title: quiz.title,
            score: total > 0 ? Math.round((correct / total) * 100) : null,
            latestAttempt,
          })
          quizTargetsByTopic.set(canonical, candidates)
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
      let globalLastEngagement: string | null = null
      for (const session of allSessions) {
        const existing = lastEngagementByCourse.get(session.courseId)
        const sessionTime = session.endTime ?? session.startTime
        if (!existing || sessionTime > existing) {
          lastEngagementByCourse.set(session.courseId, sessionTime)
        }
        if (!globalLastEngagement || sessionTime > globalLastEngagement) {
          globalLastEngagement = sessionTime
        }
      }
      // Also consider quiz attempt timestamps
      for (const attempt of allAttempts) {
        const courseId = quizToCourseId.get(attempt.quizId)
        if (courseId) {
          const existing = lastEngagementByCourse.get(courseId)
          if (!existing || attempt.completedAt > existing) {
            lastEngagementByCourse.set(courseId, attempt.completedAt)
          }
        }
        if (!globalLastEngagement || attempt.completedAt > globalLastEngagement) {
          globalLastEngagement = attempt.completedAt
        }
      }
      // Also consider flashcard last_review timestamps
      for (const card of allFlashcards) {
        if (card.courseId && card.last_review) {
          const existing = lastEngagementByCourse.get(card.courseId)
          if (!existing || card.last_review > existing) {
            lastEngagementByCourse.set(card.courseId, card.last_review)
          }
        }
        if (
          card.last_review &&
          (!globalLastEngagement || card.last_review > globalLastEngagement)
        ) {
          globalLastEngagement = card.last_review
        }
      }

      // ── Step 4: Score each topic ───────────────────────────────
      const scoredTopics: ScoredTopic[] = resolvedTopics.map(topic => {
        // Quiz score for this topic
        const quizData = quizScoreByTopic.get(topic.canonicalName)
        const quizScore =
          quizData && quizData.total > 0
            ? Math.round((quizData.correct / quizData.total) * 100)
            : null

        // Flashcard retention for this topic's courses (E62-S01: FSRS aggregation)
        const topicFlashcards = topic.courseIds.flatMap(
          courseId => flashcardsByCourseId.get(courseId) ?? []
        )
        const { retention: aggregateRetention, avgStability } = calculateAggregateRetention(
          topicFlashcards,
          currentTime
        )
        const predictedDecayDate =
          avgStability !== null ? calculateDecayDate(avgStability, currentTime) : null

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

        // Calculate score (E62-S01: fsrsRetention is the sole flashcard signal; flashcardRetention omitted)
        const scoreResult = calculateTopicScore({
          quizScore,
          flashcardRetention: null,
          completionPercent,
          daysSinceLastEngagement: daysAgo,
          fsrsRetention: aggregateRetention,
        })

        // Calculate urgency
        const urgency = computeUrgency(scoreResult.score, daysAgo)

        // Suggest actions
        const actions = suggestActions({
          quizScore,
          flashcardRetention: aggregateRetention,
          completionPercent,
        })

        const flashcardCourseId = topic.courseIds.find(
          courseId => (flashcardsByCourseId.get(courseId)?.length ?? 0) > 0
        )
        const actionTargets: Partial<Record<ActionType, TopicActionTarget>> = {}

        if (flashcardCourseId) {
          const courseName = courseById.get(flashcardCourseId)?.name ?? 'this course'
          actionTargets['flashcard-review'] = {
            actionType: 'flashcard-review',
            route: `/courses/${encodeURIComponent(flashcardCourseId)}/flashcards`,
            label: `Review flashcards in ${courseName}`,
            estimatedMinutes: 5,
          }
        }

        const quizTarget = [...(quizTargetsByTopic.get(topic.canonicalName) ?? [])].sort(
          (a, b) =>
            (a.score ?? -1) - (b.score ?? -1) ||
            (b.latestAttempt ?? '').localeCompare(a.latestAttempt ?? '') ||
            a.lessonId.localeCompare(b.lessonId)
        )[0]
        if (quizTarget) {
          actionTargets['quiz-refresh'] = {
            actionType: 'quiz-refresh',
            route: `/courses/${encodeURIComponent(quizTarget.courseId)}/lessons/${encodeURIComponent(quizTarget.lessonId)}/quiz`,
            label: `Retake ${quizTarget.title}`,
            estimatedMinutes: 10,
          }
        }

        const lessonTargets: TopicLesson[] = topic.courseIds.flatMap(courseId =>
          (videosByCourseId.get(courseId) ?? []).map(video => {
            const progress = allProgress.find(
              item => item.courseId === courseId && item.itemId === video.id
            )
            return {
              lessonId: video.id,
              courseId,
              title: video.title ?? video.filename,
              completionPct: progress ? progressPercent(progress) : 0,
              durationMinutes:
                video.duration > 0 ? Math.max(1, Math.round(video.duration / 60)) : 15,
            }
          })
        )
        const lowestLesson = [...lessonTargets].sort(
          (a, b) =>
            a.completionPct - b.completionPct ||
            a.title.localeCompare(b.title) ||
            a.lessonId.localeCompare(b.lessonId)
        )[0]
        if (lowestLesson) {
          actionTargets['lesson-rewatch'] = {
            actionType: 'lesson-rewatch',
            route: `/courses/${encodeURIComponent(lowestLesson.courseId)}/lessons/${encodeURIComponent(lowestLesson.lessonId)}`,
            label: `Rewatch ${lowestLesson.title}`,
            estimatedMinutes: lowestLesson.durationMinutes ?? 15,
            lessonTitle: lowestLesson.title,
          }
        }

        const availableActions = actions.filter(
          action => actionTargets[ACTION_TYPE_BY_LABEL[action]]
        )

        return {
          name: topic.name,
          canonicalName: topic.canonicalName,
          category: topic.category,
          courseIds: topic.courseIds,
          scoreResult,
          urgency,
          daysSinceLastEngagement: Math.round(daysAgo),
          suggestedActions: availableActions,
          actionTargets,
          aggregateRetention,
          predictedDecayDate,
          avgStability,
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
      const focusAreas = [...scoredTopics].sort((a, b) => b.urgency - a.urgency).slice(0, 3)

      // ── Step 7: Pre-compute action suggestions ─────────────────
      // Use the real action targets built from persisted records above. This
      // keeps suggestion ranking separate from route construction while
      // guaranteeing every emitted CTA has a destination the router serves.
      const topicsWithScores: TopicWithScore[] = scoredTopics.map(t => ({
        topicName: t.name,
        canonicalName: t.canonicalName,
        score: t.scoreResult.score,
        tier: t.scoreResult.tier,
        trend:
          t.daysSinceLastEngagement > 14
            ? 'declining'
            : t.daysSinceLastEngagement > 7
              ? 'stable'
              : 'improving',
        recencyScore: Math.max(0, 100 - t.daysSinceLastEngagement * 2),
        actionTargets: t.actionTargets,
        lessons: [],
      }))
      // E62-S01: Build FSRS stability map for action suggestions decay factor
      const fsrsStabilityMap = new Map<string, number>()
      for (const topic of scoredTopics) {
        if (topic.avgStability !== null) {
          fsrsStabilityMap.set(topic.canonicalName, topic.avgStability)
        }
      }
      const suggestions = generateActionSuggestions(topicsWithScores, {
        fsrsStability: fsrsStabilityMap.size > 0 ? fsrsStabilityMap : undefined,
      })

      set({
        topics: scoredTopics,
        categories,
        focusAreas,
        suggestions,
        isLoading: false,
        lastComputedAt: currentTime.toISOString(),
        globalLastEngagement,
        sourceCourseCount: importedCourses.length,
      })
    } catch (error) {
      console.error('[KnowledgeMapStore] Failed to compute scores:', error)
      set(state => ({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to compute knowledge scores',
        globalLastEngagement: state.globalLastEngagement,
      }))
    }
  },

  invalidateCache: () => {
    set({ lastComputedAt: null, suggestions: [], error: null })
  },

  getTopicsByCategory: (category: string) => {
    return get()
      .topics.filter(t => t.category === category)
      .sort((a, b) => a.scoreResult.score - b.scoreResult.score)
  },

  getTopicByName: (canonicalName: string) => {
    return get().topics.find(t => t.canonicalName === canonicalName)
  },
}))
