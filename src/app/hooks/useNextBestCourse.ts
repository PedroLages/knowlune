/**
 * useNextBestCourse — Returns the next best course to resume for a given learning path.
 *
 * Consumes useMultiPathProgress internally rather than re-implementing progress
 * computation. Returns a synchronous-first result shape that updates reactively
 * when progress changes.
 *
 * @see R1, R2 — docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { db } from '@/db'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { PROGRESS_UPDATED_EVENT } from '@/lib/progress'
import { findFirstIncompleteLesson as findFirstIncompleteLessonShared } from '@/lib/resumeLearning'
import type {
  LearningPathEntry,
  ImportedCourse,
  CompletionStatus,
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
} from '@/data/types'

export type NextBestAction = 'resume' | 'start' | 'complete' | null

export interface NextBestCourseResult {
  /** The path entry (course reference) that is the next best to resume/start */
  entry: LearningPathEntry | null
  /** The imported course metadata, or null if the course is a catalog course */
  course: ImportedCourse | null
  /** What action the user should take */
  action: NextBestAction
  /**
   * The specific lesson to navigate to.
   * - For 'resume': the first incomplete lesson
   * - For 'start': the first lesson in the course
   * - For 'complete' or null: null
   */
  targetLessonId: string | null
}

/**
 * Find the first lesson (lowest order) for a given course by querying
 * importedVideos and importedPdfs in Dexie.
 */
async function getFirstLessonId(courseId: string): Promise<string | null> {
  try {
    const videos = await db.importedVideos.where('courseId').equals(courseId).sortBy('order')
    if (videos.length > 0) return videos[0].id

    const pdfs = await db.importedPdfs.where('courseId').equals(courseId).sortBy('filename')
    if (pdfs.length > 0) return pdfs[0].id

    return null
  } catch (err) {
    console.error('[getFirstLessonId] Dexie query failed for course', courseId, err)
    return null
  }
}

/**
 * Find the first incomplete lesson for a course using the shared dual-source utility.
 * Queries Dexie for videos, PDFs, and legacy progress, then delegates to the
 * synchronous `findFirstIncompleteLesson` from `resumeLearning.ts`.
 */
async function findFirstIncompleteLessonWithFallback(
  courseId: string,
  statusMap: Record<string, CompletionStatus>
): Promise<string | null> {
  try {
    const [videos, pdfs, progressList] = await Promise.all([
      db.importedVideos.where('courseId').equals(courseId).sortBy('order') as Promise<
        ImportedVideo[]
      >,
      db.importedPdfs.where('courseId').equals(courseId).toArray() as Promise<ImportedPdf[]>,
      db.progress.where('courseId').equals(courseId).toArray() as Promise<VideoProgress[]>,
    ])

    return findFirstIncompleteLessonShared(courseId, statusMap, progressList, videos, pdfs)
  } catch (err) {
    console.error('[findFirstIncompleteLessonWithFallback] failed for course', courseId, err)
    return getFirstLessonId(courseId)
  }
}

const INITIAL_RESULT: NextBestCourseResult = {
  entry: null,
  course: null,
  action: null,
  targetLessonId: null,
}

/**
 * Core computation: given the sorted entries, course progress, imported courses,
 * and status map, determine the next best course and its target lesson ID.
 */
async function computeNextBestCourse(
  sortedEntries: LearningPathEntry[],
  courseProgress: Map<string, { courseId: string; completionPct: number }> | undefined,
  importedCourses: ImportedCourse[],
  statusMap: Record<string, CompletionStatus>,
  progressReady: boolean
): Promise<NextBestCourseResult> {
  if (sortedEntries.length === 0 || !courseProgress || courseProgress.size === 0) {
    return INITIAL_RESULT
  }

  // Loading gating: wait for contentProgress to be populated before computing
  // resume targets. Without this, an empty statusMap causes findFirstIncompleteLesson
  // to return the first lesson instead of the correct incomplete lesson.
  if (!progressReady) return INITIAL_RESULT

  // Pass 1: Find the first in-progress course (resume)
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue

    if (cp.completionPct > 0 && cp.completionPct < 100) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      const targetLessonId = await findFirstIncompleteLessonWithFallback(entry.courseId, statusMap)
      return { entry, course, action: 'resume' as const, targetLessonId }
    }
  }

  // Pass 2: Find the first unstarted course (start).
  // Uses findFirstIncompleteLessonWithFallback instead of getFirstLessonId so that
  // courses with contentProgress data (but empty legacy progress table, yielding
  // completionPct: 0) still navigate to the correct incomplete lesson.
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue

    if (cp.completionPct === 0) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      const targetLessonId = await findFirstIncompleteLessonWithFallback(entry.courseId, statusMap)
      return { entry, course, action: 'start' as const, targetLessonId }
    }
  }

  // No courses in progress or unstarted — all complete
  return { entry: null, course: null, action: 'complete' as const, targetLessonId: null }
}

