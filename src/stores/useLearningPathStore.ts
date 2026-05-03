import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { LearningPath, LearningPathEntry } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

interface LearningPathState {
  // Multi-path state (E26-S01/S02)
  paths: LearningPath[]
  entries: LearningPathEntry[] // All entries across all paths
  activePath: LearningPath | null
  isGenerating: boolean
  forkGeneration: number
  error: string | null

  // Pending deletes (undo support)
  // Uses a plain Record for Zustand immutability tracking. Each entry holds the
  // captured snapshot and a timer handle so the store can cancel and finalize.
  pendingDeletes: Record<
    string,
    { path: LearningPath; entries: LearningPathEntry[]; timer: ReturnType<typeof setTimeout> }
  >

  // Path CRUD
  loadPaths: () => Promise<void>
  createPath: (name: string, description?: string) => Promise<LearningPath>
  renamePath: (pathId: string, name: string) => Promise<void>
  updateDescription: (pathId: string, description: string) => Promise<void>
  deletePath: (pathId: string) => Promise<void>
  deletePathWithUndo: (pathId: string) => void
  restorePath: (pathId: string) => void
  _finalizeDelete: (pathId: string) => Promise<void>
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

  // Batch operations
  createPathWithCourses: (
    name: string,
    description: string | undefined,
    courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>
  ) => Promise<LearningPath>
  batchAddCoursesToPath: (
    pathId: string,
    courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>
  ) => Promise<void>

  // Template operations
  forkTemplate: (templateId: string) => Promise<string | null> // returns new path ID or null on failure

  // Helpers
  getEntriesForPath: (pathId: string) => LearningPathEntry[]

