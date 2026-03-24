/**
 * Quiz performance metric calculations for the Overview dashboard.
 *
 * All metrics are derived purely from the `quizAttempts` Dexie table.
 * Only submitted (completed) attempts are stored there — in-progress
 * attempts live in localStorage via Zustand persist middleware.
 *
 * Note on completionRate: Until Story 17.1 adds abandoned-attempt tracking,
 * every record in `quizAttempts` is a completed attempt, so completionRate
 * is always 100% when any attempts exist.
 */
import { db } from '@/db'
import type { QuizAttempt } from '@/types/quiz'

export interface QuizMetrics {
  /** Number of completed quiz attempts */
  totalQuizzes: number
  /** Average score across all attempts (0–100) */
  averageScore: number
  /** Percentage of attempts that were submitted vs abandoned (0–100) */
  completionRate: number
}

/** Load and calculate quiz performance metrics from IndexedDB. */
export async function calculateQuizMetrics(): Promise<QuizMetrics> {
  let allAttempts: QuizAttempt[]
  try {
    allAttempts = await db.quizAttempts.toArray()
  } catch (error) {
    console.error('Failed to load quiz metrics:', error)
    return { totalQuizzes: 0, averageScore: 0, completionRate: 0 }
  }

  const totalQuizzes = allAttempts.length

  if (totalQuizzes === 0) {
    return { totalQuizzes: 0, averageScore: 0, completionRate: 0 }
  }

  const averageScore =
    allAttempts.reduce((sum, a) => {
      const pct = Number.isFinite(a.percentage) ? Math.min(100, Math.max(0, a.percentage)) : 0
      return sum + pct
    }, 0) / totalQuizzes

  // All records in quizAttempts are submitted — completionRate = 100%.
  // Story 17.1 will refine this once abandoned-attempt tracking is added.
  const completionRate = 100

  return { totalQuizzes, averageScore, completionRate }
}
