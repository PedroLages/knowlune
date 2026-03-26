import { create } from 'zustand'
import { db } from '@/db'
import type { LearningPath, LearningPathEntry, LearningPathCourse } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { trackAIUsage } from '@/lib/aiEventTracking'

interface LearningPathState {
  // Multi-path state (E26-S01/S02)
  paths: LearningPath[]
  entries: LearningPathEntry[]
  activePath: LearningPath | null

  // Legacy single-path state (backward compat)
  courses: LearningPathCourse[]
  generatedAt: string | null
  isGenerating: boolean
  error: string | null

  // Path CRUD
  loadPaths: () => Promise<void>
  createPath: (name: string, description?: string) => Promise<LearningPath>
  renamePath: (pathId: string, name: string) => Promise<void>
  updateDescription: (pathId: string, description: string) => Promise<void>
  deletePath: (pathId: string) => Promise<void>
  setActivePath: (pathId: string) => void

  // Entry operations
  addCourseToPath: (
    pathId: string,
    courseId: string,
    courseType: 'imported' | 'catalog',
    justification?: string
  ) => Promise<void>
  removeCourseFromPath: (pathId: string, courseId: string) => Promise<void>
  reorderCourse: (fromIndex: number, toIndex: number) => void
  getEntriesForPath: (pathId: string) => LearningPathEntry[]

  // AI generation
  generatePath: () => Promise<void>
  regeneratePath: () => Promise<void>
  clearPath: (pathId?: string) => Promise<void>
  loadLearningPath: () => Promise<void>
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  paths: [],
  entries: [],
  activePath: null,
  courses: [],
  generatedAt: null,
  isGenerating: false,
  error: null,

  loadPaths: async () => {
    try {
      const paths = await db.learningPaths.toArray()
      const entries = await db.learningPathEntries.toArray()
      const sorted = paths.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      set({
        paths: sorted,
        entries,
        activePath: sorted[0] || null,
        error: null,
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to load paths:', error)
      set({ error: 'Failed to load learning paths from database' })
    }
  },

  createPath: async (name: string, description?: string) => {
    const now = new Date().toISOString()
    const path: LearningPath = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      isAIGenerated: false,
    }

    await persistWithRetry(async () => {
      await db.learningPaths.add(path)
    })

    set(state => ({
      paths: [...state.paths, path],
      activePath: state.activePath || path,
      error: null,
    }))

    return path
  },

  renamePath: async (pathId: string, name: string) => {
    const now = new Date().toISOString()

    await persistWithRetry(async () => {
      await db.learningPaths.update(pathId, { name, updatedAt: now })
    })

    set(state => ({
      paths: state.paths.map(p => (p.id === pathId ? { ...p, name, updatedAt: now } : p)),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, name, updatedAt: now }
          : state.activePath,
      error: null,
    }))
  },

  updateDescription: async (pathId: string, description: string) => {
    const now = new Date().toISOString()

    await persistWithRetry(async () => {
      await db.learningPaths.update(pathId, { description, updatedAt: now })
    })

    set(state => ({
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, description, updatedAt: now } : p
      ),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, description, updatedAt: now }
          : state.activePath,
      error: null,
    }))
  },

  deletePath: async (pathId: string) => {
    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPaths, db.learningPathEntries, async () => {
        await db.learningPaths.delete(pathId)
        await db.learningPathEntries.where('pathId').equals(pathId).delete()
      })
    })

    set(state => {
      const remaining = state.paths.filter(p => p.id !== pathId)
      return {
        paths: remaining,
        entries: state.entries.filter(e => e.pathId !== pathId),
        activePath: state.activePath?.id === pathId ? remaining[0] || null : state.activePath,
        error: null,
      }
    })
  },

  setActivePath: (pathId: string) => {
    const path = get().paths.find(p => p.id === pathId)
    if (path) {
      set({ activePath: path })
    }
  },

  addCourseToPath: async (
    pathId: string,
    courseId: string,
    courseType: 'imported' | 'catalog',
    justification?: string
  ) => {
    const existingEntries = get().entries.filter(e => e.pathId === pathId)

    if (existingEntries.some(e => e.courseId === courseId)) {
      set({ error: 'Course is already in this learning path' })
      return
    }

    const entry: LearningPathEntry = {
      id: crypto.randomUUID(),
      pathId,
      courseId,
      courseType,
      position: existingEntries.length + 1,
      justification,
      isManuallyOrdered: false,
    }

    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
        await db.learningPathEntries.add(entry)
        await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() })
      })
    })

    set(state => ({
      entries: [...state.entries, entry],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))
  },

  removeCourseFromPath: async (pathId: string, courseId: string) => {
    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
    const entryToRemove = pathEntries.find(e => e.courseId === courseId)

    if (!entryToRemove) return

    const remaining = pathEntries
      .filter(e => e.courseId !== courseId)
      .map((e, index) => ({ ...e, position: index + 1 }))

    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
        await db.learningPathEntries.delete(entryToRemove.id)
        for (const entry of remaining) {
          await db.learningPathEntries.update(entry.id, { position: entry.position })
        }
        await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() })
      })
    })

    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...remaining],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))
  },

  getEntriesForPath: (pathId: string) => {
    return get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
  },

  // --- Legacy single-path methods (backward compat) ---

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

    const startTime = Date.now()

    try {
      const importedCourses = await db.importedCourses.toArray()

      if (importedCourses.length < 2) {
        set({
          isGenerating: false,
          error: 'At least 2 courses are needed to generate a learning path',
        })
        return
      }

      const { generateLearningPath } = await import('@/ai/learningPath/generatePath')

      const generatedCourses: LearningPathCourse[] = []
      const generatedAt = new Date().toISOString()

      const result = await generateLearningPath(importedCourses, (course: LearningPathCourse) => {
        generatedCourses.push(course)
        set({ courses: [...generatedCourses] })
      })

      await persistWithRetry(async () => {
        await db.transaction('rw', db.learningPath, async () => {
          await db.learningPath.clear()
          await db.learningPath.bulkAdd(result.map(course => ({ ...course, generatedAt })))
        })
      })

      set({
        courses: result,
        generatedAt,
        isGenerating: false,
        error: null,
      })

      trackAIUsage('learning_path', {
        durationMs: Date.now() - startTime,
        metadata: { courseCount: result.length },
      }).catch(() => {})
    } catch (error) {
      console.error('[LearningPathStore] Failed to generate path:', error)
      trackAIUsage('learning_path', {
        status: 'error',
        durationMs: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      }).catch(() => {})
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

    const updated = reordered.map((course, index) => ({
      ...course,
      position: index + 1,
      isManuallyOrdered:
        course.courseId === movedCourse.courseId ? true : course.isManuallyOrdered,
    }))

    set({ courses: updated, error: null })

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
    await get().clearPath()
    await get().generatePath()
  },

  clearPath: async (pathId?: string) => {
    if (pathId) {
      // Multi-path clear
      set(state => ({
        entries: state.entries.filter(e => e.pathId !== pathId),
        error: null,
      }))
      try {
        await persistWithRetry(async () => {
          await db.learningPathEntries.where('pathId').equals(pathId).delete()
        })
      } catch (error) {
        console.error('[LearningPathStore] Failed to clear path:', error)
        set({ error: 'Failed to clear learning path' })
      }
    } else {
      // Legacy single-path clear
      set({ courses: [], generatedAt: null, error: null })
      try {
        await persistWithRetry(async () => {
          await db.learningPath.clear()
        })
      } catch (error) {
        console.error('[LearningPathStore] Failed to clear path:', error)
        set({ error: 'Failed to clear learning path' })
      }
    }
  },
}))
