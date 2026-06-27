import { parseTrackManifest } from '@/lib/courseManifest'
import type { TrackManifest, ManifestAuthor } from '@/lib/courseManifest'
import { scanCourseFolderFromHandle, persistScannedCourse } from '@/lib/courseImport'
import type { BulkScanResult } from '@/lib/courseImport'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { db } from '@/db'
import { toast } from 'sonner'

export interface TrackManifestSummary {
  trackName: string
  trackDescription?: string
  trackAuthor?: ManifestAuthor
  courseFolders: string[]
}

export interface CourseImportResult {
  folder: string
  success: boolean
  courseId?: string
  error?: string
}

export interface BatchImportResult {
  trackId?: string
  trackName: string
  courses: CourseImportResult[]
  successCount: number
  failureCount: number
}

/**
 * Reads and validates a track-manifest.json from a parent directory.
 * Returns a summary for the confirmation step.
 */
export async function readTrackManifest(
  parentDirHandle: FileSystemDirectoryHandle
): Promise<
  | { ok: true; summary: TrackManifestSummary; manifest: TrackManifest }
  | { ok: false; error: string }
> {
  try {
    const fileHandle = await parentDirHandle.getFileHandle('track-manifest.json')
    const file = await fileHandle.getFile()
    const text = await file.text()
    const json = JSON.parse(text)
    const result = parseTrackManifest(json)

    if (!result.ok) {
      const messages = result.errors.map(e => `${e.path}: ${e.message}`).join('; ')
      return { ok: false, error: `Invalid track-manifest.json: ${messages}` }
    }

    const manifest = result.value
    return {
      ok: true,
      manifest,
      summary: {
        trackName: manifest.track.name,
        trackDescription: manifest.track.description,
        trackAuthor: manifest.track.author,
        courseFolders: manifest.track.courses.map(c => c.folder),
      },
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { ok: false, error: 'No track-manifest.json found in the selected folder.' }
    }
    if (err instanceof SyntaxError) {
      return { ok: false, error: 'track-manifest.json is not valid JSON.' }
    }
    return {
      ok: false,
      error: `Failed to read track-manifest.json: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

/**
 * Executes a batch import of all courses listed in a track manifest.
 *
 * Iterates sequentially over each course folder listed in the manifest,
 * scanning and persisting each one. Partial failure is accepted — courses
 * that fail to import do not block the rest of the batch.
 *
 * After all courses are imported, creates a track (or matches by name)
 * and adds the successfully imported courses to it.
 */
export async function batchImportTrackCourses(
  parentDirHandle: FileSystemDirectoryHandle,
  manifest: TrackManifest
): Promise<BatchImportResult> {
  const results: CourseImportResult[] = []
  const positions = manifest.track.courses

  // Phase 1: Import each course sequentially
  for (const { folder } of positions) {
    try {
      // Get the subdirectory handle
      let dirHandle: FileSystemDirectoryHandle
      try {
        dirHandle = await parentDirHandle.getDirectoryHandle(folder)
      } catch {
        results.push({ folder, success: false, error: `Folder "${folder}" not found` })
        toast.warning(`Course folder "${folder}" not found — skipped`)
        continue
      }

      // Scan the subdirectory
      const scanResult: BulkScanResult = await scanCourseFolderFromHandle(dirHandle)

      if (scanResult.status === 'duplicate') {
        const existingCourse = await db.importedCourses.where('name').equals(folder).first()
        if (existingCourse) {
          results.push({ folder, success: true, courseId: existingCourse.id })
        } else {
          results.push({ folder, success: false, error: 'Course not found in database' })
          toast.warning(`"${folder}" appears to be imported but could not be found`)
        }
        continue
      }

      if (scanResult.status === 'no-files') {
        results.push({ folder, success: false, error: 'No supported files found' })
        toast.warning(`"${folder}" has no supported files — skipped`)
        continue
      }

      if (scanResult.status === 'error') {
        results.push({ folder, success: false, error: scanResult.message })
        toast.error(`Failed to scan "${folder}": ${scanResult.message}`)
        continue
      }

      // Persist the scanned course
      const importedCourse = await persistScannedCourse(scanResult.course)
      results.push({ folder, success: true, courseId: importedCourse.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      results.push({ folder, success: false, error: message })
      toast.error(`Failed to import "${folder}": ${message}`)
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount

  // Phase 2: Create or link author from manifest
  const trackAuthor = manifest.track.author
  if (trackAuthor) {
    try {
      await useAuthorStore.getState().addAuthor({
        name: trackAuthor.name,
        title: trackAuthor.title,
        shortBio: trackAuthor.shortBio,
        bio: trackAuthor.bio,
        photoUrl: trackAuthor.avatar,
        specialties: trackAuthor.specialties,
        yearsExperience: trackAuthor.yearsExperience,
        education: trackAuthor.education,
        socialLinks:
          trackAuthor.website || trackAuthor.linkedin || trackAuthor.twitter
            ? {
                website: trackAuthor.website,
                linkedin: trackAuthor.linkedin,
                twitter: trackAuthor.twitter,
              }
            : undefined,
        featuredQuote: trackAuthor.featuredQuote,
        courseIds: results.filter(r => r.success && r.courseId).map(r => r.courseId!),
      })
    } catch (err) {
      toast.warning('Failed to create author from manifest — continuing with track import')
    }
  }

  // Phase 3: Create or match track and add courses
  if (successCount === 0) {
    toast.error('No courses were imported — track was not created')
    return {
      trackName: manifest.track.name,
      courses: results,
      successCount: 0,
      failureCount,
    }
  }

  const trackName = manifest.track.name
  const trackDescription = manifest.track.description
  const store = useLearningPathStore.getState()

  // Check if a track with this name already exists
  let trackId: string
  const existingPath = store.paths.find(p => p.name.toLowerCase() === trackName.toLowerCase())

  if (existingPath) {
    trackId = existingPath.id
    const coursesToAdd = results
      .filter(r => r.success && r.courseId)
      .map(r => ({
        courseId: r.courseId!,
        courseType: 'imported' as const,
        justification: positions.find(p => p.folder === r.folder)?.notes,
      }))
    await store.batchAddCoursesToPath(trackId, coursesToAdd)
    toast.info(`Added ${coursesToAdd.length} courses to existing track "${trackName}"`)
  } else {
    // Create new track
    const courses = results
      .filter(r => r.success && r.courseId)
      .map(r => ({
        courseId: r.courseId!,
        courseType: 'imported' as const,
        justification: positions.find(p => p.folder === r.folder)?.notes,
      }))
    const newPath = await store.createPathWithCourses(trackName, trackDescription, courses)
    trackId = newPath.id
    toast.success(`Track "${trackName}" created with ${successCount} courses`)
  }

  // Apply manifest-specified positions via reorder (both new and existing tracks).
  // Re-read live store state each iteration — reorderCourse mutates entries,
  // so a static snapshot captured before the loop would go stale.
  //
  // Sort positions by their manifest order to minimize moves: processing the
  // smallest target positions first avoids shifting already-placed courses.
  const sortedPositions = [...positions].sort((a, b) => a.position - b.position)

  for (const { folder, position } of sortedPositions) {
    const result = results.find(r => r.folder === folder && r.success)
    if (!result?.courseId) continue

    // getState() returns the live Zustand snapshot — never use the stale
    // `store` variable captured above for entry index lookups.
    const currentEntries = useLearningPathStore
      .getState()
      .entries.filter(e => e.pathId === trackId)
      .sort((a, b) => a.position - b.position)

    const entryIndex = currentEntries.findIndex(e => e.courseId === result.courseId)
    // Clamp target to valid range — when courses fail to import, the entries
    // array may be shorter than the highest manifest position, which would
    // cause reorderCourse to silently skip (out-of-bounds toEntry).
    const targetIndex = Math.min(position - 1, currentEntries.length - 1)
    if (entryIndex >= 0 && entryIndex !== targetIndex) {
      await store.reorderCourse(trackId, entryIndex, targetIndex)
    }
  }

  return {
    trackId,
    trackName,
    courses: results,
    successCount,
    failureCount,
  }
}
