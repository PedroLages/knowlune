import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import { triggerAutoAnalysis } from '@/lib/autoAnalysis'
import { unlockSidebarItem } from '@/app/hooks/useProgressiveDisclosure'
import { triggerOllamaTagging } from '@/lib/ollamaTagging'
import {
  detectAuthorFromFolderName,
  matchOrCreateAuthor,
  detectAuthorPhoto,
} from '@/lib/authorDetection'
import { autoGenerateThumbnail } from '@/lib/autoThumbnail'
import {
  showDirectoryPicker,
  scanDirectory,
  extractVideoMetadata,
  extractPdfMetadata,
  isSupportedVideoFormat,
  isImageFile,
  getVideoFormat,
} from '@/lib/fileSystem'
import type { ImportedAuthor, ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'
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
  fileHandle: FileSystemFileHandle
  fileSize: number // File size in bytes (E1B-S02)
  width: number // Video width in pixels (E1B-S02)
  height: number // Video height in pixels (E1B-S02)
}

/** A PDF discovered during folder scan, before persistence. */
export interface ScannedPdf {
  id: string
  filename: string
  path: string
  pageCount: number
  fileHandle: FileSystemFileHandle
}

/** An image discovered during folder scan, candidate for cover image. */
export interface ScannedImage {
  filename: string
  path: string
  fileHandle: FileSystemFileHandle
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
  /** The directory handle for future file access. */
  directoryHandle: FileSystemDirectoryHandle
  /** Discovered video files with extracted metadata. */
  videos: ScannedVideo[]
  /** Discovered PDF files with extracted metadata. */
  pdfs: ScannedPdf[]
  /** Image files found in the folder, candidates for cover image. */
  images: ScannedImage[]
}

// --- Scan Phase ---

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
      for await (const entry of scanDirectory(dirHandle, '', { includeImages: true })) {
        // Check for cancellation during scan
        if (useImportProgressStore.getState().cancelRequested) {
          useImportProgressStore.getState().confirmCancellation()
          throw new Error('Import cancelled by user')
        }

        if (isSupportedVideoFormat(entry.handle.name)) {
          videoFiles.push(entry)
        } else if (isImageFile(entry.handle.name)) {
          imageFiles.push(entry)
        } else {
          pdfFiles.push(entry)
        }
        scanCount++
        // AC2: Update progress every 10 files during scan
        if (scanCount % 10 === 0) {
          progressStore.updateScanProgress(tempCourseId, scanCount, null)
        }
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

    // Build video records from successful extractions
    const videos: ScannedVideo[] = videoResults
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          entry: { handle: FileSystemFileHandle; path: string }
          metadata: { duration: number; width: number; height: number; fileSize: number }
        }> => r.status === 'fulfilled'
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
    fileHandle: v.fileHandle,
    fileSize: v.fileSize,
    width: v.width,
    height: v.height,
  }))

  // Build ImportedPdf records (add courseId)
  const pdfs: ImportedPdf[] = scanned.pdfs.map(p => ({
    id: p.id,
    courseId: scanned.id,
    filename: p.filename,
    path: p.path,
    pageCount: p.pageCount,
    fileHandle: p.fileHandle,
  }))

  // Author detection: use explicit override, or auto-detect from folder name (AC1-AC3, AC5)
  let authorId: string | undefined = overrides?.authorId
  let detectedAuthorName: string | null = null
  if (!authorId) {
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
  const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0)
  const totalFileSize = videos.reduce((sum, v) => sum + (v.fileSize || 0), 0)
  const maxResolutionHeight = videos.reduce((max, v) => Math.max(max, v.height || 0), 0)

  const course: ImportedCourse = {
    id: scanned.id,
    name: overrides?.name ?? scanned.name,
    ...(overrides?.description ? { description: overrides.description } : {}),
    importedAt: now,
    category: overrides?.category ?? '',
    tags: overrides?.tags ?? [],
    status: 'active',
    videoCount: videos.length,
    pdfCount: pdfs.length,
    directoryHandle: scanned.directoryHandle,
    ...(overrides?.coverImageHandle ? { coverImageHandle: overrides.coverImageHandle } : {}),
    ...(authorId ? { authorId } : {}),
    totalDuration: totalDuration > 0 ? totalDuration : undefined,
    totalFileSize: totalFileSize > 0 ? totalFileSize : undefined,
    maxResolutionHeight: maxResolutionHeight > 0 ? maxResolutionHeight : undefined,
  }

  try {
    // Persist to Dexie.js atomically (course + videos + pdfs)
    await db.transaction(
      'rw',
      [db.importedCourses, db.importedVideos, db.importedPdfs],
      async () => {
        await db.importedCourses.add(course)
        if (videos.length > 0) await db.importedVideos.bulkAdd(videos)
        if (pdfs.length > 0) await db.importedPdfs.bulkAdd(pdfs)
      }
    )
  } catch (error) {
    const message = `Failed to save "${course.name}" to your library. Please try again.`
    console.error('[Import] Persist transaction failed:', error)
    toast.error(message)
    throw error
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
          // More than just updatedAt
          await db.authors.update(authorId, updates)
        }
      }
    } catch (error) {
      // Non-critical — author link is best-effort
      console.warn('[Import] Failed to link course to author:', error)
    }
  }

  // Update Zustand store
  useCourseImportStore.setState(state => ({
    importedCourses: [...state.importedCourses, course],
  }))

  // Show success toast (AC4: include author name when detected)
  const authorSuffix = detectedAuthorName ? ` by ${detectedAuthorName}` : ''
  toast.success(
    `Imported: ${course.name}${authorSuffix} — ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
  )

  // Trigger auto-analysis (fire-and-forget, consent-gated)
  triggerAutoAnalysis(course)

  // Trigger Ollama auto-tagging (fire-and-forget, independent of cloud AI)
  triggerOllamaTagging(course, videos, pdfs)

  // Auto-generate thumbnail from first video at 10% mark (E1B-S04 AC1)
  // Fire-and-forget: failure shows default placeholder, no error toast (AC3)
  if (videos.length > 0 && videos[0].fileHandle) {
    autoGenerateThumbnail(course.id, videos[0].fileHandle).catch(() => {
      // silent-catch-ok: thumbnail generation failure is non-fatal — card shows placeholder icon (E1B-S04 AC3)
    })
  }

  // Unlock sidebar items via progressive disclosure
  unlockSidebarItem('course-imported')

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
      for await (const entry of scanDirectory(dirHandle, '', { includeImages: true })) {
        // Check for cancellation during scan (AC4)
        if (useImportProgressStore.getState().cancelRequested) {
          return { status: 'error', folderName: dirHandle.name, message: 'Cancelled' }
        }

        if (isSupportedVideoFormat(entry.handle.name)) {
          videoFiles.push(entry)
        } else if (isImageFile(entry.handle.name)) {
          imageFiles.push(entry)
        } else {
          pdfFiles.push(entry)
        }
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

    const videos: ScannedVideo[] = videoResults
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          entry: { handle: FileSystemFileHandle; path: string }
          metadata: { duration: number; width: number; height: number; fileSize: number }
        }> => r.status === 'fulfilled'
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
  return dirs.sort((a, b) => a.name.localeCompare(b.name))
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
