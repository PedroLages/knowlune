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
    if (get().isLoaded) return
    const courses = await db.courses.toArray()
    set({ courses, isLoaded: true })
  },
}))
