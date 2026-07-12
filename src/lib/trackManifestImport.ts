import { parseTrackManifest } from '@/lib/courseManifest'
import type { TrackManifest, ManifestAuthor } from '@/lib/courseManifest'
import { scanCourseFolderFromHandle, persistScannedCourse } from '@/lib/courseImport'
import type { BulkScanResult } from '@/lib/courseImport'
import { matchOrCreateAuthor } from '@/lib/authorDetection'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { db } from '@/db'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import type { ImportedAuthor } from '@/data/types'
import { toast } from 'sonner'
import { decodeUriComponentRepeated } from '@/lib/textUtils'

/** Timeout (ms) for fetching track-manifest.json from a remote server. */
const FETCH_TIMEOUT_MS = 10_000

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

export function matchManifestCourseFolders<T extends { name: string }>(
  folders: T[],
  manifest: TrackManifest
): { folders: T[]; missing: string[] } {
  const available = new Map(
    folders.map(folder => [decodeUriComponentRepeated(folder.name), folder] as const)
  )
  const matched: T[] = []
  const missing: string[] = []

  for (const entry of [...manifest.track.courses].sort((a, b) => a.position - b.position)) {
    const folder = [entry.folder, ...(entry.aliases ?? [])]
      .map(candidate => available.get(decodeUriComponentRepeated(candidate)))
      .find((candidate): candidate is T => !!candidate)
    if (folder) matched.push(folder)
    else missing.push(entry.folder)
  }

  return { folders: matched, missing }
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
 * Fetches and parses a track-manifest.json from a remote server URL.
 *
 * Used by the URL batch import flow to optionally sort discovered sub-directories
 * by manifest-defined position. Returns the same result shape as readTrackManifest
 * so callers can use either source interchangeably.
 */
export async function fetchTrackManifestFromUrl(
  parentUrl: string
): Promise<
  | { ok: true; summary: TrackManifestSummary; manifest: TrackManifest }
  | { ok: false; error: string }
> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const manifestUrl = new URL(
      'track-manifest.json',
      parentUrl.endsWith('/') ? parentUrl : parentUrl + '/'
    ).href

    const response = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      redirect: 'error',
    })

    if (response.status === 404) {
      clearTimeout(timeout)
      return { ok: false, error: 'Not found' }
    }

    if (!response.ok) {
      clearTimeout(timeout)
      return { ok: false, error: `Server returned ${response.status}` }
    }

    // Keep timeout active during body read to guard against slow streaming
    const json = await response.json()
    clearTimeout(timeout)

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
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out' }
    }
    if (err instanceof SyntaxError) {
      return { ok: false, error: 'track-manifest.json is not valid JSON.' }
    }
    return {
      ok: false,
      error: `Failed to fetch track-manifest.json: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
  manifest: TrackManifest,
  signal?: AbortSignal
): Promise<BatchImportResult> {
  if (signal?.aborted) {
    // Early return: signal aborted before any import work began.
    // Returns a BatchImportResult with empty courses, no trackId, and zero counts.
    // The caller should check signal.aborted before using the result for track creation.
    return {
      trackId: undefined,
      trackName: manifest.track.name,
      courses: [],
      successCount: 0,
      failureCount: 0,
    }
  }

  const results: CourseImportResult[] = []
  const positions = manifest.track.courses

  // Phase 1: Import each course sequentially
  for (const entry of positions) {
    if (signal?.aborted) {
      const partialSuccessCount = results.filter(r => r.success).length
      const partialFailureCount = results.length - partialSuccessCount
      return {
        trackName: manifest.track.name,
        courses: results,
        successCount: partialSuccessCount,
        failureCount: partialFailureCount,
      }
    }
    try {
      // Resolve the subdirectory handle — try primary folder, then aliases
      let dirHandle: FileSystemDirectoryHandle | null = null
      let matchedFolder: string | null = null

      const candidateFolders = [entry.folder, ...(entry.aliases ?? [])]
      for (const candidate of candidateFolders) {
        try {
          dirHandle = await parentDirHandle.getDirectoryHandle(candidate)
          matchedFolder = candidate
          break
        } catch {
          // try next candidate
        }
      }

      if (!dirHandle) {
        const aliasHint =
          entry.aliases && entry.aliases.length > 0
            ? ` (also tried: ${entry.aliases.join(', ')})`
            : ''
        results.push({
          folder: entry.folder,
          success: false,
          error: `Folder "${entry.folder}" not found${aliasHint}`,
        })
        toast.warning(`Course folder "${entry.folder}" not found — skipped`)
        continue
      }

      // Scan the subdirectory
      const scanResult: BulkScanResult = await scanCourseFolderFromHandle(dirHandle)

      if (scanResult.status === 'duplicate') {
        const existingCourse = await db.importedCourses.where('name').equals(entry.folder).first()
        if (existingCourse) {
          results.push({ folder: entry.folder, success: true, courseId: existingCourse.id })
        } else {
          results.push({
            folder: entry.folder,
            success: false,
            error: 'Course not found in database',
          })
          toast.warning(`"${entry.folder}" appears to be imported but could not be found`)
        }
        continue
      }

      if (scanResult.status === 'no-files') {
        results.push({ folder: entry.folder, success: false, error: 'No supported files found' })
        toast.warning(`"${entry.folder}" has no supported files — skipped`)
        continue
      }

      if (scanResult.status === 'error') {
        results.push({ folder: entry.folder, success: false, error: scanResult.message })
        toast.error(`Failed to scan "${entry.folder}": ${scanResult.message}`)
        continue
      }

      // v1.1: Advisory expected-count validation
      if (entry.expected && scanResult.status === 'success') {
        const actual = scanResult.course
        const mismatches: string[] = []
        if (
          entry.expected.videos !== undefined &&
          (actual.videos?.length ?? 0) !== entry.expected.videos
        ) {
          mismatches.push(
            `videos: expected ${entry.expected.videos}, got ${actual.videos?.length ?? 0}`
          )
        }
        if (
          entry.expected.pdfs !== undefined &&
          (actual.pdfs?.length ?? 0) !== entry.expected.pdfs
        ) {
          mismatches.push(`pdfs: expected ${entry.expected.pdfs}, got ${actual.pdfs?.length ?? 0}`)
        }
        if (mismatches.length > 0) {
          toast.info(`"${entry.folder}" counts differ from manifest: ${mismatches.join('; ')}`)
        }
      }

      // v1.1: Log if a per-course manifest is specified
      if (entry.courseManifest) {
        try {
          await dirHandle.getFileHandle(entry.courseManifest)
          // File exists — will be used by downstream course processing
        } catch {
          toast.warning(
            `"${entry.folder}" specifies courseManifest "${entry.courseManifest}" but file not found`
          )
        }
      }

      // Persist the scanned course
      const importedCourse = await persistScannedCourse(scanResult.course)
      results.push({ folder: entry.folder, success: true, courseId: importedCourse.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      results.push({ folder: entry.folder, success: false, error: message })
      toast.error(`Failed to import "${entry.folder}": ${message}`)
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount

  // Phase 2: Create or link author from manifest (uses matchOrCreateAuthor for case-insensitive dedup)
  const trackAuthor = manifest.track.author
  if (trackAuthor) {
    try {
      const authorId = await matchOrCreateAuthor(
        trackAuthor.name,
        {
          title: trackAuthor.title,
          bio: trackAuthor.bio,
        },
        { useSyncableWrite: true }
      )
      if (authorId) {
        // Atomic merge: read author, compute updates, and write inside a single
        // Dexie read-write transaction so the course-IDs append is safe against
        // concurrent modifications from other tabs or workers.  The transaction
        // spec includes 'syncQueue' because syncableWrite writes to both the
        // target table and the queue table internally; Dexie binds its inner
        // operations to this outer transaction automatically.
        await db.transaction('rw', ['authors', 'syncQueue'] as const, async () => {
          const existingAuthor = await db.authors.get(authorId)
          if (existingAuthor) {
            const courseIds = results.filter(r => r.success && r.courseId).map(r => r.courseId!)
            const allCourseIds = [...new Set([...existingAuthor.courseIds, ...courseIds])]
            const updates: Partial<ImportedAuthor> = {
              courseIds: allCourseIds,
              updatedAt: new Date().toISOString(),
            }
            if (trackAuthor.shortBio) updates.shortBio = trackAuthor.shortBio
            if (trackAuthor.avatar) updates.photoUrl = trackAuthor.avatar
            if (trackAuthor.specialties) updates.specialties = trackAuthor.specialties
            if (trackAuthor.yearsExperience) updates.yearsExperience = trackAuthor.yearsExperience
            if (trackAuthor.education) updates.education = trackAuthor.education
            if (trackAuthor.website || trackAuthor.linkedin || trackAuthor.twitter) {
              updates.socialLinks = {
                website: trackAuthor.website,
                linkedin: trackAuthor.linkedin,
                twitter: trackAuthor.twitter,
              }
            }
            if (trackAuthor.featuredQuote) updates.featuredQuote = trackAuthor.featuredQuote
            await syncableWrite('authors', 'put', {
              ...existingAuthor,
              ...updates,
            } as unknown as SyncableRecord)
          }
        })
      }
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
