import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { LearningPath, LearningPathEntry } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { trackAIUsage } from '@/lib/aiEventTracking'

interface LearningPathState {
  // Multi-path state (E26-S01/S02)
  paths: LearningPath[]
  entries: LearningPathEntry[] // All entries across all paths
  activePath: LearningPath | null
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
  reorderCourse: (pathId: string, fromIndex: number, toIndex: number) => Promise<void>

  // AI generation (generates into active path)
  generatePath: () => Promise<void>
  regeneratePath: () => Promise<void>
  clearPath: (pathId: string) => Promise<void>

  // AI order suggestion (E26-S04)
  applyAIOrder: (
    pathId: string,
    orderedEntries: Array<{ courseId: string; position: number; justification: string }>
  ) => Promise<void>

  // Helpers
  getEntriesForPath: (pathId: string) => LearningPathEntry[]
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  paths: [],
  entries: [],
  activePath: null,
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

    const prevPaths = get().paths
    const prevActivePath = get().activePath

    // Optimistic update
    set(state => ({
      paths: [...state.paths, path],
      activePath: state.activePath || path,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.learningPaths.add(path)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to create path:', error)
      set({ paths: prevPaths, activePath: prevActivePath, error: 'Failed to create learning path' })
      toast.error('Failed to create learning path')
      throw error
    }

    return path
  },

  renamePath: async (pathId: string, name: string) => {
    const now = new Date().toISOString()
    const prevPaths = get().paths
    const prevActivePath = get().activePath

    // Optimistic update
    set(state => ({
      paths: state.paths.map(p => (p.id === pathId ? { ...p, name, updatedAt: now } : p)),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, name, updatedAt: now }
          : state.activePath,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.learningPaths.update(pathId, { name, updatedAt: now })
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to rename path:', error)
      set({ paths: prevPaths, activePath: prevActivePath, error: 'Failed to rename learning path' })
      toast.error('Failed to rename learning path')
    }
  },

  updateDescription: async (pathId: string, description: string) => {
    const now = new Date().toISOString()
    const prevPaths = get().paths
    const prevActivePath = get().activePath

    // Optimistic update
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

    try {
      await persistWithRetry(async () => {
        await db.learningPaths.update(pathId, { description, updatedAt: now })
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to update description:', error)
      set({ paths: prevPaths, activePath: prevActivePath, error: 'Failed to update path description' })
      toast.error('Failed to update path description')
    }
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

    // Prevent duplicate course in same path
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

    const prevEntries = get().entries
    const prevPaths = get().paths

    // Optimistic update
    set(state => ({
      entries: [...state.entries, entry],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
          await db.learningPathEntries.add(entry)
          await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() })
        })
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to add course to path:', error)
      set({ entries: prevEntries, paths: prevPaths, error: 'Failed to add course to learning path' })
      toast.error('Failed to add course to learning path')
    }
  },

  removeCourseFromPath: async (pathId: string, courseId: string) => {
    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
    const entryToRemove = pathEntries.find(e => e.courseId === courseId)

    if (!entryToRemove) return

    // Recalculate positions for remaining entries
    const remaining = pathEntries
      .filter(e => e.courseId !== courseId)
      .map((e, index) => ({ ...e, position: index + 1 }))

    const prevEntries = get().entries
    const prevPaths = get().paths

    // Optimistic update
    set(state => ({
      entries: [
        ...state.entries.filter(e => e.pathId !== pathId),
        ...remaining,
      ],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
          await db.learningPathEntries.delete(entryToRemove.id)
          // Update positions of remaining entries
          for (const entry of remaining) {
            await db.learningPathEntries.update(entry.id, { position: entry.position })
          }
          await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() })
        })
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to remove course from path:', error)
      set({ entries: prevEntries, paths: prevPaths, error: 'Failed to remove course from learning path' })
      toast.error('Failed to remove course from learning path')
    }
  },

  reorderCourse: async (pathId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)

