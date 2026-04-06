/**
 * Hook to check whether a quiz exists for a given lesson.
 *
 * Queries Dexie's `quizzes` table by `lessonId` index and returns
 * a boolean once resolved. Used by UnifiedLessonPlayer to conditionally
 * render the "Take Quiz" button (E89-S09).
 */

import { useState, useEffect } from 'react'
import { db } from '@/db'

export function useHasQuiz(lessonId: string | undefined): {
  hasQuiz: boolean
  loading: boolean
} {
  const [hasQuiz, setHasQuiz] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lessonId) {
      setHasQuiz(false)
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)

    // silent-catch-ok: background data check, graceful degradation to no quiz
    db.quizzes
      .where('lessonId')
      .equals(lessonId)
      .count()
      .then(count => {
        if (!ignore) {
          setHasQuiz(count > 0)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('[useHasQuiz] Failed to check quiz existence:', err)
        if (!ignore) {
          setHasQuiz(false)
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [lessonId])

  return { hasQuiz, loading }
}
