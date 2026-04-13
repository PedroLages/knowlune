/**
 * Knowledge Score Calculation (E56-S02, E62-S01)
 *
 * Computes per-topic knowledge scores from multiple learning signals:
 * quiz performance, flashcard retention, completion progress, and recency.
 * Dynamic weight redistribution handles missing signals gracefully.
 *
 * E62-S01 adds FSRS retention aggregation: calculateAggregateRetention()
 * computes average retention across flashcards using predictRetention(),
 * and calculateDecayDate() predicts when retention drops below 70%.
 *
 * Pattern reference: src/lib/qualityScore.ts
 */

import { predictRetention } from '@/lib/spacedRepetition'

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
  /**
   * FSRS aggregate retention 0-100, or null if no FSRS flashcard data.
   * When provided, replaces flashcardRetention as the flashcard factor (30% weight).
   * When null, falls back to flashcardRetention for backward compatibility.
   */
  fsrsRetention?: number | null
}

/** Minimal flashcard shape needed for retention aggregation */
export interface RetentionFlashcard {
  last_review?: string
  stability: number
  /** SM-2 interval field — present on legacy cards without FSRS stability */
  interval?: number
  /** SM-2 reviewedAt field — present on legacy cards */
  reviewedAt?: string
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
// FSRS Retention Aggregation (E62-S01)
// ---------------------------------------------------------------------------

/**
 * Aggregate retention result for a set of flashcards.
 */
export interface AggregateRetentionResult {
  /** Average retention 0-100, or null if no reviewed cards */
  retention: number | null
  /** Average stability in days across reviewed cards, or null */
  avgStability: number | null
}

/**
 * Calculate aggregate retention across a set of flashcards.
 *
 * Filters out unreviewed cards (no last_review). For reviewed cards, uses
 * predictRetention() to compute per-card retention, then averages.
 *
 * Feature detection: cards with `stability > 0` use FSRS path;
 * cards without stability but with last_review still get predictRetention()
 * which handles the stability=0 case (returns 0).
 *
 * @returns retention (0-100) and avgStability, or null for both if no reviewed cards
 */
export function calculateAggregateRetention(
  flashcards: RetentionFlashcard[],
  now: Date = new Date()
): AggregateRetentionResult {
  if (flashcards.length === 0) return { retention: null, avgStability: null }

  // Filter to reviewed cards with meaningful stability
  const reviewedCards = flashcards.filter(card => card.last_review && card.stability > 0)

  if (reviewedCards.length === 0) return { retention: null, avgStability: null }

  let totalRetention = 0
  let totalStability = 0

  for (const card of reviewedCards) {
    const retention = predictRetention(
      { last_review: card.last_review, stability: card.stability },
      now
    )
    totalRetention += retention
    totalStability += card.stability
  }

  return {
    retention: Math.round(totalRetention / reviewedCards.length),
    avgStability: totalStability / reviewedCards.length,
  }
}

/**
 * Calculate the predicted date when average retention drops below 70%.
 *
 * FSRS formula: daysUntilDecay = 9 * avgStability * (1/0.70 - 1)
 *   Derived from R(t,S) = (1 + t/(9*S))^(-1) = 0.70
 *   → t = 9*S*(0.70^(-1) - 1) = 9*S*(1/0.70 - 1)
 *
 * @param avgStability - Average stability in days across reviewed cards
 * @param now - Current timestamp
 * @returns ISO date string when retention drops to 70%, or null if avgStability <= 0
 */
export function calculateDecayDate(avgStability: number, now: Date = new Date()): string | null {
  if (avgStability <= 0) return null

  // FSRS power-law: solve for t when R(t,S) = 0.70
  // R(t,S) = (1 + t/(9*S))^(-1) → t = 9*S*(R^(-1) - 1)
  const daysUntilDecay = 9 * avgStability * (1 / 0.7 - 1)

  const decayDate = new Date(now.getTime() + daysUntilDecay * 24 * 60 * 60 * 1000)
  return decayDate.toISOString()
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

  // FSRS retention overrides flashcardRetention when available (E62-S01)
  const effectiveFlashcardRetention =
    input.fsrsRetention !== undefined && input.fsrsRetention !== null
      ? input.fsrsRetention
      : input.flashcardRetention

  // Determine which signals are available
  const hasQuiz = input.quizScore !== null
  const hasFlashcard = effectiveFlashcardRetention !== null

  // Build available weights map
  const available: { key: keyof typeof BASE_WEIGHTS; value: number; score: number }[] = []

  if (hasQuiz) {
    available.push({ key: 'quiz', value: BASE_WEIGHTS.quiz, score: input.quizScore! })
  }
  if (hasFlashcard) {
    available.push({
      key: 'flashcard',
      value: BASE_WEIGHTS.flashcard,
      score: effectiveFlashcardRetention!,
    })
  }
  // Completion and recency are always available
  available.push({ key: 'completion', value: BASE_WEIGHTS.completion, score: completionScore })
  available.push({ key: 'recency', value: BASE_WEIGHTS.recency, score: recencyScore })

  const signalsUsed = available.length

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
      flashcardRetention: effectiveFlashcardRetention,
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

  return signals.map(s => s.action)
}
