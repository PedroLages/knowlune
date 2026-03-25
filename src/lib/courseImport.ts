import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { triggerAutoAnalysis } from '@/lib/autoAnalysis'
import { triggerOllamaTagging } from '@/lib/ollamaTagging'
import {
  showDirectoryPicker,
  scanDirectory,
  extractVideoMetadata,
  extractPdfMetadata,
  isSupportedVideoFormat,
  getVideoFormat,
} from '@/lib/fileSystem'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'
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
}

/** A PDF discovered during folder scan, before persistence. */
export interface ScannedPdf {
  id: string
  filename: string
  path: string
  pageCount: number
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

  store.setImporting(true)
  store.setImportError(null)
  store.setImportProgress(null)

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

    // Check for duplicate import
    const existingCourse = await db.importedCourses.where('name').equals(dirHandle.name).first()
    if (existingCourse) {
      throw new ImportError(
        `"${dirHandle.name}" is already imported. Remove it first to re-import.`,
        'DUPLICATE'
      )
    }

    // Step 2: Scan directory for supported files
    const videoFiles: { handle: FileSystemFileHandle; path: string }[] = []
    const pdfFiles: { handle: FileSystemFileHandle; path: string }[] = []

    try {
      for await (const entry of scanDirectory(dirHandle)) {
        if (isSupportedVideoFormat(entry.handle.name)) {
          videoFiles.push(entry)
        } else {
          pdfFiles.push(entry)
        }
      }
    } catch (error) {
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

    // Step 4: Extract metadata in batches (max 10 concurrent to limit memory pressure)
    const BATCH_SIZE = 10
    let processedCount = 0

    async function extractInBatches<T, R>(
      items: T[],
      extractor: (item: T) => Promise<R>
    ): Promise<PromiseSettledResult<R>[]> {
      const results: PromiseSettledResult<R>[] = []
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.allSettled(
          batch.map(async item => {
            const result = await extractor(item)
            processedCount++
            store.setImportProgress({ current: processedCount, total: totalFiles })
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
          metadata: { duration: number; width: number; height: number }
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

    return {
      id: courseId,
      name: courseName,
      scannedAt: now,
      directoryHandle: dirHandle,
      videos,
      pdfs,
    }
  } catch (error) {
    if (error instanceof ImportError) {
      store.setImportError(error.message)
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
      // User cancelled — don't show error
    } else {
      const message = 'An unexpected error occurred during import. Please try again.'
      store.setImportError(message)
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
    category?: string
    tags?: string[]
  }
): Promise<ImportedCourse> {
  const now = new Date().toISOString()

  // Build ImportedVideo records (add courseId)
  const videos: ImportedVideo[] = scanned.videos.map(v => ({
    id: v.id,
    courseId: scanned.id,
    filename: v.filename,
    path: v.path,
    duration: v.duration,
    format: v.format,
    order: v.order,
    fileHandle: v.fileHandle,
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

  const course: ImportedCourse = {
    id: scanned.id,
    name: overrides?.name ?? scanned.name,
    importedAt: now,
    category: overrides?.category ?? '',
    tags: overrides?.tags ?? [],
    status: 'active',
    videoCount: videos.length,
    pdfCount: pdfs.length,
    directoryHandle: scanned.directoryHandle,
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

  // Update Zustand store
  useCourseImportStore.setState(state => ({
    importedCourses: [...state.importedCourses, course],
  }))

  // Show success toast
  toast.success(
    `Imported: ${course.name} — ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
  )

  // Trigger auto-analysis (fire-and-forget, consent-gated)
  triggerAutoAnalysis(course)

  // Trigger Ollama auto-tagging (fire-and-forget, independent of cloud AI)
  triggerOllamaTagging(course, videos, pdfs)

  return course
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
