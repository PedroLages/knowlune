import { parseTrackManifest } from '@/lib/courseManifest'
import type { TrackManifest, ManifestAuthor } from '@/lib/courseManifest'
import { scanCourseFolderFromHandle, persistScannedCourse } from '@/lib/courseImport'
import type { BulkScanResult } from '@/lib/courseImport'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { db } from '@/db'
import { toast } from 'sonner'

/**
 * Normalize a folder name for reliable comparison.
 *
 * File System Access API may return directory names with different Unicode
 * normalization (NFD on macOS) than the JSON manifest (usually NFC).
 * Trimming whitespace also guards against copy-paste artifacts.
 */
function normalizeFolder(name: string): string {
  return name.trim().normalize('NFC')
}

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

      // Store the manifest position on the course record so the
      // InlineCoursePicker and other UIs can sort by manifest order.
      const manifestCourse = positions.find(p => normalizeFolder(p.folder) === normalizeFolder(folder))
      if (manifestCourse) {
        db.importedCourses.update(importedCourse.id, { manifestPosition: manifestCourse.position })
        useCourseImportStore.setState(state => ({
          importedCourses: state.importedCourses.map(c =>
            c.id === importedCourse.id
              ? { ...c, manifestPosition: manifestCourse.position }
              : c
          ),
        }))
      }
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

  // Build a normalized folder→position map for reliable comparison across
  // Unicode normalization boundaries (macOS NFD vs JSON NFC).
  const folderPosition = new Map<string, number>()
  for (const p of positions) {
    const key = normalizeFolder(p.folder)
    folderPosition.set(key, p.position)
  }

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
        justification: positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.notes,
        completionTarget:
          positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.completionTarget ?? undefined,
      }))
    await store.batchAddCoursesToPath(trackId, coursesToAdd)
    toast.info(`Added ${coursesToAdd.length} courses to existing track "${trackName}"`)
  } else {
    // Create new track — pre-sort by manifest position so the initial
    // entry positions are correct from the start (no render flash between
    // createPathWithCourses and the applyManifestOrder correction pass).
    const sortedResults = [...results]
      .filter(r => r.success && r.courseId)
      .sort((a, b) => {
        const posA = folderPosition.get(normalizeFolder(a.folder)) ?? Number.MAX_SAFE_INTEGER
        const posB = folderPosition.get(normalizeFolder(b.folder)) ?? Number.MAX_SAFE_INTEGER
        if (posA >= Number.MAX_SAFE_INTEGER) {
          console.warn('[trackManifestImport] Folder not in manifest (pre-sort):', a.folder)
        }
        if (posB >= Number.MAX_SAFE_INTEGER) {
          console.warn('[trackManifestImport] Folder not in manifest (pre-sort):', b.folder)
        }
        return posA - posB
      })
    const courses = sortedResults.map(r => ({
      courseId: r.courseId!,
      courseType: 'imported' as const,
      justification: positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.notes,
      completionTarget:
        positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.completionTarget ?? undefined,
    }))
    const newPath = await store.createPathWithCourses(trackName, trackDescription, courses)
    trackId = newPath.id
    toast.success(`Track "${trackName}" created with ${successCount} courses`)
  }

  // Apply manifest-specified order. For new tracks this is a defensive no-op
  // (courses are pre-sorted before createPathWithCourses above). For existing
  // tracks this repositions entries added at the tail by batchAddCoursesToPath.
  // Replaces the old per-course reorder loop which moved entries one-at-a-time
  // through the DnD machinery, causing cascading position reassignments.
  const courseIdByFolder = new Map<string, string>()
  for (const r of results) {
    if (r.success && r.courseId) courseIdByFolder.set(normalizeFolder(r.folder), r.courseId)
  }

  // Sort by manifest position to guarantee correct order even if the
  // manifest JSON array order differs from the position field values.
  const manifestOrderedCourseIds = [...positions]
    .filter(p => courseIdByFolder.has(normalizeFolder(p.folder)))
    .sort((a, b) => a.position - b.position)
    .map(p => courseIdByFolder.get(normalizeFolder(p.folder))!)

  // Warn about manifest courses that imported successfully but are missing
  // from the courseIdByFolder map (should never happen after normalization).
  for (const p of positions) {
    if (courseIdByFolder.has(normalizeFolder(p.folder))) continue
    const imported = results.find(r => r.success && normalizeFolder(r.folder) === normalizeFolder(p.folder))
    if (imported) {
      console.warn(
        '[trackManifestImport] Manifest course imported but folder mismatch after normalization — manifest:',
        JSON.stringify(p.folder),
        '| result:',
        JSON.stringify(imported.folder)
      )
    }
  }

  if (manifestOrderedCourseIds.length > 0) {
    console.log(
      '[trackManifestImport] Applying manifest order:',
      manifestOrderedCourseIds.map((id, i) => `${i + 1}. ${id}`)
    )
    await store.applyManifestOrder(trackId, manifestOrderedCourseIds)
  }

  return {
    trackId,
    trackName,
    courses: results,
    successCount,
    failureCount,
  }
}
