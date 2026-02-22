import { create } from 'zustand'
import { db } from '@/db'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'

function normalizeTags(tags: string[]): string[] {
  const unique = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))]
  unique.sort()
  return unique
}

interface CourseImportState {
  importedCourses: ImportedCourse[]
  isImporting: boolean
  importError: string | null
  importProgress: { current: number; total: number } | null

  addImportedCourse: (course: ImportedCourse) => Promise<void>
  removeImportedCourse: (courseId: string) => Promise<void>
  updateCourseTags: (courseId: string, tags: string[]) => Promise<void>
  updateCourseStatus: (courseId: string, status: LearnerCourseStatus) => Promise<void>
  getAllTags: () => string[]
  loadImportedCourses: () => Promise<void>
  setImporting: (isImporting: boolean) => void
  setImportError: (error: string | null) => void
  setImportProgress: (progress: { current: number; total: number } | null) => void
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

  updateCourseTags: async (courseId: string, tags: string[]) => {
    const { importedCourses } = get()
    const course = importedCourses.find(c => c.id === courseId)
    if (!course) return

    const oldTags = course.tags
    const normalized = normalizeTags(tags)

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c =>
        c.id === courseId ? { ...c, tags: normalized } : c
      ),
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.importedCourses.update(courseId, { tags: normalized })
      })
    } catch (error) {
      // Rollback on failure
      set(state => ({
        importedCourses: state.importedCourses.map(c =>
          c.id === courseId ? { ...c, tags: oldTags } : c
        ),
        importError: `Failed to update tags`,
      }))
      console.error('[Database] Failed to update tags:', error)
    }
  },

  updateCourseStatus: async (courseId: string, status: LearnerCourseStatus) => {
    const { importedCourses } = get()
    const course = importedCourses.find(c => c.id === courseId)
    if (!course) return

    const oldStatus = course.status

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c => (c.id === courseId ? { ...c, status } : c)),
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.importedCourses.update(courseId, { status })
      })
    } catch (error) {
      // Rollback on failure
      set(state => ({
        importedCourses: state.importedCourses.map(c =>
          c.id === courseId ? { ...c, status: oldStatus } : c
        ),
        importError: `Failed to update status`,
      }))
      console.error('[Database] Failed to update status:', error)
    }
  },

  getAllTags: () => {
    const { importedCourses } = get()
    const tagSet = new Set<string>()
    for (const course of importedCourses) {
      for (const tag of course.tags) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
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
