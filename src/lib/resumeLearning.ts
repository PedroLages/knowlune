/**
 * resumeLearning — Shared utility for computing resume points (first incomplete lesson)
 * from the canonical contentProgress source, with fallback to the legacy progress table.
 *
 * Pure function: no React or Dexie dependencies. Callers pass in data.
 *
 * @see docs/plans/2026-06-02-001-fix-resume-learning-from-last-lesson-plan.md
 */

import type { CompletionStatus, ImportedVideo, ImportedPdf, VideoProgress } from '@/data/types'

export interface FindFirstIncompleteLessonParams {
  courseId: string
  /** contentProgress statusMap, keyed `courseId:itemId` → CompletionStatus. */
  statusMap: Record<string, CompletionStatus>
  /** Legacy progress table records for this course. */
  videoProgressList: VideoProgress[]
  /** Sorted or unsorted videos in the course. Will be sorted by `order` internally. */
  videos: ImportedVideo[]
  /** PDF lessons in the course. Only consulted when `videos` is empty. */
  pdfs?: ImportedPdf[]
}

/**
 * Find the first incomplete lesson for a course by checking:
 * 1. `statusMap` (canonical contentProgress) — primary source
 * 2. `videoProgressList` (legacy progress table) — fallback when statusMap has no entry for a video
 * 3. PDFs (if no videos exist) — checked against statusMap
 * 4. First video (or first PDF) by order — fallback when neither source has any data
 *
 * Returns `null` when all lessons are completed (caller handles review behavior).
 */
export function findFirstIncompleteLesson(
  courseId: string,
  statusMap: Record<string, CompletionStatus>,
  videoProgressList: VideoProgress[],
  videos: ImportedVideo[],
  pdfs: ImportedPdf[] = []
): string | null {
  const sortedVideos = [...videos].sort((a, b) => a.order - b.order)
  const progressByVideoId = new Map(videoProgressList.map(p => [p.videoId, p]))

  // Phase 1: Check videos in order
  for (const video of sortedVideos) {
    const statusFromMap = statusMap[`${courseId}:${video.id}`]

    if (statusFromMap) {
      // statusMap has an entry for this video — use it as primary source
      if (statusFromMap !== 'completed') {
        return video.id
      }
      // Completed in contentProgress — skip to next video
      continue
    }

    // No contentProgress entry — fall back to legacy progress table
    const legacyProg = progressByVideoId.get(video.id)
    if (!legacyProg || legacyProg.completionPercentage < 90) {
      return video.id
    }
    // Legacy progress shows >= 90% — consider it completed
  }

  // Phase 2: All videos completed or no videos — try PDFs
  if (sortedVideos.length === 0 && pdfs.length > 0) {
    const sortedPdfs = [...pdfs].sort((a, b) => a.filename.localeCompare(b.filename))
    for (const pdf of sortedPdfs) {
      const statusFromMap = statusMap[`${courseId}:${pdf.id}`]
      if (statusFromMap !== 'completed') {
        return pdf.id
      }
    }
  }

  // Phase 3: All lessons explicitly completed — caller handles review behavior
  return null
}

// ── Resume target with position ────────────────────────────────────────────

export interface ResumeTargetResult {
  lessonId: string
  /** Saved playback position in seconds; 0 for unstarted lessons */
  resumePositionSeconds: number
}

/**
 * Like {@link findFirstIncompleteLesson} but also returns the saved playback
 * position (`currentTime`) for partially-watched lessons, enabling the caller
 * to pass it through to the lesson player.
 *
 * Returns `null` when all lessons are complete.
 */
export function findResumeTarget(
  courseId: string,
  statusMap: Record<string, CompletionStatus>,
  videoProgressList: VideoProgress[],
  videos: ImportedVideo[],
  pdfs: ImportedPdf[] = [],
): ResumeTargetResult | null {
  const sortedVideos = [...videos].sort((a, b) => a.order - b.order)
  const progressByVideoId = new Map(videoProgressList.map((p) => [p.videoId, p]))

  for (const video of sortedVideos) {
    const statusFromMap = statusMap[`${courseId}:${video.id}`]

    if (statusFromMap) {
      if (statusFromMap !== 'completed') {
        const vp = progressByVideoId.get(video.id)
        return {
          lessonId: video.id,
          resumePositionSeconds:
            statusFromMap === 'in-progress' ? (vp?.currentTime ?? 0) : 0,
        }
      }
      // Completed in contentProgress — skip
      continue
    }

    // No contentProgress entry — fall back to legacy progress table
    const legacyProg = progressByVideoId.get(video.id)
    if (!legacyProg || legacyProg.completionPercentage < 90) {
      return {
        lessonId: video.id,
        resumePositionSeconds: legacyProg?.currentTime ?? 0,
      }
    }
    // Legacy progress >= 90% — consider completed, skip
  }

  // All videos completed or no videos — try PDFs
  if (sortedVideos.length === 0 && pdfs.length > 0) {
    const sortedPdfs = [...pdfs].sort((a, b) => a.filename.localeCompare(b.filename))
    for (const pdf of sortedPdfs) {
      const statusFromMap = statusMap[`${courseId}:${pdf.id}`]
      if (statusFromMap !== 'completed') {
        return { lessonId: pdf.id, resumePositionSeconds: 0 }
      }
    }
  }

  return null
}
