import { db } from '@/db'
import { syncableWrite, syncableBulkPut } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { yieldToMainThread } from '@/lib/yieldToMainThread'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { triggerAutoAnalysis } from '@/lib/autoAnalysis'
import { generateCourseEmbeddingAfterImport } from '@/ai/courseEmbeddingService'
import { unlockSidebarItem } from '@/app/hooks/useProgressiveDisclosure'
import { triggerOllamaTagging } from '@/lib/ollamaTagging'
import { parseCourseManifest } from '@/lib/courseManifest'
import type { CourseManifest, ManifestModule } from '@/lib/courseManifest'
import {
  detectAuthorFromFolderName,
  matchOrCreateAuthor,
  detectAuthorPhoto,
} from '@/lib/authorDetection'
import { autoGenerateThumbnail, autoGenerateThumbnailFromServer } from '@/lib/autoThumbnail'
import { fetchDirectoryListing, isValidImportUrl, canonicalizeUrl } from '@/lib/courseServerService'
import type { ServerResult } from '@/lib/courseServerService'
import { generateStoryboard, saveVideoStoryboard, loadVideoStoryboard } from '@/lib/videoStoryboard'
import {
  loadThumbnailFromFile,
  saveCourseThumbnail,
  fetchThumbnailFromUrl,
} from '@/lib/thumbnailService'
import {
  showDirectoryPicker,
  scanDirectory,
  extractVideoMetadata,
  extractPdfMetadata,
  extractVideoMetadataFromFile,
  extractPdfMetadataFromFile,
  isSupportedVideoFormat,
  isSupportedFile,
  isImageFile,
  getVideoFormat,
} from '@/lib/fileSystem'
import type {
  ImportedAuthor,
  ImportedCourse,
  ImportedVideo,
  ImportedPdf,
  Difficulty,
} from '@/data/types'
import { toast } from 'sonner'

// --- Track Cover Types ---

/** Supported image formats for automatic track-cover detection. */
export const TRACK_COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Supported image extensions for automatic track-cover detection. */
export const TRACK_COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const

/**
 * A candidate image for a learning-track cover, discovered during import.
 *
 * SVG, GIF, BMP, video thumbnails, author avatars, and images nested inside
 * individual course directories are intentionally excluded — they are not
 * suitable as full-width 16:9 track-card banners.
 */
export interface TrackCoverCandidate {
  /** Stable identifier for React keying and selection tracking. */
  id: string
  /** Original filename (e.g. "DevOps-Platform-Engineer.webp"). */
  filename: string
  /** Discovery source — drives how the image is persisted after track creation. */
  source: 'local' | 'server' | 'manifest'
  /** Object URL for local files or full HTTP URL for server images. */
  previewUrl: string
  /** File System Access API handle (present for local-folder imports only). */
  fileHandle?: FileSystemFileHandle
  /** Full HTTP URL to the image on the content server (server imports only). */
  serverUrl?: string
}

/**
 * Returns true when a filename has a supported track-cover extension.
 *
 * Stricter than the general-purpose `isImageFile()` — excludes GIF, SVG, and
 * BMP which are not suitable for 16:9 track-card banners.
 */
export function isTrackCoverImage(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return (TRACK_COVER_EXTENSIONS as readonly string[]).includes(ext)
}

// --- Error Types ---

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_FILES' | 'PERMISSION_DENIED' | 'SCAN_ERROR' | 'DUPLICATE'
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

// --- Scanned Types (pre-persist) ---

/** A video discovered during folder scan, before persistence. */
export interface ScannedVideo {
  id: string
  filename: string
  path: string
  duration: number
  format: ImportedVideo['format']
  order: number
  fileHandle?: FileSystemFileHandle // absent for server-imported files
  fileSize: number // File size in bytes (E1B-S02)
  width: number // Video width in pixels (E1B-S02)
  height: number // Video height in pixels (E1B-S02)
  /** Full HTTP URL when imported from a course server (E133-S01). */
  serverUrl?: string
  /** Module/section title derived from the directory name during server scan. */
  moduleTitle?: string
}

/** A PDF discovered during folder scan, before persistence. */
export interface ScannedPdf {
  id: string
  filename: string
  path: string
  pageCount: number
  fileHandle?: FileSystemFileHandle // absent for server-imported files
  /** Full HTTP URL when imported from a course server (E133-S01). */
  serverUrl?: string
  /** Module/section title derived from the directory name during server scan. */
  moduleTitle?: string
}

/** An image discovered during folder scan, candidate for cover image. */
export interface ScannedImage {
  filename: string
  path: string
  fileHandle?: FileSystemFileHandle // absent for server-imported files
  serverUrl?: string // present for server-imported images (HTTP URL)
}

type VideoExtractionResult = {
  entry: { handle: FileSystemFileHandle; path: string }
  metadata: { duration: number; width: number; height: number; fileSize: number }
}

function toSortedVideos(
  videoResults: PromiseSettledResult<VideoExtractionResult>[]
): ScannedVideo[] {
  return videoResults
    .filter((r): r is PromiseFulfilledResult<VideoExtractionResult> => r.status === 'fulfilled')
    .sort((a, b) =>
      a.value.entry.path.localeCompare(b.value.entry.path, undefined, { numeric: true })
    )
    .map((r, index) => ({
      id: crypto.randomUUID(),
      filename: r.value.entry.handle.name,
      path: r.value.entry.path,
      duration: r.value.metadata.duration,
      format: getVideoFormat(r.value.entry.handle.name),
      order: index + 1,
      fileHandle: r.value.entry.handle,
      fileSize: r.value.metadata.fileSize,
      width: r.value.metadata.width,
      height: r.value.metadata.height,
    }))
}

/**
 * Complete scan result from a course folder, ready for preview/edit
 * before persisting to IndexedDB. Contains all metadata the wizard needs.
 */
export interface ScannedCourse {
  /** Pre-generated course ID (stable across scan → persist). */
  id: string
  /** Folder name used as default course name. */
  name: string
  /** ISO 8601 timestamp of when the scan occurred. */
  scannedAt: string
  /** The directory handle for future file access (absent for server imports). */
  directoryHandle: FileSystemDirectoryHandle | null
  /** Discovered video files with extracted metadata. */
  videos: ScannedVideo[]
  /** Discovered PDF files with extracted metadata. */
  pdfs: ScannedPdf[]
  /** Image files found in the folder, candidates for cover image. */
  images: ScannedImage[]
  /** Parsed course-manifest.json data, if present and valid. */
  manifestData?: CourseManifest
  /** Course source type (E133-S01). */
  source?: 'local' | 'server'
  /** FK to CourseServer.id when source is 'server' (E133-S01). */
  serverId?: string
  /** Relative path from server root to this course folder (E133-S01). */
  serverPath?: string
  /**
   * Whether the file collection was truncated by the maxScanFiles cap.
   * Only set for server-sourced imports. When true, the import result is
   * partial — the user may need to increase the cap or split the folder.
   */
  truncated?: boolean
  /** Caption files (SRT/VTT) discovered during server scan, matched to videos by stem. */
  captions?: ScannedCaption[]
}

/** A caption/subtitle file discovered during server scan. */
export interface ScannedCaption {
  /** Raw filename stem before language suffix stripping (used for video matching). */
  videoStem: string
  /** Detected language code (e.g., "en") if a known suffix was stripped. */
  language?: string
  /** Raw SRT/VTT text content. */
  srtContent: string
  /** Full HTTP URL to the caption file on the server. */
  serverUrl: string
  /** Matched video ID in the scan set (populated after matching). */
  matchedVideoId?: string
  /** Original filename (e.g. "001_intro_en.srt"). */
  filename: string
  /** Caption format derived from extension. */
  format: 'srt' | 'vtt'
}

// --- Scan Phase ---

/**
 * Reads and parses course-manifest.json from a directory handle.
 * Returns undefined if the file is missing, invalid, or unreadable.
 */
async function readCourseManifest(
  dirHandle: FileSystemDirectoryHandle
): Promise<CourseManifest | undefined> {
  try {
    const fileHandle = await dirHandle.getFileHandle('course-manifest.json')
    const file = await fileHandle.getFile()
    const text = await file.text()
    const json = JSON.parse(text)
    const result = parseCourseManifest(json)
    if (result.ok) {
      return result.value
    }
    console.warn('[scanCourseFolder] Manifest parse errors:', result.errors)
    return undefined
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      // No manifest file — silently continue
    } else if (err instanceof SyntaxError) {
      console.warn('[scanCourseFolder] Manifest is not valid JSON:', err.message)
    } else {
      console.warn('[scanCourseFolder] Failed to read manifest:', err)
    }
    return undefined
  }
}

/**
 * Reads and parses course-manifest.json from a File array (drag-drop path).
 */
async function readCourseManifestFromFiles(files: File[]): Promise<CourseManifest | undefined> {
  const manifestFile = files.find(f => f.name === 'course-manifest.json')
  if (!manifestFile) return undefined
  try {
    const text = await manifestFile.text()
    const json = JSON.parse(text)
    const result = parseCourseManifest(json)
    if (result.ok) {
      return result.value
    }
    console.warn('[scanFromDroppedFiles] Manifest parse errors:', result.errors)
    return undefined
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn('[scanFromDroppedFiles] Manifest is not valid JSON:', err.message)
    } else {
      console.warn('[scanFromDroppedFiles] Failed to read manifest:', err)
    }
    return undefined
  }
}

/**
 * Scans a user-selected folder for course content (videos + PDFs).
 * Extracts metadata but does NOT persist anything to IndexedDB.
 *
 * This enables a preview/edit step between scan and persist (wizard flow).
 *
 * @throws ImportError with code 'PERMISSION_DENIED' | 'NO_FILES' | 'SCAN_ERROR' | 'DUPLICATE'
 * @throws Error with message containing 'cancelled' if user cancels the picker
 */
