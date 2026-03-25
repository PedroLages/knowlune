import type { Question, Answer, QuizAttempt, Quiz } from '@/types/quiz'
import { isUnanswered } from '@/lib/scoring'
import { db } from '@/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TopicPerformance = {
  name: string
  percentage: number
  /** 1-indexed question numbers for incorrect answers only */
  questionNumbers: number[]
}

export type TopicAnalysis = {
  correctCount: number
  incorrectCount: number
  skippedCount: number
  /** Topics with ≥70% correct, sorted highest first */
  strengths: TopicPerformance[]
  /** Topics with <70% correct, sorted lowest first (max 3) */
  growthAreas: TopicPerformance[]
  /** False when all questions share a single topic (including all "General") */
  hasMultipleTopics: boolean
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const STRENGTH_THRESHOLD = 70
const MAX_GROWTH_AREAS = 3

/**
 * Analyze quiz performance grouped by question topic.
 *
 * Groups questions by their `topic` field (defaults to "General"),
 * calculates per-topic correctness, and categorizes into strengths
 * (≥70%) and growth areas (<70%).
 */
export function analyzeTopicPerformance(questions: Question[], answers: Answer[]): TopicAnalysis {
  const answerMap = new Map(answers.map(a => [a.questionId, a]))

  // Aggregate counts per topic
  const topicMap = new Map<
    string,
    { correct: number; total: number; incorrectQuestionNumbers: number[] }
  >()

  let correctCount = 0
  let incorrectCount = 0
  let skippedCount = 0

  for (const question of questions) {
    const topic = question.topic?.trim() || 'General'
    const answer = answerMap.get(question.id)

    if (!topicMap.has(topic)) {
      topicMap.set(topic, { correct: 0, total: 0, incorrectQuestionNumbers: [] })
    }
    const entry = topicMap.get(topic)!
    entry.total++

    if (!answer || isUnanswered(answer.userAnswer)) {
      skippedCount++
      // Intentional: skipped questions count toward growth areas because the learner
      // still needs to attempt them. "Review questions X, Y" includes both wrong and skipped.
      entry.incorrectQuestionNumbers.push(question.order)
    } else if (answer.isCorrect) {
      correctCount++
      entry.correct++
    } else {
      incorrectCount++
      entry.incorrectQuestionNumbers.push(question.order)
    }
  }

  // Build topic performance entries
  const topics: TopicPerformance[] = Array.from(topicMap.entries()).map(
    ([name, { correct, total, incorrectQuestionNumbers }]) => ({
      name,
      percentage: total > 0 ? Math.floor((correct / total) * 100) : 0,
      questionNumbers: incorrectQuestionNumbers.sort((a, b) => a - b),
    })
  )

  const hasMultipleTopics = topicMap.size > 1

  const strengths = topics
    .filter(t => t.percentage >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.percentage - a.percentage)

  const growthAreas = topics
    .filter(t => t.percentage < STRENGTH_THRESHOLD)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, MAX_GROWTH_AREAS)

  return {
    correctCount,
    incorrectCount,
    skippedCount,
    strengths,
    growthAreas,
    hasMultipleTopics,
  }
}

// ---------------------------------------------------------------------------
// Score Improvement (E16-S03)
// ---------------------------------------------------------------------------

export type ImprovementData = {
  /** Percentage from the chronologically first attempt (null if only 1 attempt) */
  firstScore: number | null
  /** Highest percentage across ALL attempts including current */
  bestScore: number | null
  /** 1-based attempt number for the overall best score */
  bestAttemptNumber: number | null
  /** Percentage from the most recent (current) attempt */
  currentScore: number
  /** currentScore − firstScore (null when fewer than 2 attempts) */
  improvement: number | null
  /** True only when current beats ALL previous attempts (strict >) */
  isNewBest: boolean
}

/**
 * Calculate score improvement across quiz attempts.
 *
 * Attempts are sorted chronologically by completedAt before analysis.
 * The "current" attempt is always the most recent one.
 *
 * - Single attempt: improvement = null, isNewBest = false (nothing to compare)
 * - Multi-attempt: improvement = currentScore - firstScore; isNewBest = current > max(previous)
 */
