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

    // --- Catalog courses: use contentProgress + course metadata ---
    if (catalogEntries.length > 0) {
      const catalogCourseIds = catalogEntries.map(e => e.courseId)

      // Load catalog course metadata for totalLessons count
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      const catalogCourses = await db.courses
        .where('id')
        .anyOf(catalogCourseIds)
        .toArray()
        .catch(() => [])

      const courseMap = new Map(catalogCourses.map(c => [c.id, c]))

      // Load contentProgress records for these courses
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      const allContentProgress = await db.contentProgress
        .where('courseId')
        .anyOf(catalogCourseIds)
        .toArray()
        .catch(() => [])

      // Group by courseId and count completed lessons (not modules)
      for (const entry of catalogEntries) {
        const course = courseMap.get(entry.courseId)
        const totalLessons = course
          ? course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
          : 0

        // Get all lesson IDs for this course to only count lesson-level progress
        const lessonIds = new Set(course?.modules.flatMap(m => m.lessons.map(l => l.id)) ?? [])

        const completedLessons = allContentProgress.filter(
          cp =>
            cp.courseId === entry.courseId && cp.status === 'completed' && lessonIds.has(cp.itemId)
        ).length

        const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

        courseProgress.set(entry.courseId, {
          courseId: entry.courseId,
          completedLessons,
          totalLessons,
          completionPct: pct,
        })

        totalCompletedLessons += completedLessons
        totalLessonsCount += totalLessons
        if (totalLessons > 0 && completedLessons >= totalLessons) {
          completedCoursesCount++
        }
      }
    }

    // --- Imported courses: use progress table + localStorage fallback ---
    if (importedEntries.length > 0) {
      const importedCourseIds = importedEntries.map(e => e.courseId)

      // Load imported course metadata for video count (= lesson count)
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      const importedCourses = await db.importedCourses
        .where('id')
        .anyOf(importedCourseIds)
        .toArray()
        .catch(() => [])

      const importedMap = new Map(importedCourses.map(c => [c.id, c]))

      // Load video progress from Dexie
      // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
      const videoProgress = await db.progress
        .where('courseId')
        .anyOf(importedCourseIds)
        .toArray()
        .catch(() => [])

      // Also check localStorage progress (pre-seeded/legacy)
      const localProgress = getAllProgress()

      for (const entry of importedEntries) {
        const importedCourse = importedMap.get(entry.courseId)
        const totalLessons = importedCourse?.videoCount ?? 0

        // Count completed videos from Dexie progress table
        const completedFromDexie = videoProgress.filter(
          vp => vp.courseId === entry.courseId && vp.completedAt
        ).length

        // Count completed from localStorage
        const localCourseProgress = localProgress[entry.courseId]
        const completedFromLocal = localCourseProgress?.completedLessons?.length ?? 0

        // Take the higher of the two sources (they may overlap)
        const completedLessons = Math.min(
          Math.max(completedFromDexie, completedFromLocal),
          totalLessons
        )

        const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

        courseProgress.set(entry.courseId, {
          courseId: entry.courseId,
          completedLessons,
          totalLessons,
          completionPct: pct,
        })

        totalCompletedLessons += completedLessons
        totalLessonsCount += totalLessons
        if (totalLessons > 0 && completedLessons >= totalLessons) {
          completedCoursesCount++
        }
      }
    }

    const overallPct =
      totalLessonsCount > 0 ? Math.round((totalCompletedLessons / totalLessonsCount) * 100) : 0

    const remainingLessons = totalLessonsCount - totalCompletedLessons
    const estimatedRemainingHours =
      Math.round(((remainingLessons * MINUTES_PER_LESSON) / 60) * 10) / 10

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
    const catalogCourseIds = [...new Set(catalogEntries.map(e => e.courseId))]
    const importedCourseIds = [...new Set(importedEntries.map(e => e.courseId))]

    const [catalogCourses, allContentProgress, importedCourses, videoProgress] = await Promise.all([
      catalogCourseIds.length > 0
        ? // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
          db.courses
            .where('id')
            .anyOf(catalogCourseIds)
            .toArray()
            .catch(() => [])
        : Promise.resolve([]),
      catalogCourseIds.length > 0
        ? // eslint-disable-next-line error-handling/no-silent-catch -- non-critical persistence error
          db.contentProgress
            .where('courseId')
            .anyOf(catalogCourseIds)
            .toArray()
            .catch(() => [])
        : Promise.resolve([]),
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

    const catalogCourseMap = new Map(catalogCourses.map(c => [c.id, c]))
    const importedCourseMap = new Map(importedCourses.map(c => [c.id, c]))
    const localProgress = importedCourseIds.length > 0 ? getAllProgress() : {}

    // Build per-course progress lookup
    const courseProgressLookup = new Map<string, CourseProgressInfo>()

    // Catalog courses
    for (const courseId of catalogCourseIds) {
      const course = catalogCourseMap.get(courseId)
      const totalLessons = course ? course.modules.reduce((sum, m) => sum + m.lessons.length, 0) : 0
      const lessonIds = new Set(course?.modules.flatMap(m => m.lessons.map(l => l.id)) ?? [])
      const completedLessons = allContentProgress.filter(
        cp => cp.courseId === courseId && cp.status === 'completed' && lessonIds.has(cp.itemId)
      ).length
      const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      courseProgressLookup.set(courseId, {
        courseId,
        completedLessons,
        totalLessons,
        completionPct: pct,
      })
    }

    // Imported courses
    for (const courseId of importedCourseIds) {
      const ic = importedCourseMap.get(courseId)
      const totalLessons = ic?.videoCount ?? 0
      const completedFromDexie = videoProgress.filter(
        vp => vp.courseId === courseId && vp.completedAt
      ).length
      const localCp = localProgress[courseId]
      const completedFromLocal = localCp?.completedLessons?.length ?? 0
      const completedLessons = Math.min(
        Math.max(completedFromDexie, completedFromLocal),
        totalLessons
      )
      const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      courseProgressLookup.set(courseId, {
        courseId,
        completedLessons,
        totalLessons,
        completionPct: pct,
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
        const cp = courseProgressLookup.get(entry.courseId)
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
          })
        }
      }

      const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0
      const remaining = totalLessons - totalCompleted
      const estimatedRemainingHours = Math.round(((remaining * MINUTES_PER_LESSON) / 60) * 10) / 10

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
