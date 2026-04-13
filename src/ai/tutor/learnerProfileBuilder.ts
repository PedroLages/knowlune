/**
 * Learner Profile Data Aggregation Layer (E63-S01)
 *
 * Pure function module that collects and structures learner profile data
 * from existing Dexie tables and Zustand stores. Each aggregation function
 * is independently callable and returns null when no data is available.
 *
 * Pattern reference: src/lib/qualityScore.ts (pure function module)
 *
 * S02 additions: Token-aware profile formatter and orchestrator.
 * - formatLearnerProfile(): formats LearnerProfileData into a budget-constrained string
 * - buildAndFormatLearnerProfile(): orchestrates aggregation + formatting
 * - filterByTopics(): scopes profile data to lesson-relevant topics
 */

import { db } from '@/db'
import { useKnowledgeMapStore } from '@/stores/useKnowledgeMapStore'
import type { Flashcard, StudySession } from '@/data/types'
import type { Quiz } from '@/types/quiz'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuizProfileData {
  /** Average percentage across all attempts */
  avgPercentage: number
  /** Number of attempts with percentage < QUIZ_FAIL_THRESHOLD */
  failedCount: number
  /** Topics with lowest average scores */
  weakTopics: string[]
}

export interface KnowledgeProfileData {
  /** Topics classified as weak by the knowledge map */
  weakTopics: string[]
  /** Topics that are fading (declining retention) */
  fadingTopics: string[]
}

export interface FlashcardProfileData {
  /** Cards with poor retention metrics */
  weakCardCount: number
  /** Cards past their review date */
  overdueCount: number
  /** First 3-5 words from weak card fronts as topic hints */
  weakTopicHints: string[]
}

export interface StudyProfileData {
  /** Total study hours in the window */
  totalHours: number
  /** Number of sessions in the window */
  sessionCount: number
  /** Average quality score across sessions */
  avgQuality: number
  /** Days since the most recent session */
  daysSinceLastSession: number
}

export interface LearnerProfileData {
  quizProfile: QuizProfileData | null
  knowledgeProfile: KnowledgeProfileData | null
  flashcardProfile: FlashcardProfileData | null
  studyProfile: StudyProfileData | null
}

/** Configuration for the profile builder orchestrator (S02) */
export interface ProfileBuilderConfig {
  courseId: string
  maxTokens: number
  lessonTopics?: string[]
}