const EMPTY_MAP = new Map<string, LearningPathEntry[]>()

/**
 * Hook that returns the next best course to resume for a given learning path.
 *
 * @param pathId - The learning path ID to query.
 * @returns A NextBestCourseResult indicating which course/lesson to resume.
 */
export function useNextBestCourse(pathId: string): NextBestCourseResult {
  const allEntries = useLearningPathStore(s => s.entries)
  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const statusMap = useContentProgressStore(s => s.statusMap)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  // Derive sorted entries for this path
  const sortedEntries = useMemo(
    () => allEntries.filter(e => e.pathId === pathId).sort((a, b) => a.position - b.position),
    [allEntries, pathId]
  )

  // Build path-entries map for useMultiPathProgress (only when sortedEntries changes)
  const pathEntriesMap = useMemo(() => {
    if (sortedEntries.length === 0) return EMPTY_MAP
    const map = new Map<string, LearningPathEntry[]>()
    map.set(pathId, sortedEntries)
    return map
  }, [sortedEntries, pathId])

  // Get progress for this path
  const progressMap = useMultiPathProgress(pathEntriesMap)
  const pathProgress = progressMap.get(pathId)
  const courseProgress = pathProgress?.courseProgress

  // Track cancellation across both effects
  const cancelledRef = useRef(false)

  // Loading-gating state: prevents incorrect resume targets before contentProgress loads
  const [contentProgressReady, setContentProgressReady] = useState(false)

  // State for the result (targetLessonId is async-resolved)
  const [result, setResult] = useState<NextBestCourseResult>(INITIAL_RESULT)

  // Eagerly load contentProgress for all courses in this path so that statusMap
  // is populated before the resume-point computation runs.
  useEffect(() => {
    if (sortedEntries.length === 0) return

    const courseIds = sortedEntries.map(e => e.courseId).filter(Boolean)
    setContentProgressReady(false)

    let ignore = false

    async function loadAll() {
      const batchSize = 10
      for (let i = 0; i < courseIds.length; i += batchSize) {
        if (ignore) return
        const batch = courseIds.slice(i, i + batchSize)
        await Promise.allSettled(batch.map(id => loadCourseProgress(id)))
      }
      if (!ignore) {
        setContentProgressReady(true)
      }
    }

    loadAll()

    return () => {
      ignore = true
    }
  }, [sortedEntries, loadCourseProgress])

  // Shared stable callback wrapping computeNextBestCourse
  const runCompute = useCallback(() => {
    const currentCancelled = { current: false }
    cancelledRef.current = false

    computeNextBestCourse(
      sortedEntries,
      courseProgress,
      importedCourses,
      statusMap,
      contentProgressReady
    ).then(nextResult => {
      if (!cancelledRef.current && !currentCancelled.current) {
        setResult(nextResult)
      }
    })

    return () => {
      currentCancelled.current = true
      cancelledRef.current = true
    }
  }, [sortedEntries, courseProgress, importedCourses, statusMap, contentProgressReady])

  // Main effect: recompute when dependencies change
  useEffect(() => {
    const cancel = runCompute()
    return cancel
  }, [runCompute])

  // Reactivity: recompute when PROGRESS_UPDATED_EVENT fires
  useEffect(() => {
    const handleProgressUpdate = () => {
      computeNextBestCourse(
        sortedEntries,
        courseProgress,
        importedCourses,
        statusMap,
        contentProgressReady
      ).then(nextResult => {
        if (!cancelledRef.current) {
          setResult(nextResult)
        }
      })
    }

    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
    }
  }, [sortedEntries, courseProgress, importedCourses, statusMap, contentProgressReady])

  return result
}
