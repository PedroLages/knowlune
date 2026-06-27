import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type {
  LearningPath,
  LearningPathEntry,
  PathProgressionMode,
  CompletionTarget,
} from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { extractGapSearchTerm, entryProvenance } from '@/data/learningPathUtils'

interface LearningPathState {
  // Multi-path state (E26-S01/S02)
  paths: LearningPath[]
  entries: LearningPathEntry[] // All entries across all paths
  activePath: LearningPath | null
  isGenerating: boolean
  forkGeneration: number
  error: string | null
  isLoaded: boolean // Guard flag — follows useBookStore.isLoaded pattern
  migrationFailed: boolean

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
  setProgressionMode: (pathId: string, mode: PathProgressionMode) => Promise<void>
  updatePathCover: (
    pathId: string,
    cover: { coverImageUrl?: string; coverPreset?: string }
  ) => Promise<void>
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
    justification?: string,
    completionTarget?: CompletionTarget
  ) => Promise<void>
  removeCourseFromPath: (pathId: string, courseId: string) => Promise<void>
  /**
   * Reorder by drag target (aligned with `@dnd-kit/sortable`): move `activeCourseId`
   * to the slot of `overCourseId`, preserving gap rows in-place.
   */
  reorderPathCourses: (
    pathId: string,
    activeCourseId: string,
    overCourseId: string
  ) => Promise<void>
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

  // Placement suggestion
  applyPlacementSuggestion: (
    pathId: string,
    courseId: string,
    suggestedPosition: number,
    justification: string
  ) => Promise<void>

  // Gap entry resolution
  replaceGapEntry: (
    pathId: string,
    gapEntryId: string,
    newCourseId: string,
    newCourseType: 'imported' | 'catalog'
  ) => Promise<void>

  // Batch operations
  createPathWithCourses: (
    name: string,
    description: string | undefined,
    courses: Array<{
      courseId: string
      courseType: 'imported' | 'catalog'
      justification?: string
      completionTarget: CompletionTarget | undefined
    }>,
    orderMode?: 'manifest' | 'custom'
  ) => Promise<LearningPath>
  batchAddCoursesToPath: (
    pathId: string,
    courses: Array<{
      courseId: string
      courseType: 'imported' | 'catalog'
      justification?: string
      completionTarget: CompletionTarget | undefined
    }>
  ) => Promise<void>

  // Manifest import ordering
  applyManifestOrder: (
    pathId: string,
    manifestCourses: Array<{
      folder: string
      courseId?: string
      position: number
    }>,
    options?: {
      setOrderMode?: 'manifest' | 'preserve'
      baseManifestHash?: string
    }
  ) => Promise<void>

  /**
   * Single-pass creation for manifest-imported tracks (replaces createPathWithCourses + applyManifestOrder).
   *
   * Note: `courses` does not include `justification` or `completionTarget` —
   * these are intentionally omitted for manifest imports. Manifest courses are
   * curated track content where justification is not AI-generated, and per-course
   * completion targets are specified in the manifest JSON instead. If needed in
   * the future, extend the course input type to accept these fields.
   */
  createPathFromManifest: (input: {
    name: string
    description?: string
    courses: Array<{ courseId: string; folder: string; position: number }>
    manifestHash: string
    manifestName?: string
  }) => Promise<string>

  // Template operations
  forkTemplate: (templateId: string) => Promise<string | null> // returns new path ID or null on failure

  // Helpers
  getEntriesForPath: (pathId: string) => LearningPathEntry[]

  /** Returns a map of courseId → minimum manifestOrdinal across all loaded entries. Used by InlineCoursePicker sorting. */
  getManifestOrdinalMap: () => Map<string, number>

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

/** Syllabus gap rows use `courseId === ''` (see PathTimeline + replaceGapEntry). */
function isPathGapEntry(e: LearningPathEntry): boolean {
  return e.courseId === ''
}

function arrayMoveInPlaceCopy<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Keep gap slots fixed; replace only real course rows with `reorderedMovables` in order. */
function weavePathWithMovableOrder(
  skeleton: LearningPathEntry[],
  reorderedMovables: LearningPathEntry[]
): LearningPathEntry[] {
  let mi = 0
  return skeleton.map(slot => {
    if (isPathGapEntry(slot)) return slot
    const src = reorderedMovables[mi++]
    return src !== undefined ? { ...src } : slot
  })
}

