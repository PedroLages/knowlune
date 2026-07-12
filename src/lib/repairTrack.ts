/**
 * One-time repair utility for learning tracks with orphaned course references.
 *
 * When a server-URL course was reimported, the learningPathEntry.courseId was
 * set to the new scanned UUID while the actual course in importedCourses kept
 * its original ID. This breaks the join between entries and courses, causing
 * LearningTrackDetail to render every module as "Course".
 *
 * This utility repairs such tracks by:
 * 1. Finding entries whose courseId doesn't resolve to an importedCourse
 * 2. Determining the canonical course ID via serverPath matching
 * 3. Updating entries and all child records to the canonical ID
 * 4. Preserving video/PDF IDs so existing progress stays connected
 * 5. Queueing corrected records for Supabase sync
 *
 * Non-destructive — entries with no confident match are reported but not modified.
 */

import { db } from '@/db'
import { syncableWrite, syncableBulkPut } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import type { ImportedCourse, ImportedVideo, ImportedPdf, LearningPathEntry } from '@/data/types'

export interface TrackRepairResult {
  /** Number of entries repaired. */
  repairedEntries: number
  /** Number of child video records updated. */
  repairedVideos: number
  /** Number of child PDF records updated. */
  repairedPdfs: number
  /** Number of caption records updated. */
  repairedCaptions: number
  /** Entries that could not be confidently matched — quarantined, not repaired. */
  quarantinedEntries: string[]
  /** Human-readable summary of what was changed. */
  summary: string
}

/**
 * Repairs a track by fixing all orphaned course references in its entries.
 *
 * Each broken entry's videos are inspected to determine the serverPath, which
 * is then matched against existing importedCourses to find the canonical ID.
 * Entries with no confident match are quarantined (reported but not modified).
 */
