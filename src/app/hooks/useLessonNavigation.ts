/**
 * useLessonNavigation — Provides prev/next lesson navigation based on adapter lesson list.
 *
 * Returns the previous and next lesson items relative to the current lesson,
 * along with the current index and total count. Uses the adapter's getLessons()
 * for source-agnostic ordering.
 *
 * @see E89-S08
 */

import { useState, useEffect, useMemo } from 'react'
import type { CourseAdapter, LessonItem } from '@/lib/courseAdapter'
import type { CourseSection } from '@/lib/lessonBasedCurriculum'

export interface LessonNavigationResult {
  prevLesson: LessonItem | null
  nextLesson: LessonItem | null
  currentIndex: number
  totalLessons: number
  lessons: LessonItem[]
  currentSection: string | null
  parentLesson: LessonItem | null
  isCompanionMaterial: boolean
  loading: boolean
}

export function useLessonNavigation(
  adapter: CourseAdapter | null,
  lessonId: string | undefined
): LessonNavigationResult {
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [sections, setSections] = useState<CourseSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!adapter) {
      setLessons([])
      setSections([])
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)

    // silent-catch-ok: background data load, graceful degradation to empty list
    Promise.all([
      adapter.getLessons(),
      // silent-catch-ok — navigation degrades to the primary lesson sequence
      adapter.getLessonBasedCurriculum().catch(error => {
        console.error('Failed to load lesson curriculum for navigation:', error)
        return []
      }),
    ])
      .then(([items, curriculum]) => {
        if (!ignore) {
          setLessons(items)
          setSections(curriculum)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Failed to load lessons for navigation:', err)
        if (!ignore) {
          setLessons([])
          setSections([])
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [adapter])

  const context = useMemo(() => {
    let currentSection: string | null = null
    let parentLesson: LessonItem | null = null

    if (lessonId) {
      for (const section of sections) {
        for (const group of section.lessons) {
          if (group.primary.id === lessonId) {
            currentSection = section.title
            break
          }
          if (group.materials.some(material => material.id === lessonId)) {
            currentSection = section.title
            parentLesson = lessons.find(lesson => lesson.id === group.primary.id) ?? null
            break
          }
        }
        if (currentSection) break
      }
    }

    const directIndex = lessonId ? lessons.findIndex(lesson => lesson.id === lessonId) : -1
    const parentIndex = parentLesson
      ? lessons.findIndex(lesson => lesson.id === parentLesson.id)
      : -1

    return {
      currentSection,
      parentLesson,
      currentIndex: directIndex >= 0 ? directIndex : parentIndex,
    }
  }, [lessonId, lessons, sections])

  const currentIndex = context.currentIndex

  // Navigate to the immediate next/previous lesson regardless of type (video or PDF).
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null

  return {
    prevLesson,
    nextLesson,
    currentIndex,
    totalLessons: lessons.length,
    lessons,
    currentSection: context.currentSection,
    parentLesson: context.parentLesson,
    isCompanionMaterial: context.parentLesson !== null,
    loading,
  }
}
