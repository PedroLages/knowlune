import { db } from '@/db'
import { humanizeFilename, type LessonItem } from '@/lib/courseAdapter'
import { getProgress } from '@/lib/progress'
import { getCompanionPdfIds, matchMaterialsToLessons } from '@/lib/lessonMaterialMatcher'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

/** Match `LocalCourseAdapter.buildPdfLessons` ordering for matcher input parity. */
function pdfOrderFromFilename(filename: string): number {
  return parseInt(filename.match(/^(\d+)/)?.[1] ?? '', 10) || Infinity
}

/**
 * True when every learner-facing lesson (videos + standalone PDFs) is completed.
 * Companion PDFs matched to a video are excluded — they are not separate completion
 * rows in navigation (`getLessons()`), so requiring them here would block the dialog.
 *
 * Gates the Session Quality dialog so it appears only after a course-terminal study
 * session, not after every session (E11-S03 product behavior).
 *
 * Falls back to `getProgress(courseId).completedLessons` when the content-progress
 * store has no entry yet (hydration / ordering edge).
 */
export async function isCourseFullyCompleteForSessionQuality(courseId: string): Promise<boolean> {
  const [videos, pdfs] = await Promise.all([
    db.importedVideos.where('courseId').equals(courseId).toArray(),
    db.importedPdfs.where('courseId').equals(courseId).toArray(),
  ])

  const videoLessons: LessonItem[] = videos.map(v => ({
    id: v.id,
    title: humanizeFilename(v.filename),
    type: 'video',
    duration: v.duration,
    order: v.order,
  }))

  const pdfLessons: LessonItem[] = pdfs.map(p => ({
    id: p.id,
    title: humanizeFilename(p.filename),
    type: 'pdf',
    duration: undefined,
    order: pdfOrderFromFilename(p.filename),
  }))

  const groups = matchMaterialsToLessons(videoLessons, pdfLessons)
  const companionPdfIds = getCompanionPdfIds(groups)

  const lessonIds = [...videos.map(v => v.id), ...pdfs.map(p => p.id)].filter(
    id => !companionPdfIds.has(id)
  )
  if (lessonIds.length === 0) return false

  const { getItemStatus } = useContentProgressStore.getState()
  const completedFromLs = new Set(getProgress(courseId).completedLessons)

  return lessonIds.every(id => {
    if (getItemStatus(courseId, id) === 'completed') return true
    return completedFromLs.has(id)
  })
}
