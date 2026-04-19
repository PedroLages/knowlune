import { create } from 'zustand'
import { db } from '@/db'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { appEventBus } from '@/lib/eventBus'
import {
  saveCourseThumbnail,
  loadCourseThumbnailUrl,
  deleteCourseThumbnail,
} from '@/lib/thumbnailService'
import type { ThumbnailSource } from '@/data/types'
import type { AutoAnalysisStatus } from '@/lib/autoAnalysis'
import { refreshCourseEmbeddingIfChanged } from '@/ai/courseEmbeddingService'
import { useAuthorStore } from './useAuthorStore'

function normalizeTags(tags: string[]): string[] {
  const unique = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))]
  unique.sort()
  return unique
}

export interface CourseDetailsUpdate {
  name?: string
  description?: string
  category?: string
  tags?: string[]
  authorId?: string | null // null to unlink, string to set, undefined to leave unchanged
}

interface CourseImportState {
  importedCourses: ImportedCourse[]
  isImporting: boolean
  importError: string | null
  importProgress: { current: number; total: number } | null
  thumbnailUrls: Record<string, string> // courseId → object URL
  autoAnalysisStatus: Record<string, AutoAnalysisStatus> // courseId → status

  addImportedCourse: (course: ImportedCourse) => Promise<void>
  removeImportedCourse: (courseId: string) => Promise<void>
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
  setImporting: (isImporting: boolean) => void
  setImportError: (error: string | null) => void
  setImportProgress: (progress: { current: number; total: number } | null) => void
  setAutoAnalysisStatus: (courseId: string, status: AutoAnalysisStatus) => void
}

export const useCourseImportStore = create<CourseImportState>((set, get) => ({
  importedCourses: [],
  isImporting: false,
  importError: null,
  importProgress: null,
  thumbnailUrls: {},
  autoAnalysisStatus: {},

  addImportedCourse: async (course: ImportedCourse) => {
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
        // Fetch child IDs before deletion so each gets its own queue entry
        const childVideos = await db.importedVideos.where('courseId').equals(courseId).toArray()
        const childPdfs = await db.importedPdfs.where('courseId').equals(courseId).toArray()
        for (const v of childVideos) {
          await syncableWrite('importedVideos', 'delete', v.id)
        }
        for (const p of childPdfs) {
          await syncableWrite('importedPdfs', 'delete', p.id)
        }
        await syncableWrite('importedCourses', 'delete', courseId)
        await deleteCourseThumbnail(courseId)
      })

      // Revoke thumbnail object URL to free memory
      const { thumbnailUrls } = get()
      if (thumbnailUrls[courseId]) {
        URL.revokeObjectURL(thumbnailUrls[courseId])
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
        await syncableWrite('importedCourses', 'put', { ...current, tags: normalized } as unknown as SyncableRecord)
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
        await syncableWrite('importedCourses', 'put', { ...current, status } as unknown as SyncableRecord)
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
    if (normalizedTags !== undefined) patch.tags = normalizedTags
    if (details.authorId !== undefined) patch.authorId = details.authorId ?? undefined

    // Optimistic update
    set(state => ({
      importedCourses: state.importedCourses.map(c => (c.id === courseId ? { ...c, ...patch } : c)),
      importError: null,
    }))

    try {
      await persistWithRetry(async () => {
        const current = await db.importedCourses.get(courseId)
        if (!current) return
        await syncableWrite('importedCourses', 'put', { ...current, ...patch } as unknown as SyncableRecord)
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
    set(state => ({
      thumbnailUrls: { ...state.thumbnailUrls, [courseId]: url },
    }))
  },

  loadThumbnailUrls: async (courseIds: string[]) => {
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
    const urls: Record<string, string> = {}
    for (const [id, url] of entries) {
      if (url) urls[id] = url
    }
    set({ thumbnailUrls: urls })
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
      const courses = await db.importedCourses.toArray()
      set({ importedCourses: courses, importError: null })
      // Load thumbnail object URLs in parallel (non-blocking)
      get()
        .loadThumbnailUrls(courses.map(c => c.id))
        .catch((err: unknown) => {
          console.warn(
            '[Thumbnail] Failed to load course thumbnails:',
            err instanceof Error ? err.message : err
          )
        })
    } catch (error) {
      set({ importError: 'Failed to load courses from database' })
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
