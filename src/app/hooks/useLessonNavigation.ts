/**
 * useLessonNavigation — Provides prev/next lesson navigation based on adapter lesson list.
 *
 * Returns the previous and next lesson items relative to the current lesson,
 * along with the current index and total count. Uses the adapter's getLessons()
 * for source-agnostic ordering.
 *
 * @see E89-S08
 */

import { useState, useEffect } from 'react'
import type { CourseAdapter, LessonItem } from '@/lib/courseAdapter'

export interface LessonNavigationResult {
  prevLesson: LessonItem | null
  nextLesson: LessonItem | null
  currentIndex: number
  totalLessons: number
  lessons: LessonItem[]
  loading: boolean
}

export function useLessonNavigation(
  adapter: CourseAdapter | null,
  lessonId: string | undefined
): LessonNavigationResult {
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!adapter) {
      setLessons([])
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)

    adapter.getLessons().then(items => {
      if (!ignore) {
        setLessons(items)
        setLoading(false)
      }
    })

    return () => {
      ignore = true
    }
  }, [adapter])

  const currentIndex = lessonId ? lessons.findIndex(l => l.id === lessonId) : -1
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  return {
    prevLesson,
    nextLesson,
    currentIndex,
    totalLessons: lessons.length,
    lessons,
    loading,
  }
}
