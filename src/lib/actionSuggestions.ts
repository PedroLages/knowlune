// Tracking note (E96-S03): trackAIUsage instrumentation is NOT applicable here.
// `actionSuggestions.ts` is a pure deterministic utility — it performs no AI
// or LLM calls. All logic is arithmetic (urgency scores, deduplication, sorting)
// operating on pre-computed TopicWithScore objects supplied by the caller.
// There is no network request, no model invocation, and therefore nothing to
// instrument with trackAIUsage.

// ── Types ───────────────────────────────────────────────────────

export type ActionType = 'flashcard-review' | 'quiz-refresh' | 'lesson-rewatch'

export type ScoreTrend = 'improving' | 'stable' | 'declining'

export interface ActionSuggestion {
  topicName: string
  canonicalName: string
  score: number
  trend: ScoreTrend
  actionType: ActionType
  actionLabel: string
  actionRoute: string
  estimatedMinutes: number
  urgencyScore: number
  lessonTitle?: string
}

export interface TopicLesson {
  lessonId: string
  courseId: string
  title: string
  completionPct: number
  durationMinutes?: number
}

export interface TopicWithScore {
  topicName: string
  canonicalName: string
  score: number
  tier: 'strong' | 'fading' | 'weak'
  trend: ScoreTrend
  recencyScore?: number
  hasFlashcards: boolean
  hasQuizzes: boolean
  lessons: TopicLesson[]
}

export interface ActionSuggestionOptions {
  maxSuggestions?: number
  fsrsStability?: Map<string, number>
}

// ── Constants ───────────────────────────────────────────────────

/** Weights for the urgency formula */
export const URGENCY_WEIGHTS = {
  scoreFactor: 0.6,
  decayFactor: 0.4,
} as const

/** Action type priority for deduplication (lower = higher priority) */
const ACTION_PRIORITY: Record<ActionType, number> = {
  'flashcard-review': 0,
  'quiz-refresh': 1,
  'lesson-rewatch': 2,
}

const DEFAULT_MAX_SUGGESTIONS = 5
const DEFAULT_LESSON_DURATION = 15
const FLASHCARD_DURATION = 5
const QUIZ_DURATION = 10

// ── Urgency Calculation ─────────────────────────────────────────

/**
 * Calculate urgency score for a topic.
 * Higher score = more urgent need for remediation.
 *
 * Formula: urgencyScore = (100 - score) * 0.6 + decayFactor * 0.4
 */
export function calculateUrgencyScore(score: number, decayFactor: number): number {
  const raw = (100 - score) * URGENCY_WEIGHTS.scoreFactor + decayFactor * URGENCY_WEIGHTS.decayFactor
  return Math.max(0, Math.min(100, raw))
}

/**
 * Derive decay factor from FSRS stability.
 * Low stability (0) → high decay (100).
 * High stability (50+) → low decay (0).
 */
export function fsrsDecayFactor(stability: number): number {
  return Math.max(0, 100 - stability * 2)
}

/**
 * Derive decay factor from recency score (fallback when FSRS is unavailable).
 * Low recency → high decay (more urgent).
 */
export function recencyDecayFactor(recencyScore: number): number {
  return Math.max(0, Math.min(100, 100 - recencyScore))
}

// ── Per-Topic Suggestion Generation ─────────────────────────────

function generateFlashcardSuggestion(topic: TopicWithScore, urgency: number): ActionSuggestion {
  return {
    topicName: topic.topicName,
    canonicalName: topic.canonicalName,
    score: topic.score,
    trend: topic.trend,
    actionType: 'flashcard-review',
    actionLabel: `Review 5 flashcards on ${topic.topicName}`,
    actionRoute: `/flashcards?topic=${encodeURIComponent(topic.canonicalName)}`,
    estimatedMinutes: FLASHCARD_DURATION,
    urgencyScore: urgency,
  }
}

