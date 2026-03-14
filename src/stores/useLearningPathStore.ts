import { create } from 'zustand'
import { db } from '@/db'
import type { LearningPathCourse } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'

interface LearningPathState {
  courses: LearningPathCourse[]
  generatedAt: string | null
  isGenerating: boolean
  error: string | null

  generatePath: () => Promise<void>
  reorderCourse: (fromIndex: number, toIndex: number) => void
  regeneratePath: () => Promise<void>
  clearPath: () => void
  loadLearningPath: () => Promise<void>
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  courses: [],
  generatedAt: null,
  isGenerating: false,
  error: null,

  loadLearningPath: async () => {
    try {
      const learningPath = await db.learningPath.toArray()
      if (learningPath.length > 0) {
        const sorted = learningPath.sort((a, b) => a.position - b.position)
        set({
          courses: sorted,
          generatedAt: sorted[0]?.generatedAt || null,
          error: null,
        })
      }
    } catch (error) {
      console.error('[LearningPathStore] Failed to load learning path:', error)
      set({ error: 'Failed to load learning path from database' })
    }
  },

  generatePath: async () => {
    set({ isGenerating: true, error: null })

    try {
      // Get imported courses from database
      const importedCourses = await db.importedCourses.toArray()

      if (importedCourses.length < 2) {
        set({
          isGenerating: false,
          error: 'At least 2 courses are needed to generate a learning path',
        })
        return
      }

      // Import the generateLearningPath function dynamically
      const { generateLearningPath } = await import('@/ai/learningPath/generatePath')

      const generatedCourses: LearningPathCourse[] = []
      const generatedAt = new Date().toISOString()

      // Generate path with streaming updates
      const result = await generateLearningPath(importedCourses, (course: LearningPathCourse) => {
        // Update UI with streaming results
        generatedCourses.push(course)
        set({ courses: [...generatedCourses] })
      })

      // Persist to IndexedDB
      await persistWithRetry(async () => {
        await db.transaction('rw', db.learningPath, async () => {
          // Clear existing path
          await db.learningPath.clear()

          // Add new path with generatedAt timestamp
          await db.learningPath.bulkAdd(result.map(course => ({ ...course, generatedAt })))
        })
      })

      set({
        courses: result,
        generatedAt,
        isGenerating: false,
        error: null,
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to generate path:', error)
      set({
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate learning path',
      })
    }
  },

  reorderCourse: async (fromIndex: number, toIndex: number) => {
    const { courses } = get()
    if (fromIndex === toIndex) return

    const reordered = [...courses]
    const [movedCourse] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedCourse)

    // Update positions and mark as manually ordered
    const updated = reordered.map((course, index) => ({
      ...course,
      position: index + 1,
      isManuallyOrdered: course.courseId === movedCourse.courseId ? true : course.isManuallyOrdered,
    }))

    // Optimistic update
    set({ courses: updated, error: null })

    // Persist to IndexedDB (await to prevent fire-and-forget)
    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPath, async () => {
        await db.learningPath.clear()
        await db.learningPath.bulkAdd(
          updated.map(course => ({
            ...course,
            generatedAt: get().generatedAt || new Date().toISOString(),
          }))
        )
      })
    }).catch(error => {
      console.error('[LearningPathStore] Failed to persist reordering:', error)
      set({ error: 'Failed to save reordering' })
    })
  },

  regeneratePath: async () => {
    // Clear manual overrides and regenerate
    await get().clearPath()
    await get().generatePath()
  },

  clearPath: async () => {
    set({ courses: [], generatedAt: null, error: null })

    try {
      await persistWithRetry(async () => {
        await db.learningPath.clear()
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to clear path:', error)
      set({ error: 'Failed to clear learning path' })
    }
  },
}))
