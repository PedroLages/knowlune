/**
 * learningResumeResolver — Canonical resume-point resolution for courses and tracks.
 *
 * Every "Continue" / "Start" / "Review" CTA must consume this same resolver so
 * lesson-completion rules, course ordering, and track advancement are consistent.
 *
 * ## Data sources (priority order)
 *
 * 1. contentProgress (canonical) — db.contentProgress table, status === 'completed'
 * 2. Legacy VideoProgress        — db.progress: completedAt OR completionPct >= 90
 * 3. Legacy localStorage         — completedLessons array
 *
 * Only actual video / PDF lesson IDs are considered.
 * Module-level / folder / section contentProgress rows are ignored.
 */

import { db } from '@/db'
import {
  isLessonCompleted,
} from '@/lib/progress'
import { sortImportedVideosForCurriculum } from '@/lib/sortImportedVideosForCurriculum'
import type {
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  CompletionStatus,
  LearningPathEntry,
} from '@/data/types'

// ── Types ────────────────────────────────────────────────────────────────────

export type ResumeAction = 'resume' | 'start' | 'complete'

export interface CourseResumeTarget {
  action: ResumeAction
  courseId: string
  /** null when all lessons are complete or course has no lessons */
  lessonId: string | null
  lessonTitle?: string
  /** Playback position in seconds; 0 or undefined means start from beginning */
  resumePositionSeconds: number
}

export interface TrackResumeTarget extends CourseResumeTarget {
  pathId: string
  /** 1-based position of the resolved course in the track */
  coursePosition?: number
}

// ── Sync resolver (for callers that already have data in memory) ─────────────

export interface SyncCourseResolveParams {
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  videoProgressList: VideoProgress[]
  statusMap: Record<string, CompletionStatus>
  legacyCompletedLessonIds?: Set<string>
}

/**
 * Synchronously resolve the next lesson for a single course.
 * Callers that already hold videos / progress from state should prefer this
 * to avoid redundant Dexie queries.
 */
export function resolveCourseResumeTargetSync(
  courseId: string,
  params: SyncCourseResolveParams,
): CourseResumeTarget {
  const sortedVideos = sortImportedVideosForCurriculum(params.videos)
  const progressByVideoId = new Map(
    params.videoProgressList.map((p) => [p.videoId, p]),
  )

  // Phase 1: Check videos in curriculum order
  for (const video of sortedVideos) {
    const cpStatus = params.statusMap[`${courseId}:${video.id}`]
    const vp = progressByVideoId.get(video.id)

    const completed = isLessonCompleted({
      courseId,
      lessonId: video.id,
      contentProgressStatus: cpStatus,
      videoProgress: vp ?? null,
      legacyCompletedLessonIds: params.legacyCompletedLessonIds
        ? [...params.legacyCompletedLessonIds]
        : undefined,
    })

    if (completed) continue

    // Not completed — determine whether to resume or start fresh
    const isStarted =
      cpStatus === 'in-progress' || (vp != null && vp.currentTime > 0)
    const title =
      video.title ??
      video.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')

    return {
      action: isStarted ? 'resume' : 'start',
      courseId,
      lessonId: video.id,
      lessonTitle: title,
      resumePositionSeconds: isStarted ? (vp?.currentTime ?? 0) : 0,
    }
  }

  // Phase 2: PDFs (only when the course has no videos)
  if (sortedVideos.length === 0 && params.pdfs.length > 0) {
    const sortedPdfs = [...params.pdfs].sort((a, b) =>
      a.filename.localeCompare(b.filename),
    )
    for (const pdf of sortedPdfs) {
      const cpStatus = params.statusMap[`${courseId}:${pdf.id}`]

      const completed = isLessonCompleted({
        courseId,
        lessonId: pdf.id,
        contentProgressStatus: cpStatus,
        legacyCompletedLessonIds: params.legacyCompletedLessonIds
          ? [...params.legacyCompletedLessonIds]
          : undefined,
      })

      if (completed) continue

      const title = pdf.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
      return {
        action: cpStatus === 'in-progress' ? 'resume' : 'start',
        courseId,
        lessonId: pdf.id,
        lessonTitle: title,
        resumePositionSeconds: 0,
      }
    }
  }

  // All lessons complete
  return { action: 'complete', courseId, lessonId: null, resumePositionSeconds: 0 }
}