    const reordered = [...pathEntries]
    const [movedEntry] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedEntry)

    const updated = reordered.map((entry, index) => ({
      ...entry,
      position: index + 1,
      isManuallyOrdered:
        entry.id === movedEntry.id ? true : entry.isManuallyOrdered,
    }))

    // Optimistic update
    set(state => ({
      entries: [
        ...state.entries.filter(e => e.pathId !== pathId),
        ...updated,
      ],
      error: null,
    }))

    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
        for (const entry of updated) {
          await db.learningPathEntries.update(entry.id, {
            position: entry.position,
            isManuallyOrdered: entry.isManuallyOrdered,
          })
        }
        await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() })
      })
    }).catch(error => {
      console.error('[LearningPathStore] Failed to persist reordering:', error)
      set({ error: 'Failed to save reordering' })
    })
  },

  generatePath: async () => {
    const { activePath } = get()
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

      // Create or use active path
      let targetPath = activePath
      if (!targetPath) {
        targetPath = await get().createPath('AI Learning Path')
        set(state => ({ ...state, activePath: targetPath }))
      }
      const pathId = targetPath!.id

      // Clear existing entries for this path
      await persistWithRetry(async () => {
        await db.learningPathEntries.where('pathId').equals(pathId).delete()
      })
      set(state => ({
        entries: state.entries.filter(e => e.pathId !== pathId),
      }))

      const generatedEntries: LearningPathEntry[] = []

      const result = await generateLearningPath(importedCourses, course => {
        const entry: LearningPathEntry = {
          id: crypto.randomUUID(),
          pathId,
          courseId: course.courseId,
          courseType: 'imported',
          position: course.position,
          justification: course.justification,
          isManuallyOrdered: false,
        }
        generatedEntries.push(entry)
        set(state => ({
          entries: [
            ...state.entries.filter(e => e.pathId !== pathId),
            ...generatedEntries,
          ],
        }))
      })

      // Build final entries from result
      const finalEntries: LearningPathEntry[] = result.map(course => ({
        id: crypto.randomUUID(),
        pathId,
        courseId: course.courseId,
        courseType: 'imported' as const,
        position: course.position,
        justification: course.justification,
        isManuallyOrdered: false,
      }))

      const now = new Date().toISOString()

      await persistWithRetry(async () => {
        await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
          // Clear any partial streaming entries
          await db.learningPathEntries.where('pathId').equals(pathId).delete()
          await db.learningPathEntries.bulkAdd(finalEntries)
          await db.learningPaths.update(pathId, {
            updatedAt: now,
            isAIGenerated: true,
          })
        })
      })

      set(state => ({
        entries: [
          ...state.entries.filter(e => e.pathId !== pathId),
          ...finalEntries,
        ],
        paths: state.paths.map(p =>
          p.id === pathId ? { ...p, updatedAt: now, isAIGenerated: true } : p
        ),
        isGenerating: false,
        error: null,
      }))

      trackAIUsage('learning_path', {
        durationMs: Date.now() - startTime,
        metadata: { courseCount: result.length, pathId },
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

  regeneratePath: async () => {
    const { activePath } = get()
    if (activePath) {
      await get().clearPath(activePath.id)
    }
    await get().generatePath()
  },

  clearPath: async (pathId: string) => {
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
  },

  applyAIOrder: async (
    pathId: string,
    orderedEntries: Array<{ courseId: string; position: number; justification: string }>
  ) => {
    const currentEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)

    // Build updated entries with AI positions and justifications
    const updated = currentEntries.map(entry => {
      const aiEntry = orderedEntries.find(o => o.courseId === entry.courseId)
      if (aiEntry) {
        return {
          ...entry,
          position: aiEntry.position,
          justification: aiEntry.justification,
          isManuallyOrdered: false,
        }
      }
      return entry
    }).sort((a, b) => a.position - b.position)

    // Optimistic update
    const now = new Date().toISOString()
    set(state => ({
      entries: [
        ...state.entries.filter(e => e.pathId !== pathId),
        ...updated,
      ],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: now, isAIGenerated: true } : p
      ),
      error: null,
    }))

    await persistWithRetry(async () => {
      await db.transaction('rw', db.learningPathEntries, db.learningPaths, async () => {
        for (const entry of updated) {
          await db.learningPathEntries.update(entry.id, {
            position: entry.position,
            justification: entry.justification,
            isManuallyOrdered: false,
          })
        }
        await db.learningPaths.update(pathId, { updatedAt: now, isAIGenerated: true })
      })
    }).catch(error => {
      console.error('[LearningPathStore] Failed to apply AI order:', error)
      set({ error: 'Failed to save AI-suggested order' })
    })
  },

  getEntriesForPath: (pathId: string) => {
    return get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
  },
}))