export function calculateImprovement(attempts: QuizAttempt[]): ImprovementData {
  if (attempts.length === 0) {
    return {
      firstScore: null,
      bestScore: null,
      bestAttemptNumber: null,
      currentScore: 0,
      improvement: null,
      isNewBest: false,
    }
  }

  const sortedByDate = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const firstAttempt = sortedByDate[0]
  const currentAttempt = sortedByDate[sortedByDate.length - 1]

  // Previous attempts (all except the most recent) — used to determine isNewBest
  const previousAttempts = sortedByDate.slice(0, -1)
  const bestPrevious =
    previousAttempts.length > 0
      ? previousAttempts.reduce((best, cur) => (cur.percentage > best.percentage ? cur : best))
      : null

  // Best across ALL attempts (including current) — for bestAttemptNumber display
  // Uses the chronologically sorted array for correct 1-based attempt numbering
  let bestIndex = 0
  for (let i = 1; i < sortedByDate.length; i++) {
    if (sortedByDate[i].percentage > sortedByDate[bestIndex].percentage) {
      bestIndex = i
    }
  }

  const improvement =
    sortedByDate.length > 1 ? currentAttempt.percentage - firstAttempt.percentage : null

  const isNewBest = bestPrevious !== null && currentAttempt.percentage > bestPrevious.percentage

  return {
    firstScore: sortedByDate.length > 1 ? firstAttempt.percentage : null,
    bestScore: sortedByDate[bestIndex].percentage,
    bestAttemptNumber: bestIndex + 1,
    currentScore: currentAttempt.percentage,
    improvement,
    isNewBest,
  }
}

// ---------------------------------------------------------------------------
// Completion Rate (E17-S01)
// ---------------------------------------------------------------------------

export type CompletionRateResult = {
  /** Percentage of started quizzes that were completed (0–100) */
  completionRate: number
  /** Number of distinct quizzes with at least one completed attempt */
  completedCount: number
  /** Total unique quizzes started (completed + in-progress) */
  startedCount: number
}

/**
 * Calculate quiz completion rate from attempt history and in-progress state.
 *
 * Formula: (unique quizzes completed / unique quizzes started) * 100
 *
 * "Completed" = has at least one entry in db.quizAttempts.
 * "In-progress" = currently tracked in localStorage quiz store (not yet submitted).
 *
 * Multiple attempts of the same quiz count as 1 completed quiz (uses Set of quizIds).
 * An in-progress quiz that also has past completed attempts is NOT double-counted
 * (it already appears in the completed set).
 */
export async function calculateCompletionRate(): Promise<CompletionRateResult> {
  const allAttempts = await db.quizAttempts.toArray()
  const completedQuizIds = new Set(allAttempts.map(a => a.quizId))
  const completedCount = completedQuizIds.size

  // Parse localStorage to detect in-progress quiz (not yet submitted)
  let inProgressQuizId: string | null = null
  try {
    const quizStoreData = localStorage.getItem('levelup-quiz-store')
    if (quizStoreData) {
      const parsed = JSON.parse(quizStoreData)
      const progressQuizId = parsed?.state?.currentProgress?.quizId
      if (typeof progressQuizId === 'string' && progressQuizId.length > 0) {
        inProgressQuizId = progressQuizId
      }
    }
  } catch {
    // silent-catch-ok — localStorage parse failure is non-fatal; treat as no in-progress quiz
  }

  // Only count in-progress quiz if it hasn't already been completed before
  const inProgressCount = inProgressQuizId && !completedQuizIds.has(inProgressQuizId) ? 1 : 0

  const startedCount = completedCount + inProgressCount
  const completionRate = startedCount > 0 ? (completedCount / startedCount) * 100 : 0

  return { completionRate, completedCount, startedCount }
}

// ---------------------------------------------------------------------------
// Retake Frequency (E17-S02)
// ---------------------------------------------------------------------------

export type RetakeFrequencyResult = {
  /** Average number of attempts per unique quiz */
  averageRetakes: number
  /** Total completed attempts across all quizzes */
  totalAttempts: number
  /** Number of distinct quizzes attempted at least once */
  uniqueQuizzes: number
}

/**
 * Calculate average retake frequency from quiz attempt history.
 *
 * Formula: totalAttempts / uniqueQuizzes
 *
 * Multiple attempts for the same quizId all count. Returns 0 when no
 * attempts exist (no division by zero).
 */
export async function calculateRetakeFrequency(): Promise<RetakeFrequencyResult> {
  const allAttempts = await db.quizAttempts.toArray()
  const uniqueQuizIds = new Set(allAttempts.map(a => a.quizId))

  const totalAttempts = allAttempts.length
  const uniqueQuizzes = uniqueQuizIds.size
  const averageRetakes = uniqueQuizzes > 0 ? totalAttempts / uniqueQuizzes : 0

  return { averageRetakes, totalAttempts, uniqueQuizzes }
}

