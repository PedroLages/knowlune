import { useState, useEffect, useCallback } from 'react'
import { db } from '@/db'
import { getAllProgress, PROGRESS_UPDATED_EVENT } from '@/lib/progress'
import type { LearningPathEntry } from '@/data/types'

const MINUTES_PER_LESSON = 15

export interface CourseProgressInfo {
  courseId: string
  completedLessons: number
  totalLessons: number
  completionPct: number
  /** Full course lesson count (always videoCount, never target-capped). */
  absoluteTotalLessons: number
  /** Completion percentage based on absolute lesson count. */
  absoluteCompletionPct: number
}

export interface PathProgressSummary {
  /** Aggregate completion across all courses in the path */
  completionPct: number
  /** Total completed lessons across all courses */
  completedLessons: number
  /** Total lessons across all courses */
  totalLessons: number
  /** Number of courses fully completed (100%) */
  completedCourses: number
  /** Total courses in the path */
  totalCourses: number
  /** Estimated remaining hours based on incomplete lessons */
  estimatedRemainingHours: number
  /** Per-course progress info */
  courseProgress: Map<string, CourseProgressInfo>
}

const EMPTY_SUMMARY: PathProgressSummary = {
  completionPct: 0,
  completedLessons: 0,
  totalLessons: 0,
  completedCourses: 0,
  totalCourses: 0,
  estimatedRemainingHours: 0,
  courseProgress: new Map(),
}

/**
 * Compute progress for all courses in a learning path.
 *
 * Handles two progress sources:
 * - **Catalog courses**: Uses `contentProgress` Dexie store (lesson-level completion status)
 * - **Imported courses**: Uses `progress` Dexie table (VideoProgress with completionPercentage)
 *   and falls back to localStorage `course-progress` for pre-seeded data
 *
 * Reactively updates when progress changes via the `course-progress-updated` custom event.
 */
