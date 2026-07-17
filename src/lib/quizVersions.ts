import type { Quiz } from '@/types/quiz'

function createdAtTime(quiz: Quiz): number {
  const timestamp = Date.parse(quiz.createdAt)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

/** Return quiz versions newest-first without mutating the caller's array. */
export function sortQuizzesNewestFirst(quizzes: Quiz[]): Quiz[] {
  return [...quizzes].sort((a, b) => createdAtTime(b) - createdAtTime(a))
}

/** Select the latest generated quiz version for a lesson. */
export function selectNewestQuiz(quizzes: Quiz[]): Quiz | null {
  return sortQuizzesNewestFirst(quizzes)[0] ?? null
}
