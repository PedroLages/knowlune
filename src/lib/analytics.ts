import type { Question, Answer } from '@/types/quiz'
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
// Completion Rate
// ---------------------------------------------------------------------------

export type CompletionRateResult = {
  completionRate: number
  completedCount: number
  startedCount: number
}

/**
 * Calculates quiz completion rate from Dexie quizAttempts and localStorage.
 *
 * - Multiple attempts for the same quizId count as 1 completed quiz.
 * - In-progress quizzes from localStorage count toward startedCount.
 */
export async function calculateCompletionRate(): Promise<CompletionRateResult> {
  const allAttempts = await db.quizAttempts.toArray()

  const completedQuizIds = new Set(allAttempts.map(a => a.quizId))
  const completedCount = completedQuizIds.size

  let inProgressCount = 0
  const quizStoreData = localStorage.getItem('levelup-quiz-store')
  if (quizStoreData) {
    try {
      const parsed = JSON.parse(quizStoreData)
      const inProgressId = parsed?.state?.currentProgress?.quizId
      // Only count as in-progress if not already recorded as completed
      if (inProgressId && !completedQuizIds.has(inProgressId)) {
        inProgressCount = 1
      }
    } catch {
      inProgressCount = 0
    }
  }

  const startedCount = completedCount + inProgressCount
  const completionRate = startedCount > 0 ? (completedCount / startedCount) * 100 : 0

  return { completionRate, completedCount, startedCount }
}