/** Resolve course IDs to names for reorder history context */
function resolvedCourseNames(entries: LearningPathEntry[]): string[] {
  const importedCourses = useCourseImportStore.getState().importedCourses
  return entries.map(e => {
    const course = importedCourses.find(c => c.id === e.courseId)
    return course?.name || 'Unknown Course'
  })
}

/**
 * Build migration patches for path-ordering backfill (F-019).
 *
 * Pure computation — no side effects. Iterates over paths that lack orderMode
 * and computes the patches needed to backfill orderMode, manifestOrdinal,
 * source, and state. Returns null if no migration is needed.
 *
 * Extracted from loadPaths for testability.
 */
interface EntryPatch {
  id: string
  patch: Partial<LearningPathEntry>
}

interface MigrationPatches {
  allPathPatches: Array<{ id: string; patch: Partial<LearningPath>; entriesSnapshot: LearningPathEntry[] }>
  allEntryPatches: EntryPatch[]
  preMigrationSnapshot: { paths: LearningPath[]; entries: LearningPathEntry[] }
  now: string
}

/** @internal Exported for testing */
export async function buildMigrationPatches(
  rawPaths: LearningPath[],
  rawEntries: LearningPathEntry[],
  sorted: LearningPath[],
): Promise<MigrationPatches | null> {
  const importedCourses = await db.importedCourses.toArray()
  const coursesById = new Map(importedCourses.map(c => [c.id, c]))
  const now = new Date().toISOString()

  const preMigrationSnapshot = {
    paths: sorted,
    entries: rawEntries,
  }

  const allPathPatches: Array<{ id: string; patch: Partial<LearningPath>; entriesSnapshot: LearningPathEntry[] }> = []
  const allEntryPatches: EntryPatch[] = []

  for (const path of rawPaths) {
    if (path.orderMode != null) continue

    const pathEntries = rawEntries
      .filter(e => e.pathId === path.id)
      .sort((a, b) => a.position - b.position)

    const entryPatches: EntryPatch[] = []
    for (const entry of pathEntries) {
      const course = entry.courseId ? coursesById.get(entry.courseId) : undefined

      if (isPathGapEntry(entry)) {
        if (entry.manifestOrdinal == null) {
          entryPatches.push({
            id: entry.id,
            patch: { ...entryProvenance(entry.source ?? 'user') },
          })
        }
      } else if (entry.manifestOrdinal != null) {
        if (!entry.source || !entry.state) {
          entryPatches.push({
            id: entry.id,
            patch: {
              source: entry.source ?? 'manifest',
              state: entry.state ?? 'active',
              manifestCourseKey: entry.manifestCourseKey ?? course?.name?.trim().normalize('NFC') ?? null,
            },
          })
        }
      } else if (course?.manifestPosition != null) {
        entryPatches.push({
          id: entry.id,
          patch: {
            manifestOrdinal: course.manifestPosition,
            source: entry.source ?? 'manifest',
            state: entry.state ?? 'active',
            manifestCourseKey: entry.manifestCourseKey ?? course.name?.trim().normalize('NFC') ?? null,
          },
        })
      } else {
        if (entry.manifestOrdinal == null || !entry.source || !entry.state) {
          entryPatches.push({
            id: entry.id,
            patch: { ...entryProvenance(entry.source ?? 'user') },
          })
        }
      }
    }

    let orderMode: 'custom' | 'manifest' = 'custom'

    if (pathEntries.some(e => e.isManuallyOrdered === true)) {
      orderMode = 'custom'
    } else {
      const manifestEntries = pathEntries
        .filter(e => {
          const ordinal = entryPatches.find(ep => ep.id === e.id)?.patch.manifestOrdinal ?? e.manifestOrdinal
          return ordinal != null
        })
        .sort((a, b) => a.position - b.position)

      const inManifestOrder = manifestEntries.every((entry, i) => {
        if (i === 0) return true
        const prevOrdinal = entryPatches.find(ep => ep.id === manifestEntries[i - 1].id)?.patch.manifestOrdinal ?? manifestEntries[i - 1].manifestOrdinal
        const currOrdinal = entryPatches.find(ep => ep.id === entry.id)?.patch.manifestOrdinal ?? entry.manifestOrdinal
        if (prevOrdinal == null || currOrdinal == null) return false
        return currOrdinal > prevOrdinal
      })

      orderMode = inManifestOrder && manifestEntries.length > 0 ? 'manifest' : 'custom'
    }

    const pathPatch: Partial<LearningPath> = {
      orderMode,
      updatedAt: now,
    }

    allPathPatches.push({ id: path.id, patch: pathPatch, entriesSnapshot: pathEntries })
    allEntryPatches.push(...entryPatches)
  }

  if (allPathPatches.length === 0 && allEntryPatches.length === 0) {
    return null
  }

  return { allPathPatches, allEntryPatches, preMigrationSnapshot, now }
}