function generateQuizSuggestion(topic: TopicWithScore, urgency: number): ActionSuggestion {
  return {
    topicName: topic.topicName,
    canonicalName: topic.canonicalName,
    score: topic.score,
    trend: topic.trend,
    actionType: 'quiz-refresh',
    actionLabel: `Take a refresher quiz on ${topic.topicName}`,
    actionRoute: `/quiz?topic=${encodeURIComponent(topic.canonicalName)}`,
    estimatedMinutes: QUIZ_DURATION,
    urgencyScore: urgency,
  }
}

function generateLessonSuggestion(topic: TopicWithScore, urgency: number): ActionSuggestion | null {
  if (topic.lessons.length === 0) return null

  // Target the lesson with the lowest completion percentage
  const lowestLesson = topic.lessons.reduce((lowest, lesson) =>
    lesson.completionPct < lowest.completionPct ? lesson : lowest
  )

  return {
    topicName: topic.topicName,
    canonicalName: topic.canonicalName,
    score: topic.score,
    trend: topic.trend,
    actionType: 'lesson-rewatch',
    actionLabel: `Rewatch ${lowestLesson.title}`,
    actionRoute: `/courses/${encodeURIComponent(lowestLesson.courseId)}/lessons/${encodeURIComponent(lowestLesson.lessonId)}`,
    estimatedMinutes: lowestLesson.durationMinutes ?? DEFAULT_LESSON_DURATION,
    urgencyScore: urgency,
    lessonTitle: lowestLesson.title,
  }
}

/**
 * Generate all applicable action suggestions for a single topic.
 */
function generateTopicSuggestions(topic: TopicWithScore, urgency: number): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = []

  if (topic.hasFlashcards) {
    suggestions.push(generateFlashcardSuggestion(topic, urgency))
  }

  if (topic.hasQuizzes) {
    suggestions.push(generateQuizSuggestion(topic, urgency))
  }

  const lessonSuggestion = generateLessonSuggestion(topic, urgency)
  if (lessonSuggestion) {
    suggestions.push(lessonSuggestion)
  }

  return suggestions
}

// ── Main Entry Point ────────────────────────────────────────────

/**
 * Generate ranked action suggestions for topics with declining knowledge scores.
 *
 * Pure function — no React, Zustand, or Dexie imports.
 * All data is passed in as plain objects.
 *
 * @param topics - Topics with their knowledge scores and available learning activities
 * @param options - Optional configuration (maxSuggestions, FSRS stability data)
 * @returns Ranked action suggestions sorted by urgency (descending)
 */
export function generateActionSuggestions(
  topics: TopicWithScore[],
  options: ActionSuggestionOptions = {}
): ActionSuggestion[] {
  const { maxSuggestions = DEFAULT_MAX_SUGGESTIONS, fsrsStability } = options

  // Filter to only declining topics (fading or weak — score < 70)
  const decliningTopics = topics.filter(t => t.tier === 'fading' || t.tier === 'weak')

  if (decliningTopics.length === 0) return []

  // Generate all suggestions per topic
  const allSuggestions: ActionSuggestion[] = []

  for (const topic of decliningTopics) {
    // Calculate decay factor
    let decayFactor: number
    const stability = fsrsStability?.get(topic.canonicalName)
    if (stability !== undefined) {
      decayFactor = fsrsDecayFactor(stability)
    } else {
      decayFactor = recencyDecayFactor(topic.recencyScore ?? 50)
    }

    const urgency = calculateUrgencyScore(topic.score, decayFactor)
    const suggestions = generateTopicSuggestions(topic, urgency)
    allSuggestions.push(...suggestions)
  }

  // Deduplicate: keep only the highest-priority action type per topic
  const bestPerTopic = new Map<string, ActionSuggestion>()
  for (const suggestion of allSuggestions) {
    const existing = bestPerTopic.get(suggestion.canonicalName)
    if (
      !existing ||
      ACTION_PRIORITY[suggestion.actionType] < ACTION_PRIORITY[existing.actionType]
    ) {
      bestPerTopic.set(suggestion.canonicalName, suggestion)
    }
  }

  // Sort by urgency descending, limit to maxSuggestions
  return Array.from(bestPerTopic.values())
    .sort((a, b) => b.urgencyScore - a.urgencyScore || a.canonicalName.localeCompare(b.canonicalName))
    .slice(0, maxSuggestions)
}
