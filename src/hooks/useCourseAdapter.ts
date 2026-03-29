/**
 * useCourseAdapter — React hook for source-agnostic course data access (E89-S02)
 *
 * Loads an ImportedCourse from Dexie by ID, resolves the correct adapter
 * (LocalCourseAdapter or YouTubeCourseAdapter), and returns it alongside
 * loading/error state.
 *
 * Uses useLiveQuery so the adapter re-creates automatically when underlying
 * Dexie data changes (e.g., video reorder, metadata refresh).
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import {
  createCourseAdapter,
  type CourseAdapter,
} from '@/lib/courseAdapter'

export interface UseCourseAdapterResult {
  adapter: CourseAdapter | null
  loading: boolean
  error: string | null
}

export function useCourseAdapter(
  courseId: string | undefined,
): UseCourseAdapterResult {
  const result = useLiveQuery(
    async () => {
      if (!courseId) return null

      const course = await db.importedCourses.get(courseId)
      if (!course) return { adapter: null, error: 'course-not-found' }

      const videos = await db.importedVideos
        .where('courseId')
        .equals(courseId)
        .toArray()

      const pdfs = await db.importedPdfs
        .where('courseId')
        .equals(courseId)
        .toArray()

      const adapter = createCourseAdapter(course, videos, pdfs)
      return { adapter, error: null }
    },
    [courseId],
  )

  // useLiveQuery returns undefined while loading
  if (result === undefined) {
    return { adapter: null, loading: true, error: null }
  }

  // courseId was undefined/empty
  if (result === null) {
    return { adapter: null, loading: false, error: 'no-course-id' }
  }

  return {
    adapter: result.adapter,
    loading: false,
    error: result.error,
  }
}
