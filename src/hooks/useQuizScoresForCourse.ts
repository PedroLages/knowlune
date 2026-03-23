import { useState, useEffect, useMemo } from 'react'
import type { Module } from '@/data/types'
import { db } from '@/db'

/**
 * Map<lessonId, bestScore | null>
 * - key present, value null  → lesson has a quiz, never attempted
 * - key present, value number → lesson has a quiz, best percentage
 * - key absent               → lesson has no quiz
 */
export type QuizScoreMap = Map<string, number | null>

/**
 * Batch-fetches quiz availability and best scores for all lessons in the
 * given modules. Uses a single Dexie query per render cycle (no N+1).
 *
 * E18-S08: QFR58, QFR61
 */
export function useQuizScoresForCourse(courseId: string, modules: Module[]): QuizScoreMap {
  const [scoreMap, setScoreMap] = useState<QuizScoreMap>(new Map())

  // Stable string key: only recomputes when lesson IDs actually change
  const lessonIdKey = useMemo(
    () => modules.flatMap(m => m.lessons).map(l => l.id).join(','),
    [modules]
  )

  useEffect(() => {
    if (!lessonIdKey) return

    let ignore = false

    async function load() {
      try {
        const lessonIds = lessonIdKey.split(',')
        // Batch query: one per course, not per lesson
        const quizzes = await db.quizzes.where('lessonId').anyOf(lessonIds).toArray()
        if (quizzes.length === 0) {
          if (!ignore) setScoreMap(new Map())
          return
        }

        const quizIds = quizzes.map(q => q.id)
        const attempts = await db.quizAttempts.where('quizId').anyOf(quizIds).toArray()

        const map = new Map<string, number | null>()
        for (const quiz of quizzes) {
          const quizAttempts = attempts.filter(a => a.quizId === quiz.id)
          if (quizAttempts.length > 0) {
            const best = Math.max(...quizAttempts.map(a => a.percentage))
            map.set(quiz.lessonId, Math.round(best))
          } else {
            map.set(quiz.lessonId, null) // has quiz, never attempted
          }
        }

        if (!ignore) setScoreMap(map)
      } catch (err) {
        // silent-catch-ok: quiz badge fetch failure is non-fatal — lesson list still renders without badges
        console.error('[useQuizScoresForCourse] Failed to load quiz scores:', err)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [courseId, lessonIdKey])

  return scoreMap
}
