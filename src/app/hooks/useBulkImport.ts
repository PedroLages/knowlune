/**
 * Bulk EPUB import hook — sequential processing with progress tracking.
 *
 * Processes files one at a time to avoid OPFS contention.
 * Supports cancellation via AbortController.
 *
 * @module useBulkImport
 * @since E108-S01
 */

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useBookStore } from '@/stores/useBookStore'
import { extractEpubMetadata } from '@/services/EpubMetadataService'
import { fetchOpenLibraryMetadata, fetchCoverImage } from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import type { Book } from '@/data/types'
import { GENRES } from '@/app/components/library/BookDetailsForm'

export interface BulkImportResult {
  fileName: string
  status: 'success' | 'error'
  error?: string
}

export interface BulkImportProgress {
  current: number
  total: number
  currentFile: string
}

export type BulkImportPhase = 'idle' | 'importing' | 'done' | 'cancelled'

export function useBulkImport() {
  const importBook = useBookStore(s => s.importBook)
  const [phase, setPhase] = useState<BulkImportPhase>('idle')
  const [progress, setProgress] = useState<BulkImportProgress>({ current: 0, total: 0, currentFile: '' })
  const [results, setResults] = useState<BulkImportResult[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const startBulkImport = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller

    setPhase('importing')
    setProgress({ current: 0, total: files.length, currentFile: files[0].name })
    setResults([])

    const importResults: BulkImportResult[] = []

    for (let i = 0; i < files.length; i++) {
      if (controller.signal.aborted) {
        // Mark remaining files as skipped — don't add them to results
        setPhase('cancelled')
        break
      }

      const file = files[i]
      setProgress({ current: i, total: files.length, currentFile: file.name })

      try {
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.epub')) {
          importResults.push({ fileName: file.name, status: 'error', error: 'Not an EPUB file' })
          continue
        }

        // Validate file size
        const MAX_FILE_SIZE_MB = 500
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          importResults.push({ fileName: file.name, status: 'error', error: 'File too large (max 500 MB)' })
          continue
        }

        // Extract metadata
        const metadata = await extractEpubMetadata(file)

        // Check abort between async operations
        if (controller.signal.aborted) break

        // Fetch Open Library metadata (best-effort)
        const olResult = await fetchOpenLibraryMetadata({
          isbn: metadata.isbn,
          title: metadata.title,
          author: metadata.author,
        })

        if (controller.signal.aborted) break

        // Determine cover
        let coverBlob: Blob | null = metadata.coverBlob ?? null
        if (!coverBlob && olResult.coverUrl) {
          const fetched = await fetchCoverImage(olResult.coverUrl)
          if (fetched) coverBlob = fetched
        }

        if (controller.signal.aborted) break

        const bookId = crypto.randomUUID()

        // Store cover in OPFS if available
        let coverUrl: string | undefined
        if (coverBlob) {
          const coverPath = await opfsStorageService.storeCoverFile(bookId, coverBlob)
          coverUrl = coverPath === 'indexeddb' ? `opfs-cover://${bookId}` : `opfs://${coverPath}`
        }

        // Auto-detect genre
        let genre = 'Other'
        if (olResult.subjects?.length) {
          const matchedGenre = GENRES.find(g =>
            olResult.subjects!.some(s => s.toLowerCase().includes(g.toLowerCase()))
          )
          if (matchedGenre) genre = matchedGenre
        }

        const book: Book = {
          id: bookId,
          title: metadata.title,
          author: metadata.author || 'Unknown Author',
          format: 'epub',
          status: 'unread',
          coverUrl,
          tags: genre !== 'Other' ? [genre] : [],
          chapters: [],
          source: { type: 'local', opfsPath: '' }, // Intentional: importBook sets the real path
          progress: 0,
          createdAt: new Date().toISOString(),
          fileSize: file.size,
        }

        await importBook(book, file)

        importResults.push({ fileName: file.name, status: 'success' })
      } catch (err) {
        // Intentional: per-file error isolation — log and continue batch
        const message = err instanceof Error ? err.message : 'Unknown error'
        importResults.push({ fileName: file.name, status: 'error', error: message })
      }
    }

    setResults(importResults)
    setProgress(prev => ({ ...prev, current: prev.total, currentFile: '' }))

    if (!controller.signal.aborted) {
      setPhase('done')
    }

    // Show summary toast
    const successCount = importResults.filter(r => r.status === 'success').length
    const failCount = importResults.filter(r => r.status === 'error').length

    if (failCount === 0) {
      toast.success(`Imported ${successCount} of ${files.length} books`)
    } else {
      toast.warning(`Imported ${successCount} of ${files.length} books — ${failCount} failed`)
    }

    return importResults
  }, [importBook])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setProgress({ current: 0, total: 0, currentFile: '' })
    setResults([])
    abortRef.current = null
  }, [])

  return {
    phase,
    progress,
    results,
    startBulkImport,
    cancel,
    reset,
  }
}
