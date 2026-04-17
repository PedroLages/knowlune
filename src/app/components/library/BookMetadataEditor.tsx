/**
 * Book metadata editor dialog — edit title, author, ISBN, description, genre, tags, and cover.
 *
 * Supports cover re-fetch from Open Library and custom cover upload.
 * All edits are local until Save is clicked — Cancel discards changes.
 *
 * @since E83-S05
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/app/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type { Book, BookGenre } from '@/data/types'
import { stripHtml } from '@/lib/textUtils'
import { Badge } from '@/app/components/ui/badge'
import { useBookStore } from '@/stores/useBookStore'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { searchCovers, type MetadataSearchResult } from '@/services/CoverSearchService'
import { detectGenre } from '@/services/GenreDetectionService'
import { GENRES } from './BookDetailsForm'
import { EditorCoverSection } from './EditorCoverSection'
import { EditorTagSection } from './EditorTagSection'
import { CoverSearchGrid } from './CoverSearchGrid'
import { ghostInputClass, labelClass } from './designConstants'
import { cn } from '@/app/components/ui/utils'

interface BookMetadataEditorProps {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NONE_GENRE = '__none__'

/** Convert image to JPEG, resizing if larger than max dimensions. */
async function toJpeg(file: File): Promise<Blob> {
  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  img.src = objectUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
  })
  URL.revokeObjectURL(objectUrl)

  const MAX_W = 1500
  const MAX_H = 2250
  let { width, height } = img
  if (width > MAX_W || height > MAX_H) {
    const scale = Math.min(MAX_W / width, MAX_H / height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context')
  }
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to JPEG blob'))
        }
      },
      'image/jpeg',
      0.85
    )
  })
}