/** Signals indicating areas of learner difficulty */
export enum ProfileSignal {
  KNOWLEDGE_WEAKNESS = 'KNOWLEDGE_WEAKNESS',
  QUIZ_FAILURES = 'QUIZ_FAILURES',
  FLASHCARD_STRUGGLES = 'FLASHCARD_STRUGGLES',
  STUDY_PATTERNS = 'STUDY_PATTERNS',
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUIZ_FAIL_THRESHOLD = 70
export const FSRS_WEAK_LAPSES = 2
export const FSRS_WEAK_STABILITY = 5
export const STUDY_WINDOW_DAYS = 7

/** Approximate characters per token (conservative estimate) */
export const CHARS_PER_TOKEN = 4


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract first 3-5 words from text as a topic hint */
function extractTopicHint(text: string): string {
  const words = text.trim().split(/\s+/)
  return words.slice(0, Math.min(5, Math.max(3, words.length))).join(' ')
}

/** Check if a flashcard is weak using FSRS heuristics */
function isWeakCard(card: Flashcard): boolean {
  return card.lapses > FSRS_WEAK_LAPSES && card.stability < FSRS_WEAK_STABILITY
}

/** Check if a flashcard is overdue */
function isOverdue(card: Flashcard, now: Date): boolean {
  if (!card.due) return false
  return new Date(card.due).getTime() < now.getTime()
}

// ---------------------------------------------------------------------------
// Aggregation Functions
// ---------------------------------------------------------------------------

/**
 * Aggregate quiz scores for a course.
 *
 * Joins quizAttempts → quizzes (via quizId) → contentProgress (via lessonId → courseId)
 * to find attempts belonging to the given course. Extracts weak topics from
 * quiz question `topic` fields.
 */
export async function aggregateQuizScores(
  courseId: string,
  _now?: Date
): Promise<QuizProfileData | null> {
  try {
    const [allQuizzes, allAttempts, allProgress] = await Promise.all([
      db.quizzes.toArray(),
      db.quizAttempts.toArray(),
      db.contentProgress.where('courseId').equals(courseId).toArray(),
    ])

    // Map lessonId → courseId using contentProgress
    const lessonIds = new Set(allProgress.map((p) => p.itemId))

    // Find quizzes belonging to this course's lessons
    const courseQuizIds = new Set<string>()
    const courseQuizzes: Quiz[] = []
    for (const quiz of allQuizzes) {
      if (lessonIds.has(quiz.lessonId)) {
        courseQuizIds.add(quiz.id)
        courseQuizzes.push(quiz)
      }
    }

    // Filter attempts for this course's quizzes
    const courseAttempts = allAttempts.filter((a) => courseQuizIds.has(a.quizId))

    if (courseAttempts.length === 0) return null

    // Compute average percentage and failed count
    const totalPercentage = courseAttempts.reduce((sum, a) => sum + a.percentage, 0)
    const avgPercentage = Math.round(totalPercentage / courseAttempts.length)
    const failedCount = courseAttempts.filter((a) => a.percentage < QUIZ_FAIL_THRESHOLD).length

    // Find weak topics: topics where average score is below threshold
    const topicScores = new Map<string, { correct: number; total: number }>()
    for (const attempt of courseAttempts) {
      const quiz = courseQuizzes.find((q) => q.id === attempt.quizId)
      if (!quiz) continue
      for (const answer of attempt.answers) {
        const question = quiz.questions.find((q) => q.id === answer.questionId)
        if (!question?.topic) continue
        const existing = topicScores.get(question.topic) ?? { correct: 0, total: 0 }
        existing.total += 1
        if (answer.isCorrect) existing.correct += 1
        topicScores.set(question.topic, existing)
      }
    }

    const weakTopics = [...topicScores.entries()]
      .filter(([, data]) => data.total > 0 && (data.correct / data.total) * 100 < QUIZ_FAIL_THRESHOLD)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .map(([topic]) => topic)

    return { avgPercentage, failedCount, weakTopics }
  } catch (error) {
    console.error('[learnerProfileBuilder] aggregateQuizScores failed:', error)
    return null
  }
}

/**
 * Aggregate knowledge map scores for a course.
 *
 * Reads from useKnowledgeMapStore to find topics classified as weak or fading
 * that are associated with the given courseId.
 */
export function aggregateKnowledgeScores(courseId: string): KnowledgeProfileData | null {
  try {
    const state = useKnowledgeMapStore.getState()
    if (!state.topics || state.topics.length === 0) return null

    // Filter topics that belong to this course
    const courseTopics = state.topics.filter((t) => t.courseIds.includes(courseId))
    if (courseTopics.length === 0) return null

    // Classify by score tier: weak = score < 40, fading = score 40-60 with high urgency
    const weakTopics = courseTopics
      .filter((t) => t.scoreResult.score < 40)
      .map((t) => t.name)

    const fadingTopics = courseTopics
      .filter(
        (t) =>
          t.scoreResult.score >= 40 &&
          t.scoreResult.score < 60 &&
          t.daysSinceLastEngagement > 7
      )
      .map((t) => t.name)

    if (weakTopics.length === 0 && fadingTopics.length === 0) return null

    return { weakTopics, fadingTopics }
  } catch (error) {
    console.error('[learnerProfileBuilder] aggregateKnowledgeScores failed:', error)
    return null
  }
}

/**
 * Aggregate flashcard weakness data for a course.
 *
 * Uses FSRS fields (lapses, stability, state) to identify struggling cards.
 * All flashcards have FSRS fields since the v31 migration.
 */
export async function aggregateFlashcardWeakness(
  courseId: string,
  now?: Date
): Promise<FlashcardProfileData | null> {
  try {
    const cards = await db.flashcards.where('courseId').equals(courseId).toArray()
    if (cards.length === 0) return null

    const currentTime = now ?? new Date()

    const weakCards = cards.filter(isWeakCard)
    const overdueCards = cards.filter((c) => isOverdue(c, currentTime))

    const weakTopicHints = weakCards
      .slice(0, 5)
      .map((c) => extractTopicHint(c.front))

    return {
      weakCardCount: weakCards.length,
      overdueCount: overdueCards.length,
      weakTopicHints,
    }
  } catch (error) {
    console.error('[learnerProfileBuilder] aggregateFlashcardWeakness failed:', error)
    return null
  }
}

/**
 * Aggregate study session data for a course within the study window.
 *
 * Looks at sessions in the last STUDY_WINDOW_DAYS days to provide
 * recent study pattern information.
 */
export async function aggregateStudySessions(
  courseId: string,
  now?: Date
): Promise<StudyProfileData | null> {
  try {
    const allSessions = await db.studySessions.where('courseId').equals(courseId).toArray()
    if (allSessions.length === 0) return null

    const currentTime = now ?? new Date()
    const windowStart = new Date(currentTime.getTime() - STUDY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    // Filter to sessions within the study window
    const recentSessions = allSessions.filter(
      (s) => new Date(s.startTime).getTime() >= windowStart.getTime()
    )

    if (recentSessions.length === 0) return null

    const totalSeconds = recentSessions.reduce((sum, s) => sum + s.duration, 0)
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10 // 1 decimal place

    const qualityScores = recentSessions
      .filter((s): s is StudySession & { qualityScore: number } => s.qualityScore != null)
      .map((s) => s.qualityScore)
    const avgQuality =
      qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length)
        : 0

    // Find most recent session to compute daysSinceLastSession
    const mostRecentTime = Math.max(
      ...allSessions.map((s) => new Date(s.endTime ?? s.startTime).getTime())
    )
    const daysSinceLastSession = Math.round(
      (currentTime.getTime() - mostRecentTime) / (1000 * 60 * 60 * 24)
    )

    return {
      totalHours,
      sessionCount: recentSessions.length,
      avgQuality,
      daysSinceLastSession: Math.max(0, daysSinceLastSession),
    }
  } catch (error) {
    console.error('[learnerProfileBuilder] aggregateStudySessions failed:', error)
    return null
  }
}

/**
 * Build a complete learner profile for a course by aggregating all data sources.
 *
 * Each sub-aggregation runs independently and returns null if no data exists.
 */
export async function buildLearnerProfile(
  courseId: string,
  now?: Date
): Promise<LearnerProfileData> {
  const [quizProfile, flashcardProfile, studyProfile] = await Promise.all([
    aggregateQuizScores(courseId, now),
    aggregateFlashcardWeakness(courseId, now),
    aggregateStudySessions(courseId, now),
  ])

  // Knowledge scores are synchronous (reads from Zustand store)
  const knowledgeProfile = aggregateKnowledgeScores(courseId)

  return {
    quizProfile,
    knowledgeProfile,
    flashcardProfile,
    studyProfile,
  }
}

// ---------------------------------------------------------------------------
// S02: Signal Formatters
// ---------------------------------------------------------------------------

/** Format knowledge weakness signal into a compact string */
function formatKnowledgeSignal(data: KnowledgeProfileData): string {
  const parts: string[] = []
  if (data.weakTopics.length > 0) {
    parts.push(`Weak: ${data.weakTopics.join(', ')}.`)
  }
  if (data.fadingTopics.length > 0) {
    parts.push(`Fading: ${data.fadingTopics.join(', ')}.`)
  }
  return parts.join(' ')
}

/** Format quiz failure signal into a compact string */
function formatQuizSignal(
  data: QuizProfileData,
  knowledgeTopics: Set<string>
): string {
  const parts: string[] = []
  parts.push(`Quiz avg: ${data.avgPercentage}%.`)
  // Deduplicate: only include quiz weak topics not already in knowledge signal
  const uniqueWeakTopics = data.weakTopics.filter(
    (t) => !knowledgeTopics.has(t.toLowerCase())
  )
  if (uniqueWeakTopics.length > 0) {
    parts.push(`Quiz struggles: ${uniqueWeakTopics.join(', ')}.`)
  }
  return parts.join(' ')
}

/** Format flashcard struggle signal into a compact string */
function formatFlashcardSignal(data: FlashcardProfileData): string {
  const parts: string[] = []
  if (data.weakCardCount > 0) {
    parts.push(`${data.weakCardCount} weak cards.`)
  }
  if (data.overdueCount > 0) {
    parts.push(`${data.overdueCount} overdue.`)
  }
  return parts.join(' ')
}

/** Format study pattern signal into a compact string */
function formatStudySignal(data: StudyProfileData): string {
  const parts: string[] = []
  parts.push(`${data.sessionCount} sessions, ${data.totalHours}h this week.`)
  if (data.avgQuality > 0) {
    parts.push(`Avg quality: ${data.avgQuality}/100.`)
  }
  if (data.daysSinceLastSession > 1) {
    parts.push(`Last session: ${data.daysSinceLastSession}d ago.`)
  }
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// S02: Topic Filtering
// ---------------------------------------------------------------------------

/**
 * Filter and prioritize profile data by lesson topics.
 *
 * Matching topics are boosted to the front of each list.
 * Non-matching topics are retained at lower priority.
 * Uses case-insensitive partial matching.
 */
export function filterByTopics(
  data: LearnerProfileData,
  lessonTopics: string[]
): LearnerProfileData {
  const lowerTopics = lessonTopics.map((t) => t.toLowerCase())

  const matchesTopic = (topic: string): boolean =>
    lowerTopics.some(
      (lt) => topic.toLowerCase().includes(lt) || lt.includes(topic.toLowerCase())
    )

  const prioritizeTopics = (topics: string[]): string[] => {
    const matching = topics.filter(matchesTopic)
    const nonMatching = topics.filter((t) => !matchesTopic(t))
    return [...matching, ...nonMatching]
  }

  return {
    quizProfile: data.quizProfile
      ? { ...data.quizProfile, weakTopics: prioritizeTopics(data.quizProfile.weakTopics) }
      : null,
    knowledgeProfile: data.knowledgeProfile
      ? {
          weakTopics: prioritizeTopics(data.knowledgeProfile.weakTopics),
          fadingTopics: prioritizeTopics(data.knowledgeProfile.fadingTopics),
        }
      : null,
    flashcardProfile: data.flashcardProfile,
    studyProfile: data.studyProfile,
  }
}

// ---------------------------------------------------------------------------
// S02: Token-Aware Formatter
// ---------------------------------------------------------------------------

/**
 * Format learner profile data into a compact string within a token budget.
 *
 * Signals are added in priority order (knowledge > quiz > flashcard > study).
 * Entire signal blocks are omitted when budget is exceeded — never truncated mid-sentence.
 * Returns empty string when all signals are null/empty.
 */
export function formatLearnerProfile(
  data: LearnerProfileData,
  maxTokens: number
): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN

  // Collect knowledge topics for deduplication with quiz signal
  const knowledgeTopics = new Set<string>()
  if (data.knowledgeProfile) {
    for (const t of data.knowledgeProfile.weakTopics) knowledgeTopics.add(t.toLowerCase())
    for (const t of data.knowledgeProfile.fadingTopics) knowledgeTopics.add(t.toLowerCase())
  }

  // Build signal blocks in priority order
  const signalBlocks: Array<{ text: string }> = []

  if (data.knowledgeProfile) {
    const text = formatKnowledgeSignal(data.knowledgeProfile)
    if (text) signalBlocks.push({ text })
  }

  if (data.quizProfile) {
    const text = formatQuizSignal(data.quizProfile, knowledgeTopics)
    if (text) signalBlocks.push({ text })
  }

  if (data.flashcardProfile) {
    const text = formatFlashcardSignal(data.flashcardProfile)
    if (text) signalBlocks.push({ text })
  }

  if (data.studyProfile) {
    const text = formatStudySignal(data.studyProfile)
    if (text) signalBlocks.push({ text })
  }

  if (signalBlocks.length === 0) return ''

  // Incrementally add signals while within budget
  const parts: string[] = []
  let currentLength = 0

  for (const block of signalBlocks) {
    const separator = parts.length > 0 ? ' ' : ''
    const newLength = currentLength + separator.length + block.text.length

    if (newLength > maxChars) break

    parts.push(block.text)
    currentLength = newLength
  }

  // When budget is extremely tight, include at least the highest-priority signal to avoid
  // returning empty context — callers should handle potential over-budget responses gracefully.
  if (parts.length === 0 && signalBlocks.length > 0) {
    parts.push(signalBlocks[0].text)
  }

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// S02: Orchestrator
// ---------------------------------------------------------------------------

/**
 * Build and format a learner profile for prompt injection.
 *
 * Orchestrates: parallel aggregation → topic filtering → token-aware formatting.
 * Uses Promise.allSettled so individual aggregation failures don't block others.
 */
export async function buildAndFormatLearnerProfile(
  config: ProfileBuilderConfig,
  now?: Date
): Promise<string> {
  const { courseId, maxTokens, lessonTopics } = config

  // Run all aggregations in parallel with graceful degradation
  const [quizResult, flashcardResult, studyResult] = await Promise.allSettled([
    aggregateQuizScores(courseId, now),
    aggregateFlashcardWeakness(courseId, now),
    aggregateStudySessions(courseId, now),
  ])

  // Knowledge is synchronous — wrap in try/catch for consistency
  let knowledgeProfile: KnowledgeProfileData | null = null
  try {
    knowledgeProfile = aggregateKnowledgeScores(courseId)
  } catch (error) {
    console.warn('[learnerProfileBuilder] aggregateKnowledgeScores failed:', error)
  }

  // Map settled results: fulfilled → value, rejected → null with warning
  let quizProfile: Awaited<ReturnType<typeof aggregateQuizScores>> | null = null
  if (quizResult.status === 'fulfilled') {
    quizProfile = quizResult.value
  } else {
    console.warn('[learnerProfileBuilder] aggregateQuizScores rejected:', quizResult.reason)
  }

  let flashcardProfile: Awaited<ReturnType<typeof aggregateFlashcardWeakness>> | null = null
  if (flashcardResult.status === 'fulfilled') {
    flashcardProfile = flashcardResult.value
  } else {
    console.warn(
      '[learnerProfileBuilder] aggregateFlashcardWeakness rejected:',
      flashcardResult.reason
    )
  }

  let studyProfile: Awaited<ReturnType<typeof aggregateStudySessions>> | null = null
  if (studyResult.status === 'fulfilled') {
    studyProfile = studyResult.value
  } else {
    console.warn(
      '[learnerProfileBuilder] aggregateStudySessions rejected:',
      studyResult.reason
    )
  }

  let profileData: LearnerProfileData = {
    quizProfile,
    knowledgeProfile,
    flashcardProfile,
    studyProfile,
  }

  // Apply topic filtering if lesson topics are provided
  if (lessonTopics && lessonTopics.length > 0) {
    profileData = filterByTopics(profileData, lessonTopics)
  }

  return formatLearnerProfile(profileData, maxTokens)
}
