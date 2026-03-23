import type { Question, Answer, QuizAttempt, Quiz } from '@/types/quiz'
import { isUnanswered } from '@/lib/scoring'
import { db } from '@/db'

// ---------------------------------------------------------------------------
// Quiz Analytics Summary (E18-S07)
// ---------------------------------------------------------------------------

export type QuizAttemptWithTitle = QuizAttempt & { quizTitle: string }

export type QuizPerformance = {
  quizId: string
  quizTitle: string
  /** Average score across all attempts, 0-100 */
  averageScore: number
  attemptCount: number
  /** Best single-attempt score, 0-100 */
  bestScore: number
  /** ISO 8601 date of the most recent attempt */
  lastAttemptDate: string
}

export type QuizAnalyticsSummary = {
  totalQuizzesCompleted: number
  /** Average score across all attempts, 0-100 */
  averageScore: number
  /** Unique quizzes attempted / total quizzes available × 100 */
  completionRate: number
  averageRetakeFrequency: number
  /** Last 5 attempts, most-recent-first, enriched with quiz title */
  recentAttempts: QuizAttemptWithTitle[]
  /** Top 5 quizzes by average score */
  topPerforming: QuizPerformance[]
  /** Bottom 5 quizzes by average score (at least 1 attempt) */
  needsImprovement: QuizPerformance[]
}

/**
 * Aggregate quiz analytics summary from Dexie.
 *
 * Completion rate = (unique quizzes attempted / total quizzes available) × 100.
 * Since quizAttempts only stores submitted attempts (no abandoned records),
 * all stored attempts are considered "completed".
 */
export async function calculateQuizAnalytics(): Promise<QuizAnalyticsSummary> {
  const [allAttempts, allQuizzes] = await Promise.all([
    db.quizAttempts.toArray(),
    db.quizzes.toArray(),
  ])

  const quizTitleMap = new Map(allQuizzes.map(q => [q.id, q.title]))
  const totalQuizzesAvailable = allQuizzes.length

  if (allAttempts.length === 0) {
    return {
      totalQuizzesCompleted: 0,
      averageScore: 0,
      completionRate: 0,
      averageRetakeFrequency: 0,
      recentAttempts: [],
      topPerforming: [],
      needsImprovement: [],
    }
  }

  // Group attempts by quizId
  const byQuiz = new Map<string, QuizAttempt[]>()
  for (const attempt of allAttempts) {
    if (!byQuiz.has(attempt.quizId)) byQuiz.set(attempt.quizId, [])
    byQuiz.get(attempt.quizId)!.push(attempt)
  }

  // Per-quiz aggregation
  const performances: QuizPerformance[] = []
  for (const [quizId, attempts] of byQuiz.entries()) {
    const avgScore = attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
    const bestScore = Math.max(...attempts.map(a => a.percentage))
    const sorted = [...attempts].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )
    performances.push({
      quizId,
      quizTitle: quizTitleMap.get(quizId) ?? 'Unknown Quiz',
      averageScore: Math.round(avgScore),
      attemptCount: attempts.length,
      bestScore,
      lastAttemptDate: sorted[0].completedAt,
    })
  }

  const totalAttempts = allAttempts.length
  const uniqueQuizzes = byQuiz.size
  const overallAvg = allAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts
  const completionRate =
    totalQuizzesAvailable > 0 ? Math.round((uniqueQuizzes / totalQuizzesAvailable) * 100) : 0
  const avgRetakeFrequency = uniqueQuizzes > 0 ? totalAttempts / uniqueQuizzes : 0

  // Recent 5 attempts, most-recent-first
  const recentAttempts: QuizAttemptWithTitle[] = [...allAttempts]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5)
    .map(a => ({ ...a, quizTitle: quizTitleMap.get(a.quizId) ?? 'Unknown Quiz' }))

  // Top/bottom sorted by averageScore
  const sortedByScore = [...performances].sort((a, b) => b.averageScore - a.averageScore)
  const topPerforming = sortedByScore.slice(0, 5)
  const needsImprovement = [...sortedByScore].reverse().slice(0, 5)

  return {
    totalQuizzesCompleted: uniqueQuizzes,
    averageScore: Math.round(overallAvg),
    completionRate,
    averageRetakeFrequency: Math.round(avgRetakeFrequency * 10) / 10,
    recentAttempts,
    topPerforming,
    needsImprovement,
  }
}

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
// Normalized Gain — Hake's Formula (E16-S04)
// ---------------------------------------------------------------------------

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
