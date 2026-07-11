/**
 * useNextBestCourse — Returns the next best course to resume for a given learning path.
 *
 * Delegates to the canonical {@link resolveCourseResumeTargetSync} resolver so
 * lesson-completion rules are consistent with the dashboard, track-detail page,
 * and course-overview CTA.
 *
 * @see src/lib/learningResumeResolver.ts
 * @see docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { db } from '@/db'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { PROGRESS_UPDATED_EVENT } from '@/lib/progress'
import {
  resolveCourseResumeTargetSync,
  type CourseResumeTarget,
} from '@/lib/learningResumeResolver'
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

const INITIAL_RESULT: NextBestCourseResult = {
  entry: null,
  course: null,
  action: null,
  targetLessonId: null,
}

/**
 * Core computation: iterate track entries in position order and resolve each
 * course's lesson target via the canonical sync resolver.
 *
 * The resolver checks contentProgress (primary), legacy VideoProgress, and
 * localStorage — so course selection and lesson selection agree on completion.
 */
async function computeNextBestCourse(
  sortedEntries: LearningPathEntry[],
  importedCourses: ImportedCourse[],
  statusMap: Record<string, CompletionStatus>,
  progressReady: boolean,
): Promise<NextBestCourseResult> {
  if (sortedEntries.length === 0) return INITIAL_RESULT

  // Loading gating: wait for contentProgress to be populated before computing
  // resume targets. Without this, an empty statusMap causes the resolver to
  // fall back to legacy progress, which may produce stale results.
  if (!progressReady) return INITIAL_RESULT

  for (const entry of sortedEntries) {
    if (!entry.courseId) continue

    const course = importedCourses.find((c) => c.id === entry.courseId) ?? null

    // Query Dexie for this course's lesson data, then resolve synchronously
    let target: CourseResumeTarget
    try {
      const [videos, pdfs, vpList] = await Promise.all([
        db.importedVideos.where('courseId').equals(entry.courseId).toArray(),
        db.importedPdfs.where('courseId').equals(entry.courseId).toArray(),
        db.progress.where('courseId').equals(entry.courseId).toArray(),
      ])

      target = resolveCourseResumeTargetSync(entry.courseId, {
        videos: videos as ImportedVideo[],
        pdfs: pdfs as ImportedPdf[],
        videoProgressList: vpList as VideoProgress[],
        statusMap,
      })
    } catch (err) {
      console.error(
        '[computeNextBestCourse] Dexie query failed for course',
        entry.courseId,
        err,
      )
      continue
    }

    if (target.action === 'resume' || target.action === 'start') {
      return {
        entry,
        course,
        action: target.action,
        targetLessonId: target.lessonId,
      }
    }

    // 'complete' — advance to next course in the track
  }

  // All courses complete
  return { entry: null, course: null, action: 'complete' as const, targetLessonId: null }
}

/**
 * Hook that returns the next best course to resume for a given learning path.
 *
 * @param pathId - The learning path ID to query.
 * @returns A NextBestCourseResult indicating which course/lesson to resume.
 */
export function useNextBestCourse(pathId: string): NextBestCourseResult {
  const allEntries = useLearningPathStore((s) => s.entries)
  const importedCourses = useCourseImportStore((s) => s.importedCourses)
  const statusMap = useContentProgressStore((s) => s.statusMap)
  const loadCourseProgress = useContentProgressStore((s) => s.loadCourseProgress)

  // Derive sorted entries for this path
  const sortedEntries = useMemo(
    () =>
      allEntries
        .filter((e) => e.pathId === pathId)
        .sort((a, b) => a.position - b.position),
    [allEntries, pathId],
  )

  // Track cancellation across effects
  const cancelledRef = useRef(false)

  // Loading-gating state: prevents incorrect resume targets before contentProgress loads
  const [contentProgressReady, setContentProgressReady] = useState(false)

  // State for the result (targetLessonId is async-resolved)
  const [result, setResult] = useState<NextBestCourseResult>(INITIAL_RESULT)

  // Eagerly load contentProgress for all courses in this path so that statusMap
  // is populated before the resume-point computation runs.
  useEffect(() => {
    if (sortedEntries.length === 0) return

    const courseIds = sortedEntries.map((e) => e.courseId).filter(Boolean)
    setContentProgressReady(false)

    let ignore = false

    async function loadAll() {
      const batchSize = 10
      for (let i = 0; i < courseIds.length; i += batchSize) {
        if (ignore) return
        const batch = courseIds.slice(i, i + batchSize)
        await Promise.allSettled(batch.map((id) => loadCourseProgress(id)))
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
      importedCourses,
      statusMap,
      contentProgressReady,
    ).then((nextResult) => {
      if (!cancelledRef.current && !currentCancelled.current) {
        setResult(nextResult)
      }
    })

    return () => {
      currentCancelled.current = true
      cancelledRef.current = true
    }
  }, [sortedEntries, importedCourses, statusMap, contentProgressReady])

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
        importedCourses,
        statusMap,
        contentProgressReady,
      ).then((nextResult) => {
        if (!cancelledRef.current) {
          setResult(nextResult)
        }
      })
    }

    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdate)
    }
  }, [sortedEntries, importedCourses, statusMap, contentProgressReady])

  return result
}
