import { create } from 'zustand'
import { db } from '@/db'
import type { Difficulty, ImportedCourse, LearnerCourseStatus } from '@/data/types'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { appEventBus } from '@/lib/eventBus'
import {
  saveCourseThumbnail,
  loadCourseThumbnailUrl,
  deleteCourseThumbnail,
} from '@/lib/thumbnailService'
import { deleteVideoStoryboardsForCourse } from '@/lib/videoStoryboard'
import type { ThumbnailSource } from '@/data/types'
import { findCourseThumbnailRepair, toCourseThumbnailRecord } from '@/lib/courseThumbnailRepair'
import type { AutoAnalysisStatus } from '@/lib/autoAnalysis'
import { refreshCourseEmbeddingIfChanged } from '@/ai/courseEmbeddingService'
import { useAuthorStore } from './useAuthorStore'
import { toast } from 'sonner'
import { toastWithUndo } from '@/lib/toastHelpers'
import { TOAST_DURATION } from '@/lib/toastConfig'
import { syncCoordinator } from '@/lib/sync/syncCoordinator'

function normalizeTags(tags: string[]): string[] {
  const unique = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))]
  unique.sort()
  return unique
}

// Course loading can be triggered by several route-level surfaces at once.
// Keep background thumbnail repair idempotent so repeated loads do not race
// to create duplicate object URLs or queue duplicate sync writes.
const thumbnailRepairsInFlight = new Set<string>()
const deferredThumbnailRepairIds = new Set<string>()
let deferredThumbnailRepairUnsubscribe: (() => void) | null = null

function deferThumbnailRepair(courseIds: string[]): void {
  courseIds.forEach(id => deferredThumbnailRepairIds.add(id))
  if (deferredThumbnailRepairUnsubscribe) return

  deferredThumbnailRepairUnsubscribe = syncCoordinator.subscribeInitialUpload(() => {
    if (syncCoordinator.isInitialUploadActive) return
    const queuedIds = [...deferredThumbnailRepairIds]
    deferredThumbnailRepairIds.clear()
    deferredThumbnailRepairUnsubscribe?.()
    deferredThumbnailRepairUnsubscribe = null
    if (queuedIds.length > 0) {
      void useCourseImportStore.getState().repairMissingThumbnails(queuedIds)
    }
  })
}

export interface CourseDetailsUpdate {
  name?: string
  description?: string
  category?: string
  difficulty?: Difficulty | null
  tags?: string[]
  authorId?: string | null // null to unlink, string to set, undefined to leave unchanged
  sourceDriveId?: string // Google Drive folder ID for Drive-imported courses (E77b-S02)
}

interface CourseImportState {
  importedCourses: ImportedCourse[]
  isCoursesLoaded: boolean
  isImporting: boolean
  importError: string | null
  importProgress: { current: number; total: number } | null
  thumbnailUrls: Record<string, string> // courseId → object URL
  autoAnalysisStatus: Record<string, AutoAnalysisStatus> // courseId → status

  addImportedCourse: (
    course: ImportedCourse
  ) => Promise<{ error?: { code: string; modality: string } }>
  removeImportedCourse: (courseId: string) => Promise<void>
  removeImportedCourses: (courseIds: string[]) => Promise<void>
  updateCourseTags: (courseId: string, tags: string[]) => Promise<void>
  updateCourseStatus: (courseId: string, status: LearnerCourseStatus) => Promise<void>
  updateCourseDetails: (courseId: string, details: CourseDetailsUpdate) => Promise<boolean>
  updateCourseThumbnail: (courseId: string, blob: Blob, source: ThumbnailSource) => Promise<void>
  getAllTags: () => string[]
  getTagsWithCounts: () => { tag: string; count: number }[]
  renameTagGlobally: (oldTag: string, newTag: string) => Promise<'renamed' | 'merged'>
  deleteTagGlobally: (tag: string) => Promise<void>
  loadImportedCourses: () => Promise<void>
  loadThumbnailUrls: (courseIds: string[]) => Promise<void>
  repairMissingThumbnails: (courseIds: string[]) => Promise<void>
  setImporting: (isImporting: boolean) => void
  setImportError: (error: string | null) => void
  setImportProgress: (progress: { current: number; total: number } | null) => void
  setAutoAnalysisStatus: (courseId: string, status: AutoAnalysisStatus) => void
}