export async function repairTrack(trackId: string): Promise<TrackRepairResult> {
  const result: TrackRepairResult = {
    repairedEntries: 0,
    repairedVideos: 0,
    repairedPdfs: 0,
    repairedCaptions: 0,
    quarantinedEntries: [],
    summary: '',
  }

  // Load all courses for matching
  const allCourses = await db.importedCourses.toArray()
  const coursesByServerPath = new Map<string, ImportedCourse>()
  for (const c of allCourses) {
    if (c.serverPath) {
      coursesByServerPath.set(c.serverPath, c)
    }
  }

  // Load all entries for this track
  const entries = await db.learningPathEntries
    .where('pathId')
    .equals(trackId)
    .toArray()

  // Identify broken entries
  const validCourseIds = new Set(allCourses.map(c => c.id))
  const brokenEntries = entries.filter(
    e => e.courseId !== '' && !validCourseIds.has(e.courseId)
  )

  if (brokenEntries.length === 0) {
    result.summary = 'No broken entries found — track is already healthy.'
    return result
  }

  console.log('[RepairTrack] Found broken entries:', {
    trackId,
    brokenCount: brokenEntries.length,
    brokenIds: brokenEntries.map(e => e.courseId),
  })

  // For each broken entry, find the canonical course
  const repairs: Array<{
    entry: LearningPathEntry
    canonicalCourseId: string
    canonicalCourseName: string
  }> = []

  for (const entry of brokenEntries) {
    const brokenCourseId = entry.courseId

    // Try to find videos with this broken courseId to extract serverPath
    const videos = await db.importedVideos
      .where('courseId')
      .equals(brokenCourseId)
      .toArray()

    // Derive serverPath from a video's serverUrl
    let serverPath: string | undefined
    for (const v of videos) {
      if (v.serverUrl) {
        // serverUrl format: https://server/path/to/course/video.mp4
        // serverPath is the directory: /path/to/course
        try {
          const url = new URL(v.serverUrl)
          const pathParts = url.pathname.split('/').filter(Boolean)
          // Remove the filename (last segment) to get the course directory
          if (pathParts.length > 0) {
            pathParts.pop()
            serverPath = '/' + pathParts.join('/')
            break
          }
        } catch {
          // Not a valid URL — try next video
        }
      }
    }

    // If no serverPath from videos, try PDFs
    if (!serverPath) {
      const pdfs = await db.importedPdfs
        .where('courseId')
        .equals(brokenCourseId)
        .toArray()
      for (const p of pdfs) {
        if (p.serverUrl) {
          try {
            const url = new URL(p.serverUrl)
            const pathParts = url.pathname.split('/').filter(Boolean)
            if (pathParts.length > 0) {
              pathParts.pop()
              serverPath = '/' + pathParts.join('/')
              break
            }
          } catch {
            // Not a valid URL
          }
        }
      }
    }

    if (!serverPath) {
      result.quarantinedEntries.push(entry.id)
      console.warn('[RepairTrack] Cannot determine serverPath for entry:', {
        entryId: entry.id,
        brokenCourseId,
      })
      continue
    }

    // Match against existing courses by serverPath
    const canonicalCourse = coursesByServerPath.get(serverPath)
    if (!canonicalCourse) {
      result.quarantinedEntries.push(entry.id)
      console.warn('[RepairTrack] No existing course matches serverPath:', {
        entryId: entry.id,
        brokenCourseId,
        serverPath,
      })
      continue
    }

    // Require exactly one confident match (already guaranteed by Map.get)
    repairs.push({
      entry,
      canonicalCourseId: canonicalCourse.id,
      canonicalCourseName: canonicalCourse.name,
    })
  }

  if (repairs.length === 0) {
    result.summary = `No repairable entries found. ${result.quarantinedEntries.length} entries quarantined (no confident match).`
    return result
  }

  // Execute repairs in a transaction
  await db.transaction(
    'rw',
    [
      db.learningPathEntries,
      db.importedVideos,
      db.importedPdfs,
      db.videoCaptions,
    ],
    async () => {
      for (const repair of repairs) {
        const { entry, canonicalCourseId, canonicalCourseName } = repair
        const brokenCourseId = entry.courseId

        // 1. Update the learning path entry
        const updatedEntry = { ...entry, courseId: canonicalCourseId }
        await syncableWrite(
          'learningPathEntries',
          'put',
          updatedEntry as unknown as SyncableRecord
        )
        result.repairedEntries++

        // 2. Update all affected videos — preserve IDs so progress stays connected
        const videosToFix = await db.importedVideos
          .where('courseId')
          .equals(brokenCourseId)
          .toArray()

        if (videosToFix.length > 0) {
          const fixedVideos: ImportedVideo[] = videosToFix.map(v => ({
            ...v,
            courseId: canonicalCourseId,
          }))
          await syncableBulkPut('importedVideos', fixedVideos as unknown as SyncableRecord[])
          result.repairedVideos += fixedVideos.length
        }

        // 3. Update all affected PDFs
        const pdfsToFix = await db.importedPdfs
          .where('courseId')
          .equals(brokenCourseId)
          .toArray()

        if (pdfsToFix.length > 0) {
          const fixedPdfs: ImportedPdf[] = pdfsToFix.map(p => ({
            ...p,
            courseId: canonicalCourseId,
          }))
          await syncableBulkPut('importedPdfs', fixedPdfs as unknown as SyncableRecord[])
          result.repairedPdfs += fixedPdfs.length
        }

        // 4. Update video captions
        const captionsToFix = await db.videoCaptions
          .where('courseId')
          .equals(brokenCourseId)
          .toArray()

        if (captionsToFix.length > 0) {
          for (const caption of captionsToFix) {
            await db.videoCaptions.put({
              ...caption,
              courseId: canonicalCourseId,
            })
          }
          result.repairedCaptions += captionsToFix.length
        }

        console.log('[RepairTrack] Repaired entry:', {
          entryId: entry.id,
          brokenCourseId,
          canonicalCourseId,
          canonicalCourseName,
          fixedVideos: videosToFix.length,
          fixedPdfs: pdfsToFix.length,
          fixedCaptions: captionsToFix.length,
        })
      }
    }
  )

  const parts: string[] = []
  if (result.repairedEntries > 0) {
    parts.push(`${result.repairedEntries} entries`)
  }
  if (result.repairedVideos > 0) {
    parts.push(`${result.repairedVideos} videos`)
  }
  if (result.repairedPdfs > 0) {
    parts.push(`${result.repairedPdfs} PDFs`)
  }
  if (result.repairedCaptions > 0) {
    parts.push(`${result.repairedCaptions} captions`)
  }
  const repairedSummary = parts.length > 0 ? `Repaired ${parts.join(', ')}.` : ''

  const quarantineSummary =
    result.quarantinedEntries.length > 0
      ? ` ${result.quarantinedEntries.length} entries quarantined (no confident match).`
      : ''

  result.summary = `${repairedSummary}${quarantineSummary}`

  return result
}
