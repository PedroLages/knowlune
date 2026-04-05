/**
 * Book import dialog with drag-drop, metadata extraction, and Open Library cover fetch.
 *
 * Accepts .epub files only. Extracts metadata via epub.js, optionally fetches
 * cover from Open Library, and stores the file in OPFS.
 *
 * @since E83-S02
 */

import { useCallback, useRef, useState } from 'react'
import { Upload, Loader2, BookOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useBookStore } from '@/stores/useBookStore'
import { extractEpubMetadata } from '@/services/EpubMetadataService'
import {
  fetchOpenLibraryMetadata,
  fetchCoverImage,
} from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import type { Book, BookStatus } from '@/data/types'

interface BookImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ImportPhase =
  | 'idle'
  | 'extracting'
  | 'fetching-cover'
  | 'storing'
  | 'done'
  | 'error'

const PHASE_LABELS: Record<ImportPhase, string> = {
  idle: '',
  extracting: 'Extracting metadata...',
  'fetching-cover': 'Fetching cover...',
  storing: 'Storing file...',
  done: 'Done',
  error: 'Import failed',
}

const GENRES = [
  'Psychology',
  'Science',
  'Business',
  'Philosophy',
  'Technology',
  'History',
  'Self-Help',
  'Fiction',
  'Other',
]

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Currently Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

export function BookImportDialog({ open, onOpenChange }: BookImportDialogProps) {
  const importBook = useBookStore(s => s.importBook)

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
  const isImporting = phase !== 'idle' && phase !== 'done' && phase !== 'error'

  const reset = useCallback(() => {
    setFile(null)
    setTitle('')
    setAuthor('')
    setGenre('Other')
    setStatus('unread')
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl)
    setCoverPreviewUrl(null)
    setCoverBlob(null)
    setPhase('idle')
    setIsDragActive(false)
  }, [coverPreviewUrl])

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isImporting) {
        reset()
        onOpenChange(false)
      }
    },
    [isImporting, onOpenChange, reset]
  )

  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.epub')) {
      toast.error('Only EPUB files are supported')
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
        setCoverPreviewUrl(url)
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
          setCoverPreviewUrl(url)
          setCoverBlob(blob)
        }
      }

      // Auto-detect genre from subjects
      if (olResult.subjects?.length) {
        const matchedGenre = GENRES.find(g =>
          olResult.subjects!.some(s =>
            s.toLowerCase().includes(g.toLowerCase())
          )
        )
        if (matchedGenre) setGenre(matchedGenre)
      }

      setPhase('idle')
    } catch {
      toast.error('Failed to extract metadata from EPUB')
      setPhase('error')
    }
  }, [])

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
        const coverPath = await opfsStorageService.storeCoverFile(
          bookId,
          coverBlob
        )
        coverUrl =
          coverPath === 'indexeddb'
            ? `opfs-cover://${bookId}`
            : `opfs://${coverPath}`
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
  }, [
    file,
    title,
    author,
    genre,
    status,
    coverBlob,
    importBook,
    reset,
    onOpenChange,
  ])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg"
        aria-label="Import book"
        data-testid="book-import-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Import Book
          </DialogTitle>
          <DialogDescription>
            Import an EPUB file to add it to your library.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone — shown when no file is selected */}
        {!file && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Select EPUB file to import"
            data-testid="epub-drop-zone"
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
              isDragActive
                ? 'border-brand bg-brand-soft/20'
                : 'border-border hover:border-brand/50'
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

        {/* Book details — shown after file is selected */}
        {file && (
          <div className="space-y-4" data-testid="book-details-form">
            {/* Cover preview + title/author */}
            <div className="flex gap-4">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt={`Cover of ${title}`}
                  className="h-32 w-24 shrink-0 rounded-lg object-cover"
                  data-testid="cover-preview"
                />
              ) : (
                <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <Label htmlFor="book-title">Title</Label>
                  <Input
                    id="book-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Book title"
                    disabled={isImporting}
                    data-testid="book-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="book-author">Author</Label>
                  <Input
                    id="book-author"
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="Author name"
                    disabled={isImporting}
                    data-testid="book-author-input"
                  />
                </div>
              </div>
            </div>

            {/* Genre + Status selects */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="book-genre">Genre</Label>
                <Select
                  value={genre}
                  onValueChange={setGenre}
                  disabled={isImporting}
                >
                  <SelectTrigger id="book-genre" data-testid="book-genre-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map(g => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="book-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={v => setStatus(v as BookStatus)}
                  disabled={isImporting}
                >
                  <SelectTrigger
                    id="book-status"
                    data-testid="book-status-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* File info */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="truncate">{file.name}</span>
              <span className="shrink-0">
                ({(file.size / (1024 * 1024)).toFixed(1)} MB)
              </span>
              {!isImporting && phase !== 'done' && (
                <button
                  type="button"
                  onClick={reset}
                  className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted"
                  aria-label="Remove selected file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Phase indicator */}
            {phase !== 'idle' && (
              <p
                className={`text-sm ${
                  phase === 'error'
                    ? 'text-destructive'
                    : phase === 'done'
                      ? 'text-success'
                      : 'text-muted-foreground'
                }`}
                data-testid="import-phase"
              >
                {isImporting && (
                  <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                )}
                {PHASE_LABELS[phase]}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                variant="brand"
                onClick={handleImport}
                disabled={isImporting || !title.trim()}
                className="min-h-[44px]"
                data-testid="import-book-button"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