/**
 * Returns an encouraging interpretation string for the retake frequency.
 *
 * Bands:
 * - ≤ 1.0: "No retakes yet — each quiz taken once."
 * - ≤ 2.0: "Light review — you occasionally revisit quizzes."
 * - ≤ 3.0: "Active practice — you retake quizzes 2-3 times on average for mastery."
 * - > 3.0: "Deep practice — strong commitment to mastery through repetition."
 */
export function interpretRetakeFrequency(avg: number): string {
  if (avg <= 1.0) return 'No retakes yet — each quiz taken once.'
  if (avg <= 2.0) return 'Light review — you occasionally revisit quizzes.'
  if (avg <= 3.0) return 'Active practice — you retake quizzes 2-3 times on average for mastery.'
  return 'Deep practice — strong commitment to mastery through repetition.'
}

/**
 * Calculate normalized gain (Hake's formula) across quiz attempts.
 *
 * Formula: g = (post% - pre%) / (100 - pre%)
 *
 * - pre%: percentage from the chronologically first attempt
 * - post%: percentage from the chronologically last attempt
 * - Returns null when < 2 attempts or pre% = 100 (ceiling effect / division by zero)
 *
 * Reference: Hake, R.R. (1998). "Interactive-engagement versus traditional methods"
 */
export function calculateNormalizedGain(attempts: QuizAttempt[]): number | null {
  if (attempts.length < 2) return null

  const sorted = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const pre = sorted[0].percentage
  const post = sorted[sorted.length - 1].percentage

  if (pre >= 100) return null

  return (post - pre) / (100 - pre)
}

// ---------------------------------------------------------------------------
// Item Difficulty — P-Values (E17-S03)
// ---------------------------------------------------------------------------

export type ItemDifficulty = {
  /** Question ID from the quiz */
  questionId: string
  /** Question text for display */
  questionText: string
  /** 1-indexed display order (from question.order) */
  questionOrder: number
  /** Topic tag (defaults to "General" if unset) */
  topic: string
  /** Proportion of attempts answered correctly (0.0–1.0) */
  pValue: number
  /** Human-readable difficulty label */
  difficulty: 'Easy' | 'Medium' | 'Difficult'
}

/**
 * Calculate item difficulty (P-values) for each question in a quiz.
 *
 * P-value = proportion of attempts where the question was answered correctly.
 * Questions with zero attempts across all attempts are excluded.
 *
 * Difficulty thresholds (standard psychometric convention):
 *   - P >= 0.8  → "Easy"
 *   - 0.5 <= P < 0.8 → "Medium"
 *   - P < 0.5  → "Difficult"
 *
 * Results are sorted easiest-first (descending P-value) for display.
 */
export function calculateItemDifficulty(quiz: Quiz, attempts: QuizAttempt[]): ItemDifficulty[] {
  if (attempts.length === 0) return []

  // Aggregate correct/total counts per questionId across all attempts
  const statsMap = new Map<string, { correct: number; total: number }>()

  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      // Exclude skipped/unanswered — they reflect time pressure, not knowledge gaps.
      // Consistent with analyzeTopicPerformance which uses the same exclusion.
      if (isUnanswered(answer.userAnswer)) continue
      const existing = statsMap.get(answer.questionId) ?? { correct: 0, total: 0 }
      statsMap.set(answer.questionId, {
        correct: existing.correct + (answer.isCorrect ? 1 : 0),
        total: existing.total + 1,
      })
    }
  }

  // Map quiz questions to ItemDifficulty, excluding questions with no attempts
  return quiz.questions
    .map((q): ItemDifficulty | null => {
      const stats = statsMap.get(q.id)
      if (!stats || stats.total === 0) return null

      const pValue = stats.correct / stats.total
      const difficulty: ItemDifficulty['difficulty'] =
        pValue >= 0.8 ? 'Easy' : pValue >= 0.5 ? 'Medium' : 'Difficult'

      return {
        questionId: q.id,
        questionText: q.text,
        questionOrder: q.order,
        topic: q.topic?.trim() || 'General',
        pValue,
        difficulty,
      }
    })
    .filter((item): item is ItemDifficulty => item !== null)
    .sort((a, b) => b.pValue - a.pValue) // Easiest first
}

// ---------------------------------------------------------------------------
// Discrimination Indices — Point-Biserial Correlation (E17-S04)
// ---------------------------------------------------------------------------

export type DiscriminationResult = {
  /** Question ID from the quiz */
  questionId: string
  /**
   * Point-biserial correlation between question correctness (0/1) and total score.
   * Range: -1.0 to 1.0. Negative values indicate the question may have issues.
   * 0 is returned for edge cases (all same answer, all same score).
   */
  discriminationIndex: number
  /** Human-readable interpretation of the discrimination index */
  interpretation: string
}