// ── Async resolvers (convenience wrappers that query Dexie) ───────────────────

/**
 * Resolve the next lesson for a course, querying Dexie for video / progress data.
 * Accepts an optional pre-populated statusMap to avoid re-loading contentProgress
 * when the caller already holds it in state.
 */
export async function resolveCourseResumeTarget(
  courseId: string,
  options?: {
    statusMap?: Record<string, CompletionStatus>
    legacyCompletedLessonIds?: Set<string>
  },
): Promise<CourseResumeTarget> {
  const [videos, pdfs, videoProgressList] = await Promise.all([
    db.importedVideos.where('courseId').equals(courseId).toArray(),
    db.importedPdfs.where('courseId').equals(courseId).toArray(),
    db.progress.where('courseId').equals(courseId).toArray(),
  ])

  return resolveCourseResumeTargetSync(courseId, {
    videos: videos as ImportedVideo[],
    pdfs: pdfs as ImportedPdf[],
    videoProgressList: videoProgressList as VideoProgress[],
    statusMap: options?.statusMap ?? {},
    legacyCompletedLessonIds: options?.legacyCompletedLessonIds,
  })
}

// ── Track resolver ───────────────────────────────────────────────────────────

export interface SyncTrackResolveParams {
  /** Sorted entries (by position), with empty-string courseIds filtered out */
  sortedEntries: Array<{ courseId: string; position: number }>
  /** Per-course resume targets, pre-computed by the caller */
  courseResumeTargets: Map<string, CourseResumeTarget>
}

/**
 * Synchronously resolve the next course + lesson for a track.
 * Iterates entries in position order; returns the first non-complete course.
 * Returns `{ action: 'complete' }` when every course is finished.
 *
 * Never returns lesson 1 of a completed course as a fallback.
 */
export function resolveTrackResumeTargetSync(
  pathId: string,
  params: SyncTrackResolveParams,
): TrackResumeTarget {
  for (let i = 0; i < params.sortedEntries.length; i++) {
    const entry = params.sortedEntries[i]
    if (!entry.courseId) continue

    const target = params.courseResumeTargets.get(entry.courseId)
    if (!target) continue

    if (target.action === 'resume' || target.action === 'start') {
      return { ...target, pathId, coursePosition: i + 1 }
    }
    // 'complete' → advance to next course
  }

  return {
    action: 'complete',
    pathId,
    courseId: '',
    lessonId: null,
    resumePositionSeconds: 0,
  }
}

/**
 * Async version — queries Dexie for entries and delegates to sync resolver.
 */
export async function resolveTrackResumeTarget(
  pathId: string,
  options?: {
    statusMap?: Record<string, CompletionStatus>
    legacyCompletedLessonIds?: Set<string>
    entries?: LearningPathEntry[]
  },
): Promise<TrackResumeTarget> {
  const entries =
    options?.entries ??
    ((await db.learningPathEntries
      .where('pathId')
      .equals(pathId)
      .sortBy('position')) as LearningPathEntry[])

  const sorted = entries
    .filter((e) => e.courseId !== '')
    .sort((a, b) => a.position - b.position)

  for (let i = 0; i < sorted.length; i++) {
    const target = await resolveCourseResumeTarget(sorted[i].courseId, options)
    if (target.action === 'resume' || target.action === 'start') {
      return { ...target, pathId, coursePosition: i + 1 }
    }
  }

  return {
    action: 'complete',
    pathId,
    courseId: '',
    lessonId: null,
    resumePositionSeconds: 0,
  }
}
