import { create } from 'zustand'
import { db } from '@/db'
import type { CompletionStatus, ContentProgress, Module } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { markLessonComplete, markLessonIncomplete } from '@/lib/progress'
import { appEventBus } from '@/lib/eventBus'
import { MILESTONE_THRESHOLD } from '@/services/NotificationService'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

// E92-S09: P0 contentProgress table is wired through syncableWrite.
// - syncableWrite stamps userId/updatedAt and enqueues a Supabase upload entry.
// - tableRegistry marks contentProgress with no stripFields/vaultFields (AC7),
//   so the full record is serialized to Supabase content_progress.
// - The transactional batch is replaced by a sequential loop of syncableWrite
//   calls wrapped in persistWithRetry; atomicity across the cascade is best-effort
//   (matches the pattern expected by the E92-S05 upload engine).

interface ContentProgressState {
  /** Map of `courseId:itemId` → status for fast lookups */
  statusMap: Record<string, CompletionStatus>
  isLoading: boolean
  error: string | null

  loadCourseProgress: (courseId: string) => Promise<void>
  setItemStatus: (
    courseId: string,
    itemId: string,
    status: CompletionStatus,
    modules: Module[]
  ) => Promise<void>
  getItemStatus: (courseId: string, itemId: string) => CompletionStatus
}

function key(courseId: string, itemId: string): string {
  return `${courseId}:${itemId}`
}

/**
 * Compute the derived module status from its children's statuses.
 * - All completed → completed
 * - All not-started → not-started
 * - Otherwise → in-progress
 */
function deriveModuleStatus(
  courseId: string,
  module: Module,
  statusMap: Record<string, CompletionStatus>
): CompletionStatus {
  const statuses = module.lessons.map(l => statusMap[key(courseId, l.id)] ?? 'not-started')
  if (statuses.length === 0) return 'not-started'
  if (statuses.every(s => s === 'completed')) return 'completed'
  if (statuses.every(s => s === 'not-started')) return 'not-started'
  return 'in-progress'
}

export const useContentProgressStore = create<ContentProgressState>((set, get) => ({
  statusMap: {},
  isLoading: false,
  error: null,

  loadCourseProgress: async (courseId: string) => {
    set({ isLoading: true, error: null })
    try {
      const records = await db.contentProgress.where({ courseId }).toArray()
      const { statusMap } = get()
      // Clear stale entries for this course before merging fresh records
      const prefix = `${courseId}:`
      const updated: Record<string, CompletionStatus> = {}
      for (const [k, v] of Object.entries(statusMap)) {
        if (!k.startsWith(prefix)) {
          updated[k] = v
        }
      }
      for (const record of records) {
        updated[key(record.courseId, record.itemId)] = record.status
      }
      set({ statusMap: updated, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load progress' })
      console.error('[ContentProgressStore] Failed to load:', error)
    }
  },

  setItemStatus: async (
    courseId: string,
    itemId: string,
    status: CompletionStatus,
    modules: Module[]
  ) => {
    const { statusMap } = get()
    const previousMap = { ...statusMap }
    const now = new Date().toISOString()

    // Build the new status map with the item change
    const newMap = { ...statusMap }
    newMap[key(courseId, itemId)] = status

    // Cascade: recompute parent module status for any module containing this item
    const cascadeRecords: ContentProgress[] = []
    for (const mod of modules) {
      if (mod.lessons.some(l => l.id === itemId)) {
        const moduleStatus = deriveModuleStatus(courseId, mod, newMap)
        newMap[key(courseId, mod.id)] = moduleStatus
        cascadeRecords.push({
          courseId,
          itemId: mod.id,
          status: moduleStatus,
          updatedAt: now,
        })
      }
    }

    // Optimistic update
    set({ statusMap: newMap, error: null })

    // Bridge: sync with localStorage progress for progress bar consistency
    if (status === 'completed') {
      markLessonComplete(courseId, itemId)
    } else {
      markLessonIncomplete(courseId, itemId)
    }

    try {
      await persistWithRetry(async () => {
        // E92-S09: syncableWrite stamps userId/updatedAt + enqueues upload.
        // P0 table, no stripFields. Sequential loop (chosen over a Dexie
        // transaction wrapper) because syncableWrite needs to enqueue each
        // record; keeps the call pattern consistent with E92-S05 upload engine.
        const itemRecord: ContentProgress = {
          courseId,
          itemId,
          status,
          updatedAt: now,
        }
        await syncableWrite('contentProgress', 'put', itemRecord as unknown as SyncableRecord)
        for (const record of cascadeRecords) {
          await syncableWrite('contentProgress', 'put', record as unknown as SyncableRecord)
        }
      })

      // E60-S03 + E43-S07: Side-effect checks (notification triggers)
      // Resolve course once and share between both checks
      if (status === 'completed' && modules.length > 0) {
        const course = await db.importedCourses.get(courseId)
        const courseName = course?.name ?? 'Unknown Course'

        // E60-S03: Check if course is approaching completion (milestone trigger)
        try {
          const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
          const completedLessons = modules.reduce(
            (sum, m) =>
              sum + m.lessons.filter(l => newMap[key(courseId, l.id)] === 'completed').length,
            0
          )
          const remaining = totalLessons - completedLessons
          if (remaining > 0 && remaining <= MILESTONE_THRESHOLD) {
            appEventBus.emit({
              type: 'milestone:approaching',
              courseId,
              courseName,
              remainingLessons: remaining,
              totalLessons,
            })
          }
        } catch (milestoneError) {
          // silent-catch-ok: notification side-effect should not roll back progress
          console.error('[ContentProgressStore] Milestone check failed:', milestoneError)
        }

        // E43-S07: Check if all modules are now completed (course finished)
        const allModulesComplete = modules.every(
          mod => newMap[key(courseId, mod.id)] === 'completed'
        )
        if (allModulesComplete) {
          appEventBus.emit({
            type: 'course:completed',
            courseId,
            courseName,
          })
        }
      }
    } catch (error) {
      // Rollback on failure (both Zustand and localStorage)
      set({ statusMap: previousMap, error: 'Failed to save progress' })
      if (status === 'completed') {
        markLessonIncomplete(courseId, itemId)
      } else {
        markLessonComplete(courseId, itemId)
      }
      console.error('[ContentProgressStore] Failed to persist:', error)
    }
  },

  getItemStatus: (courseId: string, itemId: string): CompletionStatus => {
    return get().statusMap[key(courseId, itemId)] ?? 'not-started'
  },
}))