  /**
   * Replace Dexie + in-memory collections from a validated remote snapshot.
   *
   * E96-S02: called by `hydrateP3P4FromSupabase` after a Supabase pull. Pure
   * setter from the sync engine's perspective — uses `db.<table>.bulkPut`
   * directly (never `syncableWrite`) so it does NOT enqueue any syncQueue
   * rows. See E93 retrospective — echo loops are the top regression vector.
   *
   * AC5 disposition: `isAllDefaults` guard is vacuously satisfied for both
   * `learningPaths` and `learningPathEntries` — neither is a singleton. Rows
   * are union-merged via `bulkPut` keyed by id.
   */
  hydrateFromRemote: (snapshot: {
    paths?: LearningPath[]
    entries?: LearningPathEntry[]
  }) => Promise<void>
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  paths: [],
  entries: [],
  activePath: null,
  isGenerating: false,
  forkGeneration: 0,
  error: null,
  pendingDeletes: {},

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
        await syncableWrite('learningPaths', 'add', path as unknown as SyncableRecord)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to create path:', error)
      set({
        paths: prevPaths,
        activePath: prevActivePath,
        error: 'Failed to create learning path',
      })
      toast.error('Failed to create learning path')
      // Re-throw so callers like generatePath can handle the error
      throw error
    }

    return path
  },

  renamePath: async (pathId: string, name: string) => {
    const now = new Date().toISOString()
    const prevPaths = get().paths
    const prevActivePath = get().activePath
    const existing = prevPaths.find(p => p.id === pathId)
    if (!existing) return

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
        // syncableWrite needs the full record — read-merge-put so the
        // registry-driven LWW comparison works against a complete row.
        await syncableWrite('learningPaths', 'put', {
          ...existing,
          name,
        } as unknown as SyncableRecord)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to rename path:', error)
      set({
        paths: prevPaths,
        activePath: prevActivePath,
        error: 'Failed to rename learning path',
      })
      toast.error('Failed to rename learning path')
    }
  },

  updateDescription: async (pathId: string, description: string) => {
    const now = new Date().toISOString()
    const prevPaths = get().paths
    const prevActivePath = get().activePath
    const existing = prevPaths.find(p => p.id === pathId)
    if (!existing) return

    // Optimistic update
    set(state => ({
      paths: state.paths.map(p => (p.id === pathId ? { ...p, description, updatedAt: now } : p)),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, description, updatedAt: now }
          : state.activePath,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPaths', 'put', {
          ...existing,
          description,
        } as unknown as SyncableRecord)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to update description:', error)
      set({
        paths: prevPaths,
        activePath: prevActivePath,
        error: 'Failed to update path description',
      })
      toast.error('Failed to update path description')
    }
  },

  deletePath: async (pathId: string) => {
    // Capture snapshot before any mutation for rollback on failure.
    const prevState = get()
    const prevPaths = prevState.paths
    const prevEntries = prevState.entries
    const prevActivePath = prevState.activePath

    // Collect the entries to delete *before* the syncableWrite calls so we
    // can enqueue each one. We cannot use a Dexie transaction here because
    // syncableWrite spans Dexie + syncQueue; enqueueing happens outside the
    // table-scoped transaction.
    const entryIds = (await db.learningPathEntries
      .where('pathId')
      .equals(pathId)
      .primaryKeys()) as string[]

    // Optimistic update
    set(state => {
      const remaining = state.paths.filter(p => p.id !== pathId)
      return {
        paths: remaining,
        entries: state.entries.filter(e => e.pathId !== pathId),
        activePath: state.activePath?.id === pathId ? remaining[0] || null : state.activePath,
        error: null,
      }
    })

    try {
      await persistWithRetry(async () => {
        for (const entryId of entryIds) {
          await syncableWrite('learningPathEntries', 'delete', entryId)
        }
        await syncableWrite('learningPaths', 'delete', pathId)
      })
    } catch (error) {
      // Rollback to full snapshot preserving original state.
      console.error('[LearningPathStore] Failed to delete path:', error)
      set({
        paths: prevPaths,
        entries: prevEntries,
        activePath: prevActivePath,
        error: 'Failed to delete learning path',
      })
      toast.error('Failed to delete learning path')
      throw error
    }
  },

  deletePathWithUndo: (pathId: string) => {
    const state = get()

    // Guard: path must exist in state
    const path = state.paths.find(p => p.id === pathId)
    if (!path) return

    // Guard: already pending deletion — no-op to prevent double-delete
    if (state.pendingDeletes[pathId]) return

    // Capture snapshot of the path and its entries before removal
    const pathEntries = state.entries.filter(e => e.pathId === pathId)

    // Optimistic removal from in-memory state (same logic as deletePath)
    set(state => {
      const remaining = state.paths.filter(p => p.id !== pathId)
      return {
        paths: remaining,
        entries: state.entries.filter(e => e.pathId !== pathId),
        activePath: state.activePath?.id === pathId ? remaining[0] || null : state.activePath,
        error: null,
      }
    })

    // Store in pendingDeletes for undo window (5 seconds)
    const timer = setTimeout(() => {
      get()._finalizeDelete(pathId)
    }, 5000)

    // Use immutable Record replacement for Zustand tracking
    const pendingDeletes = { ...state.pendingDeletes }
    pendingDeletes[pathId] = { path, entries: pathEntries, timer }
    set({ pendingDeletes })

    // Show undo toast
    toast('Path deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          // Use getState() to avoid stale closure issues
          useLearningPathStore.getState().restorePath(pathId)
        },
      },
      onDismiss: () => {
        // If the toast auto-dismisses (timer expired), finalize
        // This is a safety net for the setTimeout above
        const current = useLearningPathStore.getState().pendingDeletes
        if (current[pathId]) {
          useLearningPathStore.getState()._finalizeDelete(pathId)
        }
      },
    })
  },

  restorePath: (pathId: string) => {
    const state = get()
    const pending = state.pendingDeletes[pathId]

    // Guard: nothing to restore (already finalized or never deleted)
    if (!pending) return

    // Cancel the expiry timer
    clearTimeout(pending.timer)

    // Re-insert path and entries into state
    set(state => ({
      paths: [...state.paths, pending.path],
      entries: [...state.entries, ...pending.entries],
      error: null,
    }))

    // Persist the re-inserted path and entries via syncableWrite.
    // Await the result — only clear pendingDeletes on success so the user can
    // retry Undo if persistence fails. On failure, keep the pendingDeletes
    // entry and show an error toast with a retry hint.
    persistWithRetry(async () => {
      await syncableWrite('learningPaths', 'put', pending.path as unknown as SyncableRecord)
      for (const entry of pending.entries) {
        await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
      }
    })
      .then(() => {
        // Success — remove from pendingDeletes
        const current = get().pendingDeletes
        const pendingDeletes = { ...current }
        delete pendingDeletes[pathId]
        set({ pendingDeletes })
      })
      .catch(error => {
        console.error('[LearningPathStore] Failed to persist restored path:', error)
        toast.error('Failed to restore path — retry Undo')
      })
  },

  // Private: finalize the deletion by persisting to Dexie.
  // Called by setTimeout or onDismiss when the undo window expires.
  _finalizeDelete: async (pathId: string) => {
    const state = get()
    const pending = state.pendingDeletes[pathId]

    // Guard: entry already cleared (e.g., by restorePath)
    if (!pending) return

    // Collect entry IDs from the snapshot (not current state, which already
    // has them removed) — exact duplicate of deletePath's persist logic.
    const entryIds = pending.entries.map(e => e.id)

    try {
      await persistWithRetry(async () => {
        for (const entryId of entryIds) {
          await syncableWrite('learningPathEntries', 'delete', entryId)
        }
        await syncableWrite('learningPaths', 'delete', pathId)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to finalize delete:', error)
      // Path is already removed from state; Dexie still has it. On next
      // loadPaths() it will reappear. Log and leave pendingDeletes entry
      // to prevent re-finalization attempts.
      return
    }

    // Remove from pendingDeletes using immutable replacement
    const pendingDeletes = { ...state.pendingDeletes }
    delete pendingDeletes[pathId]
    set({ pendingDeletes })
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
        await syncableWrite('learningPathEntries', 'add', entry as unknown as SyncableRecord)
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', existingPath as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to add course to path:', error)
      set({
        entries: prevEntries,
        paths: prevPaths,
        error: 'Failed to add course to learning path',
      })
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
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...remaining],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPathEntries', 'delete', entryToRemove.id)
        // Update positions of remaining entries — one put per row.
        for (const entry of remaining) {
          await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
        }
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', existingPath as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to remove course from path:', error)
      set({
        entries: prevEntries,
        paths: prevPaths,
        error: 'Failed to remove course from learning path',
      })
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
      isManuallyOrdered: entry.id === movedEntry.id ? true : entry.isManuallyOrdered,
    }))

    // Optimistic update
    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...updated],
      error: null,
    }))

    await persistWithRetry(async () => {
      for (const entry of updated) {
        await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
      }
      const existingPath = await db.learningPaths.get(pathId)
      if (existingPath) {
        await syncableWrite('learningPaths', 'put', existingPath as unknown as SyncableRecord)
      }
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

      // Clear existing entries for this path — enqueue deletes one-at-a-time.
      const existingEntryIds = (await db.learningPathEntries
        .where('pathId')
        .equals(pathId)
        .primaryKeys()) as string[]
      await persistWithRetry(async () => {
        for (const entryId of existingEntryIds) {
          await syncableWrite('learningPathEntries', 'delete', entryId)
        }
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
          entries: [...state.entries.filter(e => e.pathId !== pathId), ...generatedEntries],
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
        // Clear any partial streaming entries.
        const partialIds = (await db.learningPathEntries
          .where('pathId')
          .equals(pathId)
          .primaryKeys()) as string[]
        for (const entryId of partialIds) {
          await syncableWrite('learningPathEntries', 'delete', entryId)
        }
        for (const entry of finalEntries) {
          await syncableWrite('learningPathEntries', 'add', entry as unknown as SyncableRecord)
        }
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', {
            ...existingPath,
            isAIGenerated: true,
          } as unknown as SyncableRecord)
        }
      })

      set(state => ({
        entries: [...state.entries.filter(e => e.pathId !== pathId), ...finalEntries],
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
      const entryIds = (await db.learningPathEntries
        .where('pathId')
        .equals(pathId)
        .primaryKeys()) as string[]
      await persistWithRetry(async () => {
        for (const entryId of entryIds) {
          await syncableWrite('learningPathEntries', 'delete', entryId)
        }
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
    const updated = currentEntries
      .map(entry => {
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
      })
      .sort((a, b) => a.position - b.position)

    // Optimistic update
    const now = new Date().toISOString()
    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...updated],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: now, isAIGenerated: true } : p
      ),
      error: null,
    }))

    await persistWithRetry(async () => {
      for (const entry of updated) {
        await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
      }
      const existingPath = await db.learningPaths.get(pathId)
      if (existingPath) {
        await syncableWrite('learningPaths', 'put', {
          ...existingPath,
          isAIGenerated: true,
        } as unknown as SyncableRecord)
      }
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

  createPathWithCourses: async (
    name: string,
    description: string | undefined,
    courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>
  ) => {
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
    const prevEntries = get().entries
    const prevActivePath = get().activePath

    // Deduplicate courses
    const seen = new Set<string>()
    const uniqueCourses = courses.filter(c => {
      if (seen.has(c.courseId)) return false
      seen.add(c.courseId)
      return true
    })

    const pathEntries: LearningPathEntry[] = uniqueCourses.map((c, i) => ({
      id: crypto.randomUUID(),
      pathId: path.id,
      courseId: c.courseId,
      courseType: c.courseType,
      position: i + 1,
      isManuallyOrdered: false,
    }))

    // Optimistic update
    set(state => ({
      paths: [...state.paths, path],
      entries: [...state.entries, ...pathEntries],
      activePath: state.activePath || path,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPaths', 'add', path as unknown as SyncableRecord)
        for (const entry of pathEntries) {
          await syncableWrite('learningPathEntries', 'add', entry as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      // Rollback: remove path and all entries
      console.error('[LearningPathStore] Failed to create path with courses:', error)
      set({
        paths: prevPaths,
        entries: prevEntries,
        activePath: prevActivePath,
        error: 'Failed to create learning path with courses',
      })
      toast.error('Failed to create learning path')
      throw error
    }

    return path
  },

  batchAddCoursesToPath: async (
    pathId: string,
    courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>
  ) => {
    const existingEntries = get().entries.filter(e => e.pathId === pathId)
    const existingCourseIds = new Set(existingEntries.map(e => e.courseId))

    // Deduplicate against existing entries and within the input
    const seen = new Set<string>()
    const uniqueCourses = courses.filter(c => {
      if (existingCourseIds.has(c.courseId) || seen.has(c.courseId)) return false
      seen.add(c.courseId)
      return true
    })

    if (uniqueCourses.length === 0) return

    const nextPosition = existingEntries.length + 1
    const pathEntries: LearningPathEntry[] = uniqueCourses.map((c, i) => ({
      id: crypto.randomUUID(),
      pathId,
      courseId: c.courseId,
      courseType: c.courseType,
      position: nextPosition + i,
      isManuallyOrdered: false,
    }))

    const prevEntries = get().entries
    const prevPaths = get().paths

    // Optimistic update
    set(state => ({
      entries: [...state.entries, ...pathEntries],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        for (const entry of pathEntries) {
          await syncableWrite('learningPathEntries', 'add', entry as unknown as SyncableRecord)
        }
        const updatedPath = get().paths.find(p => p.id === pathId)
        if (updatedPath) {
          await syncableWrite('learningPaths', 'put', updatedPath as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to batch add courses to path:', error)
      set({
        entries: prevEntries,
        paths: prevPaths,
        error: 'Failed to add courses to learning path',
      })
      toast.error('Failed to add courses to learning path')
      throw error
    }
  },

  forkTemplate: async (templateId: string) => {
    const generation = get().forkGeneration + 1
    set({ forkGeneration: generation })

    const template = await db.learningPaths.get(templateId)
    if (!template || !template.isTemplate) {
      toast.error('Template not found')
      return null
    }

    if (get().forkGeneration !== generation) return null

    const templateEntries = await db.learningPathEntries
      .where('pathId')
      .equals(templateId)
      .sortBy('position')

    if (get().forkGeneration !== generation) return null

    const importedCourses = useCourseImportStore.getState().importedCourses

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

    const importedNames = new Map<string, string>()
    for (const course of importedCourses) {
      importedNames.set(normalize(course.name), course.id)
    }

    const now = new Date().toISOString()
    const newPathId = crypto.randomUUID()

    const newPath: LearningPath = {
      id: newPathId,
      name: template.name,
      description: template.description,
      createdAt: now,
      updatedAt: now,
      isAIGenerated: false,
      isTemplate: false,
      forkedFrom: templateId,
      estimatedHours: template.estimatedHours,
      difficultyLabel: template.difficultyLabel,
    }

    const prevPaths = get().paths
    const prevEntries = get().entries
    const prevActivePath = get().activePath

    set(state => ({
      paths: [...state.paths, newPath],
      activePath: state.activePath || newPath,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPaths', 'add', newPath as unknown as SyncableRecord)
      })

      if (get().forkGeneration !== generation) {
        db.learningPaths.delete(newPathId).catch(() => {})
        set({ paths: prevPaths, activePath: prevActivePath })
        return null
      }

      const newEntries: LearningPathEntry[] = []
      for (const entry of templateEntries) {
        const matchTitleMatch = entry.justification?.match(/\[Search for: (.+)\]$/)
        const matchTitle = matchTitleMatch ? matchTitleMatch[1] : undefined

        let courseId = ''
        let courseType: 'imported' | 'catalog' = 'catalog'

        if (entry.courseId && importedCourses.some(c => c.id === entry.courseId)) {
          courseId = entry.courseId
          courseType = 'imported'
        } else if (matchTitle) {
          const normalizedMatch = normalize(matchTitle)
          const matchedId = importedNames.get(normalizedMatch)
          if (matchedId) {
            courseId = matchedId
            courseType = 'imported'
          }
        }

        const newEntry: LearningPathEntry = {
          id: crypto.randomUUID(),
          pathId: newPathId,
          courseId,
          courseType,
          position: entry.position,
          justification: entry.justification,
          isManuallyOrdered: false,
        }
        newEntries.push(newEntry)
      }

      set(state => ({ entries: [...state.entries, ...newEntries] }))

      for (const newEntry of newEntries) {
        await persistWithRetry(async () => {
          await syncableWrite('learningPathEntries', 'add', newEntry as unknown as SyncableRecord)
        })
      }

      const freshPaths = await db.learningPaths.toArray()
      const freshEntries = await db.learningPathEntries.toArray()
      const sorted = freshPaths.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      set(state => ({
        paths: sorted,
        entries: freshEntries,
        activePath: sorted.find(p => p.id === newPathId) ?? state.activePath,
      }))

      toast.success(`Created "${newPath.name}" from template`)
      return newPathId
    } catch (error) {
      console.error('[LearningPathStore] Failed to fork template:', error)
      set({
        paths: prevPaths,
        entries: prevEntries,
        activePath: prevActivePath,
      })
      toast.error('Failed to create path from template')
      return null
    }
  },

  hydrateFromRemote: async ({ paths, entries } = {}) => {
    // Direct Dexie write — NEVER through syncableWrite. The remote is already
    // authoritative in Supabase; enqueueing here would create an echo loop.
    if (paths && paths.length > 0) {
      await db.learningPaths.bulkPut(paths)
    }
    if (entries && entries.length > 0) {
      await db.learningPathEntries.bulkPut(entries)
    }
    if ((paths && paths.length > 0) || (entries && entries.length > 0)) {
      // Refresh in-memory cache from Dexie to reflect the merged state.
      const freshPaths = await db.learningPaths.toArray()
      const freshEntries = await db.learningPathEntries.toArray()
      const sorted = freshPaths.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      set(state => ({
        paths: sorted,
        entries: freshEntries,
        activePath: state.activePath ?? sorted[0] ?? null,
      }))
    }
  },
}))