/**
 * Module-level loading lock for loadPaths.
 * Prevents concurrent invocations (F-024). Set BEFORE the first await so callers
 * that race during app startup coalesce into a single load.
 */
let _loadPathsLock: Promise<void> | null = null

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  paths: [],
  entries: [],
  activePath: null,
  isGenerating: false,
  forkGeneration: 0,
  error: null,
  isLoaded: false,
  migrationFailed: false,
  pendingDeletes: {},

  loadPaths: async () => {
    if (get().isLoaded) return
    if (_loadPathsLock) return _loadPathsLock

    _loadPathsLock = (async () => {
      let rawPaths: LearningPath[] = []
      let rawEntries: LearningPathEntry[] = []
      try {
        rawPaths = await db.learningPaths.toArray()
        rawEntries = await db.learningPathEntries.toArray()
        const sorted = rawPaths.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        // ── Migration: backfill orderMode, manifestOrdinal, source, state ──
        // Uses extracted buildMigrationPatches for testability (F-019).
        const migrationResult = await buildMigrationPatches(rawPaths, rawEntries, sorted)

        // Hoist patch arrays for re-use in the re-read section below.
        // Empty when no migration was needed.
        const allPathPatches = migrationResult?.allPathPatches ?? []
        const allEntryPatches = migrationResult?.allEntryPatches ?? []
        const preMigrationSnapshot = migrationResult?.preMigrationSnapshot ?? null

        if (migrationResult) {
          // ── Persist ──
          let persistFailed = false
          try {
            await persistWithRetry(async () => {
              // Write entry patches first so a crash leaves entries without orderMode,
              // triggering re-migration on next load. Paths are updated last so a
              // partial write still leaves paths without orderMode.
              for (const { id, patch } of allEntryPatches) {
                const existing = await db.learningPathEntries.get(id)
                if (existing) {
                  await syncableWrite('learningPathEntries', 'put', {
                    ...existing,
                    ...patch,
                  } as unknown as SyncableRecord)
                }
              }
              for (const { id, patch } of allPathPatches) {
                const existing = await db.learningPaths.get(id)
                if (existing) {
                  await syncableWrite('learningPaths', 'put', {
                    ...existing,
                    ...patch,
                  } as unknown as SyncableRecord)
                }
              }
            })
          } catch (persistError) {
            console.error('[LearningPathStore] Migration persist failed — rolling back:', persistError)
            // Rollback: restore Zustand to pre-migration snapshot.
            // Sets isLoaded:true so loaded data is renderable — migrationFailed
            // signals consumers to show an error banner instead of a spinner.
            set({
              paths: preMigrationSnapshot!.paths,
              entries: preMigrationSnapshot!.entries,
              error: 'Failed to migrate track ordering — rolled back',
              isLoaded: true,
              migrationFailed: true,
            })
            toast.error('Track ordering migration failed. Changes have been rolled back.')
            persistFailed = true
            // Continue — load the unmigrated data so the app still works;
            // re-migration runs automatically on next loadPaths() because
            // orderMode is still missing.
          }

          // ── Re-read from Dexie to pick up persisted migration ──
          // Skip if persist failed — the rollback already restored the
          // pre-migration state with isLoaded:false and error set.
          if (!persistFailed) {
            const migratedPaths = await db.learningPaths.toArray()
            const migratedEntries = await db.learningPathEntries.toArray()
            const finalSorted = migratedPaths.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )

            // Apply computed patches to in-memory state for data that may not
            // have been persisted yet (partial-write recovery).
            const patchedEntries = migratedEntries.map(entry => {
              const patch = allEntryPatches.find(ep => ep.id === entry.id)
              if (patch) return { ...entry, ...patch.patch }
              return entry
            })
            const patchedPaths = finalSorted.map(path => {
              const patch = allPathPatches.find(pp => pp.id === path.id)
              if (patch) return { ...path, ...patch.patch }
              return path
            })

            set({
              paths: patchedPaths,
              entries: patchedEntries,
              activePath: sorted[0] || null,
              error: null,
              isLoaded: true,
              migrationFailed: false,
            })
          }
        } else {
          // ── No migration needed — direct load ──
          set({
            paths: sorted,
            entries: rawEntries,
            activePath: sorted[0] || null,
            error: null,
            isLoaded: true,
            migrationFailed: false,
          })
        }
      } catch (error) {
        console.error('[LearningPathStore] Failed to load paths:', error)
        // F-003: Use already-read Dexie data if available, even when a non-persist
        // error (e.g. buildMigrationPatches) throws after the initial read.
        if (rawPaths.length > 0 || rawEntries.length > 0) {
          set({
            paths: rawPaths.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ),
            entries: rawEntries,
            activePath: rawPaths[0] || null,
            error: 'Failed to load learning paths from database',
            isLoaded: true,
            migrationFailed: false,
          })
        } else {
          set({
            error: 'Failed to load learning paths from database',
            isLoaded: true,
            migrationFailed: false,
          })
        }
      }
    })()

    try {
      await _loadPathsLock
    } finally {
      _loadPathsLock = null
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
      progressionMode: 'free',
      orderMode: 'custom',
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

  setProgressionMode: async (pathId: string, mode: PathProgressionMode) => {
    const prevPaths = get().paths
    const prevActivePath = get().activePath
    const existing = prevPaths.find(p => p.id === pathId)
    if (!existing) return

    // Optimistic update
    set(state => ({
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, progressionMode: mode } : p
      ),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, progressionMode: mode }
          : state.activePath,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPaths', 'put', {
          ...existing,
          progressionMode: mode,
        } as unknown as SyncableRecord)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to update progression mode:', error)
      set({
        paths: prevPaths,
        activePath: prevActivePath,
        error: 'Failed to update progression mode',
      })
      toast.error('Failed to update progression mode')
    }
  },

  updatePathCover: async (pathId, cover) => {
    const now = new Date().toISOString()
    const prevPaths = get().paths
    const prevActivePath = get().activePath
    const existing = prevPaths.find(p => p.id === pathId)
    if (!existing) return

    // Optimistic update
    set(state => ({
      paths: state.paths.map(p => (p.id === pathId ? { ...p, ...cover, updatedAt: now } : p)),
      activePath:
        state.activePath?.id === pathId
          ? { ...state.activePath, ...cover, updatedAt: now }
          : state.activePath,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPaths', 'put', {
          ...existing,
          ...cover,
        } as unknown as SyncableRecord)
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to update path cover:', error)
      set({
        paths: prevPaths,
        activePath: prevActivePath,
        error: 'Failed to update path cover',
      })
      toast.error('Failed to update path cover')
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
    justification?: string,
    completionTarget?: CompletionTarget
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
      completionTarget,
      ...entryProvenance(),
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

  reorderPathCourses: async (pathId: string, activeCourseId: string, overCourseId: string) => {
    if (!pathId || !activeCourseId || !overCourseId || activeCourseId === overCourseId) {
      return
    }

    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
    const path = get().paths.find(p => p.id === pathId)
    if (!path) return

    const movable = pathEntries.filter(e => !isPathGapEntry(e))
    const oldIx = movable.findIndex(e => e.courseId === activeCourseId)
    const newIx = movable.findIndex(e => e.courseId === overCourseId)

    if (oldIx === -1 || newIx === -1) return

    const movedEntry = movable[oldIx]
    const movableReordered = arrayMoveInPlaceCopy(movable, oldIx, newIx)
    const rebuilt = weavePathWithMovableOrder(pathEntries, movableReordered)

    // Flip orderMode to "custom" on first user drag reorder
    const wasOrderMode = path.orderMode ?? 'custom'
    const switchedFromManifest = wasOrderMode === 'manifest'

    // Reassign dense positions.
    // NOTE: isManuallyOrdered is no longer written during reorder (deprecated).
    // Consumers should check path.orderMode === 'custom' instead to determine
    // whether the user has manually reordered. The isManuallyOrdered field is
    // kept on legacy Dexie rows but never set by new code.
    const updated = rebuilt.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }))

    const updatedPath = {
      ...path,
      orderMode: 'custom' as const,
      updatedAt: new Date().toISOString(),
    }

    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...updated],
      paths: state.paths.map(p =>
        p.id === pathId ? updatedPath : p
      ),
      error: null,
    }))

    let persistSucceeded = false
    try {
      await persistWithRetry(async () => {
        for (const entry of updated) {
          await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
        }
        await syncableWrite('learningPaths', 'put', updatedPath as unknown as SyncableRecord)
      })
      persistSucceeded = true
    } catch (error) {
      console.error('[LearningPathStore] Failed to persist reordering:', error)
      // Rollback: restore pre-mutation state
      set(state => ({
        entries: state.entries.map(e => {
          const orig = pathEntries.find(pe => pe.id === e.id)
          return orig ?? e
        }),
        paths: state.paths.map(p =>
          p.id === pathId ? path : p
        ),
        // Only set error if no prior error exists
        ...(state.error ? {} : { error: 'Failed to save reordering' }),
      }))
    }

    // Record reorder history only on successful persist (F-043).
    // Gate on movable-coordinate indices (oldIx/newIx) to avoid comparing
    // gap-inclusive vs gap-exclusive coordinate systems (F-043 coordinate fix).
    if (persistSucceeded && oldIx !== newIx) {
      try {
        const importedCourses = useCourseImportStore.getState().importedCourses
        const courseData = importedCourses.find(c => c.id === movedEntry.courseId)
        const courseName = courseData?.name || 'Unknown Course'
        const courseTags = courseData?.tags || []

        const movedPos = updated.find(e => e.id === movedEntry.id)?.position ?? newIx + 1
        const beforeCourses = resolvedCourseNames(
          updated.filter(e => e.id !== movedEntry.id && e.position < movedPos).slice(-2)
        )
        const afterCourses = resolvedCourseNames(
          updated.filter(e => e.id !== movedEntry.id && e.position > movedPos).slice(0, 2)
        )

        const historyEntry = {
          id: crypto.randomUUID(),
          pathId,
          courseId: movedEntry.courseId,
          suggestedPosition: switchedFromManifest ? movedEntry.position : null,
          chosenPosition: movedPos,
          courseName,
          courseTags,
          surroundingBefore: beforeCourses,
          surroundingAfter: afterCourses,
          movedAt: new Date().toISOString(),
        }

        db.reorderHistory.add(historyEntry).catch(err => {
          console.warn('[LearningPathStore] Failed to record reorder history:', err)
        })

        db.reorderHistory
          .orderBy('movedAt')
          .reverse()
          .toArray()
          .then(all => {
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
            const toDelete = all
              .filter((e, i) => i >= 50 || new Date(e.movedAt).getTime() < cutoff)
              .map(e => e.id)
            if (toDelete.length > 0) {
              db.reorderHistory.bulkDelete(toDelete).catch(() => {})
            }
          })
          .catch(() => {})
      } catch (err) {
        console.warn('[LearningPathStore] Failed to record reorder history:', err)
      }
    }
  },

  reorderCourse: async (pathId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)

    const fromEntry = pathEntries[fromIndex]
    const toEntry = pathEntries[toIndex]

    if (
      !fromEntry?.courseId ||
      !toEntry?.courseId ||
      isPathGapEntry(fromEntry) ||
      isPathGapEntry(toEntry)
    ) {
      return
    }

    await get().reorderPathCourses(pathId, fromEntry.courseId, toEntry.courseId)
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
          completionTarget: undefined,
          ...entryProvenance(),
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
        completionTarget: undefined,
        ...entryProvenance(),
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
            orderMode: existingPath.orderMode ?? 'custom',
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
            completionTarget: entry.completionTarget,
            // Preserve existing source/state — AI order doesn't change provenance
          }
        }
        return entry
      })
      .sort((a, b) => a.position - b.position)

    // Capture previous state for rollback before optimistic update
    const prevEntries = get().entries
    const prevPaths = get().paths

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
      // Rollback: restore pre-mutation state
      set({ entries: prevEntries, paths: prevPaths, error: 'Failed to save AI-suggested order' })
    })
  },

  getEntriesForPath: (pathId: string) => {
    return get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)
  },

  /** Returns a map of courseId → minimum manifestOrdinal across all loaded entries.
   * Used by InlineCoursePicker to sort courses by manifest position.
   * If the same course appears in multiple tracks with different ordinals,
   * the minimum ordinal is used — placing the course earliest in the picker
   * where users expect to see familiar courses first. */
  getManifestOrdinalMap: () => {
    const entries = get().entries
    const ordinals = new Map<string, number>()
    for (const entry of entries) {
      if (entry.manifestOrdinal == null) continue
      const current = ordinals.get(entry.courseId)
      if (current == null || entry.manifestOrdinal < current) {
        ordinals.set(entry.courseId, entry.manifestOrdinal)
      }
    }
    return ordinals
  },

  applyPlacementSuggestion: async (
    pathId: string,
    courseId: string,
    suggestedPosition: number,
    justification: string
  ) => {
    const pathEntries = get()
      .entries.filter(e => e.pathId === pathId)
      .sort((a, b) => a.position - b.position)

    const entry = pathEntries.find(e => e.courseId === courseId)
    if (!entry) return

    const fromIndex = pathEntries.indexOf(entry)
    const toIndex = suggestedPosition - 1

    // Reorder array
    const reordered = [...pathEntries]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(Math.min(toIndex, reordered.length), 0, {
      ...moved,
      justification,
      // Preserve existing source/state — placement doesn't change provenance
    })

    const updated = reordered.map((e, index) => ({
      ...e,
      position: index + 1,
    }))

    // Optimistic update
    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...updated],
      error: null,
    }))

    await persistWithRetry(async () => {
      for (const e of updated) {
        await syncableWrite('learningPathEntries', 'put', e as unknown as SyncableRecord)
      }
      const existingPath = await db.learningPaths.get(pathId)
      if (existingPath) {
        await syncableWrite('learningPaths', 'put', existingPath as unknown as SyncableRecord)
      }
    }).catch(error => {
      console.error('[LearningPathStore] Failed to apply placement suggestion:', error)
      set({ error: 'Failed to apply placement suggestion' })
    })
  },

  replaceGapEntry: async (pathId, gapEntryId, newCourseId, newCourseType) => {
    const state = get()
    const gapEntry = state.entries.find(e => e.id === gapEntryId && e.pathId === pathId)
    if (!gapEntry) return

    // Check duplicate — the new course must not already exist in this path
    const existingEntries = state.entries.filter(e => e.pathId === pathId)
    if (existingEntries.some(e => e.courseId === newCourseId)) {
      set({ error: 'Course is already in this learning path' })
      return
    }

    const replacementEntry: LearningPathEntry = {
      id: crypto.randomUUID(),
      pathId,
      courseId: newCourseId,
      courseType: newCourseType,
      position: gapEntry.position,
      justification: gapEntry.justification,
      isManuallyOrdered: false,
      completionTarget: undefined,
      ...entryProvenance(),
    }

    const prevEntries = get().entries
    const prevPaths = get().paths

    // Optimistic update — remove gap entry, add real course
    set(state => ({
      entries: [...state.entries.filter(e => e.id !== gapEntryId), replacementEntry],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('learningPathEntries', 'delete', gapEntryId)
        await syncableWrite(
          'learningPathEntries',
          'add',
          replacementEntry as unknown as SyncableRecord
        )
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', existingPath as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to replace gap entry:', error)
      set({
        entries: prevEntries,
        paths: prevPaths,
        error: 'Failed to resolve gap entry',
      })
      toast.error('Failed to resolve gap entry')
    }
  },

  createPathWithCourses: async (
    name: string,
    description: string | undefined,
    courses: Array<{
      courseId: string
      courseType: 'imported' | 'catalog'
      justification?: string
      completionTarget: CompletionTarget | undefined
    }>,
    orderMode?: 'manifest' | 'custom'
  ) => {
    const now = new Date().toISOString()
    const path: LearningPath = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      isAIGenerated: false,
      progressionMode: 'free',
      orderMode: orderMode ?? 'custom',
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
      justification: c.justification,
      isManuallyOrdered: false,
      completionTarget: c.completionTarget,
      ...entryProvenance(),
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

  createPathFromManifest: async (input) => {
    const now = new Date().toISOString()

    // Sort courses by manifest position (ascending), tie-break by folder
    const sorted = [...input.courses].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      return a.folder.localeCompare(b.folder)
    })

    // Deduplicate by courseId — keep first occurrence in sorted order
    const seen = new Set<string>()
    const uniqueCourses = sorted.filter(c => {
      if (seen.has(c.courseId)) {
        console.warn(
          '[LearningPathStore] createPathFromManifest duplicate courseId:',
          c.courseId,
          '- keeping first occurrence'
        )
        return false
      }
      seen.add(c.courseId)
      return true
    })

    if (uniqueCourses.length === 0) {
      console.warn('[LearningPathStore] createPathFromManifest called with empty courses — aborting')
      toast.error('Cannot create track: no courses to import')
      throw new Error('Cannot create track from manifest: no courses provided')
    }

    const pathId = crypto.randomUUID()
    const path: LearningPath = {
      id: pathId,
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      isAIGenerated: false,
      progressionMode: 'free',
      orderMode: 'manifest',
      baseManifestHash: input.manifestHash,
    }

    const pathEntries: LearningPathEntry[] = uniqueCourses.map((course, index) => ({
      id: crypto.randomUUID(),
      pathId,
      courseId: course.courseId,
      courseType: 'imported' as const,
      position: index + 1, // dense sequential — the mutable current order
      // isManuallyOrdered is intentionally omitted (deprecated — consumers check orderMode instead)
      manifestOrdinal: course.position, // immutable curated position from manifest
      source: 'manifest',
      state: 'active',
      manifestCourseKey: course.folder.trim().normalize('NFC'),
    }))

    const prevPaths = get().paths
    const prevEntries = get().entries
    const prevActivePath = get().activePath

    // Optimistic update
    set(state => ({
      paths: [...state.paths, path],
      entries: [...state.entries, ...pathEntries],
      activePath: state.activePath || path,
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        // Note: uses 'put' (not 'add') for idempotency — if the path was
        // partially persisted before a failure, the retry overwrites cleanly.
        // Using syncableWrite prevents a single Dexie transaction, so partial
        // writes can leave orphaned rows until the cleanup below runs.
        await syncableWrite('learningPaths', 'put', path as unknown as SyncableRecord)
        for (const entry of pathEntries) {
          await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to create path from manifest:', error)

      // Cleanup: delete any orphaned entries and path that may have been
      // persisted before the failure (F-044). F-002: use per-step try/catch so
      // orphaned entries don't block path deletion (and vice versa).
      try {
        const orphanedEntries = await db.learningPathEntries.where('pathId').equals(pathId).toArray()
        for (const oe of orphanedEntries) {
          await syncableWrite('learningPathEntries', 'delete', oe.id)
        }
      } catch (cleanupError) {
        console.warn('[LearningPathStore] Failed to clean up orphaned manifest entries:', cleanupError)
      }
      try {
        const orphanedPath = await db.learningPaths.get(pathId)
        if (orphanedPath) {
          await syncableWrite('learningPaths', 'delete', pathId)
        }
      } catch (cleanupError) {
        console.warn('[LearningPathStore] Failed to clean up orphaned manifest path:', cleanupError)
      }

      set({
        paths: prevPaths,
        entries: prevEntries,
        activePath: prevActivePath,
        error: 'Failed to create path from manifest',
      })
      toast.error('Failed to create track from manifest')
      throw error
    }

    return pathId
  },

  batchAddCoursesToPath: async (
    pathId: string,
    courses: Array<{
      courseId: string
      courseType: 'imported' | 'catalog'
      justification?: string
      completionTarget: CompletionTarget | undefined
      source?: 'manifest' | 'user'
    }>
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
      justification: c.justification,
      // isManuallyOrdered is intentionally omitted (deprecated — consumers check orderMode instead)
      completionTarget: c.completionTarget,
      ...entryProvenance(c.source ?? 'user'),
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

  applyManifestOrder: async (
    pathId: string,
    manifestCourses: Array<{
      folder: string
      courseId?: string
      position: number
    }>,
    options?: {
      setOrderMode?: 'manifest' | 'preserve'
      baseManifestHash?: string
    }
  ) => {
    const allEntries = get().entries.filter(e => e.pathId === pathId)
    const path = get().paths.find(p => p.id === pathId)
    if (!path) return

    // Group entries by manifestCourseKey and by courseId for two-tier matching.
    const byManifestCourseKey = new Map<string, LearningPathEntry[]>()
    const byCourseId = new Map<string, LearningPathEntry[]>()
    for (const e of allEntries) {
      if (e.manifestCourseKey) {
        const arr = byManifestCourseKey.get(e.manifestCourseKey)
        if (arr) arr.push(e)
        else byManifestCourseKey.set(e.manifestCourseKey, [e])
      }
      const arr = byCourseId.get(e.courseId)
      if (arr) arr.push(e)
      else byCourseId.set(e.courseId, [e])
    }

    const ordered: LearningPathEntry[] = []
    const seenIds = new Set<string>()
    const orphanIds: string[] = []

    // Place manifest courses in manifest position order.
    // Two-tier matching: try manifestCourseKey first, then fall back to courseId.
    const manifestSorted = [...manifestCourses].sort((a, b) => a.position - b.position)
    for (const mc of manifestSorted) {
      const key = mc.folder.trim().normalize('NFC')
      let matchedEntries = byManifestCourseKey.get(key)
      if (!matchedEntries || matchedEntries.length === 0) {
        if (!mc.courseId) continue // gap entries have no courseId; skip to avoid matching ''
        matchedEntries = byCourseId.get(mc.courseId) ?? []
      }
      if (matchedEntries.length > 0) {
        const keep = matchedEntries[0]
        ordered.push({
          ...keep,
          position: ordered.length + 1,
          source: 'manifest',
          state: 'active',
          manifestOrdinal: mc.position,
          manifestCourseKey: key,
        })
        seenIds.add(keep.id)
        for (let i = 1; i < matchedEntries.length; i++) {
          orphanIds.push(matchedEntries[i].id)
          seenIds.add(matchedEntries[i].id)
        }
      }
    }

    // Append entries not in the manifest (preserve user-added/gap courses).
    for (const entry of allEntries) {
      if (!seenIds.has(entry.id)) {
        ordered.push({ ...entry, position: ordered.length + 1 })
        seenIds.add(entry.id)
      }
    }

    const prevEntries = get().entries
    const prevPaths = get().paths

    // Determine path mode update
    const currentOrderMode = path.orderMode
    let newOrderMode: 'manifest' | 'custom' | undefined
    if (options?.setOrderMode === 'manifest') {
      newOrderMode = 'manifest'
    } else if (options?.setOrderMode === 'preserve') {
      newOrderMode = currentOrderMode ?? 'custom'
    } else {
      // Default: preserve current, fall back to 'custom'
      newOrderMode = currentOrderMode ?? 'custom'
    }

    const pathPatch: Partial<LearningPath> = {
      updatedAt: new Date().toISOString(),
      orderMode: newOrderMode,
      ...(options?.baseManifestHash ? { baseManifestHash: options.baseManifestHash } : {}),
    }

    // Optimistic update
    set(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...ordered],
      paths: state.paths.map(p =>
        p.id === pathId ? { ...p, ...pathPatch } as LearningPath : p
      ),
      error: null,
    }))

    try {
      await persistWithRetry(async () => {
        for (const entry of ordered) {
          await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
        }
        for (const orphanId of orphanIds) {
          await syncableWrite('learningPathEntries', 'delete', orphanId)
        }
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', {
            ...existingPath,
            ...pathPatch,
          } as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      console.error('[LearningPathStore] Failed to apply manifest order:', error)
      // F-004: Best-effort revert Dexie entries to pre-mutation values so Dexie
      // is not left in a partially-persisted inconsistent state after retry exhaustion.
      try {
        for (const entry of allEntries) {
          await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
        }
        const existingPath = await db.learningPaths.get(pathId)
        if (existingPath) {
          await syncableWrite('learningPaths', 'put', {
            ...path,
          } as unknown as SyncableRecord)
        }
      } catch (revertError) {
        console.warn('[LearningPathStore] Failed to revert Dexie entries after manifest order failure:', revertError)
      }
      set({ entries: prevEntries, paths: prevPaths, error: 'Failed to apply manifest order' })
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to apply course order: ${errorMsg}`)
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
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

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
      progressionMode: 'free',
      orderMode: 'custom',
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
        const matchTitle = extractGapSearchTerm(entry.justification)

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
          completionTarget: entry.completionTarget,
          ...entryProvenance(),
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

if (import.meta.env.DEV && typeof window !== 'undefined' && __PLAYWRIGHT_TEST__) {
  ;(
    window as unknown as { __learningPathStore__?: typeof useLearningPathStore }
  ).__learningPathStore__ = useLearningPathStore
}