export async function scanCourseFolder(): Promise<ScannedCourse> {
  const store = useCourseImportStore.getState()
  const progressStore = useImportProgressStore.getState()

  store.setImporting(true)
  store.setImportError(null)
  store.setImportProgress(null)

  // Generate a temporary courseId for progress tracking (will be replaced by actual ID later)
  const tempCourseId = crypto.randomUUID()

  try {
    // Step 1: Show directory picker
    let dirHandle: FileSystemDirectoryHandle
    try {
      dirHandle = await showDirectoryPicker()
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        throw error // Let caller handle cancellation
      }
      throw new ImportError(
        'We need access to your course folder to import it. Please grant permission and try again.',
        'PERMISSION_DENIED'
      )
    }

    // Start progress tracking (AC1: "Scanning folder... 0 of ? files processed")
    progressStore.startImport(tempCourseId, dirHandle.name)

    // Check for duplicate import
    const existingCourse = await db.importedCourses.where('name').equals(dirHandle.name).first()
    if (existingCourse) {
      throw new ImportError(
        `"${dirHandle.name}" is already imported. Remove it first to re-import.`,
        'DUPLICATE'
      )
    }

    // Step 2: Scan directory for supported files (including images for cover selection)
    const videoFiles: { handle: FileSystemFileHandle; path: string }[] = []
    const pdfFiles: { handle: FileSystemFileHandle; path: string }[] = []
    const imageFiles: { handle: FileSystemFileHandle; path: string }[] = []
    let scanCount = 0

    try {
      // Recursive pass: videos + PDFs (course content may be in subdirectories)
      for await (const entry of scanDirectory(dirHandle, '', { includeImages: false })) {
        if (useImportProgressStore.getState().cancelRequested) {
          useImportProgressStore.getState().confirmCancellation()
          throw new Error('Import cancelled by user')
        }

        if (isSupportedVideoFormat(entry.handle.name)) {
          videoFiles.push(entry)
        } else {
          pdfFiles.push(entry)
        }
        scanCount++
        if (scanCount % 10 === 0) {
          progressStore.updateScanProgress(tempCourseId, scanCount, null)
        }
      }

      // Root-only pass: images (cover selection should only see root-folder images)
      for await (const entry of scanDirectory(dirHandle, '', {
        includeImages: true,
        maxDepth: 0,
      })) {
        if (useImportProgressStore.getState().cancelRequested) {
          useImportProgressStore.getState().confirmCancellation()
          throw new Error('Import cancelled by user')
        }

        if (isImageFile(entry.handle.name)) imageFiles.push(entry)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        throw error
      }
      console.error('[Import] Directory scan failed:', error)
      throw new ImportError('Failed to scan the selected folder. Please try again.', 'SCAN_ERROR')
    }

    // Step 3: Validate results
    if (videoFiles.length === 0 && pdfFiles.length === 0) {
      throw new ImportError(
        'No supported files found. Please select a folder containing video (MP4, MKV, AVI, WEBM) or PDF files.',
        'NO_FILES'
      )
    }

    const totalFiles = videoFiles.length + pdfFiles.length
    store.setImportProgress({ current: 0, total: totalFiles })
    // Update progress with known total (AC2: "45 of 120 files processed (38%)")
    progressStore.updateProcessingProgress(tempCourseId, 0, totalFiles)

    // Step 4: Extract metadata in batches (max 10 concurrent to limit memory pressure)
    const BATCH_SIZE = 10
    let processedCount = 0

    async function extractInBatches<T, R>(
      items: T[],
      extractor: (item: T) => Promise<R>
    ): Promise<PromiseSettledResult<R>[]> {
      const results: PromiseSettledResult<R>[] = []
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        // Check for cancellation between batches
        if (useImportProgressStore.getState().cancelRequested) {
          useImportProgressStore.getState().confirmCancellation()
          throw new Error('Import cancelled by user')
        }

        const batch = items.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.allSettled(
          batch.map(async item => {
            const result = await extractor(item)
            processedCount++
            store.setImportProgress({ current: processedCount, total: totalFiles })
            // AC2: Update progress with file count and percentage
            progressStore.updateProcessingProgress(tempCourseId, processedCount, totalFiles)
            return result
          })
        )
        results.push(...batchResults)
      }
      return results
    }

    const videoResults = await extractInBatches(videoFiles, async entry => {
      const metadata = await extractVideoMetadata(entry.handle)
      return { entry, metadata }
    })

    const pdfResults = await extractInBatches(pdfFiles, async entry => {
      const metadata = await extractPdfMetadata(entry.handle)
      return { entry, metadata }
    })

    // Step 5: Build scanned course record
    const courseId = crypto.randomUUID()
    const courseName = dirHandle.name
    const now = new Date().toISOString()

    const videos: ScannedVideo[] = toSortedVideos(videoResults)

    // Build PDF records from successful extractions (sorted by path with natural numeric order)
    const pdfs: ScannedPdf[] = pdfResults
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          entry: { handle: FileSystemFileHandle; path: string }
          metadata: { pageCount: number }
        }> => r.status === 'fulfilled'
      )
      .sort((a, b) =>
        a.value.entry.path.localeCompare(b.value.entry.path, undefined, { numeric: true })
      )
      .map(r => ({
        id: crypto.randomUUID(),
        filename: r.value.entry.handle.name,
        path: r.value.entry.path,
        pageCount: r.value.metadata.pageCount,
        fileHandle: r.value.entry.handle,
      }))

    // Build image candidates for cover selection (sorted by path)
    const images: ScannedImage[] = [...imageFiles]
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
      .map(entry => ({
        filename: entry.handle.name,
        path: entry.path,
        fileHandle: entry.handle,
      }))

    // Read course-manifest.json if present
    const manifestData = await readCourseManifest(dirHandle)

    // Mark scan complete in progress store
    progressStore.completeCourse(tempCourseId)

    return {
      id: courseId,
      name: courseName,
      scannedAt: now,
      directoryHandle: dirHandle,
      videos,
      pdfs,
      images,
      manifestData,
    }
  } catch (error) {
    if (error instanceof ImportError) {
      store.setImportError(error.message)
      progressStore.failCourse(tempCourseId, error.message)
      if (error.code === 'PERMISSION_DENIED') {
        toast.error(error.message, {
          action: {
            label: 'Try Again',
            onClick: () => {
              scanCourseFolder().catch(() => {})
            },
          },
        })
      } else {
        toast.error(error.message)
      }
    } else if (error instanceof Error && error.message.includes('cancelled')) {
      // User cancelled — don't show error (AC4: cancellation confirmed via overlay)
    } else {
      const message = 'An unexpected error occurred during import. Please try again.'
      store.setImportError(message)
      progressStore.failCourse(tempCourseId, message)
      toast.error(message)
      console.error('[Import] Unexpected error:', error)
    }
    throw error
  } finally {
    store.setImporting(false)
    store.setImportProgress(null)
  }
}

// --- Manifest Lesson Mapping ---

/**
 * Converts a video filename into a human-readable display title.
 * Strips the extension, replaces separators with spaces, and capitalizes words.
 */
function deriveTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

interface ManifestFlatLesson {
  filename: string
  title: string
  moduleTitle: string
  order: number
}

/**
 * Flattens manifest module/lesson structure into an ordered list
 * with sequential 1-based positions.
 */
function flattenManifestModules(modules: ManifestModule[]): ManifestFlatLesson[] {
  const flat: ManifestFlatLesson[] = []
  let order = 1
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      flat.push({
        filename: lesson.filename,
        title: lesson.title,
        moduleTitle: mod.title,
        order: order++,
      })
    }
  }
  return flat
}

/**
 * Applies manifest-defined lesson ordering, titles, and module grouping
 * to an array of ImportedVideo records.
 *
 * - Videos that match a manifest lesson (by filename) get the manifest's title,
 *   moduleTitle, and order.
 * - Videos not in the manifest are appended after manifest-ordered videos with
 *   filename-derived titles and sequential order.
 * - If multiple videos match the same manifest lesson filename, the first match
 *   wins; the rest are treated as unmatched.
 * - Unmatched manifest lessons (no video file found) are logged as warnings.
 *
 * When `strict` is true (default), unmatched videos are EXCLUDED — only files
 * explicitly listed in the manifest are imported. This lets you skip unwanted
 * lessons by writing a course-manifest.json that lists only what to include.
 */
function applyManifestVideoOrder(
  videos: ImportedVideo[],
  modules: ManifestModule[],
  strict = true
): ImportedVideo[] {
  const flatLessons = flattenManifestModules(modules)

  const matchedVideoIds = new Set<string>()
  const ordered: ImportedVideo[] = []

  // First pass: match videos to manifest lessons in manifest order
  for (const lesson of flatLessons) {
    const video = videos.find(
      v =>
        v.filename.toLowerCase().trim() === lesson.filename.toLowerCase().trim() &&
        !matchedVideoIds.has(v.id)
    )
    if (!video) {
      console.warn(
        `[persistScannedCourse] Manifest lesson "${lesson.title}" has no matching video: ${lesson.filename}`
      )
      continue
    }

    matchedVideoIds.add(video.id)
    ordered.push({
      ...video,
      title: lesson.title,
      moduleTitle: lesson.moduleTitle || video.moduleTitle || undefined,
      order: lesson.order,
    })
  }

  // Second pass: append videos not referenced in the manifest (skip when strict)
  if (!strict) {
    let nextOrder = flatLessons.length + 1
    for (const video of videos) {
      if (!matchedVideoIds.has(video.id)) {
        ordered.push({
          ...video,
          title: deriveTitleFromFilename(video.filename),
          moduleTitle: video.moduleTitle || undefined,
          order: nextOrder++,
        })
      }
    }
  } else if (videos.length > matchedVideoIds.size) {
    console.warn(
      `[persistScannedCourse] Skipped ${videos.length - matchedVideoIds.size} video(s) not listed in course-manifest.json`
    )
  }

  return ordered
}