export function BookMetadataEditor({ book, open, onOpenChange }: BookMetadataEditorProps) {
  const updateBookMetadata = useBookStore(s => s.updateBookMetadata)
  const allTags = useBookStore(s => s.getAllTags)

  // Local form state
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [narrator, setNarrator] = useState('')
  const [asin, setAsin] = useState('')
  const [description, setDescription] = useState('')
  const [seriesName, setSeriesName] = useState('')
  const [seriesSequence, setSeriesSequence] = useState('')
  const [genre, setGenre] = useState(NONE_GENRE)
  // Track whether the user explicitly changed the genre in this edit session.
  // Prevents silently overwriting a legacy tag-based genre with undefined on save.
  const [genreChanged, setGenreChanged] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [newCoverBlob, setNewCoverBlob] = useState<Blob | null>(null)
  const [isFetchingCover, setIsFetchingCover] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Cover/metadata search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<MetadataSearchResult[]>([])
  const [showSearchGrid, setShowSearchGrid] = useState(false)

  const coverPreviewUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Revoke object URL helper
  const setSafeCoverPreviewUrl = useCallback((url: string | null) => {
    if (coverPreviewUrlRef.current) {
      URL.revokeObjectURL(coverPreviewUrlRef.current)
    }
    coverPreviewUrlRef.current = url
    setCoverPreviewUrl(url)
  }, [])

  // Populate form when book changes
  useEffect(() => {
    if (book && open) {
      setTitle(book.title)
      setAuthor(book.author ?? '')
      setIsbn(book.isbn || '')
      setNarrator(book.narrator ?? '')
      setAsin(book.asin ?? '')
      setDescription(book.description ? stripHtml(book.description) : '')
      // Use dedicated genre field if set, fall back to tag-based detection for legacy books
      const bookGenre = book.genre || book.tags.find(t => (GENRES as string[]).includes(t))
      setGenre(bookGenre ?? NONE_GENRE)
      setSeriesName(book.series ?? '')
      setSeriesSequence(book.seriesSequence ?? '')
      setGenreChanged(false) // reset change tracking when form opens
      // Tags excluding the genre tag
      setTags(book.tags.filter(t => !(GENRES as string[]).includes(t)))
      setNewCoverBlob(null)
      setTagInput('')
      setShowTagSuggestions(false)
      // Reset search state
      setShowSearchGrid(false)
      setSearchResults([])
      setIsSearching(false)

      // Resolve existing cover — opfs-cover:// requires async blob resolution
      let isCancelled = false
      let blobUrl: string | null = null

      const resolveCover = async () => {
        setIsFetchingCover(true)
        try {
          if (book.coverUrl?.startsWith('opfs-cover://') || book.coverUrl?.startsWith('opfs://')) {
            blobUrl = await opfsStorageService.getCoverUrl(book.id)
            if (!isCancelled) {
              setSafeCoverPreviewUrl(blobUrl)
              blobUrl = null // setSafeCoverPreviewUrl owns the lifecycle; null out to prevent double-revoke
            }
          } else if (book.coverUrl) {
            // Direct URL (https:// or data:image/) — no resolution needed
            if (!isCancelled) setSafeCoverPreviewUrl(book.coverUrl)
          } else {
            if (!isCancelled) setSafeCoverPreviewUrl(null)
          }
        } catch {
          // silent-catch-ok: cover resolution failure shows placeholder, not an error state
          if (!isCancelled) setSafeCoverPreviewUrl(null)
        } finally {
          if (!isCancelled) setIsFetchingCover(false)
        }
      }

      resolveCover()

      return () => {
        isCancelled = true
        // Revoke only if the blob was resolved but isCancelled blocked handoff to setSafeCoverPreviewUrl
        if (blobUrl) URL.revokeObjectURL(blobUrl)
      }
    }
  }, [book, open, setSafeCoverPreviewUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) {
        URL.revokeObjectURL(coverPreviewUrlRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleClose = useCallback(() => {
    if (!isSaving) {
      abortControllerRef.current?.abort()
      setShowSearchGrid(false)
      setSearchResults([])
      onOpenChange(false)
    }
  }, [isSaving, onOpenChange])

  // Tag management
  const addTag = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (trimmed && !tags.includes(trimmed)) {
        setTags(prev => [...prev, trimmed])
      }
      setTagInput('')
      setShowTagSuggestions(false)
    },
    [tags]
  )

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
        e.preventDefault()
        addTag(tagInput)
      }
    },
    [tagInput, addTag]
  )

  // Tag autocomplete suggestions
  const tagSuggestions = tagInput.trim()
    ? allTags().filter(
        t =>
          t.toLowerCase().includes(tagInput.toLowerCase()) &&
          !tags.includes(t) &&
          !(GENRES as string[]).includes(t)
      )
    : []

  // Unified cover + metadata search across all providers
  const handleSearchCovers = useCallback(async () => {
    if (!book) return
    if (!navigator.onLine) {
      toast.warning('You are offline. Search requires an internet connection.')
      return
    }

    // Cancel any in-flight search
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsSearching(true)
    setSearchResults([])
    setShowSearchGrid(true)

    await searchCovers(
      { title, author, isbn: isbn || undefined, asin: asin || undefined },
      book.format,
      (providerResults) => {
        if (controller.signal.aborted) return
        setSearchResults(prev => [...prev, ...providerResults])
      },
      controller.signal
    )

    if (!controller.signal.aborted) setIsSearching(false)
  }, [book, title, author, isbn, asin])

  // Apply a selected search result: fetch cover + auto-fill blank fields
  const handleSelectResult = useCallback(async (result: MetadataSearchResult) => {
    // 1. Fetch and convert cover if available
    if (result.coverUrl && /^https?:\/\//.test(result.coverUrl)) {
      setIsFetchingCover(true)
      try {
        // Google Books CDN blocks browser-direct fetch (no CORS headers) — route through proxy
        const fetchUrl = result.provider === 'google-books'
          ? `/api/cover-proxy?url=${encodeURIComponent(result.coverUrl)}`
          : result.coverUrl
        const signal = abortControllerRef.current?.signal ?? AbortSignal.timeout(15_000)
        const response = await fetch(fetchUrl, { signal })
        if (response.ok) {
          const blob = await response.blob()
          const jpegBlob = await toJpeg(new File([blob], 'cover.jpg', { type: blob.type }))
          const url = URL.createObjectURL(jpegBlob)
          setSafeCoverPreviewUrl(url)
          setNewCoverBlob(jpegBlob)
        }
      } catch {
        toast.warning('Could not fetch cover image — try uploading manually.')
        setShowSearchGrid(false)
      } finally {
        setIsFetchingCover(false)
      }
    }

    // 2. Auto-fill only blank fields (never overwrite existing user data)
    const m = result.metadata
    if (!author.trim() && m.author) setAuthor(m.author)
    if (!description.trim() && m.description) setDescription(stripHtml(m.description))
    if (!seriesName.trim() && m.series) setSeriesName(m.series)
    if (!seriesSequence.trim() && m.seriesSequence) setSeriesSequence(m.seriesSequence)
    if (!isbn.trim() && m.isbn) setIsbn(m.isbn)
    if (!asin.trim() && m.asin) setAsin(m.asin)
    if (!narrator.trim() && m.narrator) setNarrator(m.narrator)

    // 3. Auto-detect genre if not set
    if (genre === NONE_GENRE && m.genres && m.genres.length > 0) {
      const detected = detectGenre(m.genres)
      if (detected !== 'Other') {
        setGenre(detected)
        setGenreChanged(true)
      }
    }

    setShowSearchGrid(false)
  }, [author, description, seriesName, seriesSequence, isbn, asin, narrator, genre, setSafeCoverPreviewUrl])

  // Custom cover upload
  const handleCoverUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const jpegBlob = await toJpeg(file)
        const url = URL.createObjectURL(jpegBlob)
        setSafeCoverPreviewUrl(url)
        setNewCoverBlob(jpegBlob)
      } catch {
        toast.error('Failed to process image')
      }
      // Reset file input so same file can be re-selected
      e.target.value = ''
    },
    [setSafeCoverPreviewUrl]
  )

  // Save
  const handleSave = useCallback(async () => {
    if (!book || !title.trim() || !author.trim()) return

    setIsSaving(true)
    try {
      // Determine the effective genre value for saving.
      // If the user didn't explicitly change the genre, preserve the book's existing genre
      // (including legacy tag-based genres) to avoid silently deleting it on save.
      const effectiveGenre: BookGenre | undefined = genreChanged
        ? genre !== NONE_GENRE
          ? (genre as BookGenre)
          : undefined
        : book.genre ||
          (book.tags.find(t => (GENRES as string[]).includes(t)) as BookGenre | undefined)

      // Build tags: genre (if set) + user tags
      const finalTags = effectiveGenre ? [effectiveGenre, ...tags] : [...tags]

      // Handle cover update — append timestamp to bust the useBookCoverUrl cache
      // when the same opfs-cover:// path is rewritten with a new image.
      let coverUrl = book.coverUrl
      if (newCoverBlob) {
        const coverPath = await opfsStorageService.storeCoverFile(book.id, newCoverBlob)
        const base = coverPath === 'indexeddb' ? `opfs-cover://${book.id}` : `opfs://${coverPath}`
        coverUrl = `${base}?t=${Date.now()}`
      }

      await updateBookMetadata(book.id, {
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim() || undefined,
        description: description.trim() || undefined,
        genre: effectiveGenre, // E108-S05: persist genre field, preserve if not changed
        tags: finalTags,
        coverUrl,
        series: seriesName.trim() || undefined, // E110-S02: series grouping
        seriesSequence: seriesSequence.trim() || undefined,
        narrator: narrator.trim() || undefined,
        asin: asin.trim() || undefined,
      })

      onOpenChange(false)
    } catch {
      toast.error('Failed to save book details')
    } finally {
      setIsSaving(false)
    }
  }, [
    book,
    title,
    author,
    isbn,
    narrator,
    asin,
    description,
    genre,
    genreChanged,
    seriesName,
    seriesSequence,
    tags,
    newCoverBlob,
    updateBookMetadata,
    onOpenChange,
  ])

  if (!book) return null

  const canSave = title.trim().length > 0 && author.trim().length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) handleClose()
      }}
    >
      <DialogContent
        className="flex flex-col w-full max-w-2xl sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden"
        aria-label="Edit book details"
        data-testid="book-metadata-editor"
      >
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Edit Book Details
          </DialogTitle>
          <DialogDescription>Update the metadata for &ldquo;{book.title}&rdquo;.</DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Cover row: image + buttons side by side */}
          <EditorCoverSection
            coverPreviewUrl={coverPreviewUrl}
            title={title}
            format={book.format}
            isFetchingCover={isFetchingCover}
            isSearching={isSearching}
            isSaving={isSaving}
            fileInputRef={fileInputRef}
            onSearchCovers={handleSearchCovers}
            onCoverUpload={handleCoverUpload}
          />

          {/* Format badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full">
              {book.format === 'audiobook' ? 'Audiobook' : book.format.toUpperCase()}
            </Badge>
            {book.linkedBookId && (
              <Badge variant="secondary" className="rounded-full">
                Linked Format
              </Badge>
            )}
          </div>

          {/* Search results grid — full width, shown after search */}
          {showSearchGrid && (
            <CoverSearchGrid
              results={searchResults}
              isSearching={isSearching}
              onSelect={handleSelectResult}
            />
          )}

          {/* Form fields — single column, full width */}
          <div className="space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="edit-book-title" className={labelClass}>
                Title *
              </Label>
              <Input
                id="edit-book-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Book title"
                disabled={isSaving}
                className={cn(ghostInputClass)}
                data-testid="edit-book-title"
              />
            </div>

            {/* Author */}
            <div>
              <Label htmlFor="edit-book-author" className={labelClass}>
                Author *
              </Label>
              <Input
                id="edit-book-author"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Author name"
                disabled={isSaving}
                className={cn(ghostInputClass)}
                data-testid="edit-book-author"
              />
            </div>

            {/* ISBN */}
            <div>
              <Label htmlFor="edit-book-isbn" className={labelClass}>
                ISBN
              </Label>
              <Input
                id="edit-book-isbn"
                value={isbn}
                onChange={e => setIsbn(e.target.value)}
                placeholder="ISBN (optional)"
                disabled={isSaving}
                className={cn(ghostInputClass)}
                data-testid="edit-book-isbn"
              />
            </div>

            {/* Narrator + ASIN — audiobooks only */}
            {book.format === 'audiobook' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-book-narrator" className={labelClass}>
                    Narrator
                  </Label>
                  <Input
                    id="edit-book-narrator"
                    value={narrator}
                    onChange={e => setNarrator(e.target.value)}
                    placeholder="Narrator name"
                    disabled={isSaving}
                    className={cn(ghostInputClass)}
                    data-testid="edit-book-narrator"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-book-asin" className={labelClass}>
                    ASIN
                  </Label>
                  <Input
                    id="edit-book-asin"
                    value={asin}
                    onChange={e => setAsin(e.target.value)}
                    placeholder="Audible ASIN"
                    disabled={isSaving}
                    className={cn(ghostInputClass)}
                    data-testid="edit-book-asin"
                  />
                </div>
              </div>
            )}

            {/* Series (E110-S02) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-book-series" className={labelClass}>
                  Series
                </Label>
                <Input
                  id="edit-book-series"
                  value={seriesName}
                  onChange={e => setSeriesName(e.target.value)}
                  placeholder="e.g. Harry Potter"
                  disabled={isSaving}
                  className={cn(ghostInputClass)}
                  data-testid="edit-book-series"
                />
              </div>
              <div>
                <Label htmlFor="edit-book-series-sequence" className={labelClass}>
                  Book #
                </Label>
                <Input
                  id="edit-book-series-sequence"
                  value={seriesSequence}
                  onChange={e => setSeriesSequence(e.target.value)}
                  placeholder="e.g. 1, 2.5"
                  disabled={isSaving}
                  className={cn(ghostInputClass)}
                  data-testid="edit-book-series-sequence"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="edit-book-description" className={labelClass}>
                Description
              </Label>
              <Textarea
                id="edit-book-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
                rows={3}
                disabled={isSaving}
                className={cn(ghostInputClass)}
                data-testid="edit-book-description"
              />
            </div>

            {/* Genre */}
            <div>
              <Label htmlFor="edit-book-genre" className={labelClass}>
                Genre
              </Label>
              <Select
                value={genre}
                onValueChange={v => {
                  setGenre(v)
                  setGenreChanged(true)
                }}
                disabled={isSaving}
              >
                <SelectTrigger
                  id="edit-book-genre"
                  className={cn(ghostInputClass)}
                  data-testid="edit-book-genre"
                >
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_GENRE}>None</SelectItem>
                  {GENRES.map(g => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <EditorTagSection
              tags={tags}
              tagInput={tagInput}
              showTagSuggestions={showTagSuggestions}
              tagSuggestions={tagSuggestions}
              isSaving={isSaving}
              tagInputRef={tagInputRef}
              onTagInputChange={v => {
                setTagInput(v)
                setShowTagSuggestions(true)
              }}
              onTagKeyDown={handleTagKeyDown}
              onFocus={() => setShowTagSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowTagSuggestions(false), 200)
              }}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />

          </div>{/* end form fields */}
        </div>{/* end scrollable body */}

        {/* Fixed footer with actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/20 shrink-0">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSaving}
            className="min-h-[44px]"
            data-testid="editor-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="min-h-[44px] rounded-full px-6"
            data-testid="editor-save-button"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
