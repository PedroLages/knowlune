/**
 * Auto-generates a thumbnail from a video file handle during import.
 *
 * Extracts a frame at the 10% mark (avoids black screens/intros per AC1),
 * saves to IndexedDB as a JPEG blob, and updates the Zustand thumbnail cache.
 *
 * Failures are silent — the course card falls back to a placeholder icon (AC3).
 *
 * @module autoThumbnail
 * @story E1B-S04
 */

import { extractThumbnailFromVideo, saveCourseThumbnail } from '@/lib/thumbnailService'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

/**
 * Generates and persists a thumbnail from a video file handle.
 * Updates the Zustand store so the card displays the thumbnail immediately.
 *
 * @param courseId - The course to attach the thumbnail to
 * @param videoHandle - FileSystemFileHandle for the first video in the course
 */
export async function autoGenerateThumbnail(
  courseId: string,
  videoHandle: FileSystemFileHandle
): Promise<void> {
  // Check if thumbnail already exists (idempotent — AC4: don't regenerate on refresh)
  const existing = useCourseImportStore.getState().thumbnailUrls[courseId]
  if (existing) return

  const blob = await extractThumbnailFromVideo(videoHandle)
  // Route through the store action so the local card update and cloud-sync
  // queue stay in lockstep with manual thumbnail changes.
  const updateCourseThumbnail = useCourseImportStore.getState().updateCourseThumbnail
  if (typeof updateCourseThumbnail === 'function') {
    await updateCourseThumbnail(courseId, blob, 'auto')
    return
  }

  // Keep isolated import flows and older store mocks working while callers
  // migrate to the centralized update action above.
  await saveCourseThumbnail(courseId, blob, 'auto')
  const url = URL.createObjectURL(blob)
  useCourseImportStore.setState(state => ({
    thumbnailUrls: { ...state.thumbnailUrls, [courseId]: url },
  }))
}