export const useCourseImportStore = create<CourseImportState>((set, get) => ({
  importedCourses: [],
  isCoursesLoaded: false,
  isImporting: false,
  importError: null,
  importProgress: null,
  thumbnailUrls: {},
  autoAnalysisStatus: {},

  addImportedCourse: async (course: ImportedCourse) => {
    // Guest cap: 1 course per guest session
    if (selectIsGuestMode(useAuthStore.getState())) {
      const guestSessionId = sessionStorage.getItem('knowlune-guest-id')
      const existing = await db.importedCourses
        .filter(r => r.userId === null && r.guestSessionId === guestSessionId)
        .count()
      if (existing >= 1) return { error: { code: 'GUEST_CAP_EXCEEDED', modality: 'course' } }
    }

    // Optimistic update
    set(state => ({
      importedCourses: [...state.importedCourses, course],
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
      })

      // E43-S07: Emit import-finished event for notification
      const lessonCount = (course.videoCount ?? 0) + (course.pdfCount ?? 0)
      appEventBus.emit({
        type: 'import:finished',
        courseId: course.id,
        courseName: course.name,
        lessonCount,
      })
    } catch (error) {
      // Rollback on failure
      set(state => ({
        importedCourses: state.importedCourses.filter(c => c.id !== course.id),
        importError: `Failed to save course: ${course.name}`,
      }))
      console.error('[Database] Failed to persist course:', error)
    }
    return {}
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
        // Fetch child IDs in parallel, then delete all records concurrently.
        // Independent IDs = no write conflicts; parallising cuts per-course wall-clock ~4×.
        const [childVideos, childPdfs] = await Promise.all([
          db.importedVideos.where('courseId').equals(courseId).toArray(),
          db.importedPdfs.where('courseId').equals(courseId).toArray(),
        ])
        const videoDeletes = childVideos.map(v => syncableWrite('importedVideos', 'delete', v.id))
        const pdfDeletes = childPdfs.map(p => syncableWrite('importedPdfs', 'delete', p.id))
        await Promise.all([
          ...videoDeletes,
          ...pdfDeletes,
          syncableWrite('importedCourses', 'delete', courseId),
          deleteCourseThumbnail(courseId),
          deleteVideoStoryboardsForCourse(courseId),
        ])
      })

      // Revoke thumbnail object URL to free memory
      const { thumbnailUrls } = get()
      if (thumbnailUrls[courseId]) {
        if (thumbnailUrls[courseId].startsWith('blob:')) {
          URL.revokeObjectURL(thumbnailUrls[courseId])
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [courseId]: _removed, ...rest } = thumbnailUrls
        set({ thumbnailUrls: rest })
      }

      // Clean up orphaned author (best-effort — course deletion already succeeded)
      if (courseToRemove?.authorId) {
        try {
          const authorStore = useAuthorStore.getState()
          await authorStore.unlinkCourseFromAuthor(courseToRemove.authorId, courseId)
          const author = authorStore.getAuthorById(courseToRemove.authorId)
          if (author && author.courseIds.length === 0 && !author.isPreseeded) {
            await authorStore.deleteAuthor(courseToRemove.authorId, { silent: true })
          }
        } catch (authorError) {
          console.error('[Database] Failed to clean up orphaned author:', authorError)
        }
      }
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

  removeImportedCourses: async (courseIds: string[]) => {
    const { importedCourses } = get()
    // Capture snapshot for undo — full ImportedCourse records for each requested ID
    const snapshot = courseIds
      .map(id => importedCourses.find(c => c.id === id))
      .filter((c): c is ImportedCourse => c !== undefined)

    const deleted: ImportedCourse[] = []
    const failed: { id: string; name: string }[] = []

    // Batch deletion with concurrency limit — each removeImportedCourse
    // handles its own optimistic removal and rollback. Detect failure by
    // checking if the course still exists in Zustand after the batch resolves.
    const CONCURRENCY = 3
    for (let i = 0; i < courseIds.length; i += CONCURRENCY) {
      const batch = courseIds.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(id => get().removeImportedCourse(id)))

      for (const id of batch) {
        const stillExists = get().importedCourses.find(c => c.id === id)
        if (stillExists) {
          failed.push({ id, name: stillExists.name })
        } else {
          const course = snapshot.find(c => c.id === id)
          if (course) deleted.push(course)
        }
      }
    }

    // Undo toast for successful deletions (8s window)
    if (deleted.length > 0) {
      toastWithUndo({
        message: `${deleted.length} ${deleted.length === 1 ? 'course' : 'courses'} deleted`,
        onUndo: async () => {
          for (const course of deleted) {
            await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
          }
          set(state => ({
            importedCourses: [...deleted, ...state.importedCourses],
          }))
          toast.success(`${deleted.length} ${deleted.length === 1 ? 'course' : 'courses'} restored`)
        },
        duration: TOAST_DURATION.LONG,
      })
    }

    // Error toast for any failures
    if (failed.length > 0) {
      const names = failed.map(f => f.name)
      toast.error(
        `Failed to delete ${failed.length} ${failed.length === 1 ? 'course' : 'courses'}: ${names.join(', ')}`
      )
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
        const current = await db.importedCourses.get(courseId)
        if (!current) return
        await syncableWrite('importedCourses', 'put', {
          ...current,
          tags: normalized,
        } as unknown as SyncableRecord)
      })
      // Refresh embedding after successful tag update (fire-and-forget, E52-S04)
      const updated = get().importedCourses.find(c => c.id === courseId)
      if (updated) {
        refreshCourseEmbeddingIfChanged(updated).catch(() => {
          // silent-catch-ok: embedding failure logged inside refreshCourseEmbeddingIfChanged
        })
      }
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
        const current = await db.importedCourses.get(courseId)
        if (!current) return
        await syncableWrite('importedCourses', 'put', {
          ...current,
          status,
        } as unknown as SyncableRecord)
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

  updateCourseDetails: async (courseId: string, details: CourseDetailsUpdate) => {
    const { importedCourses } = get()
    const course = importedCourses.find(c => c.id === courseId)
    if (!course) return false

    const oldCourse = structuredClone(course)
    const normalizedTags = details.tags ? normalizeTags(details.tags) : undefined
    const patch: Partial<ImportedCourse> = {}
    if (details.name !== undefined) patch.name = details.name.trim()
    if (details.description !== undefined)
      patch.description = details.description.trim() || undefined
    if (details.category !== undefined) patch.category = details.category.trim()
    if (details.difficulty !== undefined) patch.difficulty = details.difficulty ?? undefined
    if (normalizedTags !== undefined) patch.tags = normalizedTags
    if (details.authorId !== undefined) patch.authorId = details.authorId ?? undefined
    if (details.sourceDriveId !== undefined) patch.sourceDriveId = details.sourceDriveId

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c => (c.id === courseId ? { ...c, ...patch } : c)),
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        const current = await db.importedCourses.get(courseId)
        if (!current) return
        await syncableWrite('importedCourses', 'put', {
          ...current,
          ...patch,
        } as unknown as SyncableRecord)
      })
      // Refresh embedding after successful metadata update (fire-and-forget, E52-S04)
      const updated = get().importedCourses.find(c => c.id === courseId)
      if (updated) {
        refreshCourseEmbeddingIfChanged(updated).catch(() => {
          // silent-catch-ok: embedding failure logged inside refreshCourseEmbeddingIfChanged
        })
      }
      return true
    } catch (error) {
      // Rollback on failure
      set(state => ({
        importedCourses: state.importedCourses.map(c => (c.id === courseId ? oldCourse : c)),
        importError: `Failed to update course details`,
      }))
      console.error('[Database] Failed to update course details:', error)
      return false
    }
  },

  updateCourseThumbnail: async (courseId: string, blob: Blob, source: ThumbnailSource) => {
    await saveCourseThumbnail(courseId, blob, source)
    const url = URL.createObjectURL(blob)
    const previousUrl = get().thumbnailUrls[courseId]
    if (previousUrl?.startsWith('blob:') && previousUrl !== url) {
      URL.revokeObjectURL(previousUrl)
    }
    set(state => ({
      thumbnailUrls: { ...state.thumbnailUrls, [courseId]: url },
    }))

    // Touch the course row so the existing storage-sync handler uploads the
    // newly saved blob. The local thumbnail remains usable if cloud sync is
    // temporarily unavailable.
    try {
      const course = await db.importedCourses.get(courseId)
      if (course) {
        await syncableWrite('importedCourses', 'put', course as unknown as SyncableRecord)
      }
    } catch (error) {
      console.warn('[Thumbnail] Saved locally but could not queue cloud sync:', error)
      toast.warning('Cover saved on this device; cloud sync will retry later.')
    }
  },

  loadThumbnailUrls: async (courseIds: string[]) => {
    const urlsAtStart = get().thumbnailUrls
    const entries = await Promise.all(
      courseIds.map(async id => {
        try {
          const url = await loadCourseThumbnailUrl(id)
          return [id, url] as [string, string | null]
        } catch (err) {
          console.warn(
            `[Thumbnail] Failed to load thumbnail for course ${id}:`,
            err instanceof Error ? err.message : err
          )
          return [id, null] as [string, string | null]
        }
      })
    )
    set(state => {
      const urls = { ...state.thumbnailUrls }
      for (const [id, url] of entries) {
        const currentUrl = state.thumbnailUrls[id]
        if (currentUrl !== urlsAtStart[id]) {
          if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
          continue
        }

        if (currentUrl?.startsWith('blob:') && currentUrl !== url) {
          URL.revokeObjectURL(currentUrl)
        }
        if (url) urls[id] = url
        else delete urls[id]
      }
      return { thumbnailUrls: urls }
    })
  },

  repairMissingThumbnails: async (courseIds: string[]) => {
    const courses = get().importedCourses.filter(course => courseIds.includes(course.id))
    const concurrency = 2

    for (let index = 0; index < courses.length; index += concurrency) {
      const batch = courses.slice(index, index + concurrency)
      await Promise.all(
        batch.map(async course => {
          if (thumbnailRepairsInFlight.has(course.id)) return
          thumbnailRepairsInFlight.add(course.id)

          try {
            const repair = await findCourseThumbnailRepair(course)
            if (!repair) return

            const record = toCourseThumbnailRecord(course.id, repair, new Date().toISOString())
            await db.courseThumbnails.put(record)

            const url = record.blob ? URL.createObjectURL(record.blob) : record.remoteUrl
            const previousUrl = get().thumbnailUrls[course.id]
            if (previousUrl?.startsWith('blob:') && previousUrl !== url) {
              URL.revokeObjectURL(previousUrl)
            }
            set(state => ({
              thumbnailUrls: { ...state.thumbnailUrls, [course.id]: url },
            }))

            const currentCourse = await db.importedCourses.get(course.id)
            if (currentCourse) {
              // Remote YouTube fallbacks cannot be uploaded to the thumbnail
              // bucket. Persist the URL on the course itself so other devices
              // can render the recovered cover without a local blob record.
              const courseForSync =
                repair.kind === 'remote'
                  ? { ...currentCourse, youtubeThumbnailUrl: repair.url }
                  : currentCourse
              if (repair.kind === 'remote') {
                set(state => ({
                  importedCourses: state.importedCourses.map(item =>
                    item.id === course.id ? courseForSync : item
                  ),
                }))
              }
              await syncableWrite(
                'importedCourses',
                'put',
                courseForSync as unknown as SyncableRecord
              )
            }
          } catch (error) {
            // Repair is intentionally best-effort. The shared card surface
            // exposes the Add cover action when no candidate is recoverable.
            console.warn(`[Thumbnail] Could not repair course "${course.name}":`, error)
          } finally {
            thumbnailRepairsInFlight.delete(course.id)
          }
        })
      )
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

  getTagsWithCounts: () => {
    const { importedCourses } = get()
    const counts = new Map<string, number>()
    for (const course of importedCourses) {
      for (const tag of course.tags) {
        const normalized = tag.trim().toLowerCase()
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag))
  },

  renameTagGlobally: async (oldTag: string, newTag: string) => {
    const normalizedOld = oldTag.trim().toLowerCase()
    const normalizedNew = newTag.trim().toLowerCase()
    if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return 'renamed'

    const { importedCourses } = get()
    const existingTags = new Set<string>()
    for (const course of importedCourses) {
      for (const tag of course.tags) existingTags.add(tag.trim().toLowerCase())
    }
    const isMerge = existingTags.has(normalizedNew)

    // Find courses that have the old tag
    const affectedCourses = importedCourses.filter(c =>
      c.tags.some(t => t.trim().toLowerCase() === normalizedOld)
    )
    if (affectedCourses.length === 0) return 'renamed'

    // Build updated courses
    const updatedCourses = affectedCourses.map(course => {
      const newTags = course.tags.map(t =>
        t.trim().toLowerCase() === normalizedOld ? normalizedNew : t
      )
      return { ...course, tags: normalizeTags(newTags) }
    })

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c => {
        const updated = updatedCourses.find(u => u.id === c.id)
        return updated ?? c
      }),
    }))

    try {
      await persistWithRetry(async () => {
        // Sequential syncableWrite per course — loses transaction atomicity but
        // gains per-record queue entries (E94-S02 tradeoff, see plan §Key Technical Decisions)
        for (const course of updatedCourses) {
          await syncableWrite('importedCourses', 'put', course as unknown as SyncableRecord)
        }
      })
      return isMerge ? 'merged' : 'renamed'
    } catch (error) {
      // Rollback
      set(state => ({
        importedCourses: state.importedCourses.map(c => {
          const original = affectedCourses.find(o => o.id === c.id)
          return original ?? c
        }),
        importError: 'Failed to rename tag',
      }))
      console.error('[Database] Failed to rename tag globally:', error)
      return 'renamed'
    }
  },

  deleteTagGlobally: async (tag: string) => {
    const normalized = tag.trim().toLowerCase()
    if (!normalized) return

    const { importedCourses } = get()
    const affectedCourses = importedCourses.filter(c =>
      c.tags.some(t => t.trim().toLowerCase() === normalized)
    )
    if (affectedCourses.length === 0) return

    const updatedCourses = affectedCourses.map(course => ({
      ...course,
      tags: course.tags.filter(t => t.trim().toLowerCase() !== normalized),
    }))

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c => {
        const updated = updatedCourses.find(u => u.id === c.id)
        return updated ?? c
      }),
    }))

    try {
      await persistWithRetry(async () => {
        // Sequential syncableWrite per course — loses transaction atomicity but
        // gains per-record queue entries (E94-S02 tradeoff, see plan §Key Technical Decisions)
        for (const course of updatedCourses) {
          await syncableWrite('importedCourses', 'put', course as unknown as SyncableRecord)
        }
      })
    } catch (error) {
      // Rollback
      set(state => ({
        importedCourses: state.importedCourses.map(c => {
          const original = affectedCourses.find(o => o.id === c.id)
          return original ?? c
        }),
        importError: 'Failed to delete tag',
      }))
      console.error('[Database] Failed to delete tag globally:', error)
    }
  },

  loadImportedCourses: async () => {
    try {
      const authState = useAuthStore.getState()
      const isGuest = selectIsGuestMode(authState)
      const guestSessionId = isGuest ? sessionStorage.getItem('knowlune-guest-id') : null
      const allCourses = await db.importedCourses.toArray()
      const courses = allCourses.filter(course => {
        // During the pre-auth boot window retain legacy local behavior. Once a
        // session is known, never render another account's IndexedDB rows.
        if (!authState.user && !isGuest) return true
        if (isGuest) return course.userId === null && course.guestSessionId === guestSessionId
        return course.userId === authState.user?.id
      })
      set({ importedCourses: courses, isCoursesLoaded: true, importError: null })
      // Load thumbnail object URLs in parallel (non-blocking)
      get()
        .loadThumbnailUrls(courses.map(c => c.id))
        .catch((err: unknown) => {
          console.warn(
            '[Thumbnail] Failed to load course thumbnails:',
            err instanceof Error ? err.message : err
          )
        })
      const courseIds = courses.map(course => course.id)
      if (syncCoordinator.isInitialUploadActive) {
        // Thumbnail discovery writes syncable course metadata. Let the bounded
        // initial-upload run finish first so its original progress cannot gain
        // new work and appear to move backwards.
        deferThumbnailRepair(courseIds)
      } else {
        void get().repairMissingThumbnails(courseIds)
      }
    } catch (error) {
      set({ isCoursesLoaded: true, importError: 'Failed to load courses from database' })
      console.error('[Database] Failed to load courses:', error)
    }
  },

  setImporting: (isImporting: boolean) => set({ isImporting }),
  setImportError: (error: string | null) => set({ importError: error }),
  setImportProgress: (progress: { current: number; total: number } | null) =>
    set({ importProgress: progress }),
  setAutoAnalysisStatus: (courseId: string, status: AutoAnalysisStatus) =>
    set(state => ({
      autoAnalysisStatus: { ...state.autoAnalysisStatus, [courseId]: status },
    })),
}))