// --- Persist Phase ---

/**
 * Persists a scanned course to IndexedDB, updates Zustand store,
 * and triggers auto-analysis / Ollama tagging.
 *
 * Accepts an optional `overrides` parameter so the wizard can modify
 * the course name, tags, etc. before persisting.
 */
export async function persistScannedCourse(
  scanned: ScannedCourse,
  overrides?: {
    name?: string
    description?: string
    category?: string
    tags?: string[]
    coverImageHandle?: FileSystemFileHandle
    authorId?: string
    skipStoreUpdate?: boolean
    difficulty?: Difficulty
    authorName?: string
  }
): Promise<ImportedCourse> {
  const now = new Date().toISOString()

  // Build ImportedVideo records (add courseId + metadata fields from E1B-S02)
  const videos: ImportedVideo[] = scanned.videos.map(v => ({
    id: v.id,
    courseId: scanned.id,
    filename: v.filename,
    path: v.path,
    duration: v.duration,
    format: v.format,
    order: v.order,
    fileHandle: v.fileHandle ?? null,
    fileSize: v.fileSize,
    width: v.width,
    height: v.height,
    ...(v.serverUrl ? { serverUrl: v.serverUrl } : {}),
    ...(v.moduleTitle ? { moduleTitle: v.moduleTitle } : {}),
  }))

  // Apply manifest lesson mapping (title, moduleTitle, order) when a manifest is present
  const manifestModules = scanned.manifestData?.course.modules
  const orderedVideos =
    manifestModules && manifestModules.length > 0
      ? applyManifestVideoOrder(videos, manifestModules)
      : videos

  // Build ImportedPdf records
  const pdfs: ImportedPdf[] = scanned.pdfs.map(p => ({
    id: p.id,
    courseId: scanned.id,
    filename: p.filename,
    path: p.path,
    pageCount: p.pageCount,
    fileHandle: p.fileHandle ?? null,
    ...(p.serverUrl ? { serverUrl: p.serverUrl } : {}),
    ...(p.moduleTitle ? { moduleTitle: p.moduleTitle } : {}),
  }))

  // Author detection: use explicit override (authorId or authorName from manifest),
  // fall back to manifest author name, or auto-detect from folder name (AC1-AC3, AC5)
  let authorId: string | undefined = overrides?.authorId
  let detectedAuthorName: string | null = null
  const authorName = overrides?.authorName ?? scanned.manifestData?.course.author?.name
  if (authorName) {
    // Manifest-provided author name takes precedence — resolve via matchOrCreateAuthor
    try {
      const authorTitle = scanned.manifestData?.course.author?.title
      const authorBio = scanned.manifestData?.course.author?.bio
      const matchedId = await matchOrCreateAuthor(
        authorName,
        authorTitle || authorBio ? { title: authorTitle, bio: authorBio } : undefined,
        { useSyncableWrite: true }
      )
      if (matchedId) {
        authorId = matchedId
      }
    } catch (error) {
      console.warn('[Import] Manifest author creation failed:', error)
    }
  } else if (!authorId) {
    try {
      detectedAuthorName = detectAuthorFromFolderName(scanned.name)
      const matchedId = await matchOrCreateAuthor(detectedAuthorName, undefined, {
        useSyncableWrite: true,
      })
      if (matchedId) {
        authorId = matchedId
      }
    } catch (error) {
      // Author detection is non-critical — log and continue (AC5)
      console.warn('[Import] Author detection failed:', error)
    }
  }

  // Aggregate video metadata for course-level display (E1B-S02)
  const totalDuration = orderedVideos.reduce((sum, v) => sum + (v.duration || 0), 0)
  const totalFileSize = orderedVideos.reduce((sum, v) => sum + (v.fileSize || 0), 0)
  const maxResolutionHeight = orderedVideos.reduce((max, v) => Math.max(max, v.height || 0), 0)

  const course: ImportedCourse = {
    id: scanned.id,
    name: overrides?.name ?? scanned.name,
    ...(overrides?.description ? { description: overrides.description } : {}),
    importedAt: now,
    category: overrides?.category ?? '',
    ...(overrides?.difficulty !== undefined ? { difficulty: overrides.difficulty } : {}),
    tags: overrides?.tags ?? [],
    status: 'not-started',
    videoCount: orderedVideos.length,
    pdfCount: pdfs.length,
    directoryHandle: scanned.directoryHandle,
    ...(overrides?.coverImageHandle ? { coverImageHandle: overrides.coverImageHandle } : {}),
    ...(authorId ? { authorId } : {}),
    totalDuration: totalDuration > 0 ? totalDuration : undefined,
    totalFileSize: totalFileSize > 0 ? totalFileSize : undefined,
    maxResolutionHeight: maxResolutionHeight > 0 ? maxResolutionHeight : undefined,
    // Server import fields (E133-S01)
    ...(scanned.source ? { source: scanned.source } : {}),
    ...(scanned.serverId ? { serverId: scanned.serverId } : {}),
    ...(scanned.serverPath ? { serverPath: scanned.serverPath } : {}),
  }

  console.debug('[Import] Persisting course:', {
    id: course.id,
    name: course.name,
    videoCount: course.videoCount,
    pdfCount: course.pdfCount,
    source: course.source,
    serverPath: course.serverPath,
  })

  // Idempotency guard: check if this course has a checkpoint from a prior
  // partial import. If the checkpoint shows videos or PDFs were already
  // written, we can trust the existing data and skip those phases.
  // (Captions are intentionally NOT checkpointed — they are derived purely
  // from on-disk .srt/.vtt files, so skipping them on resume is safe.)
  const checkpointKey = `import-check:${scanned.id}`
  const existingCheckpoint = await db.syncMetadata.get(checkpointKey)
  const checkpointValue = (existingCheckpoint?.value ?? {}) as { phase?: string; at?: string }
  const skipVideos = checkpointValue.phase === 'videos' || checkpointValue.phase === 'pdfs'
  const skipPdfs = checkpointValue.phase === 'pdfs'

  // Track persist progress so the UI can show per-file progress during the
  // sequential writes below. Without this, the wizard shows only "Importing…"
  // and the user has no indication that work is happening — for courses with
  // many files the silence can be long enough to feel stuck.
  const totalPersistItems = 1 + orderedVideos.length + pdfs.length
  let persistCompleted = 0
  const persistProgress = useImportProgressStore.getState()
  persistProgress.startImport(scanned.id, course.name)
  persistProgress.updateProcessingProgress(scanned.id, 0, totalPersistItems)

  try {
    // Map scanned video IDs → persisted video IDs for caption association.
    // Populated during the video write loops below so caption.matchedVideoId
    // (set at scan time with the scanned video's UUID) is translated to the
    // actual persisted video ID before writing to videoCaptions.
    const scannedToPersistedVideoId = new Map<string, string>()

    // Unit 8: Re-import safety — upsert instead of insert to prevent duplicates.
    // Uses Dexie's put() through a helper that checks for existing records by
    // matching (courseId, serverUrl) for server imports or (courseId, path) for local.

    // Check if this course was already imported (same serverPath).
    // Uses filter() instead of .where() because serverPath may not be indexed yet.
    let existingCourse: ImportedCourse | undefined
    if (scanned.serverPath) {
      const allCourses = await db.importedCourses.toArray()
      existingCourse = allCourses.find(c => c.serverPath === scanned.serverPath)
    }

    const isReimport = !!existingCourse
    if (isReimport && existingCourse) {
      // Re-import: update existing course record, preserve original id
      const updatedCourse = { ...(course as ImportedCourse), id: existingCourse.id }
      await syncableWrite('importedCourses', 'put', updatedCourse as unknown as SyncableRecord)
      persistCompleted++

      // Collect existing video/PDF IDs for this course to enable upsert
      const existingVideos = await db.importedVideos
        .where('courseId')
        .equals(existingCourse.id)
        .toArray()
      const existingPdfs = await db.importedPdfs
        .where('courseId')
        .equals(existingCourse.id)
        .toArray()
      const existingVidByServerUrl = new Map(
        existingVideos.filter(v => v.serverUrl).map(v => [v.serverUrl!, v])
      )
      const existingPdfByServerUrl = new Map(
        existingPdfs.filter(p => p.serverUrl).map(p => [p.serverUrl!, p])
      )
      const keptVideoIds = new Set<string>()
      const keptPdfIds = new Set<string>()

      // Build video records for bulkPut — use existing IDs for matching server URLs
      const videoRecords: ImportedVideo[] = []
      for (const video of orderedVideos) {
        const existing = video.serverUrl ? existingVidByServerUrl.get(video.serverUrl) : undefined
        const record = existing ? { ...video, id: existing.id } : video
        videoRecords.push(record)
        if (existing) {
          keptVideoIds.add(existing.id)
        } else {
          keptVideoIds.add(record.id)
        }
        scannedToPersistedVideoId.set(video.id, record.id)
      }

      // Build PDF records for bulkPut
      const pdfRecords: ImportedPdf[] = []
      for (const pdf of pdfs) {
        const existing = pdf.serverUrl ? existingPdfByServerUrl.get(pdf.serverUrl) : undefined
        const record = existing ? { ...pdf, id: existing.id } : pdf
        pdfRecords.push(record)
        if (existing) {
          keptPdfIds.add(existing.id)
        } else {
          keptPdfIds.add(record.id)
        }
      }

      // Bulk write all videos and PDFs — replaces per-file syncableWrite loop
      if (videoRecords.length > 0) {
        await syncableBulkPut('importedVideos', videoRecords as unknown as SyncableRecord[])
        persistCompleted += videoRecords.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
        // Checkpoint: videos written — if we crash now, we know videos are done
        await db.syncMetadata.put({ table: `import-check:${scanned.id}`, value: { phase: 'videos', at: now } })
        await yieldToMainThread()
      }
      if (pdfRecords.length > 0) {
        await syncableBulkPut('importedPdfs', pdfRecords as unknown as SyncableRecord[])
        persistCompleted += pdfRecords.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
        // Checkpoint: PDFs written
        await db.syncMetadata.put({ table: `import-check:${scanned.id}`, value: { phase: 'pdfs', at: now } })
        await yieldToMainThread()
      }

      // Prune orphaned records (files removed from server since last import)
      for (const v of existingVideos) {
        if (!keptVideoIds.has(v.id)) {
          await db.importedVideos.delete(v.id)
          await db.videoCaptions.where('videoId').equals(v.id).delete()
        }
      }
      for (const p of existingPdfs) {
        if (!keptPdfIds.has(p.id)) {
          await db.importedPdfs.delete(p.id)
        }
      }

      // Use the existing course ID for all downstream operations
      course.id = existingCourse.id
    } else {
      // First import: write course record individually, then bulk-write videos and PDFs.
      // Using put (upsert) so re-import after incomplete delete doesn't fail
      // with primary-key constraint violations on orphaned child records.
      await syncableWrite('importedCourses', 'put', course as unknown as SyncableRecord)
      persistCompleted++
      persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)

      // Bulk write all videos — replaces per-file syncableWrite loop.
      // On retry (skipVideos), the checkpoint tells us videos already
      // landed in Dexie via a prior bulkPut — skip the write but still
      // populate the scanned→persisted ID map and advance progress.
      if (orderedVideos.length > 0 && !skipVideos) {
        await syncableBulkPut('importedVideos', orderedVideos as unknown as SyncableRecord[])
        for (const video of orderedVideos) {
          scannedToPersistedVideoId.set(video.id, video.id)
        }
        persistCompleted += orderedVideos.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
        // Checkpoint: videos written
        await db.syncMetadata.put({ table: `import-check:${scanned.id}`, value: { phase: 'videos', at: now } })
        await yieldToMainThread()
      } else if (orderedVideos.length > 0 && skipVideos) {
        // Videos were already persisted in a prior attempt — populate ID map
        for (const video of orderedVideos) {
          scannedToPersistedVideoId.set(video.id, video.id)
        }
        persistCompleted += orderedVideos.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
      }

      // Bulk write all PDFs — replaces per-file syncableWrite loop
      if (pdfs.length > 0 && !skipPdfs) {
        await syncableBulkPut('importedPdfs', pdfs as unknown as SyncableRecord[])
        persistCompleted += pdfs.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
        // Checkpoint: PDFs written
        await db.syncMetadata.put({ table: `import-check:${scanned.id}`, value: { phase: 'pdfs', at: now } })
        await yieldToMainThread()
      } else if (pdfs.length > 0 && skipPdfs) {
        // PDFs were already persisted in a prior attempt
        persistCompleted += pdfs.length
        persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
      }
    }

    // Persist captions (SRT/VTT) to videoCaptions table using db.videoCaptions.put().
    // We use put() (upsert on compound PK [courseId+videoId]) so re-importing
    // the same course does not throw on duplicate-key conflicts.
    // We use a direct Dexie call rather than syncableWrite because videoCaptions
    // is intentionally not in the sync tableRegistry (captions are locally
    // sourced from .srt/.vtt files — they have no Supabase equivalent).
    //
    // The scannedToPersistedVideoId map translates scan-time video UUIDs to
    // the actual persisted video IDs (which may differ during re-import).
    if (scanned.captions && scanned.captions.length > 0) {
      for (const caption of scanned.captions) {
        if (caption.matchedVideoId && caption.srtContent) {
          const persistedVideoId = scannedToPersistedVideoId.get(caption.matchedVideoId)
          if (!persistedVideoId) continue
          await db.videoCaptions.put({
            courseId: course.id,
            videoId: persistedVideoId,
            filename: caption.filename,
            content: caption.srtContent,
            format: caption.format,
            createdAt: now,
          })
          persistCompleted++
        }
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    useImportProgressStore
      .getState()
      .failCourse(scanned.id, `Failed to save "${course.name}": ${detail}`)
    const message = `Failed to save "${course.name}": ${detail}`
    console.error('[Import] Persist transaction failed:', error)
    toast.error(message)
    throw error
  }

  // Post-persist verification — ensure data actually landed in IndexedDB.
  // If the read-back fails, the syncableWrite calls above succeeded (they would
  // have thrown otherwise), so the data is in Dexie.  A transient read issue or
  // index delay is the most likely explanation.  Continue with the store update
  // and post-import tasks — the course will appear after a page refresh at worst.
  const persisted = await db.importedCourses.get(course.id)
  if (!persisted) {
    console.warn(
      '[Import] Post-persist verification: course not found on read-back — continuing with store update (data was written successfully)'
    )
    toast.warning(`"${course.name}" imported but may need a page refresh to appear.`)
  }

  // Link course to author if detected (AC2) + attach photo if found (E25-S05)
  if (authorId) {
    try {
      const author = await db.authors.get(authorId)
      if (author) {
        const updates: Partial<ImportedAuthor> = { updatedAt: now }

        // Link course if not already linked
        if (!author.courseIds.includes(course.id)) {
          updates.courseIds = [...author.courseIds, course.id]
        }

        // Detect and attach author photo if author doesn't already have one (E25-S05)
        if (!author.photoHandle && !author.photoUrl) {
          const photoCandidate = detectAuthorPhoto(scanned.images)
          if (photoCandidate) {
            updates.photoHandle = photoCandidate.fileHandle
            console.warn(
              `[Import] Auto-detected author photo: ${photoCandidate.path} for "${author.name}"`
            )
          }
        }

        if (Object.keys(updates).length > 1) {
          // More than just updatedAt — fetch-then-put so syncableWrite has the full record
          const fullAuthor = await db.authors.get(authorId)
          if (fullAuthor) {
            await syncableWrite('authors', 'put', {
              ...fullAuthor,
              ...updates,
            } as unknown as SyncableRecord)
          }
        }
      }
    } catch (error) {
      // Non-critical — author link is best-effort
      console.warn('[Import] Failed to link course to author:', error)
    }
  }

  // Update Zustand store (skip when caller handles batch refresh)
  if (!overrides?.skipStoreUpdate) {
    useCourseImportStore.setState(state => ({
      importedCourses: [...state.importedCourses, course],
    }))
  }

  // Show success toast (AC4: include author name when detected)
  const authorSuffix = detectedAuthorName ? ` by ${detectedAuthorName}` : ''
  toast.success(
    `Imported: ${course.name}${authorSuffix} — ${orderedVideos.length} ${orderedVideos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
  )

  // Trigger auto-analysis (fire-and-forget, consent-gated)
  triggerAutoAnalysis(course)

  // Trigger Ollama auto-tagging (fire-and-forget, independent of cloud AI)
  triggerOllamaTagging(course, orderedVideos, pdfs)

  // Generate course embedding for ML recommendations (fire-and-forget, E52-S04)
  generateCourseEmbeddingAfterImport(course).catch(err => {
    // silent-catch-ok: embedding failure logged inside generateCourseEmbeddingAfterImport
    console.error('[CourseEmbedding] Unexpected outer catch during import embedding:', err)
  })

  // Auto-generate thumbnail from first video at 10% mark (E1B-S04 AC1)
  // Skip if user selected a cover image in the wizard — don't overwrite their choice
  // Tiered approach: local FileHandle > server image > server video frame (best-effort)
  if (!overrides?.coverImageHandle && orderedVideos.length > 0) {
    const firstVideo = orderedVideos[0]
    if (firstVideo.fileHandle) {
      autoGenerateThumbnail(course.id, firstVideo.fileHandle).catch(err => {
        // silent-catch-ok: thumbnail generation failure is non-fatal — card shows placeholder icon (E1B-S04 AC3)
        console.warn('[ServerThumbnail] Local thumbnail generation failed:', {
          courseId: course.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    } else if (scanned.images.length > 0 && scanned.images[0].serverUrl) {
      // Server course with discovered images — use first image as thumbnail (more reliable than video extraction)
      fetchThumbnailFromUrl(scanned.images[0].serverUrl)
        .then(async blob => {
          await saveCourseThumbnail(course.id, blob, 'auto')
          const url = URL.createObjectURL(blob)
          useCourseImportStore.setState(state => ({
            thumbnailUrls: { ...state.thumbnailUrls, [course.id]: url },
          }))
        })
        .catch(err => {
          // Fall back to video frame extraction
          console.warn('[ServerThumbnail] Image fetch failed, falling back to video extraction:', {
            courseId: course.id,
            imageUrl: scanned.images[0].serverUrl,
            error: err instanceof Error ? err.message : String(err),
          })
          if (firstVideo.serverUrl) {
            console.debug('[ServerThumbnail] Attempting thumbnail from server video (fallback):', {
              courseId: course.id,
              videoUrl: firstVideo.serverUrl,
            })
            autoGenerateThumbnailFromServer(course.id, firstVideo.serverUrl).catch(err => {
              console.warn('[ServerThumbnail] Video thumbnail extraction also failed:', {
                courseId: course.id,
                videoUrl: firstVideo.serverUrl,
                error: err instanceof Error ? err.message : String(err),
              })
            })
          }
        })
    } else if (firstVideo.serverUrl) {
      console.debug('[ServerThumbnail] Attempting thumbnail from server video:', {
        courseId: course.id,
        videoUrl: firstVideo.serverUrl,
      })
      autoGenerateThumbnailFromServer(course.id, firstVideo.serverUrl).catch(err => {
        console.warn('[ServerThumbnail] Thumbnail generation failed:', {
          courseId: course.id,
          videoUrl: firstVideo.serverUrl,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  // Background storyboard generation for local videos (fire-and-forget, sequential).
  // Skips YouTube videos; skips videos that already have a storyboard (idempotent).
  // Failure is non-fatal — live extraction (Phase 1) serves previews until lazy backfill.
  const localVideos = orderedVideos.filter(v => !v.youtubeVideoId && v.fileHandle)
  if (localVideos.length > 0) {
    // Fire-and-forget — don't block the import wizard on storyboard generation
    void (async () => {
      for (const vid of localVideos) {
        try {
          const existing = await loadVideoStoryboard(vid.id)
          if (existing) {
            URL.revokeObjectURL(existing.url)
            continue // Already generated — skip
          }
          const result = await generateStoryboard(vid.fileHandle!)
          if (result) {
            await saveVideoStoryboard(vid.id, course.id, result)
          }
        } catch {
          // silent-catch-ok: storyboard generation is non-fatal
        }
      }
    })()
  }

  // Persist user-selected cover image to courseThumbnails table so card renders it
  if (overrides?.coverImageHandle) {
    try {
      const file = await overrides.coverImageHandle.getFile()
      const resizedBlob = await loadThumbnailFromFile(file)
      await saveCourseThumbnail(course.id, resizedBlob, 'local')
      const url = URL.createObjectURL(resizedBlob)
      useCourseImportStore.setState(state => ({
        thumbnailUrls: { ...state.thumbnailUrls, [course.id]: url },
      }))
    } catch (error) {
      // silent-catch-ok: thumbnail persistence failure is non-fatal — card shows placeholder icon
      console.warn('[Import] Failed to save user-selected cover image:', error)
    }
  }

  // E32-S03: Check storage quota after import (fire-and-forget)
  import('@/lib/storageQuotaMonitor').then(({ checkStorageQuota }) => {
    checkStorageQuota().catch(() => {
      // silent-catch-ok: quota check is advisory
    })
  })

  // Create import-finished notification
  useNotificationStore.getState().create({
    type: 'import-finished',
    title: `Course imported: ${course.name}`,
    message: `${orderedVideos.length} ${orderedVideos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'} imported successfully`,
    actionUrl: `/courses/${course.id}`,
  })

  // Unlock sidebar items via progressive disclosure
  unlockSidebarItem('course-imported')

  // Mark the course as fully imported in the progress overlay
  useImportProgressStore.getState().completeCourse(scanned.id)

  return course
}

// --- Bulk Scan Phase (from pre-selected handle) ---

/**
 * Result of scanning a single folder for bulk import.
 * Separates success/failure for consolidated reporting.
 */
export type BulkScanResult =
  | { status: 'success'; course: ScannedCourse; truncated?: boolean }
  | { status: 'no-files'; folderName: string }
  | { status: 'duplicate'; folderName: string }
  | { status: 'error'; folderName: string; message: string }

/**
 * Scans a directory handle directly (no picker prompt).
 * Used by bulk import to scan sub-folders of a parent directory.
 *
 * Does NOT interact with the Zustand store or show toasts — the caller
 * is responsible for aggregated UI updates.
 */
export async function scanCourseFolderFromHandle(
  dirHandle: FileSystemDirectoryHandle
): Promise<BulkScanResult> {
  try {
    // Check for duplicate import
    const existingCourse = await db.importedCourses.where('name').equals(dirHandle.name).first()
    if (existingCourse) {
      return { status: 'duplicate', folderName: dirHandle.name }
    }

    // Scan directory for supported files
    const videoFiles: { handle: FileSystemFileHandle; path: string }[] = []
    const pdfFiles: { handle: FileSystemFileHandle; path: string }[] = []
    const imageFiles: { handle: FileSystemFileHandle; path: string }[] = []
    try {
      // Recursive pass: videos + PDFs (course content may be in subdirectories)
      for await (const entry of scanDirectory(dirHandle, '', { includeImages: false })) {
        // Check for cancellation during scan (AC4)
        if (useImportProgressStore.getState().cancelRequested) {
          return { status: 'error', folderName: dirHandle.name, message: 'Cancelled' }
        }

        if (isSupportedVideoFormat(entry.handle.name)) {
          videoFiles.push(entry)
        } else {
          pdfFiles.push(entry)
        }
      }

      // Root-only pass: images (cover selection should only see root-folder images)
      for await (const entry of scanDirectory(dirHandle, '', {
        includeImages: true,
        maxDepth: 0,
      })) {
        if (useImportProgressStore.getState().cancelRequested) {
          return { status: 'error', folderName: dirHandle.name, message: 'Cancelled' }
        }

        if (isImageFile(entry.handle.name)) imageFiles.push(entry)
      }
    } catch (error) {
      console.error('[BulkImport] Directory scan failed:', error)
      return { status: 'error', folderName: dirHandle.name, message: 'Failed to scan folder' }
    }

    // Check for supported files
    if (videoFiles.length === 0 && pdfFiles.length === 0) {
      return { status: 'no-files', folderName: dirHandle.name }
    }

    // Extract metadata in batches
    const BATCH_SIZE = 10
    async function extractInBatches<T, R>(
      items: T[],
      extractor: (item: T) => Promise<R>
    ): Promise<PromiseSettledResult<R>[]> {
      const results: PromiseSettledResult<R>[] = []
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        // Check for cancellation between batches (AC4)
        if (useImportProgressStore.getState().cancelRequested) {
          return results // Return partial results, caller handles cancellation
        }

        const batch = items.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.allSettled(batch.map(extractor))
        results.push(...batchResults)
      }
      return results
    }

    const videoResults = await extractInBatches(videoFiles, async entry => {
      const metadata = await extractVideoMetadata(entry.handle)
      return { entry, metadata }
    })

    const pdfResults = await extractInBatches(pdfFiles, async entry => {
      const metadata = await extractPdfMetadata(entry.handle)
      return { entry, metadata }
    })

    const courseId = crypto.randomUUID()
    const now = new Date().toISOString()

    const videos: ScannedVideo[] = toSortedVideos(videoResults)

    const pdfs: ScannedPdf[] = pdfResults
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          entry: { handle: FileSystemFileHandle; path: string }
          metadata: { pageCount: number }
        }> => r.status === 'fulfilled'
      )
      .map(r => ({
        id: crypto.randomUUID(),
        filename: r.value.entry.handle.name,
        path: r.value.entry.path,
        pageCount: r.value.metadata.pageCount,
        fileHandle: r.value.entry.handle,
      }))

    const images: ScannedImage[] = imageFiles.map(entry => ({
      filename: entry.handle.name,
      path: entry.path,
      fileHandle: entry.handle,
    }))

    const manifestData = await readCourseManifest(dirHandle)

    return {
      status: 'success',
      course: {
        id: courseId,
        name: dirHandle.name,
        scannedAt: now,
        directoryHandle: dirHandle,
        videos,
        pdfs,
        images,
        manifestData,
      },
    }
  } catch (error) {
    console.error('[BulkImport] Unexpected error:', error)
    return {
      status: 'error',
      folderName: dirHandle.name,
      message: error instanceof Error ? error.message : 'Unexpected error',
    }
  }
}

