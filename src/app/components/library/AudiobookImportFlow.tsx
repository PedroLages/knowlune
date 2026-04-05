/**
 * AudiobookImportFlow — handles MP3 file selection, chapter ordering,
 * ID3 tag extraction, duration calculation, and OPFS storage for audiobooks.
 *
 * Renders within BookImportDialog when "Audiobook" mode is selected.
 *
 * @module AudiobookImportFlow
 */
// eslint-disable-next-line component-size/max-lines -- self-contained multi-step import flow: file selection, ID3 parsing, duration calc, OPFS storage, metadata form
import { useState, useRef, useCallback } from 'react'
import { Headphones, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Progress } from '@/app/components/ui/progress'
import { useBookStore } from '@/stores/useBookStore'
import { opfsStorageService } from '@/services/OpfsStorageService'
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
}

interface ChapterFile {
  file: File
  order: number
  title: string
  duration: number // seconds
}

type Phase = 'idle' | 'processing' | 'storing' | 'done' | 'error'

export function AudiobookImportFlow({ onCancel, onImported }: AudiobookImportFlowProps) {
  const importBook = useBookStore(s => s.importBook)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [chapters, setChapters] = useState<ChapterFile[]>([])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status] = useState<BookStatus>('unread')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  const isImporting = phase === 'processing' || phase === 'storing'

  const processFiles = useCallback(
    async (files: File[]) => {
      const mp3s = files.filter(f => f.name.toLowerCase().endsWith('.mp3'))
      if (mp3s.length === 0) {
        toast.error('No MP3 files found. Please select MP3 audiobook files.')
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
    [title]
  )

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
          position: { type: 'time', value: cumulativeStart },
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

  return (
    <div className="space-y-4">
      {/* File picker — shown when no chapters loaded yet */}
      {chapters.length === 0 && !isImporting && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Select MP3 files to import"
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
            Select MP3 files (one per chapter)
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Files will be sorted by leading number (01-intro.mp3, 02-chapter.mp3…)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
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

      {/* Metadata form — shown after chapters are loaded */}
      {chapters.length > 0 && !isImporting && (
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
