/**
 * Book import dialog with drag-drop, metadata extraction, and Open Library cover fetch.
 *
 * Accepts .epub files only. Extracts metadata via epub.js, optionally fetches
 * cover from Open Library, and stores the file in OPFS.
 *
 * @since E83-S02
 */

// eslint-disable-next-line component-size/max-lines -- multi-mode import dialog (EPUB + audiobook); split would require prop-drilling the shared open/close state
import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, BookOpen, Headphones, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Progress } from '@/app/components/ui/progress'
import { Button } from '@/app/components/ui/button'
import { useBookStore } from '@/stores/useBookStore'
import { extractEpubMetadata } from '@/services/EpubMetadataService'
import { extractEpubChapters } from '@/lib/epubChapterExtractor'
import { fetchOpenLibraryMetadata, fetchCoverImage } from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import type { Book, BookGenre, BookStatus } from '@/data/types'
import { BookDetailsForm, type ImportPhase } from './BookDetailsForm'
import { detectGenre } from '@/services/GenreDetectionService'
import { AudiobookImportFlow } from './AudiobookImportFlow'
import { useBulkImport } from '@/app/hooks/useBulkImport'

type ImportMode = 'epub' | 'audiobook'

interface BookImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected file from drag-drop on the library page */
  initialFile?: File | null
}

