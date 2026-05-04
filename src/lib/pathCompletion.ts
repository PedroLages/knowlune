/**
 * Shared path completion percentage calculator.
 *
 * Computes aggregate completion across imported courses in a learning path.
 * Used by both the milestone detection (Dexie-based) and the reactive hook
 * (usePathProgress) to avoid duplicating the per-course progress logic.
 *
 * Progress sources (takes max of the two):
 *  - Dexie `progress` table (completedAt timestamp)
 *  - localStorage `course-progress` (completedLessons array)
 */

export interface PathCompletionEntry {
  courseId: string
}

export interface PathCompletionCourse {
  id: string
  videoCount?: number
}

export interface PathCompletionVideoProgress {
  courseId: string
  completedAt?: number | null
}

export interface PathCompletionLocalProgress {
  completedLessons?: string[]
}

/**
 * Compute the aggregate path completion percentage from imported course data.
 *
 * @param entries - Imported learning path entries (need courseId)
 * @param importedCourseMap - Map of courseId → course metadata (need videoCount)
 * @param videoProgress - Array of progress records from Dexie progress table
 * @param localProgress - Record of courseId → localStorage progress
 * @returns Completion percentage (0-100), rounded to nearest integer
 */
export function computePathCompletionPct(
  entries: PathCompletionEntry[],
  importedCourseMap: Map<string, PathCompletionCourse>,
  videoProgress: PathCompletionVideoProgress[],
  localProgress: Record<string, PathCompletionLocalProgress>,
): number {
  let totalCompletedLessons = 0
  let totalLessonsCount = 0

  for (const entry of entries) {
    const importedCourse = importedCourseMap.get(entry.courseId)
    const totalLessons = importedCourse?.videoCount ?? 0

    // Count completed videos from Dexie progress table
    const completedFromDexie = videoProgress.filter(
      vp => vp.courseId === entry.courseId && vp.completedAt,
    ).length

    // Count completed from localStorage
    const localCp = localProgress[entry.courseId]
    const completedFromLocal = localCp?.completedLessons?.length ?? 0

    // Take the higher of the two sources (they may overlap), capped at total
    const completedLessons = Math.min(
      Math.max(completedFromDexie, completedFromLocal),
      totalLessons,
    )

    totalCompletedLessons += completedLessons
    totalLessonsCount += totalLessons
  }

  return totalLessonsCount > 0
    ? Math.round((totalCompletedLessons / totalLessonsCount) * 100)
    : 0
}
