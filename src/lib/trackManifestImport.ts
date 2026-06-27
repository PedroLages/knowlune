import { sha256 } from '@/lib/hash'
import { parseTrackManifest } from '@/lib/courseManifest'
import type { TrackManifest, ManifestAuthor } from '@/lib/courseManifest'
import { scanCourseFolderFromHandle, persistScannedCourse } from '@/lib/courseImport'
import type { BulkScanResult } from '@/lib/courseImport'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { db } from '@/db'
import { toast } from 'sonner'

/**
 * Compute a deterministic hash from the manifest content for baseManifestHash.
 * Uses SHA-256 via crypto.subtle for collision resistance.
 */
async function computeManifestHash(manifest: TrackManifest): Promise<string> {
  const fullHash = await sha256(JSON.stringify(manifest.track))
  return fullHash.slice(0, 16) // 16 hex chars = 64 bits, sufficient for collision resistance
}

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
 * Module-level loading lock for batchImportTrackCourses (F-012).
 * Prevents concurrent invocations that could create duplicate tracks
 * or corrupt entry ordering.
 */
let _batchImportLock: Promise<unknown> | null = null

/**
 * Executes a batch import of all courses listed in a track manifest.
 *
 * Iterates sequentially over each course folder listed in the manifest,
 * scanning and persisting each one. Partial failure is accepted — courses
 * that fail to import do not block the rest of the batch.
 *
 * After all courses are imported, creates a track (or matches by name)
 * and adds the successfully imported courses to it.
 *
 * Uses a module-level loading lock to prevent concurrent invocations.
 */
export async function batchImportTrackCourses(
  parentDirHandle: FileSystemDirectoryHandle,
  manifest: TrackManifest
): Promise<BatchImportResult> {
  // In-flight guard: coalesce concurrent calls into a single import
  if (_batchImportLock) return _batchImportLock as Promise<BatchImportResult>

  _batchImportLock = (async () => {
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
      // manifestPosition on ImportedCourse is deprecated — ordering now lives
      // on LearningPathEntry.manifestOrdinal, populated during track creation.
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
        source: 'manifest' as const,
        justification: positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.notes,
        completionTarget:
          positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.completionTarget ?? undefined,
      }))
    await store.batchAddCoursesToPath(trackId, coursesToAdd)
    toast.info(`Added ${coursesToAdd.length} courses to existing track "${trackName}"`)
  } else {
    // Create new track via single-pass createPathFromManifest.
    // This replaces the old two-pass (createPathWithCourses + applyManifestOrder).
    const manifestHash = await computeManifestHash(manifest)
    const manifestCourses = results
      .filter(r => r.success && r.courseId)
      .map(r => ({
        courseId: r.courseId!,
        folder: r.folder,
        position: positions.find(p => normalizeFolder(p.folder) === normalizeFolder(r.folder))?.position ?? 0,
      }))

    // Guard: no courses to add — abort before calling createPathFromManifest
    if (manifestCourses.length === 0) {
      toast.error('No courses were successfully imported — track creation aborted')
      return {
        trackName,
        courses: results,
        successCount: 0,
        failureCount,
      }
    }

    trackId = await store.createPathFromManifest({
      name: trackName,
      description: trackDescription,
      courses: manifestCourses,
      manifestHash,
      manifestName: trackName,
    })
    toast.success(`Track "${trackName}" created with ${successCount} courses`)
  }

  // For existing tracks only: apply manifest order to reposition entries
  // added at the tail by batchAddCoursesToPath. New tracks created via
  // createPathFromManifest already have correct positions.
  if (existingPath) {
    const courseIdByFolder = new Map<string, string>()
    for (const r of results) {
      if (r.success && r.courseId) courseIdByFolder.set(normalizeFolder(r.folder), r.courseId)
    }

    const manifestCoursesForOrder = [...positions]
      .filter(p => courseIdByFolder.has(normalizeFolder(p.folder)))
      .sort((a, b) => a.position - b.position)
      .map(p => ({
        folder: p.folder,
        courseId: courseIdByFolder.get(normalizeFolder(p.folder))!,
        position: p.position,
      }))

    if (manifestCoursesForOrder.length > 0) {
      await store.applyManifestOrder(trackId, manifestCoursesForOrder, {
        setOrderMode: 'manifest',
      })
    }
  }

  return {
    trackId,
    trackName,
    courses: results,
    successCount,
    failureCount,
  }
    })()

    try {
      return await _batchImportLock as Promise<BatchImportResult>
    } finally {
      _batchImportLock = null
    }
}
