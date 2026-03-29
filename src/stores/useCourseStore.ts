import { create } from 'zustand'
import type { Course } from '@/data/types'

/**
 * @deprecated Dead regular course store — courses table dropped in Dexie v30 (E89-S01).
 * This store is kept as a no-op stub because ~30 legacy modules still import it.
 * It always returns an empty array. Will be removed when consumers migrate to ImportedCourse.
 */
interface CourseStoreState {
  courses: Course[]
  isLoaded: boolean
  loadCourses: () => Promise<void>
}

export const useCourseStore = create<CourseStoreState>(() => ({
  courses: [],
  isLoaded: true,

  loadCourses: async () => {
    // No-op: regular courses table dropped (E89-S01)
  },
}))
