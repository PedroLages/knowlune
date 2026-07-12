/**
 * Referential integrity validation for learning tracks.
 *
 * Verifies that every learningPathEntry.courseId resolves to an importedCourse,
 * and that every importedVideo/importedPdf.courseId resolves to an importedCourse.
 * Useful as a diagnostic after track creation and as a repair pre-check.
 */

import { db } from '@/db'

export interface TrackIntegrityResult {
  /** Entry IDs whose courseId does not resolve to an importedCourse. */
  missingCourseEntries: string[]
  /** Video IDs whose courseId does not resolve to an importedCourse. */
  orphanedVideos: string[]
  /** PDF IDs whose courseId does not resolve to an importedCourse. */
  orphanedPdfs: string[]
  /** True when all references resolve cleanly. */
  valid: boolean
}

/**
 * Validates that all course references in a track's entries (and their
 * associated videos/PDFs) resolve to existing importedCourse records.
 *
 * Non-destructive — reports issues without modifying any data.
 */
export async function validateCourseReferences(trackId: string): Promise<TrackIntegrityResult> {
  const result: TrackIntegrityResult = {
    missingCourseEntries: [],
    orphanedVideos: [],
    orphanedPdfs: [],
    valid: true,
  }

  // Load all imported courses into a Set for O(1) lookup
  const allCourses = await db.importedCourses.toArray()
  const validCourseIds = new Set(allCourses.map(c => c.id))

  // Check track entries
  const entries = await db.learningPathEntries.where('pathId').equals(trackId).toArray()
  for (const entry of entries) {
    // Skip gap entries (courseId === '')
    if (entry.courseId === '') continue
    if (!validCourseIds.has(entry.courseId)) {
      result.missingCourseEntries.push(entry.id)
      result.valid = false
    }
  }

  // Check videos — collect all courseIds referenced by video records
  const allVideos = await db.importedVideos.toArray()
  for (const video of allVideos) {
    if (!validCourseIds.has(video.courseId)) {
      result.orphanedVideos.push(video.id)
      result.valid = false
    }
  }

  // Check PDFs
  const allPdfs = await db.importedPdfs.toArray()
  for (const pdf of allPdfs) {
    if (!validCourseIds.has(pdf.courseId)) {
      result.orphanedPdfs.push(pdf.id)
      result.valid = false
    }
  }

  if (!result.valid) {
    console.warn('[TrackIntegrity] Validation failed:', {
      trackId,
      missingCourseEntries: result.missingCourseEntries.length,
      orphanedVideos: result.orphanedVideos.length,
      orphanedPdfs: result.orphanedPdfs.length,
    })
  }

  return result
}
