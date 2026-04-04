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

    adapter
      .getLessons()
      .then(items => {
        if (!ignore) {
          setLessons(items)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Failed to load lessons for navigation:', err)
        if (!ignore) {
          setLessons([])
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [adapter])

  const currentIndex = lessonId ? lessons.findIndex(l => l.id === lessonId) : -1

  // Video-only navigation: scan forward/backward for the next video,
  // skipping standalone PDF lessons. PDFs remain accessible via sidebar click.
  const nextLesson = (() => {
    if (currentIndex < 0) return null
    for (let i = currentIndex + 1; i < lessons.length; i++) {
      if (lessons[i].type === 'video') return lessons[i]
    }
    return null
  })()

  const prevLesson = (() => {
    if (currentIndex <= 0) return null
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (lessons[i].type === 'video') return lessons[i]
    }
    return null
  })()

  return {
    prevLesson,
    nextLesson,
    currentIndex,
    totalLessons: lessons.length,
    lessons,
    loading,
  }
}