/**
 * Scans a course folder from the appropriate source (server URL or local handle).
 *
 * Encapsulates the branching logic that decides between server-sourced and
 * local-file-system imports. Used by `BulkImportDialog` to avoid duplicating
 * the source-selection pattern across its scan loop and rescan handler.
 *
 * @returns A `BulkScanResult` preserving all statuses (`'success'`, `'error'`,
 *          `'no-files'`, `'duplicate'`). Server-URL scans produce `'success'`
 *          or `'error'`; handle scans pass through `scanCourseFolderFromHandle`'s
 *          full result shape.
 */
export async function scanCourseFromSource(source: {
  serverUrl?: string
  handle: FileSystemDirectoryHandle | null
  folderName: string
}): Promise<BulkScanResult> {
  if (source.serverUrl) {
    try {
      // Check for duplicate by folder name before scanning (same as local handle path)
      const existingCourse = await db.importedCourses
        .where('name')
        .equals(source.folderName)
        .first()
      if (existingCourse) {
        return { status: 'duplicate', folderName: source.folderName }
      }

      const scannedCourse = await scanCourseFolderFromServer(source.serverUrl)
      return {
        status: 'success',
        course: scannedCourse,
        ...(scannedCourse.truncated ? { truncated: true } : {}),
      }
    } catch (error) {
      return {
        status: 'error',
        folderName: source.folderName,
        message: error instanceof Error ? error.message : 'Failed to scan server folder',
      }
    }
  } else if (source.handle) {
    // Pass through the full result from scanCourseFolderFromHandle,
    // which may include 'no-files' or 'duplicate' statuses.
    return await scanCourseFolderFromHandle(source.handle)
  } else {
    return { status: 'error', folderName: source.folderName, message: 'No source available' }
  }
}

