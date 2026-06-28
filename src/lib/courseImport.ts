import { db } from '@/db'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
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
import { autoGenerateThumbnail } from '@/lib/autoThumbnail'
import { fetchDirectoryListing } from '@/lib/courseServerService'
import { generateStoryboard, saveVideoStoryboard, loadVideoStoryboard } from '@/lib/videoStoryboard'
import { loadThumbnailFromFile, saveCourseThumbnail } from '@/lib/thumbnailService'
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
}

/** An image discovered during folder scan, candidate for cover image. */
export interface ScannedImage {
  filename: string
  path: string
  fileHandle?: FileSystemFileHandle // absent for server-imported files
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

    // Build PDF records from successful extractions
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

    // Build image candidates for cover selection
    const images: ScannedImage[] = imageFiles.map(entry => ({
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
      moduleTitle: lesson.moduleTitle || undefined,
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
          moduleTitle: undefined,
          order: nextOrder++,
        })
      }
    }
  } else if (videos.length > matchedVideoIds.size) {
    console.log(
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
  }))

  // Apply manifest lesson mapping (title, moduleTitle, order) when a manifest is present
  const manifestModules = scanned.manifestData?.course.modules
  const orderedVideos =
    manifestModules && manifestModules.length > 0
      ? applyManifestVideoOrder(videos, manifestModules)
      : videos

  // Build ImportedPdf records (add courseId)
  const pdfs: ImportedPdf[] = scanned.pdfs.map(p => ({
    id: p.id,
    courseId: scanned.id,
    filename: p.filename,
    path: p.path,
    pageCount: p.pageCount,
    fileHandle: p.fileHandle ?? null,
    ...(p.serverUrl ? { serverUrl: p.serverUrl } : {}),
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
        authorTitle || authorBio ? { title: authorTitle, bio: authorBio } : undefined
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
      const matchedId = await matchOrCreateAuthor(detectedAuthorName)
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
    // E94-S02: Use syncableWrite instead of db.transaction so each record gets
    // a sync queue entry. Atomicity across course/video/pdf is sacrificed — each
    // record is individually atomic. If interrupted mid-import, partial records
    // may exist locally without queue entries; an upload scan can detect these.
    // The handles (directoryHandle, coverImageHandle, fileHandle) are stripped
    // from the upload payload by the table registry automatically.
    await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
    persistCompleted++
    persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)

    for (const video of orderedVideos) {
      await syncableWrite('importedVideos', 'add', video as unknown as SyncableRecord)
      persistCompleted++
      persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
    }
    for (const pdf of pdfs) {
      await syncableWrite('importedPdfs', 'add', pdf as unknown as SyncableRecord)
      persistCompleted++
      persistProgress.updateProcessingProgress(scanned.id, persistCompleted, totalPersistItems)
    }
  } catch (error) {
    useImportProgressStore.getState().failCourse(scanned.id, `Failed to save "${course.name}"`)
    const message = `Failed to save "${course.name}" to your library. Please try again.`
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
            console.info(
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
  if (!overrides?.coverImageHandle && orderedVideos.length > 0 && orderedVideos[0].fileHandle) {
    autoGenerateThumbnail(course.id, orderedVideos[0].fileHandle).catch(() => {
      // silent-catch-ok: thumbnail generation failure is non-fatal — card shows placeholder icon (E1B-S04 AC3)
    })
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
  | { status: 'success'; course: ScannedCourse }
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

    // Extract PDF metadata from File objects
    const pdfs: ScannedPdf[] = []
    for (const file of pdfFiles) {
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
export async function scanCourseFolderFromServer(
  folderUrl: string,
  serverId?: string
): Promise<ScannedCourse> {
  const progressStore = useImportProgressStore.getState()
  const courseId = crypto.randomUUID()

  // Extract course name from URL path (last segment before trailing /)
  const urlPath = new URL(folderUrl).pathname
  const segments = urlPath.split('/').filter(Boolean)
  const courseName = decodeURIComponent(segments[segments.length - 1] || 'Imported Course')

  // Derive the server root URL for building serverPath
  // The server root is the base of the course content (e.g., "http://192.168.2.200:8099")
  // We derive it by removing the path portion after the host
  const parsedUrl = new URL(folderUrl)
  const serverRoot = `${parsedUrl.protocol}//${parsedUrl.host}`

  progressStore.startImport(courseId, courseName)

  // Recursively collect all files
  const allVideos: {
    name: string
    url: string
    path: string
    format: 'mp4' | 'webm' | 'mkv' | 'ts' | 'avi'
  }[] = []
  const allPdfs: { name: string; url: string; path: string }[] = []

  // Breadth-first traversal with concurrency limit
  const pendingDirs: string[] = [folderUrl]
  const seen = new Set<string>()

  while (pendingDirs.length > 0) {
    // Take up to MAX_CONCURRENT_DIR_SCANS directories
    const batch = pendingDirs.splice(0, MAX_CONCURRENT_DIR_SCANS)

    const results = await Promise.allSettled(
      batch.map(async dirUrl => {
        if (seen.has(dirUrl)) return
        seen.add(dirUrl)

        const result = await fetchDirectoryListing(dirUrl)
        if (!result.ok) {
          console.warn(`[scanServer] Failed to list ${dirUrl}: ${result.error}`)
          return
        }

        for (const file of result.data.files) {
          if (file.type === 'directory') {
            pendingDirs.push(file.url)
          } else if (file.type === 'video') {
            const relPath = file.url.replace(serverRoot + '/', '')
            // Determine format from extension
            const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
            const validFormats = ['mp4', 'webm', 'mkv', 'ts', 'avi'] as const
            allVideos.push({
              name: file.name,
              url: file.url,
              path: relPath,
              format: validFormats.includes(ext as typeof validFormats[number])
                ? (ext as 'mp4' | 'webm' | 'mkv' | 'ts' | 'avi')
                : 'mp4',
            })
          } else if (file.type === 'pdf') {
            const relPath = file.url.replace(serverRoot + '/', '')
            allPdfs.push({
              name: file.name,
              url: file.url,
              path: relPath,
            })
          }
        }
      })
    )

    // Log any unexpected failures during concurrent scans
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[scanServer] Directory scan rejected:', r.reason)
      }
    }
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
    }))

  // Build ScannedPdf[] — no fileHandle, pageCount=0 (lazy or Range-read later)
  const pdfs: ScannedPdf[] = allPdfs
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(p => ({
      id: crypto.randomUUID(),
      filename: p.name,
      path: p.path,
      pageCount: 0,
      serverUrl: p.url,
    }))

  // Derive server path (relative path from server root to this course folder)
  const serverPath = decodeURIComponent(urlPath.replace(/^\//, '').replace(/\/$/, ''))

  return {
    id: courseId,
    name: courseName,
    scannedAt: new Date().toISOString(),
    directoryHandle: null,
    videos,
    pdfs,
    images: [],
    source: 'server',
    ...(serverId ? { serverId } : {}),
    serverPath,
  }
}
