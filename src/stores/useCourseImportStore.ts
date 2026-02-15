import { create } from 'zustand'
import { db } from '@/db'
import type { ImportedCourse } from '@/data/types'

interface CourseImportState {
  importedCourses: ImportedCourse[]
  isImporting: boolean
  importError: string | null
  importProgress: { current: number; total: number } | null

  addImportedCourse: (course: ImportedCourse) => Promise<void>
  removeImportedCourse: (courseId: string) => Promise<void>
  loadImportedCourses: () => Promise<void>
  setImporting: (isImporting: boolean) => void
  setImportError: (error: string | null) => void
  setImportProgress: (progress: { current: number; total: number } | null) => void
}

async function persistWithRetry(operation: () => Promise<void>, maxRetries = 3): Promise<void> {
  const delays = [1000, 2000, 4000]
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delays[attempt]))
    }
  }
}

export const useCourseImportStore = create<CourseImportState>((set, get) => ({
  importedCourses: [],
  isImporting: false,
  importError: null,
  importProgress: null,

  addImportedCourse: async (course: ImportedCourse) => {
    // Optimistic update
    set(state => ({
      importedCourses: [...state.importedCourses, course],
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.importedCourses.add(course)
      })
    } catch (error) {
      // Rollback on failure
      set(state => ({
        importedCourses: state.importedCourses.filter(c => c.id !== course.id),
        importError: `Failed to save course: ${course.name}`,
      }))
      console.error('[Database] Failed to persist course:', error)
    }
  },

  removeImportedCourse: async (courseId: string) => {
    const { importedCourses } = get()
    const courseToRemove = importedCourses.find(c => c.id === courseId)

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.filter(c => c.id !== courseId),
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.transaction(
          'rw',
          [db.importedCourses, db.importedVideos, db.importedPdfs],
          async () => {
            await db.importedCourses.delete(courseId)
            await db.importedVideos.where('courseId').equals(courseId).delete()
            await db.importedPdfs.where('courseId').equals(courseId).delete()
          }
        )
      })
    } catch (error) {
      // Rollback on failure
      if (courseToRemove) {
        set(state => ({
          importedCourses: [...state.importedCourses, courseToRemove],
          importError: `Failed to remove course`,
        }))
      }
      console.error('[Database] Failed to remove course:', error)
    }
  },

  loadImportedCourses: async () => {
    try {
      const courses = await db.importedCourses.toArray()
      set({ importedCourses: courses, importError: null })
    } catch (error) {
      set({ importError: 'Failed to load courses from database' })
      console.error('[Database] Failed to load courses:', error)
    }
  },

  setImporting: (isImporting: boolean) => set({ isImporting }),
  setImportError: (error: string | null) => set({ importError: error }),
  setImportProgress: (progress: { current: number; total: number } | null) =>
    set({ importProgress: progress }),
}))