/**
 * Enumerates immediate sub-directories of a parent directory.
 * Used by bulk import to discover course folders.
 */
export async function listSubDirectories(
  parentHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const dirs: FileSystemDirectoryHandle[] = []
  for await (const entry of parentHandle.values()) {
    if (entry.kind === 'directory') {
      dirs.push(entry as FileSystemDirectoryHandle)
    }
  }
  // Return directories in file-system order — callers that need a specific
  // order (e.g. BulkImportDialog when a track-manifest.json defines positions)
  // are responsible for sorting themselves.
  return dirs
}

/**
 * Enumerates immediate sub-directories of a remote server URL using nginx
 * autoindex directory listings.
 *
 * Validates the URL, fetches the directory listing, and returns only directory
 * entries. Errors are surfaced as `ServerResult` with user-friendly messages.
 *
 * @param url - Full URL to a directory on an nginx server
 * @returns Array of sub-directory names and their full URLs
 */
export async function listServerSubDirectories(
  url: string
): Promise<ServerResult<{ name: string; url: string }[]>> {
  // Validate URL first — catches empty strings, bad protocols, bare IP roots
  const validation = isValidImportUrl(url)
  if (!validation.valid) {
    return { ok: false, error: validation.reason }
  }

  // Fetch the directory listing
  const result = await fetchDirectoryListing(url)
  if (!result.ok) {
    return result // passthrough error (network, timeout, non-200, parse failure)
  }

  // Filter for directory entries only
  const directories = result.data.files
    .filter(f => f.type === 'directory')
    .map(f => ({ name: f.name.replace(/\/$/, ''), url: f.url }))

  return { ok: true, data: directories }
}