/**
 * Calculate discrimination indices (point-biserial correlation) for each quiz question.
 *
 * Discrimination index = correlation between getting a question right and overall quiz score.
 * A high value means high scorers tend to get it right; low scorers tend to get it wrong.
 *
 * Returns null when fewer than 5 attempts (insufficient data for meaningful analysis).
 *
 * Formula (point-biserial correlation):
 *   rpb = ((M₁ - M₀) / SD) × √(p × (1 − p))
 *   where:
 *     M₁ = mean total score for correct-answer group
 *     M₀ = mean total score for incorrect-answer group
 *     SD = sample standard deviation of all scores (n−1)
 *     p  = proportion of correct answers
 *
 * Interpretation thresholds (standard psychometric convention):
 *   rpb > 0.3  → High discriminator
 *   0.2 ≤ rpb ≤ 0.3 → Moderate discriminator
 *   rpb < 0.2  → Low discriminator (or ambiguous/trivial question)
 */
export function calculateDiscriminationIndices(
  quiz: Quiz,
  attempts: QuizAttempt[]
): DiscriminationResult[] | null {
  if (attempts.length < 5) return null

  // Pre-build lookup map to avoid O(n×m) find() calls and to support unanswered filtering.
  // Consistent with calculateItemDifficulty which also excludes unanswered/skipped answers.
  const answerLookup = new Map(
    attempts.map(attempt => [attempt.id, new Map(attempt.answers.map(a => [a.questionId, a]))])
  )

  return quiz.questions.map(question => {
    // Only include attempts where this question was actually answered (not skipped)
    const dataPoints = attempts
      .map(attempt => {
        const answer = answerLookup.get(attempt.id)?.get(question.id)
        if (!answer || isUnanswered(answer.userAnswer)) return null
        return { x: answer.isCorrect ? 1 : 0, y: attempt.score }
      })
      .filter((d): d is { x: number; y: number } => d !== null)

    const n = dataPoints.length

    const group1 = dataPoints.filter(d => d.x === 1).map(d => d.y) // Correct
    const group0 = dataPoints.filter(d => d.x === 0).map(d => d.y) // Incorrect

    if (group1.length === 0 || group0.length === 0) {
      return {
        questionId: question.id,
        discriminationIndex: 0,
        interpretation: 'Not enough data',
      }
    }

    const mean1 = group1.reduce((sum, val) => sum + val, 0) / group1.length
    const mean0 = group0.reduce((sum, val) => sum + val, 0) / group0.length

    // Sample standard deviation of all scores (n-1 for unbiased estimate)
    const allScores = dataPoints.map(d => d.y)
    const meanAll = allScores.reduce((sum, val) => sum + val, 0) / n
    const variance = allScores.reduce((sum, val) => sum + Math.pow(val - meanAll, 2), 0) / (n - 1)
    const sd = Math.sqrt(variance)

    if (sd === 0) {
      return {
        questionId: question.id,
        discriminationIndex: 0,
        interpretation: 'All scores identical — cannot discriminate',
      }
    }

    const p = group1.length / n
    const rpb = ((mean1 - mean0) / sd) * Math.sqrt(p * (1 - p))

    let interpretation: string
    if (rpb > 0.3) {
      interpretation =
        'High discriminator — you tend to get this right on strong attempts and wrong on weak ones.'
    } else if (rpb >= 0.2) {
      interpretation =
        'Moderate discriminator — this question partially differentiates strong and weak attempts.'
    } else {
      interpretation =
        "Low discriminator — doesn't correlate well with overall performance. Might be ambiguous or overly easy/hard."
    }

    return { questionId: question.id, discriminationIndex: rpb, interpretation }
  })
}

// ---------------------------------------------------------------------------
// Learning Trajectory Patterns (E17-S05)
// ---------------------------------------------------------------------------

export type TrajectoryPattern = 'linear' | 'exponential' | 'logarithmic' | 'declining' | 'plateau'

export type TrajectoryResult = {
  /** Detected pattern type */
  pattern: TrajectoryPattern
  /** Human-readable interpretation of the pattern */
  interpretation: string
  /** R² (coefficient of determination) for the best-fit model (0.0–1.0) */
  confidence: number
  /** Data points used for the analysis (attempt number + percentage) */
  dataPoints: Array<{ attemptNumber: number; percentage: number }>
}

/**
 * Pattern interpretations mapping.
 */
