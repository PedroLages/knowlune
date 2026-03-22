import type { Question, Answer, QuizAttempt } from '@/types/quiz'
import { isUnanswered } from '@/lib/scoring'

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
      ? previousAttempts.reduce((best, cur) =>
          cur.percentage > best.percentage ? cur : best
        )
      : null

  // Best across ALL attempts (including current) — for bestAttemptNumber display
  // Uses the original (unsorted) attempts array index for consistent 1-based numbering
  let bestIndex = 0
  for (let i = 1; i < attempts.length; i++) {
    if (attempts[i].percentage > attempts[bestIndex].percentage) {
      bestIndex = i
    }
  }

  const improvement =
    sortedByDate.length > 1 ? currentAttempt.percentage - firstAttempt.percentage : null

  const isNewBest =
    bestPrevious !== null && currentAttempt.percentage > bestPrevious.percentage

  return {
    firstScore: sortedByDate.length > 1 ? firstAttempt.percentage : null,
    bestScore: attempts[bestIndex].percentage,
    bestAttemptNumber: bestIndex + 1,
    currentScore: currentAttempt.percentage,
    improvement,
    isNewBest,
  }
}
