/**
 * Knowledge Score Calculation (E56-S02)
 *
 * Computes per-topic knowledge scores from multiple learning signals:
 * quiz performance, flashcard retention, completion progress, and recency.
 * Dynamic weight redistribution handles missing signals gracefully.
 *
 * Pattern reference: src/lib/qualityScore.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeTier = 'strong' | 'fading' | 'weak'
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

export interface TopicScoreInput {
  /** Quiz score as percentage 0-100, or null if no quiz data */
  quizScore: number | null
  /** Average flashcard retention 0-100, or null if no flashcard data */
  flashcardRetention: number | null
  /** Completion percentage 0-100 */
  completionPercent: number
  /** Days since last engagement with this topic */
  daysSinceLastEngagement: number
}

export interface TopicScoreResult {
  /** Composite score 0-100 */
  score: number
  /** Knowledge tier classification */
  tier: KnowledgeTier
  /** Confidence based on how many signals are available */
  confidence: ConfidenceLevel
  /** Individual factor scores */
  factors: {
    quizScore: number | null
    flashcardRetention: number | null
    completionScore: number
    recencyScore: number
  }
  /** Number of signals used (2-4) */
  signalsUsed: number
  /** Effective weights after redistribution */
  effectiveWeights: {
    quiz: number
    flashcard: number
    completion: number
    recency: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base weights before redistribution — sum to 1.0 */
export const BASE_WEIGHTS = {
  quiz: 0.3,
  flashcard: 0.3,
  completion: 0.2,
  recency: 0.2,
} as const

/** Recency decay constants */
const RECENCY_FULL_DAYS = 7
const RECENCY_FLOOR_DAYS = 90
const RECENCY_MAX_SCORE = 100
const RECENCY_FLOOR_SCORE = 10

// ---------------------------------------------------------------------------
// Tier & Confidence
// ---------------------------------------------------------------------------

/** Classify a score into a knowledge tier */
export function getKnowledgeTier(score: number): KnowledgeTier {
  if (score >= 70) return 'strong'
  if (score >= 40) return 'fading'
  return 'weak'
}

/** Determine confidence level based on number of available signals */
export function getConfidenceLevel(signalsUsed: number): ConfidenceLevel {
  if (signalsUsed >= 4) return 'high'
  if (signalsUsed === 3) return 'medium'
  if (signalsUsed === 2) return 'low'
  return 'none'
}

// ---------------------------------------------------------------------------
// Recency Score
// ---------------------------------------------------------------------------

/**
 * Calculate recency score based on days since last engagement.
 * - 0-7 days: 100 (full score)
 * - 7-90 days: linear decay from 100 to 10
 * - 90+ days: 10 (floor, never zero)
 */
export function calculateRecencyScore(daysSinceLastEngagement: number): number {
  if (daysSinceLastEngagement <= RECENCY_FULL_DAYS) return RECENCY_MAX_SCORE
  if (daysSinceLastEngagement >= RECENCY_FLOOR_DAYS) return RECENCY_FLOOR_SCORE

  // Linear decay over the 83-day range (7 to 90)
  const range = RECENCY_FLOOR_DAYS - RECENCY_FULL_DAYS // 83
  const elapsed = daysSinceLastEngagement - RECENCY_FULL_DAYS
  const decayRange = RECENCY_MAX_SCORE - RECENCY_FLOOR_SCORE // 90

  return Math.round(RECENCY_MAX_SCORE - (elapsed / range) * decayRange)
}

// ---------------------------------------------------------------------------
// Composite Score
// ---------------------------------------------------------------------------

/**
 * Calculate a composite knowledge score for a topic using dynamic weight
 * redistribution. Missing signals (null quiz/flashcard) have their weights
 * distributed proportionally among available signals.
 */
export function calculateTopicScore(input: TopicScoreInput): TopicScoreResult {
  const recencyScore = calculateRecencyScore(input.daysSinceLastEngagement)
  const completionScore = Math.max(0, Math.min(100, input.completionPercent))

  // Determine which signals are available
  const hasQuiz = input.quizScore !== null
  const hasFlashcard = input.flashcardRetention !== null

  // Build available weights map
  const available: { key: keyof typeof BASE_WEIGHTS; value: number; score: number }[] = []

  if (hasQuiz) {
    available.push({ key: 'quiz', value: BASE_WEIGHTS.quiz, score: input.quizScore! })
  }
  if (hasFlashcard) {
    available.push({
      key: 'flashcard',
      value: BASE_WEIGHTS.flashcard,
      score: input.flashcardRetention!,
    })
  }
  // Completion and recency are always available
  available.push({ key: 'completion', value: BASE_WEIGHTS.completion, score: completionScore })
  available.push({ key: 'recency', value: BASE_WEIGHTS.recency, score: recencyScore })

  const signalsUsed = available.length

  // Guard: no signals (should not happen since completion+recency are always present)
  if (signalsUsed === 0) {
    return {
      score: 0,
      tier: 'weak',
      confidence: 'none',
      factors: {
        quizScore: null,
        flashcardRetention: null,
        completionScore: 0,
        recencyScore: 0,
      },
      signalsUsed: 0,
      effectiveWeights: { quiz: 0, flashcard: 0, completion: 0, recency: 0 },
    }
  }

  // Redistribute weights proportionally
  const totalAvailableWeight = available.reduce((sum, s) => sum + s.value, 0)

  const effectiveWeights = {
    quiz: 0,
    flashcard: 0,
    completion: 0,
    recency: 0,
  }

  let compositeScore = 0
  for (const signal of available) {
    const normalizedWeight = signal.value / totalAvailableWeight
    effectiveWeights[signal.key] = normalizedWeight
    compositeScore += signal.score * normalizedWeight
  }

  const score = Math.round(Math.max(0, Math.min(100, compositeScore)))

  return {
    score,
    tier: getKnowledgeTier(score),
    confidence: getConfidenceLevel(signalsUsed),
    factors: {
      quizScore: input.quizScore,
      flashcardRetention: input.flashcardRetention,
      completionScore,
      recencyScore,
    },
    signalsUsed,
    effectiveWeights,
  }
}

// ---------------------------------------------------------------------------
// Urgency
// ---------------------------------------------------------------------------

/**
 * Calculate urgency for a topic. Higher urgency = needs more attention.
 * Formula: (100 - score) * 0.6 + min(100, daysSinceEngagement * 2) * 0.4
 */
export function computeUrgency(score: number, daysSinceEngagement: number): number {
  const scoreFactor = (100 - score) * 0.6
  const timeFactor = Math.min(100, daysSinceEngagement * 2) * 0.4
  return Math.round(scoreFactor + timeFactor)
}

// ---------------------------------------------------------------------------
// Suggested Actions
// ---------------------------------------------------------------------------

export type SuggestedAction = 'Review Flashcards' | 'Retake Quiz' | 'Rewatch Lesson'

/**
 * Suggest actions based on which signal is weakest.
 * Actions are sorted by priority (lowest-scoring signal gets highest priority).
 */
export function suggestActions(input: {
  quizScore: number | null
  flashcardRetention: number | null
  completionPercent: number
}): SuggestedAction[] {
  const signals: { action: SuggestedAction; score: number }[] = []

  if (input.flashcardRetention !== null) {
    signals.push({ action: 'Review Flashcards', score: input.flashcardRetention })
  }
  if (input.quizScore !== null) {
    signals.push({ action: 'Retake Quiz', score: input.quizScore })
  }
  if (input.completionPercent < 100) {
    signals.push({ action: 'Rewatch Lesson', score: input.completionPercent })
  }

  // Sort by score ascending (weakest first = highest priority)
  signals.sort((a, b) => a.score - b.score)

  return signals.map((s) => s.action)
}
