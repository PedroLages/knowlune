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
import type { Book } from '@/data/types'
import { Badge } from '@/app/components/ui/badge'
import { useBookStore } from '@/stores/useBookStore'
import { fetchOpenLibraryMetadata, fetchCoverImage } from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { GENRES } from './BookDetailsForm'
import { EditorCoverSection } from './EditorCoverSection'
import { EditorTagSection } from './EditorTagSection'
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

  const MAX_W = 800
  const MAX_H = 1200
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
  const [description, setDescription] = useState('')
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

  const coverPreviewUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

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
      setAuthor(book.author)
      setIsbn(book.isbn || '')
      setDescription(book.description || '')
      // Use dedicated genre field if set, fall back to tag-based detection for legacy books
      const bookGenre = book.genre || book.tags.find(t => (GENRES as string[]).includes(t))
      setGenre(bookGenre ?? NONE_GENRE)
      setGenreChanged(false) // reset change tracking when form opens
      // Tags excluding the genre tag
      setTags(book.tags.filter(t => !(GENRES as string[]).includes(t)))
      setNewCoverBlob(null)
      setTagInput('')
      setShowTagSuggestions(false)
      // Set existing cover
      if (book.coverUrl) {
        setSafeCoverPreviewUrl(book.coverUrl)
      } else {
        setSafeCoverPreviewUrl(null)
      }
    }
  }, [book, open, setSafeCoverPreviewUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) {
        URL.revokeObjectURL(coverPreviewUrlRef.current)
      }
    }
  }, [])

  const handleClose = useCallback(() => {
    if (!isSaving) {
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

  // Cover re-fetch from Open Library
  const handleRefetchCover = useCallback(async () => {
    if (!book) return
    if (!navigator.onLine) {
      toast.warning('You are offline. Cover fetch requires an internet connection.')
      return
    }
    setIsFetchingCover(true)
    try {
      const result = await fetchOpenLibraryMetadata({
        isbn: isbn || undefined,
        title,
        author,
      })
      if (result.coverUrl) {
        const blob = await fetchCoverImage(result.coverUrl)
        if (blob) {
          const jpegBlob = await toJpeg(new File([blob], 'cover.jpg', { type: blob.type }))
          const url = URL.createObjectURL(jpegBlob)
          setSafeCoverPreviewUrl(url)
          setNewCoverBlob(jpegBlob)
        } else {
          toast.info('No cover found on Open Library')
        }
      } else {
        toast.info('No cover found on Open Library')
      }
    } catch {
      toast.error('Failed to fetch cover')
    } finally {
      setIsFetchingCover(false)
    }
  }, [book, isbn, title, author, setSafeCoverPreviewUrl])

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
      const effectiveGenre: string | undefined =
        genreChanged
          ? genre !== NONE_GENRE ? genre : undefined
          : book.genre || book.tags.find(t => (GENRES as string[]).includes(t)) || undefined

      // Build tags: genre (if set) + user tags
      const finalTags = effectiveGenre ? [effectiveGenre, ...tags] : [...tags]

      // Handle cover update
      let coverUrl = book.coverUrl
      if (newCoverBlob) {
        const coverPath = await opfsStorageService.storeCoverFile(book.id, newCoverBlob)
        coverUrl = coverPath === 'indexeddb' ? `opfs-cover://${book.id}` : `opfs://${coverPath}`
      }

      await updateBookMetadata(book.id, {
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim() || undefined,
        description: description.trim() || undefined,
        genre: effectiveGenre, // E108-S05: persist genre field, preserve if not changed
        tags: finalTags,
        coverUrl,
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
    description,
    genre,
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
        className="max-w-4xl"
        aria-label="Edit book details"
        data-testid="book-metadata-editor"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Edit Book Details
          </DialogTitle>
          <DialogDescription>Update the metadata for &ldquo;{book.title}&rdquo;.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Left column: Cover + format badges */}
          <div className="w-full sm:w-2/5 flex flex-col gap-3">
            <EditorCoverSection
              coverPreviewUrl={coverPreviewUrl}
              title={title}
              isFetchingCover={isFetchingCover}
              isSaving={isSaving}
              fileInputRef={fileInputRef}
              onRefetchCover={handleRefetchCover}
              onCoverUpload={handleCoverUpload}
            />
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
          </div>

          {/* Right column: Form fields */}
          <div className="w-full sm:w-3/5 space-y-4">
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
              <Select value={genre} onValueChange={v => { setGenre(v); setGenreChanged(true) }} disabled={isSaving}>
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

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
