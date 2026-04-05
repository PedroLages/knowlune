/**
 * AudiobookImportFlow — handles MP3 file selection and M4B single-file import,
 * chapter ordering, ID3 tag extraction, duration calculation, and OPFS storage.
 *
 * Renders within BookImportDialog when "Audiobook" mode is selected.
 *
 * @module AudiobookImportFlow
 * @since E87-S01
 * @modified E88-S04 — added M4B single-file import with chapter extraction
 */
// eslint-disable-next-line component-size/max-lines -- self-contained multi-step import flow: file selection, ID3 parsing, duration calc, OPFS storage, metadata form
import { useState, useRef, useCallback, useEffect } from 'react'
import { Headphones, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Progress } from '@/app/components/ui/progress'
import { useBookStore } from '@/stores/useBookStore'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { parseM4bFile } from '@/services/M4bParserService'
import type { Book, BookChapter, BookStatus } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract leading number from a filename for chapter ordering. */
function extractLeadingNumber(name: string): number {
  const match = name.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : Infinity
}

/** Derive a chapter title from an MP3 filename (strip leading number, extension). */
function chapterTitleFromFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '') // remove extension
      .replace(/^\d+[-_ ]*/, '') // remove leading number
      .replace(/[-_]/g, ' ') // normalize separators
      .trim() || name.replace(/\.[^.]+$/, '')
  )
}

/** Get duration of an audio file using a temporary Audio element. */
function getAudioDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(isFinite(audio.duration) ? audio.duration : 0)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve(0)
    })
    audio.src = url
  })
}

/**
 * Attempt to read ID3v2 title and artist tags from a binary buffer.
 * Reads the minimal ID3v2 header to avoid a heavy dependency.
 * Returns null fields if parsing fails or tags are absent.
 */