export function usePathProgress(entries: LearningPathEntry[]): PathProgressSummary {
  const [summary, setSummary] = useState<PathProgressSummary>(EMPTY_SUMMARY)

  const computeProgress = useCallback(async () => {
    if (entries.length === 0) {
      setSummary(EMPTY_SUMMARY)
      return
    }

    const courseProgress = new Map<string, CourseProgressInfo>()
    let totalCompletedLessons = 0
    let totalLessonsCount = 0
    let completedCoursesCount = 0

    // Separate entries by course type
    const catalogEntries = entries.filter(e => e.courseType === 'catalog')
    const importedEntries = entries.filter(e => e.courseType === 'imported')

    // --- Catalog courses: table dropped in E89-S01 ---
    // Catalog entries still tracked by courseId, but with 0 progress (no course metadata available)
    if (catalogEntries.length > 0) {
      for (const entry of catalogEntries) {
        courseProgress.set(entry.courseId, {
          courseId: entry.courseId,
          completedLessons: 0,
          totalLessons: 0,
          completionPct: 0,
          absoluteTotalLessons: 0,
          absoluteCompletionPct: 0,
        })
      }
    }

    // --- Imported courses: use progress table + localStorage fallback ---
    let importedMap = new Map<string, any>()
    let videoProgress: any[] = []
    let localProgress: Record<string, any> = {}

    if (importedEntries.length > 0) {
      const importedCourseIds = importedEntries.map(e => e.courseId)

      // Load imported course metadata for video count (= lesson count)
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      const importedCourses = await db.importedCourses
        .where('id')
        .anyOf(importedCourseIds)
        .toArray()
        .catch(() => [])

      importedMap = new Map(importedCourses.map(c => [c.id, c]))

      // Load video progress from Dexie
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      videoProgress = await db.progress
        .where('courseId')
        .anyOf(importedCourseIds)
        .toArray()
        .catch(() => [])

      // Also check localStorage progress (pre-seeded/legacy)
      localProgress = getAllProgress()

      for (const entry of importedEntries) {
        const importedCourse = importedMap.get(entry.courseId)
        const absoluteTotalLessons = importedCourse?.videoCount ?? 0

        // Count completed videos from Dexie progress table
        const completedFromDexie = videoProgress.filter(
          vp => vp.courseId === entry.courseId && vp.completedAt
        ).length

        // Count completed from localStorage
        const localCourseProgress = localProgress[entry.courseId]
        const completedFromLocal = localCourseProgress?.completedLessons?.length ?? 0

        // Raw absolute completed (clamped to actual course length)
        const absoluteCompleted = Math.min(
          Math.max(completedFromDexie, completedFromLocal),
          absoluteTotalLessons
        )

        // Compute target-capped denominator
        const targetLessonCount = entry.completionTarget?.targetLessonCount
        let targetTotal: number
        if (targetLessonCount != null && targetLessonCount >= 1) {
          targetTotal = Math.min(targetLessonCount, absoluteTotalLessons)
        } else {
          targetTotal = absoluteTotalLessons
        }

        // Clamp completed to target (can't exceed target)
        const clampedCompleted = Math.min(absoluteCompleted, targetTotal)

        const completionPct =
          targetTotal > 0 ? Math.round((clampedCompleted / targetTotal) * 100) : 0
        const absoluteCompletionPct =
          absoluteTotalLessons > 0
            ? Math.round((absoluteCompleted / absoluteTotalLessons) * 100)
            : 0

        courseProgress.set(entry.courseId, {
          courseId: entry.courseId,
          completedLessons: clampedCompleted,
          totalLessons: targetTotal,
          completionPct,
          absoluteTotalLessons,
          absoluteCompletionPct,
        })

        totalCompletedLessons += clampedCompleted
        totalLessonsCount += targetTotal
        if (targetTotal > 0 && clampedCompleted >= targetTotal) {
          completedCoursesCount++
        }
      }
    }

    const clampedRemaining = Math.max(0, totalLessonsCount - totalCompletedLessons)
    const overallPct =
      totalLessonsCount > 0 ? Math.round((totalCompletedLessons / totalLessonsCount) * 100) : 0
    const estimatedRemainingHours =
      Math.round(((clampedRemaining * MINUTES_PER_LESSON) / 60) * 10) / 10

    setSummary({
      completionPct: overallPct,
      completedLessons: totalCompletedLessons,
      totalLessons: totalLessonsCount,
      completedCourses: completedCoursesCount,
      totalCourses: entries.length,
      estimatedRemainingHours,
      courseProgress,
    })
  }, [entries])

  // Initial computation and reactive updates
  useEffect(() => {
    computeProgress()

    // Listen for localStorage progress changes (pre-seeded courses)
    const handleProgressUpdate = () => {
      computeProgress()
    }

    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
    window.addEventListener('storage', handleProgressUpdate)

    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
      window.removeEventListener('storage', handleProgressUpdate)
    }
  }, [computeProgress])

  return summary
}

/**
 * Compute progress for multiple paths at once (for list view).
 * Returns a map of pathId → PathProgressSummary.
 */