const TRAJECTORY_INTERPRETATIONS: Record<TrajectoryPattern, string> = {
  linear: 'Consistent improvement',
  exponential: 'Accelerating mastery',
  logarithmic: 'Strong early gains, then plateauing',
  declining: 'Consider reviewing material',
  plateau: 'Consistent performance',
}

/**
 * Calculate the linear R² (coefficient of determination) for a set of (x, y) points.
 *
 * R² = 1 - (SS_res / SS_tot)
 * where SS_res = sum of (y_i - ŷ_i)² and SS_tot = sum of (y_i - ȳ)²
 *
 * Returns 0 when SS_tot is 0 (all y values identical — plateau).
 */
export function calculateLinearR2(points: Array<{ x: number; y: number }>): number {
  const n = points.length
  if (n < 2) return 0

  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n

  // Linear regression: ŷ = slope * x + intercept
  let sumXY = 0
  let sumX2 = 0
  for (const p of points) {
    sumXY += (p.x - meanX) * (p.y - meanY)
    sumX2 += (p.x - meanX) ** 2
  }

  if (sumX2 === 0) return 0

  const slope = sumXY / sumX2
  const intercept = meanY - slope * meanX

  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - meanY) ** 2
  }

  if (ssTot === 0) return 0

  return Math.max(0, 1 - ssRes / ssTot)
}

/**
 * Calculate R² for a logarithmic fit: y = a * ln(x) + b
 * Transforms x to ln(x) then applies linear regression on (ln(x), y).
 */
function calculateLogR2(points: Array<{ x: number; y: number }>): number {
  const transformed = points.filter(p => p.x > 0).map(p => ({ x: Math.log(p.x), y: p.y }))
  return calculateLinearR2(transformed)
}

/**
 * Calculate R² for an exponential fit: y = a * e^(bx)
 * Transforms y to ln(y) then applies linear regression on (x, ln(y)).
 * Only uses points where y > 0.
 */
function calculateExpR2(points: Array<{ x: number; y: number }>): number {
  const transformed = points.filter(p => p.y > 0).map(p => ({ x: p.x, y: Math.log(p.y) }))
  if (transformed.length < 2) return 0
  return calculateLinearR2(transformed)
}

/**
 * Detect learning trajectory pattern from quiz attempts.
 *
 * Requires at least 3 attempts for meaningful analysis. Attempts are sorted
 * chronologically by completedAt before analysis.
 *
 * Classification logic:
 * 1. Check for plateau: if range of scores <= 5 percentage points → plateau
 * 2. Check for declining: if linear slope is negative → declining (confidence = linear R²)
 * 3. Compare R² of linear, exponential, and logarithmic fits → pick best model
 *
 * Returns null when fewer than 3 attempts exist.
 */
export function detectLearningTrajectory(attempts: QuizAttempt[]): TrajectoryResult | null {
  if (attempts.length < 3) return null

  const sorted = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const dataPoints = sorted.map((a, i) => ({
    attemptNumber: i + 1,
    percentage: a.percentage,
  }))

  const points = dataPoints.map(d => ({ x: d.attemptNumber, y: d.percentage }))

  // Check for plateau: range of scores <= 5
  const scores = points.map(p => p.y)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)

  if (maxScore - minScore <= 5) {
    return {
      pattern: 'plateau',
      interpretation: TRAJECTORY_INTERPRETATIONS.plateau,
      confidence: 1,
      dataPoints,
    }
  }

  // Calculate linear slope for direction detection
  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n
  let sumXY = 0
  let sumX2 = 0
  for (const p of points) {
    sumXY += (p.x - meanX) * (p.y - meanY)
    sumX2 += (p.x - meanX) ** 2
  }
  const slope = sumX2 === 0 ? 0 : sumXY / sumX2

  // Check for declining trend
  if (slope < 0) {
    const confidence = calculateLinearR2(points)
    return {
      pattern: 'declining',
      interpretation: TRAJECTORY_INTERPRETATIONS.declining,
      confidence,
      dataPoints,
    }
  }

  // Compare models for positive/improving trends
  const linearR2 = calculateLinearR2(points)
  const expR2 = calculateExpR2(points)
  const logR2 = calculateLogR2(points)

  const models: Array<{ pattern: TrajectoryPattern; r2: number }> = [
    { pattern: 'linear', r2: linearR2 },
    { pattern: 'exponential', r2: expR2 },
    { pattern: 'logarithmic', r2: logR2 },
  ]

  // Pick the best-fit model
  const best = models.reduce((a, b) => (b.r2 > a.r2 ? b : a))

  return {
    pattern: best.pattern,
    interpretation: TRAJECTORY_INTERPRETATIONS[best.pattern],
    confidence: best.r2,
    dataPoints,
  }
}