/**
 * Result of listing a server track root — directories (course folders) and
 * track-cover image candidates discovered at the immediate root level.
 */
export interface ServerTrackRootListing {
  /** Immediate child directories (course folders). */
  directories: Array<{ name: string; url: string }>
  /** Immediate child image files suitable for track covers (JPEG/PNG/WebP only). */
  images: Array<{ name: string; url: string }>
}

/**
 * List a server URL's immediate children — both directories and root-level images.
 *
 * Makes a single HTTP request to the directory listing. Returns directories
 * (for course-folder discovery) AND root-level images (for track-cover detection)
 * in one call. Does NOT recurse into subdirectories.
 *
 * Images inside course directories are excluded — only files directly in the
 * track root are returned. Duplicate canonical URLs are deduplicated and
 * images are sorted naturally by filename.
 *
 * @param url - Full URL to a track-root directory on an nginx server
 * @returns Both directories and root-level track-cover images
 */
export async function listServerTrackRoot(
  url: string
): Promise<ServerResult<ServerTrackRootListing>> {
  // Validate URL first — catches empty strings, bad protocols, bare IP roots
  const validation = isValidImportUrl(url)
  if (!validation.valid) {
    return { ok: false, error: validation.reason }
  }

  // Fetch the directory listing (single HTTP request)
  const result = await fetchDirectoryListing(url)
  if (!result.ok) {
    return result // passthrough error (network, timeout, non-200, parse failure)
  }

  // Filter for directory entries
  const directories = result.data.files
    .filter(f => f.type === 'directory')
    .map(f => ({ name: f.name.replace(/\/$/, ''), url: f.url }))

  // Filter for root-level track-cover images (JPEG/PNG/WebP only — not GIF/SVG/BMP)
  const seenUrls = new Set<string>()
  const images: Array<{ name: string; url: string }> = []

  for (const f of result.data.files) {
    if (f.type !== 'image') continue
    if (!isTrackCoverImage(f.name)) continue // excludes GIF, SVG, BMP
    const canonical = canonicalizeUrl(f.url)
    if (seenUrls.has(canonical)) continue
    seenUrls.add(canonical)
    images.push({ name: f.name, url: f.url })
  }

  // Sort images naturally by filename
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  return { ok: true, data: { directories, images } }
}

// --- Drag-and-Drop File Import (E33-S06) ---

/**
 * Scans dropped files to create a ScannedCourse without showDirectoryPicker().
 * Enables E2E test automation via Playwright's setInputFiles() or dispatchEvent('drop').
 *
 * Key differences from scanCourseFolder():
 * - No directory picker prompt — files come from drag-and-drop or file input
 * - No FileSystemDirectoryHandle — directoryHandle is null (file handles may be available)
 * - Video/PDF metadata extracted directly from File objects
 * - No duplicate detection (no folder name to check against)
 *
 * @param files Array of File objects from drop event or file input
 * @param courseName Name to use for the course (defaults to "Dropped Course")
 * @throws ImportError with code 'NO_FILES' if no supported files found
 */
