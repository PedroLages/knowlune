import { create } from 'zustand'
import { db } from '@/db'
import type { Course } from '@/data/types'

interface CourseStoreState {
  courses: Course[]
  isLoaded: boolean
  loadCourses: () => Promise<void>
}

export const useCourseStore = create<CourseStoreState>((set, get) => ({
  courses: [],
  isLoaded: false,

  loadCourses: async () => {
    if (get().isLoaded && get().courses.length > 0) return
    try {
      const courses = await db.courses.toArray()
      if (courses.length > 0 || !get().isLoaded) {
        set({ courses, isLoaded: true })
      }
    } catch (error) {
      console.error('[CourseStore] Failed to load courses:', error)
    }
  },
}))
