import { db } from '@/db'
import { getStudyLog, toLocalDateString } from '@/lib/studyLog'
import type { Challenge } from '@/data/types'

/**
 * Count completed content items since the challenge was created.
 * Uses the `status` index on contentProgress for efficient querying.
 */
export async function calculateCompletionProgress(challenge: Challenge): Promise<number> {
  const createdAtMs = new Date(challenge.createdAt).getTime()
  return db.contentProgress
    .where('status')
    .equals('completed')
    .filter(p => new Date(p.updatedAt).getTime() >= createdAtMs)
    .count()
}

/**
 * Sum study session durations since challenge creation, converted to hours.
 * Uses the `duration` field (active seconds, idle time excluded).
 */
export async function calculateTimeProgress(challenge: Challenge): Promise<number> {
  const sessions = await db.studySessions
    .where('startTime')
    .above(challenge.createdAt)
    .filter(s => s.endTime !== undefined)
    .toArray()

  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0)
  return totalSeconds / 3600
}

/**
 * Count distinct study days since challenge creation date.
 * Scoped to the challenge lifetime per AC4.
 */
export function calculateStreakProgress(challenge: Challenge): number {
  const log = getStudyLog()
  const createdAt = challenge.createdAt
  const studyDays = new Set<string>()
  for (const entry of log) {
    if (entry.type === 'lesson_complete' && entry.timestamp >= createdAt) {
      studyDays.add(toLocalDateString(new Date(entry.timestamp)))
    }
  }
  return studyDays.size
}

/**
 * Count books finished since the challenge was created.
 * Uses the `status` index on books for efficient querying, then filters by finishedAt.
 */
export async function calculateBooksProgress(challenge: Challenge): Promise<number> {
  return db.books
    .where('status')
    .equals('finished')
    .filter(b => {
      if (!b.finishedAt) return false
      return new Date(b.finishedAt).getTime() >= new Date(challenge.createdAt).getTime()
    })
    .count()
}

/**
 * Sum pages read across all books since the challenge was created.
 * For each book updated after challenge creation, pages read = totalPages * progress / 100.
 */
export async function calculatePagesProgress(challenge: Challenge): Promise<number> {
  const createdAtMs = new Date(challenge.createdAt).getTime()
  const books = await db.books.toArray()

  return books.reduce((sum, book) => {
    if (!book.totalPages || book.totalPages <= 0) return sum
    // Only count books that have been touched since challenge creation
    const updatedAt = book.updatedAt || book.createdAt
    if (new Date(updatedAt).getTime() < createdAtMs) return sum
    const pagesRead = Math.round((book.totalPages * book.progress) / 100)
    return sum + pagesRead
  }, 0)
}

/** Dispatch to the appropriate calculator based on challenge type. */
export async function calculateProgress(challenge: Challenge): Promise<number> {
  switch (challenge.type) {
    case 'completion':
      return calculateCompletionProgress(challenge)
    case 'time':
      return calculateTimeProgress(challenge)
    case 'streak':
      return calculateStreakProgress(challenge)
    case 'books':
      return calculateBooksProgress(challenge)
    case 'pages':
      return calculatePagesProgress(challenge)
  }
}