export function useMultiPathProgress(
  pathEntries: Map<string, LearningPathEntry[]>
): Map<string, PathProgressSummary> {
  const [summaries, setSummaries] = useState<Map<string, PathProgressSummary>>(new Map())

  const computeAll = useCallback(async () => {
    const result = new Map<string, PathProgressSummary>()

    // Collect all unique course IDs across all paths
    const allEntries = Array.from(pathEntries.values()).flat()
    if (allEntries.length === 0) {
      setSummaries(result)
      return
    }

    const catalogEntries = allEntries.filter(e => e.courseType === 'catalog')
    const importedEntries = allEntries.filter(e => e.courseType === 'imported')

    // Batch load all data once
    const importedCourseIds = [...new Set(importedEntries.map(e => e.courseId))]

    // Catalog courses table dropped (E89-S01) — skip catalog DB queries
    const [importedCourses, videoProgress] = await Promise.all([
      importedCourseIds.length > 0
        ? // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
          db.importedCourses
            .where('id')
            .anyOf(importedCourseIds)
            .toArray()
            .catch(() => [])
        : Promise.resolve([]),
      importedCourseIds.length > 0
        ? // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
          db.progress
            .where('courseId')
            .anyOf(importedCourseIds)
            .toArray()
            .catch(() => [])
        : Promise.resolve([]),
    ])

    const importedCourseMap = new Map(importedCourses.map(c => [c.id, c]))
    const localProgress = importedCourseIds.length > 0 ? getAllProgress() : {}

    // Build per-course progress lookup with composite key (pathId:courseId)
    // to support per-path completionTarget variance (R7).
    const courseProgressLookup = new Map<string, CourseProgressInfo>()

    // Catalog courses — table dropped (E89-S01), report 0 progress
    for (const entry of catalogEntries) {
      const key = entry.pathId + ':' + entry.courseId
      courseProgressLookup.set(key, {
        courseId: entry.courseId,
        completedLessons: 0,
        totalLessons: 0,
        completionPct: 0,
        absoluteTotalLessons: 0,
        absoluteCompletionPct: 0,
      })
    }

    // Imported courses — aggregate per entry to apply per-path completionTarget
    const rawCourseCache = new Map<string, { absoluteTotal: number; absoluteCompleted: number }>()
    for (const entry of importedEntries) {
      // Cache raw absolute data per courseId (avoid redundant DB lookups)
      if (!rawCourseCache.has(entry.courseId)) {
        const ic = importedCourseMap.get(entry.courseId)
        const absoluteTotal = ic?.videoCount ?? 0
        const completedFromDexie = videoProgress.filter(
          vp => vp.courseId === entry.courseId && vp.completedAt
        ).length
        const localCp = localProgress[entry.courseId]
        const completedFromLocal = localCp?.completedLessons?.length ?? 0
        const absoluteCompleted = Math.min(
          Math.max(completedFromDexie, completedFromLocal),
          absoluteTotal
        )
        rawCourseCache.set(entry.courseId, { absoluteTotal, absoluteCompleted })
      }

      const { absoluteTotal, absoluteCompleted } = rawCourseCache.get(entry.courseId)!

      // Apply per-path completionTarget
      const targetLessonCount = entry.completionTarget?.targetLessonCount
      let targetTotal: number
      if (targetLessonCount != null && targetLessonCount >= 1) {
        targetTotal = Math.min(targetLessonCount, absoluteTotal)
      } else {
        targetTotal = absoluteTotal
      }

      const clampedCompleted = Math.min(absoluteCompleted, targetTotal)
      const completionPct =
        targetTotal > 0 ? Math.round((clampedCompleted / targetTotal) * 100) : 0
      const absoluteCompletionPct =
        absoluteTotal > 0 ? Math.round((absoluteCompleted / absoluteTotal) * 100) : 0

      const key = entry.pathId + ':' + entry.courseId
      courseProgressLookup.set(key, {
        courseId: entry.courseId,
        completedLessons: clampedCompleted,
        totalLessons: targetTotal,
        completionPct,
        absoluteTotalLessons: absoluteTotal,
        absoluteCompletionPct,
      })
    }

    // Aggregate per path
    for (const [pathId, entries] of pathEntries) {
      if (entries.length === 0) {
        result.set(pathId, EMPTY_SUMMARY)
        continue
      }

      let totalCompleted = 0
      let totalLessons = 0
      let completedCourses = 0
      const pathCourseProgress = new Map<string, CourseProgressInfo>()

      for (const entry of entries) {
        const key = pathId + ':' + entry.courseId
        const cp = courseProgressLookup.get(key)
        if (cp) {
          pathCourseProgress.set(entry.courseId, cp)
          totalCompleted += cp.completedLessons
          totalLessons += cp.totalLessons
          if (cp.totalLessons > 0 && cp.completedLessons >= cp.totalLessons) {
            completedCourses++
          }
        } else {
          pathCourseProgress.set(entry.courseId, {
            courseId: entry.courseId,
            completedLessons: 0,
            totalLessons: 0,
            completionPct: 0,
            absoluteTotalLessons: 0,
            absoluteCompletionPct: 0,
          })
        }
      }

      const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0
      const clampedRemaining = Math.max(0, totalLessons - totalCompleted)
      const estimatedRemainingHours =
        Math.round(((clampedRemaining * MINUTES_PER_LESSON) / 60) * 10) / 10

      result.set(pathId, {
        completionPct: overallPct,
        completedLessons: totalCompleted,
        totalLessons,
        completedCourses,
        totalCourses: entries.length,
        estimatedRemainingHours,
        courseProgress: pathCourseProgress,
      })
    }

    setSummaries(result)
  }, [pathEntries])

  useEffect(() => {
    computeAll()

    const handleUpdate = () => {
      computeAll()
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [computeAll])

  return summaries
}
