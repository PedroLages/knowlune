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
import { Upload, BookOpen, Headphones } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { useBookStore } from '@/stores/useBookStore'
import { extractEpubMetadata } from '@/services/EpubMetadataService'
import { fetchOpenLibraryMetadata, fetchCoverImage } from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import type { Book, BookStatus } from '@/data/types'
import { BookDetailsForm, GENRES, type ImportPhase } from './BookDetailsForm'
import { AudiobookImportFlow } from './AudiobookImportFlow'

type ImportMode = 'epub' | 'audiobook'

interface BookImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected file from drag-drop on the library page */
  initialFile?: File | null
}

export function BookImportDialog({ open, onOpenChange, initialFile }: BookImportDialogProps) {
  const importBook = useBookStore(s => s.importBook)

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
  }, [setSafeCoverPreviewUrl])

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isImporting) {
        reset()
        onOpenChange(false)
      }
    },
    [isImporting, onOpenChange, reset]
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

        // Auto-detect genre from subjects
        if (olResult.subjects?.length) {
          const matchedGenre = GENRES.find(g =>
            olResult.subjects!.some(s => s.toLowerCase().includes(g.toLowerCase()))
          )
          if (matchedGenre) setGenre(matchedGenre)
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
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) processFile(droppedFile)
    },
    [processFile]
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
      const selectedFile = e.target.files?.[0]
      if (selectedFile) processFile(selectedFile)
    },
    [processFile]
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

      const book: Book = {
        id: bookId,
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        format: 'epub',
        status,
        coverUrl,
        tags: genre !== 'Other' ? [genre] : [],
        chapters: [],
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
      <DialogContent className="max-w-lg" aria-label="Import book" data-testid="book-import-dialog">
        <DialogHeader>
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
          <div className="flex gap-2" role="tablist" aria-label="Import type">
            <button
              role="tab"
              aria-selected={importMode === 'epub'}
              onClick={() => setImportMode('epub')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                importMode === 'epub'
                  ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                  : 'border-border bg-surface-elevated text-muted-foreground hover:bg-surface-elevated/80'
              }`}
            >
              <BookOpen className="size-4" aria-hidden="true" />
              EPUB
            </button>
            <button
              role="tab"
              aria-selected={importMode === 'audiobook'}
              onClick={() => setImportMode('audiobook')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                importMode === 'audiobook'
                  ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                  : 'border-border bg-surface-elevated text-muted-foreground hover:bg-surface-elevated/80'
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
              file && (file.name.toLowerCase().endsWith('.m4b') || file.name.toLowerCase().endsWith('.mp3'))
                ? file
                : null
            }
          />
        )}

        {/* EPUB: Drop zone — shown when no file is selected */}
        {importMode === 'epub' && !file && (
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
              Drop your EPUB file here or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              className="hidden"
              onChange={handleFileInput}
              data-testid="epub-file-input"
            />
          </div>
        )}

        {/* EPUB: Book details — shown after file is selected */}
        {importMode === 'epub' && file && (
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