export function BookImportDialog({ open, onOpenChange, initialFile }: BookImportDialogProps) {
  const importBook = useBookStore(s => s.importBook)
  const bulkImport = useBulkImport()
  const { reset: bulkReset, startBulkImport, cancel: bulkCancel } = bulkImport

  const [importMode, setImportMode] = useState<ImportMode>('epub')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('Other')
  const [status, setStatus] = useState<BookStatus>('unread')
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [isDragActive, setIsDragActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverPreviewUrlRef = useRef<string | null>(null)
  const isImporting = phase !== 'idle' && phase !== 'done' && phase !== 'error'

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) {
        URL.revokeObjectURL(coverPreviewUrlRef.current)
      }
    }
  }, [])

  /** Revoke previous object URL before setting a new one */
  const setSafeCoverPreviewUrl = useCallback((url: string | null) => {
    if (coverPreviewUrlRef.current) {
      URL.revokeObjectURL(coverPreviewUrlRef.current)
    }
    coverPreviewUrlRef.current = url
    setCoverPreviewUrl(url)
  }, [])

  const reset = useCallback(() => {
    setFile(null)
    setTitle('')
    setAuthor('')
    setGenre('Other')
    setStatus('unread')
    setSafeCoverPreviewUrl(null)
    setCoverBlob(null)
    setPhase('idle')
    setIsDragActive(false)
    setImportMode('epub')
    bulkReset()
  }, [setSafeCoverPreviewUrl, bulkReset])

  const isBulkImporting = bulkImport.phase === 'importing'

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isImporting && !isBulkImporting) {
        reset()
        onOpenChange(false)
      }
    },
    [isImporting, isBulkImporting, onOpenChange, reset]
  )

  const processFile = useCallback(
    async (selectedFile: File) => {
      // M4B/MP3 files auto-switch to audiobook import mode; the file is passed via
      // AudiobookImportFlow's initialFile prop so it isn't lost on the mode switch
      const fileName = selectedFile.name.toLowerCase()
      if (fileName.endsWith('.m4b') || fileName.endsWith('.mp3')) {
        setImportMode('audiobook')
        setFile(selectedFile) // preserve the file so AudiobookImportFlow can receive it
        return
      }

      if (!fileName.endsWith('.epub')) {
        toast.error('Supported formats: EPUB, MP3, M4B')
        return
      }

      const MAX_FILE_SIZE_MB = 500
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`)
        return
      }

      setFile(selectedFile)
      setPhase('extracting')

      try {
        const metadata = await extractEpubMetadata(selectedFile)
        setTitle(metadata.title)
        setAuthor(metadata.author)

        // Use embedded cover if available
        if (metadata.coverBlob) {
          const url = URL.createObjectURL(metadata.coverBlob)
          setSafeCoverPreviewUrl(url)
          setCoverBlob(metadata.coverBlob)
        }

        // Fetch additional metadata from Open Library (best-effort)
        setPhase('fetching-cover')
        const olResult = await fetchOpenLibraryMetadata({
          isbn: metadata.isbn,
          title: metadata.title,
          author: metadata.author,
        })

        // Use Open Library cover if we don't have an embedded one
        if (!metadata.coverBlob && olResult.coverUrl) {
          const blob = await fetchCoverImage(olResult.coverUrl)
          if (blob) {
            const url = URL.createObjectURL(blob)
            setSafeCoverPreviewUrl(url)
            setCoverBlob(blob)
          }
        }

        // Auto-detect genre from subjects via keyword matching (E108-S05)
        if (olResult.subjects?.length) {
          const detected = detectGenre(olResult.subjects)
          if (detected !== 'Other') setGenre(detected)
        }

        setPhase('idle')
      } catch {
        toast.error('Failed to extract metadata from EPUB')
        setPhase('error')
      }
    },
    [setSafeCoverPreviewUrl]
  )

  // Process initialFile when dialog opens with a pre-selected file (e.g., drag-drop on library page)
  useEffect(() => {
    if (open && initialFile) {
      processFile(initialFile)
    }
  }, [open, initialFile, processFile])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragActive(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 1) {
        // Bulk import mode — filter to EPUB files only
        const epubFiles = droppedFiles.filter(f => f.name.toLowerCase().endsWith('.epub'))
        if (epubFiles.length === 0) {
          toast.error('No EPUB files found in selection')
          return
        }
        const skippedCount = droppedFiles.length - epubFiles.length
        if (skippedCount > 0) {
          toast.info(`${skippedCount} non-EPUB file${skippedCount > 1 ? 's' : ''} skipped`)
        }
        startBulkImport(epubFiles)
      } else if (droppedFiles[0]) {
        processFile(droppedFiles[0])
      }
    },
    [processFile, startBulkImport]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
      if (!selectedFiles || selectedFiles.length === 0) return

      if (selectedFiles.length > 1) {
        const epubFiles = Array.from(selectedFiles).filter(f =>
          f.name.toLowerCase().endsWith('.epub')
        )
        if (epubFiles.length === 0) {
          toast.error('No EPUB files found in selection')
          return
        }
        startBulkImport(epubFiles)
      } else {
        processFile(selectedFiles[0])
      }
    },
    [processFile, startBulkImport]
  )

  const handleImport = useCallback(async () => {
    if (!file || !title.trim()) return

    setPhase('storing')

    try {
      const bookId = crypto.randomUUID()

      // Store cover in OPFS if available
      let coverUrl: string | undefined
      if (coverBlob) {
        const coverPath = await opfsStorageService.storeCoverFile(bookId, coverBlob)
        coverUrl = coverPath === 'indexeddb' ? `opfs-cover://${bookId}` : `opfs://${coverPath}`
      }

      // Extract EPUB TOC chapters for chapter-mapping (E103 — Link Formats).
      // Failure is non-fatal: empty chapters[] still imports; user can re-scan later.
      let extractedChapters: Book['chapters'] = []
      try {
        const fileBuffer = await file.arrayBuffer()
        const tocItems = await extractEpubChapters(fileBuffer)
        extractedChapters = tocItems.map((item, index) => ({
          id: item.href,
          bookId,
          title: item.label,
          order: index,
          position: { type: 'cfi', value: item.href },
        }))
      } catch (err) {
        // silent-catch-ok: chapter extraction failure is non-fatal — book imports with empty chapters[]; user can re-scan from the context menu later.
        console.warn('[BookImportDialog] EPUB chapter extraction failed:', err)
      }

      const book: Book = {
        id: bookId,
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        format: 'epub',
        status,
        coverUrl,
        genre: genre !== 'Other' ? (genre as BookGenre) : undefined, // E108-S05: dedicated genre field
        tags: genre !== 'Other' ? [genre] : [],
        chapters: extractedChapters,
        source: { type: 'local', opfsPath: '' }, // importBook sets the real path
        progress: 0,
        createdAt: new Date().toISOString(),
        fileSize: file.size,
      }

      await importBook(book, file)

      setPhase('done')
      toast.success(`"${title}" imported successfully`)

      // Close dialog after brief success indication
      setTimeout(() => {
        reset()
        onOpenChange(false)
      }, 600)
    } catch {
      setPhase('error')
      toast.error('Failed to import book. Please try again.')
    }
  }, [file, title, author, genre, status, coverBlob, importBook, reset, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl"
        aria-label="Import book"
        data-testid="book-import-dialog"
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Import Book
          </DialogTitle>
          <DialogDescription>
            {importMode === 'epub'
              ? 'Import an EPUB file to add it to your library.'
              : 'Import MP3 files or a single M4B audiobook to your library.'}
          </DialogDescription>
        </DialogHeader>

        {/* Mode switcher — only show when no file is in progress */}
        {!file && (
          <div
            className="flex gap-1 p-1 bg-muted rounded-full w-fit mx-auto"
            role="tablist"
            aria-label="Import type"
          >
            <button
              role="tab"
              aria-selected={importMode === 'epub'}
              onClick={() => setImportMode('epub')}
              className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all min-h-[40px] ${
                importMode === 'epub'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-4" aria-hidden="true" />
              EPUB
            </button>
            <button
              role="tab"
              aria-selected={importMode === 'audiobook'}
              onClick={() => setImportMode('audiobook')}
              className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all min-h-[40px] ${
                importMode === 'audiobook'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="audiobook-import-tab"
            >
              <Headphones className="size-4" aria-hidden="true" />
              Audiobook
            </button>
          </div>
        )}

        {/* Audiobook import flow */}
        {importMode === 'audiobook' && (
          <AudiobookImportFlow
            onCancel={() => handleClose(false)}
            onImported={() => {
              reset()
              onOpenChange(false)
            }}
            initialFile={
              file &&
              (file.name.toLowerCase().endsWith('.m4b') || file.name.toLowerCase().endsWith('.mp3'))
                ? file
                : null
            }
          />
        )}

        {/* EPUB: Drop zone — shown when no file is selected and not bulk importing */}
        {importMode === 'epub' && !file && bulkImport.phase === 'idle' && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Select EPUB file to import"
            data-testid="epub-drop-zone"
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              isDragActive ? 'border-brand bg-brand-soft/20' : 'border-border hover:border-brand/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Drop EPUB files here or click to browse
            </p>
            <p className="text-center text-xs text-muted-foreground/70">
              Select multiple files for bulk import
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              multiple
              className="hidden"
              onChange={handleFileInput}
              data-testid="epub-file-input"
            />
          </div>
        )}

        {/* EPUB: Bulk import progress — shown during bulk import */}
        {importMode === 'epub' &&
          (bulkImport.phase === 'importing' ||
            bulkImport.phase === 'done' ||
            bulkImport.phase === 'cancelled') && (
            <div className="flex flex-col gap-4 py-2" data-testid="bulk-import-progress">
              {bulkImport.phase === 'importing' && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span
                      className="text-muted-foreground truncate max-w-[70%]"
                      data-testid="bulk-import-current-file"
                    >
                      {bulkImport.progress.currentFile}
                    </span>
                    <span
                      className="text-muted-foreground tabular-nums"
                      data-testid="bulk-import-count"
                    >
                      {bulkImport.progress.current} / {bulkImport.progress.total}
                    </span>
                  </div>
                  <Progress
                    value={(bulkImport.progress.current / bulkImport.progress.total) * 100}
                    className="h-2"
                    aria-label={`Importing ${bulkImport.progress.current} of ${bulkImport.progress.total} books`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={bulkCancel}
                    className="self-end"
                    data-testid="bulk-import-cancel"
                  >
                    <X className="size-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                </>
              )}

              {(bulkImport.phase === 'done' || bulkImport.phase === 'cancelled') && (
                <div className="flex flex-col gap-3">
                  <Progress value={100} className="h-2" />
                  <p
                    className="text-sm text-foreground font-medium"
                    data-testid="bulk-import-summary"
                  >
                    {bulkImport.phase === 'cancelled' ? 'Import cancelled. ' : ''}
                    Imported {bulkImport.results.filter(r => r.status === 'success').length} of{' '}
                    {bulkImport.progress.total} books
                  </p>
                  {bulkImport.results.some(r => r.status === 'error') && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-destructive">
                        {bulkImport.results.filter(r => r.status === 'error').length} file(s) had
                        errors
                      </summary>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {bulkImport.results
                          .filter(r => r.status === 'error')
                          .map(r => (
                            <li key={r.fileName} className="text-xs">
                              <span className="font-medium">{r.fileName}</span>: {r.error}
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => handleClose(false)}
                    className="self-end"
                    data-testid="bulk-import-done"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}

        {/* EPUB: Book details — shown after file is selected */}
        {importMode === 'epub' && file && bulkImport.phase === 'idle' && (
          <BookDetailsForm
            file={file}
            title={title}
            author={author}
            genre={genre}
            status={status}
            coverPreviewUrl={coverPreviewUrl}
            phase={phase}
            isImporting={isImporting}
            onTitleChange={setTitle}
            onAuthorChange={setAuthor}
            onGenreChange={setGenre}
            onStatusChange={setStatus}
            onReset={reset}
            onCancel={() => handleClose(false)}
            onImport={handleImport}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