function parseId3v2Tags(buffer: ArrayBuffer): { title: string | null; artist: string | null } {
  const view = new Uint8Array(buffer)
  // ID3v2 magic: "ID3" at offset 0
  if (view[0] !== 0x49 || view[1] !== 0x44 || view[2] !== 0x33) {
    return { title: null, artist: null }
  }

  // ID3v2.3/2.4 — frame ID is 4 bytes, size is 4 bytes (big-endian), flags 2 bytes
  const headerSize = 10
  // Extended header size (skip if present)
  const flags = view[5]
  const hasExtHeader = (flags & 0x40) !== 0
  let offset = headerSize
  if (hasExtHeader) {
    // Extended header size is 4 bytes at current offset
    const extSize =
      (view[offset] << 24) | (view[offset + 1] << 16) | (view[offset + 2] << 8) | view[offset + 3]
    offset += extSize
  }

  let title: string | null = null
  let artist: string | null = null

  const decoder = new TextDecoder('utf-8', { fatal: false })

  while (offset + 10 < buffer.byteLength && (title === null || artist === null)) {
    const frameId = String.fromCharCode(
      view[offset],
      view[offset + 1],
      view[offset + 2],
      view[offset + 3]
    )
    if (frameId === '\0\0\0\0') break

    const frameSize =
      (view[offset + 4] << 24) |
      (view[offset + 5] << 16) |
      (view[offset + 6] << 8) |
      view[offset + 7]

    if (frameSize <= 0 || frameSize > 1_000_000) break

    const dataStart = offset + 10
    const dataEnd = Math.min(dataStart + frameSize, buffer.byteLength)
    const frameData = buffer.slice(dataStart + 1, dataEnd) // +1 to skip encoding byte

    if (frameId === 'TIT2' && title === null) {
      title = decoder.decode(frameData).replace(/\0/g, '').trim() || null
    } else if (frameId === 'TPE1' && artist === null) {
      artist = decoder.decode(frameData).replace(/\0/g, '').trim() || null
    }

    offset += 10 + frameSize
  }

  return { title, artist }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AudiobookImportFlowProps {
  onCancel: () => void
  onImported: () => void
  /** Pre-selected file from drag-drop or initialFile on the parent dialog */
  initialFile?: File | null
}

interface ChapterFile {
  file: File
  order: number
  title: string
  duration: number // seconds
}

type Phase = 'idle' | 'processing' | 'storing' | 'done' | 'error'

/** M4B parsed state — populated after parsing a single .m4b file */
interface M4bParsed {
  bookId: string // generated once during parsing; reused on import
  file: File
  title: string
  author: string
  coverBlob: Blob | null
  chapters: BookChapter[]
  totalDuration: number
}

export function AudiobookImportFlow({
  onCancel,
  onImported,
  initialFile,
}: AudiobookImportFlowProps) {
  const importBook = useBookStore(s => s.importBook)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processFilesRef = useRef<((files: File[]) => Promise<void>) | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [chapters, setChapters] = useState<ChapterFile[]>([])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status] = useState<BookStatus>('unread')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [m4bParsed, setM4bParsed] = useState<M4bParsed | null>(null)

  const isImporting = phase === 'processing' || phase === 'storing'

  /** Process an M4B file — lazy-loads music-metadata for chapter extraction */
  const processM4bFile = useCallback(async (file: File) => {
    // Enforce file size limit — 2GB is generous for audiobooks while preventing runaway uploads
    const MAX_M4B_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB
    if (file.size > MAX_M4B_SIZE_BYTES) {
      toast.error('File too large. M4B audiobooks must be under 2 GB.')
      return
    }

    setPhase('processing')
    setProgressLabel('Parsing chapters…')
    setProgress(50)

    try {
      // Generate bookId once here; chapters are keyed to it and it's reused on import
      const bookId = crypto.randomUUID()
      const result = await parseM4bFile(file, bookId)

      setTitle(result.title)
      setAuthor(result.author)
      setM4bParsed({
        bookId,
        file,
        title: result.title,
        author: result.author,
        coverBlob: result.coverBlob,
        chapters: result.chapters,
        totalDuration: result.totalDuration,
      })

      setPhase('idle')
      setProgress(0)
      setProgressLabel('')
    } catch {
      toast.error('Failed to parse M4B file. The file may be corrupted.')
      setPhase('error')
    }
  }, [])

  const processFiles = useCallback(
    async (files: File[]) => {
      // Check for M4B file first — single-file audiobook
      const m4bFile = files.find(f => f.name.toLowerCase().endsWith('.m4b'))
      if (m4bFile) {
        // Warn if non-M4B files were also selected — they will be ignored
        const nonM4bFiles = files.filter(f => !f.name.toLowerCase().endsWith('.m4b'))
        if (nonM4bFiles.length > 0) {
          toast.warning(
            `Only the M4B file will be imported. ${nonM4bFiles.length} other file${nonM4bFiles.length !== 1 ? 's' : ''} will be ignored.`
          )
        }
        await processM4bFile(m4bFile)
        return
      }

      const mp3s = files.filter(f => f.name.toLowerCase().endsWith('.mp3'))
      if (mp3s.length === 0) {
        toast.error('No MP3 or M4B files found. Please select audiobook files.')
        return
      }

      setPhase('processing')
      setProgress(0)

      // Sort by leading number in filename, then alphabetically
      const sorted = [...mp3s].sort((a, b) => {
        const na = extractLeadingNumber(a.name)
        const nb = extractLeadingNumber(b.name)
        if (na !== nb) return na - nb
        return a.name.localeCompare(b.name)
      })

      // Extract ID3 tags from first file
      try {
        const slice = sorted[0].slice(0, 4096) // Read just header bytes
        const buf = await slice.arrayBuffer()
        const tags = parseId3v2Tags(buf)
        if (tags.title) setTitle(tags.title)
        if (tags.artist) setAuthor(tags.artist)
      } catch {
        // silent-catch-ok: ID3 parsing failure falls back to filename heuristic
      }

      // Fallback title from filename (strip number + extension)
      if (!title) {
        setTitle(chapterTitleFromFilename(sorted[0].name) || 'Untitled Audiobook')
      }

      // Calculate duration for each chapter
      const result: ChapterFile[] = []
      for (let i = 0; i < sorted.length; i++) {
        setProgressLabel(`Reading chapter ${i + 1} of ${sorted.length}…`)
        setProgress(Math.round(((i + 1) / sorted.length) * 100))
        const duration = await getAudioDuration(sorted[i])
        result.push({
          file: sorted[i],
          order: i,
          title: chapterTitleFromFilename(sorted[i].name) || `Chapter ${i + 1}`,
          duration,
        })
      }

      setChapters(result)
      setPhase('idle')
      setProgress(0)
      setProgressLabel('')
    },
    [title, processM4bFile]
  )

  // Keep processFilesRef current so the initialFile effect always calls the latest version
  processFilesRef.current = processFiles

  // Process initialFile when the component mounts (e.g. M4B dropped on the library page).
  // processFilesRef.current always holds the latest processFiles — no dep needed.
  // intentional empty deps: run once on mount only
  useEffect(() => {
    if (initialFile) {
      processFilesRef.current?.([initialFile])
    }
  }, []) // intentionally empty — processFilesRef is used to avoid stale closure

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length > 0) await processFiles(files)
      e.target.value = ''
    },
    [processFiles]
  )

  const handleImport = useCallback(async () => {
    if (chapters.length === 0 || !title.trim()) return

    setPhase('storing')

    try {
      const bookId = crypto.randomUUID()
      const now = new Date().toISOString()

      // Build cumulative start times for each chapter
      let cumulativeStart = 0
      const bookChapters: BookChapter[] = chapters.map(ch => {
        const chapter: BookChapter = {
          id: crypto.randomUUID(),
          bookId,
          title: ch.title,
          order: ch.order,
          position: { type: 'time', seconds: cumulativeStart },
        }
        cumulativeStart += ch.duration
        return chapter
      })

      const totalDuration = chapters.reduce((sum, ch) => sum + ch.duration, 0)

      // Store each MP3 file in OPFS
      let firstOpfsPath = ''
      for (let i = 0; i < chapters.length; i++) {
        setProgressLabel(`Storing chapter ${i + 1} of ${chapters.length}…`)
        setProgress(Math.round(((i + 1) / chapters.length) * 100))

        const chapterFilename = `chapter-${String(i).padStart(2, '0')}.mp3`
        const chFile = new File([chapters[i].file], chapterFilename, { type: 'audio/mpeg' })

        // Store via opfsStorageService — reuse book file storage pattern
        const path = await opfsStorageService.storeBookFile(bookId, chFile)
        if (i === 0) firstOpfsPath = path
      }

      const book: Book = {
        id: bookId,
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        format: 'audiobook',
        status,
        tags: [],
        chapters: bookChapters,
        source: { type: 'local', opfsPath: firstOpfsPath },
        progress: 0,
        totalDuration: Math.round(totalDuration),
        createdAt: now,
        fileSize: chapters.reduce((sum, ch) => sum + ch.file.size, 0),
      }

      await importBook(book)

      setPhase('done')
      toast.success(`"${title}" imported (${chapters.length} chapters)`)

      setTimeout(() => {
        onImported()
      }, 600)
    } catch {
      setPhase('error')
      toast.error('Failed to import audiobook. Please try again.')
    }
  }, [chapters, title, author, status, importBook, onImported])

  /** Import an M4B audiobook — stores single file + cover in OPFS */
  const handleImportM4b = useCallback(async () => {
    if (!m4bParsed || !title.trim()) return

    setPhase('storing')
    setProgressLabel('Storing audiobook…')
    setProgress(30)

    try {
      // Reuse the bookId generated during parsing — chapters are already keyed to it
      const bookId = m4bParsed.bookId
      const now = new Date().toISOString()

      // Chapters already have the correct bookId from processM4bFile; no remapping needed
      const bookChapters: BookChapter[] = m4bParsed.chapters

      // Store M4B as single file: book.m4b
      const m4bFile = new File([m4bParsed.file], 'book.m4b', {
        type: 'audio/mp4',
      })
      const opfsPath = await opfsStorageService.storeBookFile(bookId, m4bFile)
      setProgress(60)

      // Store cover art if extracted
      let coverUrl: string | undefined
      if (m4bParsed.coverBlob) {
        const coverPath = await opfsStorageService.storeCoverFile(bookId, m4bParsed.coverBlob)
        coverUrl = coverPath === 'indexeddb' ? `opfs-cover://${bookId}` : `opfs://${coverPath}`
      }
      setProgress(80)

      const book: Book = {
        id: bookId,
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        format: 'audiobook',
        status,
        coverUrl,
        tags: [],
        chapters: bookChapters,
        source: { type: 'local', opfsPath: opfsPath === 'indexeddb' ? 'indexeddb' : opfsPath },
        progress: 0,
        totalDuration: Math.round(m4bParsed.totalDuration),
        createdAt: now,
        fileSize: m4bParsed.file.size,
      }

      await importBook(book)
      setProgress(100)

      setPhase('done')
      toast.success(
        `"${title}" imported (${bookChapters.length} chapter${bookChapters.length !== 1 ? 's' : ''})`
      )

      setTimeout(() => {
        onImported()
      }, 600)
    } catch {
      setPhase('error')
      toast.error('Failed to import M4B audiobook. Please try again.')
    }
  }, [m4bParsed, title, author, status, importBook, onImported])

  const hasContent = chapters.length > 0 || m4bParsed !== null

  return (
    <div className="space-y-4">
      {/* File picker — shown when no chapters loaded yet */}
      {!hasContent && !isImporting && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Select audiobook files to import"
          data-testid="audiobook-drop-zone"
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          <Headphones className="h-8 w-8 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            Select MP3 files or a single M4B file
          </p>
          <p className="text-center text-xs text-muted-foreground">
            MP3: sorted by number (01-intro.mp3…) | M4B: chapters extracted automatically
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4b,audio/mpeg,audio/mp4"
            multiple
            className="hidden"
            onChange={handleFileInput}
            data-testid="audiobook-file-input"
          />
        </div>
      )}

      {/* Progress indicator during processing/storing */}
      {isImporting && (
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5 bg-brand-soft" />
          <p className="text-xs text-muted-foreground text-center">{progressLabel}</p>
        </div>
      )}

      {/* M4B metadata form — shown after M4B file is parsed */}
      {m4bParsed && !isImporting && (
        <div className="space-y-4">
          {/* File summary */}
          <div className="rounded-xl bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                M4B audiobook — {m4bParsed.chapters.length} chapter
                {m4bParsed.chapters.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => {
                  setM4bParsed(null)
                  setTitle('')
                  setAuthor('')
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear selected file"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Duration: {Math.floor(m4bParsed.totalDuration / 60)} min | Size:{' '}
              {(m4bParsed.file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="audiobook-title">Title</Label>
            <Input
              id="audiobook-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Audiobook title"
            />
          </div>

          {/* Author */}
          <div className="space-y-1.5">
            <Label htmlFor="audiobook-author">Author</Label>
            <Input
              id="audiobook-author"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </div>

          {/* Chapter list preview */}
          <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-surface-elevated">
            {m4bParsed.chapters.map((ch, i) => (
              <div
                key={ch.id}
                className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-border/40 last:border-0"
              >
                <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate">{ch.title}</span>
                <span className="text-muted-foreground ml-2 tabular-nums">
                  {ch.position.type === 'time'
                    ? `${Math.floor(ch.position.seconds / 60)}:${String(Math.floor(ch.position.seconds % 60)).padStart(2, '0')}`
                    : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onCancel} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={handleImportM4b}
              disabled={!title.trim()}
              className="min-h-[44px] gap-2"
            >
              <Upload className="size-4" />
              Import Audiobook
            </Button>
          </div>
        </div>
      )}

      {/* MP3 metadata form — shown after MP3 chapters are loaded */}
      {chapters.length > 0 && !m4bParsed && !isImporting && (
        <div className="space-y-4">
          {/* Chapter summary */}
          <div className="rounded-xl bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setChapters([])}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear selected files"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Total duration: {Math.floor(chapters.reduce((s, c) => s + c.duration, 0) / 60)} min
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="audiobook-title">Title</Label>
            <Input
              id="audiobook-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Audiobook title"
            />
          </div>

          {/* Author */}
          <div className="space-y-1.5">
            <Label htmlFor="audiobook-author">Author</Label>
            <Input
              id="audiobook-author"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </div>

          {/* Chapter list preview */}
          <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-surface-elevated">
            {chapters.map((ch, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-border/40 last:border-0"
              >
                <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate">{ch.title}</span>
                <span className="text-muted-foreground ml-2 tabular-nums">
                  {Math.floor(ch.duration / 60)}:
                  {String(Math.round(ch.duration % 60)).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onCancel} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={handleImport}
              disabled={!title.trim()}
              className="min-h-[44px] gap-2"
            >
              <Upload className="size-4" />
              Import Audiobook
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
