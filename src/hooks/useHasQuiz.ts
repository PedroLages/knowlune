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
  const [checkedLessonId, setCheckedLessonId] = useState<string | undefined>()

  useEffect(() => {
    if (!lessonId) {
      setHasQuiz(false)
      setCheckedLessonId(undefined)
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)
    setCheckedLessonId(undefined)

    // silent-catch-ok: background data check, graceful degradation to no quiz
    db.quizzes
      .where('lessonId')
      .equals(lessonId)
      .count()
      .then(count => {
        if (!ignore) {
          setHasQuiz(count > 0)
          setCheckedLessonId(lessonId)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('[useHasQuiz] Failed to check quiz existence:', err)
        if (!ignore) {
          setHasQuiz(false)
          setCheckedLessonId(lessonId)
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [lessonId])

  const resultMatchesLesson = checkedLessonId === lessonId
  return {
    hasQuiz: resultMatchesLesson ? hasQuiz : false,
    loading: lessonId ? !resultMatchesLesson || loading : false,
  }
}