export async function scanFromDroppedFiles(
  files: File[],
  courseName = 'Dropped Course'
): Promise<ScannedCourse> {
  const store = useCourseImportStore.getState()
  store.setImporting(true)
  store.setImportError(null)
  store.setImportProgress(null)

  try {
    // Categorize files by type
    const videoFiles: File[] = []
    const pdfFiles: File[] = []
    const imageFileList: File[] = []

    for (const file of files) {
      if (isSupportedVideoFormat(file.name)) {
        videoFiles.push(file)
      } else if (isSupportedFile(file.name) && !isSupportedVideoFormat(file.name)) {
        // isSupportedFile includes PDFs and videos — exclude videos
        pdfFiles.push(file)
      } else if (isImageFile(file.name)) {
        imageFileList.push(file)
      }
    }

    if (videoFiles.length === 0 && pdfFiles.length === 0) {
      const unsupportedCount = files.length - imageFileList.length
      const hint =
        unsupportedCount > 0
          ? ` Found ${files.length} file(s) but none matched supported formats.`
          : ''
      throw new ImportError(
        `No supported files found.${hint} Supported: MP4, MKV, AVI, WEBM, PDF. Try using "Select Folder" for course folders.`,
        'NO_FILES'
      )
    }

    const totalFiles = videoFiles.length + pdfFiles.length
    store.setImportProgress({ current: 0, total: totalFiles })

    // Extract video metadata from File objects
    // Sort dropped files by name for deterministic order (no folder structure in drops)
    const sortedVideoFiles = [...videoFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    let processedCount = 0
    const videos: ScannedVideo[] = []
    for (const file of sortedVideoFiles) {
      try {
        const metadata = await extractVideoMetadataFromFile(file)
        videos.push({
          id: crypto.randomUUID(),
          filename: file.name,
          path: file.name,
          duration: metadata.duration,
          format: getVideoFormat(file.name),
          order: videos.length + 1,
          fileHandle: null as unknown as FileSystemFileHandle, // No handle for dropped files
          fileSize: metadata.fileSize,
          width: metadata.width,
          height: metadata.height,
        })
      } catch {
        // silent-catch-ok: skip files that fail metadata extraction
        console.warn(`[Import] Failed to extract metadata for dropped file: ${file.name}`)
      }
      processedCount++
      store.setImportProgress({ current: processedCount, total: totalFiles })
    }

    // Extract PDF metadata from File objects (sorted by name with natural numeric order)
    const sortedPdfFiles = [...pdfFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    const pdfs: ScannedPdf[] = []
    for (const file of sortedPdfFiles) {
      try {
        const metadata = await extractPdfMetadataFromFile(file)
        pdfs.push({
          id: crypto.randomUUID(),
          filename: file.name,
          path: file.name,
          pageCount: metadata.pageCount,
          fileHandle: null as unknown as FileSystemFileHandle, // No handle for dropped files
        })
      } catch {
        // silent-catch-ok: skip files that fail metadata extraction
        console.warn(`[Import] Failed to extract metadata for dropped file: ${file.name}`)
      }
      processedCount++
      store.setImportProgress({ current: processedCount, total: totalFiles })
    }

    // Build image candidates (no metadata extraction needed)
    const images: ScannedImage[] = imageFileList.map(file => ({
      filename: file.name,
      path: file.name,
      fileHandle: null as unknown as FileSystemFileHandle, // No handle for dropped files
    }))

    const manifestData = await readCourseManifestFromFiles(files)

    return {
      id: crypto.randomUUID(),
      name: courseName,
      scannedAt: new Date().toISOString(),
      directoryHandle: null as unknown as FileSystemDirectoryHandle, // No directory handle for drops
      videos,
      pdfs,
      images,
      manifestData,
    }
  } catch (error) {
    if (error instanceof ImportError) {
      store.setImportError(error.message)
      toast.error(error.message)
    } else {
      const message = 'An unexpected error occurred while processing dropped files.'
      store.setImportError(message)
      toast.error(message)
      console.error('[Import] Drop processing error:', error)
    }
    throw error
  } finally {
    store.setImporting(false)
    store.setImportProgress(null)
  }
}

// --- Backwards-Compatible One-Shot Import ---

/**
 * One-shot import: scans folder then persists immediately.
 * Preserves the original API for existing callers (Courses page, Overview page).
 */
export async function importCourseFromFolder(): Promise<ImportedCourse> {
  const scanned = await scanCourseFolder()
  return persistScannedCourse(scanned)
}

// --- Drive Import (E77b-S02) ---

/**
 * Describes a single file from a Google Drive folder to be imported as a course lesson.
 * This is the minimal surface the caller must provide — typically sourced from
 * the Google Drive API response.
 */
export interface DriveFileDescription {
  /** Google Drive file ID. */
  fileId: string
  /** Display name of the file (used for lesson title and filename fallback). */
  name: string
  /** MIME type of the file (e.g., 'video/mp4'). */
  mimeType: string
}

/**
 * Imports a course directly from Google Drive without downloading any files.
 *
 * Creates a Course record with `sourceDriveId` set to the Drive folder ID, and
 * Lesson (ImportedVideo) records with per-file `driveFileRef` entries pointing
 * to the corresponding Drive file IDs — no file download at import time.
 *
 * Drive-sourced courses are first-class courses sharing the same data model and
 * UX as local imports. Files are streamed on-demand when the user plays a lesson.
 *
 * @param folderId - The Google Drive folder ID
 * @param folderName - Display name for the course (typically the folder name)
 * @param files - Array of Drive file descriptions to import as lessons
 * @returns The persisted ImportedCourse record
 */
export async function importCourseFromDrive(
  folderId: string,
  folderName: string,
  files: DriveFileDescription[]
): Promise<ImportedCourse> {
  const courseId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Validate that all fileIds match the expected Drive format
  const FILE_ID_RE = /^[a-zA-Z0-9_-]+$/
  for (const f of files) {
    if (!FILE_ID_RE.test(f.fileId)) {
      throw new Error(`Invalid Drive fileId format: "${f.fileId}"`)
    }
  }

  // Only video files become lessons; non-video files (PDFs, images, audio, etc.)
  // are silently skipped. PDF records are not persisted here — that is deferred
  // to a follow-up story (E77B-S03 or later) which will also add driveFileRef to
  // the ImportedPdf type. Until then, pdfCount is zeroed to avoid implying
  // records exist that were never stored.
  const videoFiles = files.filter(f => f.mimeType.startsWith('video/'))

  const videos: ImportedVideo[] = videoFiles.map((f, index) => ({
    id: crypto.randomUUID(),
    courseId,
    filename: f.name,
    path: '', // No local path for Drive files
    duration: 0, // Unknown at import time (no download)
    format: 'mp4' as const, // Conservative default; refined on first play
    order: index + 1,
    fileHandle: null as unknown as FileSystemFileHandle, // No local handle
    fileSize: undefined,
    width: undefined,
    height: undefined,
    driveFileRef: { fileId: f.fileId, driveSource: 'google' },
  }))

  const course: ImportedCourse = {
    id: courseId,
    name: folderName,
    importedAt: now,
    category: '',
    tags: [],
    status: 'not-started',
    videoCount: videos.length,
    pdfCount: 0, // PDF records not persisted yet (deferred to E77B-S03+)
    directoryHandle: null as unknown as FileSystemDirectoryHandle,
    sourceDriveId: folderId,
    source: 'drive',
  }

  // Persist course + videos using syncableWrite for sync queue entries
  await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
  for (const video of videos) {
    await syncableWrite('importedVideos', 'add', video as unknown as SyncableRecord)
  }

  return course
}

// ─── Server Import (E133-S01) ──────────────────────────────────────────────────

/**
 * Maximum number of concurrent directory listing requests during recursive scan.
 * nginx serves autoindex pages fast — 10 concurrent keeps import snappy without
 * hammering the server.
 */
const MAX_CONCURRENT_DIR_SCANS = 10

/**
 * Recursively scan a course folder on a remote HTTP server using nginx
 * autoindex directory listings. No File System Access API handles needed —
 * all files are referenced by their HTTP URL.
 *
 * The plan skips video metadata extraction (duration, resolution) during
 * import because loading 50+ video files over HTTP is too slow. Videos get
 * `duration: 0` initially; the real duration is reported by the `<video>`
 * element at playback time and updated asynchronously.
 *
 * @param folderUrl — Full URL to the course folder (e.g. "http://192.168.2.200:8099/AI/Course/")
 * @param serverId — Optional FK to CourseServer.id for settings integration
 * @returns A ScannedCourse ready for the wizard's details step
 */

/**
 * Derive a clean module/section title from a directory URL.
 * Strips the numeric prefix (e.g., "01 - Overview" → "Overview").
 */
function deriveModuleTitle(dirUrl: string | undefined): string | undefined {
  if (!dirUrl) return undefined
  try {
    const pathname = new URL(dirUrl).pathname
    const segments = pathname.split('/').filter(Boolean)
    const lastSegment = decodeURIComponent(segments[segments.length - 1] || '')
    if (!lastSegment) return undefined
    // Strip numeric prefix: "01-Overview" → "Overview", "02 - Getting Started" → "Getting Started"
    const cleaned = lastSegment
      .replace(/^\d+\s*-\s*/, '')
      .replace(/^\d+-/, '')
      .replace(/^\d+\s+/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    return cleaned || lastSegment
  } catch {
    return undefined
  }
}

/** Known language suffixes in caption filenames (e.g., "001_intro_en.srt"). */
const CAPTION_LANG_SUFFIXES = [
  '_en',
  '_fr',
  '_es',
  '_de',
  '_ja',
  '_zh',
  '_ko',
  '_pt',
  '_ar',
  '_ru',
  '_it',
  '_nl',
  '_pl',
  '_sv',
  '_tr',
  '_hi',
  '_vi',
  '_th',
] as const

/** Strips known language suffix from a stem. Returns {cleanStem, language}. */
function stripLanguageSuffix(stem: string): { cleanStem: string; language?: string } {
  for (const suffix of CAPTION_LANG_SUFFIXES) {
    if (stem.toLowerCase().endsWith(suffix)) {
      return { cleanStem: stem.slice(0, -suffix.length), language: suffix.slice(1) }
    }
  }
  return { cleanStem: stem }
}

export async function scanCourseFolderFromServer(
  folderUrl: string,
  serverId?: string,
  maxScanFiles: number = 5_000
): Promise<ScannedCourse> {
  const progressStore = useImportProgressStore.getState()
  const courseId = crypto.randomUUID()

  // Extract course name from URL path (last segment before trailing /)
  const urlPath = new URL(folderUrl).pathname
  const segments = urlPath.split('/').filter(Boolean)
  const courseName = decodeURIComponent(segments[segments.length - 1] || 'Imported Course')

  // Compute the course base URL so derived paths are course-folder-relative.
  // Stripping the full course URL (not just protocol+host) from file URLs
  // produces paths like "01-Overview/001-intro.mp4" instead of
  // "Academy/DevOps/MyCourse/01-Overview/001-intro.mp4".
  // This matches local import behavior where paths are relative to the course folder.
  const courseBaseUrl = folderUrl.replace(/\/+$/, '')
  progressStore.startImport(courseId, courseName)

  // Recursively collect all files
  const allVideos: {
    name: string
    url: string
    path: string
    format: 'mp4' | 'webm' | 'mkv' | 'ts' | 'avi'
  }[] = []
  const allPdfs: { name: string; url: string; path: string }[] = []
  const allImages: { name: string; url: string; path: string }[] = []
  const allCaptions: {
    rawStem: string
    cleanStem: string
    language?: string
    name: string
    url: string
  }[] = []
  // Map file URLs → parent directory URLs for section structure derivation
  const fileDirMap = new Map<string, string>()

  // Deduplication: track seen file URLs (canonical form) to avoid counting
  // the same file multiple times due to symlinks, encoding variants, etc.
  const seenFileUrls = new Set<string>()
  // Diagnostics: track duplicate counts for transparency
  const duplicateVideoUrls: string[] = []
  const duplicatePdfUrls: string[] = []
  const duplicateDirUrls: string[] = []

  // Breadth-first traversal with concurrency limit
  const pendingDirs: string[] = [folderUrl]
  const seen = new Set<string>()
  let dirsScanned = 0
  let hitCap = false

  while (pendingDirs.length > 0) {
    // Check for cancellation
    if (useImportProgressStore.getState().cancelRequested) {
      useImportProgressStore.getState().confirmCancellation()
      throw new Error('Import cancelled by user')
    }

    // Take up to MAX_CONCURRENT_DIR_SCANS directories
    const batch = pendingDirs.splice(0, MAX_CONCURRENT_DIR_SCANS)

    const results = await Promise.allSettled(
      batch.map(async dirUrl => {
        // Canonicalize directory URL for deduplication (trailing slash, encoding variants)
        const canonicalDirUrl = canonicalizeUrl(dirUrl)
        if (seen.has(canonicalDirUrl)) return
        seen.add(canonicalDirUrl)

        const result = await fetchDirectoryListing(dirUrl)
        if (!result.ok) {
          console.warn(`[scanServer] Failed to list ${dirUrl}: ${result.error}`)
          return
        }

        for (const file of result.data.files) {
          const currentCount = allVideos.length + allPdfs.length + allImages.length
          if (currentCount >= maxScanFiles) break
          if (file.type === 'directory') {
            // Deduplicate directory URLs before enqueuing
            const canonicalChildDir = canonicalizeUrl(file.url)
            // Skip parent-directory links and URLs outside the course base path
            if (!canonicalChildDir.startsWith(courseBaseUrl)) continue
            if (seen.has(canonicalChildDir)) {
              if (duplicateDirUrls.length < 20) duplicateDirUrls.push(file.url)
              continue
            }
            pendingDirs.push(file.url)
          } else if (file.type === 'video') {
            const canonicalFileUrl = canonicalizeUrl(file.url)
            if (seenFileUrls.has(canonicalFileUrl)) {
              if (duplicateVideoUrls.length < 20) duplicateVideoUrls.push(file.url)
              continue
            }
            seenFileUrls.add(canonicalFileUrl)
            const relPath = file.url.replace(courseBaseUrl + '/', '')
            const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
            const validFormats = ['mp4', 'webm', 'mkv', 'ts', 'avi'] as const
            allVideos.push({
              name: file.name,
              url: file.url,
              path: relPath,
              format: validFormats.includes(ext as (typeof validFormats)[number])
                ? (ext as 'mp4' | 'webm' | 'mkv' | 'ts' | 'avi')
                : 'mp4',
            })
            fileDirMap.set(file.url, dirUrl)
          } else if (file.type === 'pdf') {
            const canonicalFileUrl = canonicalizeUrl(file.url)
            if (seenFileUrls.has(canonicalFileUrl)) {
              if (duplicatePdfUrls.length < 20) duplicatePdfUrls.push(file.url)
              continue
            }
            seenFileUrls.add(canonicalFileUrl)
            const relPath = file.url.replace(courseBaseUrl + '/', '')
            allPdfs.push({
              name: file.name,
              url: file.url,
              path: relPath,
            })
            fileDirMap.set(file.url, dirUrl)
          } else if (file.type === 'image') {
            const canonicalFileUrl = canonicalizeUrl(file.url)
            if (seenFileUrls.has(canonicalFileUrl)) continue
            seenFileUrls.add(canonicalFileUrl)
            const relPath = file.url.replace(courseBaseUrl + '/', '')
            allImages.push({
              name: file.name,
              url: file.url,
              path: relPath,
            })
          } else if (file.type === 'caption') {
            const canonicalFileUrl = canonicalizeUrl(file.url)
            if (seenFileUrls.has(canonicalFileUrl)) continue
            seenFileUrls.add(canonicalFileUrl)
            // Collect caption files for post-scan matching (Unit 4)
            const captionStemRaw = file.name.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
            const { cleanStem, language } = stripLanguageSuffix(captionStemRaw)
            allCaptions.push({
              rawStem: captionStemRaw,
              cleanStem,
              language,
              name: file.name,
              url: file.url,
            })
          }
        }

        dirsScanned++
        // Update progress: dirsScanned / approximate total (pending + scanned + current batch)
        const total = pendingDirs.length + seen.size
        const fileCount = allVideos.length + allPdfs.length + allImages.length
        progressStore.updateScanProgress(courseId, fileCount, total > 0 ? total : null)
      })
    )

    // Log any unexpected failures during concurrent scans
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[scanServer] Directory scan rejected:', r.reason)
      }
    }
  }

  // Emit diagnostics report with deduplication statistics
  if (duplicateVideoUrls.length > 0 || duplicatePdfUrls.length > 0 || duplicateDirUrls.length > 0) {
    console.info('[scanServer] Import diagnostics:', {
      courseName,
      uniqueDirs: seen.size,
      uniqueVideos: allVideos.length,
      duplicateVideosSkipped: duplicateVideoUrls.length,
      uniquePdfs: allPdfs.length,
      duplicatePdfsSkipped: duplicatePdfUrls.length,
      duplicateDirsSkipped: duplicateDirUrls.length,
      firstDuplicateVideoUrls: duplicateVideoUrls.slice(0, 20),
      firstDuplicateDirUrls: duplicateDirUrls.slice(0, 20),
    })
  }

  // Detect and log when the file cap was reached during the scan.
  // This means the import result is partial — the server directory has more
  // files than maxScanFiles permits.
  const totalFiles = allVideos.length + allPdfs.length + allImages.length
  if (totalFiles >= maxScanFiles) {
    hitCap = true
    console.warn(
      `[scanServer] File cap reached: ${totalFiles} files collected (max ${maxScanFiles}). ` +
        `Some files and directories from ${folderUrl} were skipped. ` +
        `Consider splitting the folder or increasing maxScanFiles.`
    )
  }

  // Build ScannedVideo[] — no fileHandle, duration=0 (lazy at playback)
  const videos: ScannedVideo[] = allVideos
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map((v, index) => ({
      id: crypto.randomUUID(),
      filename: v.name,
      path: v.path,
      duration: 0, // Deferred to playback (plan: skip metadata extraction for speed)
      format: v.format as ScannedVideo['format'],
      order: index + 1,
      fileSize: 0,
      width: 0,
      height: 0,
      serverUrl: v.url,
      moduleTitle: deriveModuleTitle(fileDirMap.get(v.url)),
    }))

  // Build ScannedPdf[] — no fileHandle, pageCount=0 (lazy or Range-read later).
  // NOTE: Material classification is deferred to render-time via
  // lessonBasedCurriculum.matchMaterialsToLessons(). Scan-time classification
  // was removed because isMaterialFilename() patterns are too aggressive for
  // server-sourced PDFs — primary PDFs (e.g., "001 Linux Distros.pdf") were
  // misclassified as materials and attached to wrong parent videos.
  const pdfs: ScannedPdf[] = allPdfs
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(p => ({
      id: crypto.randomUUID(),
      filename: p.name,
      path: p.path,
      pageCount: 0,
      serverUrl: p.url,
      moduleTitle: deriveModuleTitle(fileDirMap.get(p.url)),
    }))

  // Post-scan caption matching: match SRT/VTT files to videos by stem
  const captions: ScannedCaption[] = []
  for (const cap of allCaptions) {
    // Try matching by clean stem (after language suffix stripping)
    const matchingVideo = videos.find(v => {
      const vStem = v.filename.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
      return vStem === cap.cleanStem
    })
    // Fallback: try the raw stem (includes language suffix)
    const fallbackVideo = !matchingVideo
      ? videos.find(v => {
          const vStem = v.filename.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
          return vStem === cap.rawStem
        })
      : null
    const targetVideo = matchingVideo || fallbackVideo
    if (targetVideo) {
      // Fetch caption content
      let srtContent = ''
      try {
        const resp = await fetch(cap.url)
        if (resp.ok) {
          srtContent = await resp.text()
        }
      } catch {
        console.warn(`[scanServer] Failed to fetch caption: ${cap.url}`)
      }
      captions.push({
        videoStem: cap.cleanStem,
        language: cap.language,
        srtContent,
        serverUrl: cap.url,
        matchedVideoId: targetVideo.id,
        filename: cap.name,
        format: cap.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
      })
    } else {
      console.warn(`[scanServer] No matching video for caption: ${cap.name}`)
    }
  }

  // Mark import as complete in progress store
  progressStore.completeCourse(courseId)

  // Derive server path (relative path from server root to this course folder)
  const serverPath = decodeURIComponent(urlPath.replace(/^\//, '').replace(/\/$/, ''))

  // Build ScannedImage[] from server-discovered images
  const images: ScannedImage[] = allImages
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(img => ({
      filename: img.name,
      path: img.path,
      serverUrl: img.url,
    }))

  return {
    id: courseId,
    name: courseName,
    scannedAt: new Date().toISOString(),
    directoryHandle: null,
    videos,
    pdfs,
    images,
    source: 'server',
    captions: captions.length > 0 ? captions : undefined,
    ...(serverId ? { serverId } : {}),
    serverPath,
    ...(hitCap ? { truncated: true } : {}),
  }
}

// ─── Track Cover Persistence ─────────────────────────────────────────────────

/**
 * Persists a selected track-cover candidate to Supabase Storage and updates the
 * LearningPath record via the store.
 *
 * Handles both local (FileSystemFileHandle) and remote (HTTP URL) image sources.
 * Upload failures are non-blocking — the track import succeeds regardless.
 *
 * @returns A status string describing the outcome for import result feedback.
 */
export async function applyImportedTrackCover({
  trackId,
  candidate,
  isExplicitSelection,
  preserveExisting,
}: {
  trackId: string
  candidate: TrackCoverCandidate
  /** True when the user explicitly selected this candidate in the chooser UI. */
  isExplicitSelection: boolean
  /** When true and the track already has a cover, skip persistence entirely. */
  preserveExisting: boolean
}): Promise<
  | 'track-cover-added-automatically'
  | 'track-cover-selected'
  | 'track-cover-upload-failed'
  | 'track-cover-skipped-preserved'
> {
  const lpStore = useLearningPathStore.getState()
  const existingPath = lpStore.paths.find(p => p.id === trackId)

  // Preserve existing manual covers unless the user explicitly chose a new one
  if (preserveExisting && !isExplicitSelection && existingPath?.coverImageUrl) {
    return 'track-cover-skipped-preserved'
  }
  if (preserveExisting && !isExplicitSelection && existingPath?.coverPreset) {
    return 'track-cover-skipped-preserved'
  }

  try {
    let file: File

    if (candidate.source === 'local' && candidate.fileHandle) {
      // Read from local FileSystemFileHandle
      file = await candidate.fileHandle.getFile()
    } else if (candidate.serverUrl) {
      // Fetch from remote server with CORS
      const response = await fetch(candidate.serverUrl)
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} for ${candidate.serverUrl}`)
      }
      const contentType = response.headers.get('Content-Type') ?? ''
      if (!contentType.startsWith('image/')) {
        throw new Error(`Unexpected Content-Type "${contentType}" for ${candidate.serverUrl}`)
      }
      const blob = await response.blob()
      // Enforce a reasonable source-size limit (10 MB) to prevent OOM on misconfigured servers
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error(`Image too large (${(blob.size / 1024 / 1024).toFixed(1)} MB)`)
      }
      file = new File([blob], candidate.filename, {
        type: contentType || 'image/jpeg',
      })
    } else {
      throw new Error('Track cover candidate has no readable source')
    }

    // Dynamically import to avoid circular dependency at module-load time
    const { uploadPathCover } = await import('@/lib/pathCoverUpload')
    const coverImageUrl = await uploadPathCover(file, trackId)

    await lpStore.updatePathCover(trackId, {
      coverImageUrl,
      coverPreset: undefined,
    })

    return isExplicitSelection ? 'track-cover-selected' : 'track-cover-added-automatically'
  } catch (error) {
    // Non-blocking: track import succeeds regardless of cover upload failure
    console.warn(
      '[applyImportedTrackCover] Cover upload failed (non-blocking):',
      error instanceof Error ? error.message : error
    )

    // Fallback: if it's a server image, try storing the direct URL so the card
    // still renders something (ephemeral — the URL may break later, but better
    // than showing nothing)
    if (candidate.serverUrl) {
      try {
        await lpStore.updatePathCover(trackId, {
          coverImageUrl: candidate.serverUrl,
          coverPreset: undefined,
        })
        return isExplicitSelection ? 'track-cover-selected' : 'track-cover-added-automatically'
      } catch {
        // Best-effort fallback also failed — card will show gradient
      }
    }

    return 'track-cover-upload-failed'
  }
}

/**
 * Enumerates immediate image files in a directory handle that are suitable for
 * track covers (JPEG/PNG/WebP only). Does NOT recurse into subdirectories.
 *
 * Returns candidates sorted naturally by filename. Callers are responsible for
 * revoking object URLs via `URL.revokeObjectURL()` when done.
 */
export async function collectLocalTrackCoverCandidates(
  parentDirHandle: FileSystemDirectoryHandle
): Promise<TrackCoverCandidate[]> {
  const candidates: TrackCoverCandidate[] = []

  for await (const entry of parentDirHandle.values()) {
    if (entry.kind !== 'file') continue
    if (!isTrackCoverImage(entry.name)) continue

    const fileHandle = entry as FileSystemFileHandle
    try {
      const file = await fileHandle.getFile()
      candidates.push({
        id: crypto.randomUUID(),
        filename: fileHandle.name,
        source: 'local',
        previewUrl: URL.createObjectURL(file),
        fileHandle,
      })
    } catch {
      // Skip files that can't be read (permissions, etc.)
    }
  }

  return candidates.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true })
  )
}
