import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
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

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_FILES' | 'PERMISSION_DENIED' | 'SCAN_ERROR' | 'DUPLICATE'
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

export async function importCourseFromFolder(): Promise<ImportedCourse> {
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

    // Step 3: Validate results (AC 2)
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

    // Step 5: Build course record
    const courseId = crypto.randomUUID()
    const courseName = dirHandle.name
    const now = new Date().toISOString()

    // Build video records from successful extractions
    const videos: ImportedVideo[] = videoResults
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
        courseId,
        filename: r.value.entry.handle.name,
        path: r.value.entry.path,
        duration: r.value.metadata.duration,
        format: getVideoFormat(r.value.entry.handle.name),
        order: index + 1,
        fileHandle: r.value.entry.handle,
      }))

    // Build PDF records from successful extractions
    const pdfs: ImportedPdf[] = pdfResults
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
        courseId,
        filename: r.value.entry.handle.name,
        path: r.value.entry.path,
        pageCount: r.value.metadata.pageCount,
        fileHandle: r.value.entry.handle,
      }))

    const course: ImportedCourse = {
      id: courseId,
      name: courseName,
      importedAt: now,
      category: '',
      tags: [],
      status: 'active',
      videoCount: videos.length,
      pdfCount: pdfs.length,
      directoryHandle: dirHandle,
    }

    // Step 6: Persist to Dexie.js atomically (course + videos + pdfs).
    // Note: We persist BEFORE updating Zustand (not optimistic) because import
    // requires a cross-table transaction. The store's addImportedCourse() uses
    // optimistic updates for simple CRUD — that pattern doesn't apply here.
    await db.transaction(
      'rw',
      [db.importedCourses, db.importedVideos, db.importedPdfs],
      async () => {
        await db.importedCourses.add(course)
        if (videos.length > 0) await db.importedVideos.bulkAdd(videos)
        if (pdfs.length > 0) await db.importedPdfs.bulkAdd(pdfs)
      }
    )

    // Step 7: Update Zustand store (already persisted in transaction above)
    useCourseImportStore.setState(state => ({
      importedCourses: [...state.importedCourses, course],
    }))

    // Step 8: Show success toast (AC 1)
    toast.success(
      `Imported: ${courseName} — ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
    )

    return course
  } catch (error) {
    if (error instanceof ImportError) {
      store.setImportError(error.message)
      if (error.code === 'PERMISSION_DENIED') {
        toast.error(error.message, {
          action: {
            label: 'Try Again',
            onClick: () => {
              importCourseFromFolder().catch(() => {})
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
