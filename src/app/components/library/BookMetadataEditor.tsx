/**
 * Book metadata editor dialog — edit title, author, ISBN, description, genre, tags, and cover.
 *
 * Supports cover re-fetch from Open Library and custom cover upload.
 * All edits are local until Save is clicked — Cancel discards changes.
 *
 * @since E83-S05
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2, RefreshCw, Upload, X } from 'lucide-react'
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
import { Badge } from '@/app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type { Book } from '@/data/types'
import { useBookStore } from '@/stores/useBookStore'
import { fetchOpenLibraryMetadata, fetchCoverImage } from '@/services/OpenLibraryService'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { GENRES } from './BookDetailsForm'

interface BookMetadataEditorProps {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NONE_GENRE = '__none__'

/** Convert image to JPEG, resizing if larger than max dimensions. */
async function toJpeg(file: File): Promise<Blob> {
  const img = new Image()
  img.src = URL.createObjectURL(file)
  await new Promise(r => { img.onload = r })
  URL.revokeObjectURL(img.src)

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
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  return new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.85))
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
      // Detect genre from tags
      const matchedGenre = book.tags.find(t => GENRES.includes(t))
      setGenre(matchedGenre || NONE_GENRE)
      // Tags excluding the genre tag
      setTags(book.tags.filter(t => !GENRES.includes(t)))
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
  const addTag = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setTagInput('')
    setShowTagSuggestions(false)
  }, [tags])

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      addTag(tagInput)
    }
  }, [tagInput, addTag])

  // Tag autocomplete suggestions
  const tagSuggestions = tagInput.trim()
    ? allTags().filter(t =>
        t.toLowerCase().includes(tagInput.toLowerCase()) &&
        !tags.includes(t) &&
        !GENRES.includes(t)
      )
    : []

  // Cover re-fetch from Open Library
  const handleRefetchCover = useCallback(async () => {
    if (!book) return
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
  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [setSafeCoverPreviewUrl])

  // Save
  const handleSave = useCallback(async () => {
    if (!book || !title.trim() || !author.trim()) return

    setIsSaving(true)
    try {
      // Build tags: genre (if set) + user tags
      const finalTags = genre !== NONE_GENRE ? [genre, ...tags] : [...tags]

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
        tags: finalTags,
        coverUrl,
      })

      onOpenChange(false)
    } catch {
      toast.error('Failed to save book details')
    } finally {
      setIsSaving(false)
    }
  }, [book, title, author, isbn, description, genre, tags, newCoverBlob, updateBookMetadata, onOpenChange])

  if (!book) return null

  const canSave = title.trim().length > 0 && author.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg" aria-label="Edit book details" data-testid="book-metadata-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Edit Book Details
          </DialogTitle>
          <DialogDescription>
            Update the metadata for &ldquo;{book.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover section */}
          <div className="flex gap-4">
            <div className="relative shrink-0">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt={`Cover of ${title}`}
                  className="h-32 w-24 rounded-lg object-cover"
                  data-testid="editor-cover-preview"
                />
              ) : (
                <div className="flex h-32 w-24 items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {isFetchingCover && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefetchCover}
                disabled={isFetchingCover || isSaving}
                className="min-h-[44px]"
                data-testid="refetch-cover-button"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Re-fetch from Open Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="min-h-[44px]"
                data-testid="upload-cover-button"
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload custom cover
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleCoverUpload}
                data-testid="cover-file-input"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="edit-book-title">Title *</Label>
            <Input
              id="edit-book-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Book title"
              disabled={isSaving}
              data-testid="edit-book-title"
            />
          </div>

          {/* Author */}
          <div>
            <Label htmlFor="edit-book-author">Author *</Label>
            <Input
              id="edit-book-author"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
              disabled={isSaving}
              data-testid="edit-book-author"
            />
          </div>

          {/* ISBN */}
          <div>
            <Label htmlFor="edit-book-isbn">ISBN</Label>
            <Input
              id="edit-book-isbn"
              value={isbn}
              onChange={e => setIsbn(e.target.value)}
              placeholder="ISBN (optional)"
              disabled={isSaving}
              data-testid="edit-book-isbn"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="edit-book-description">Description</Label>
            <Textarea
              id="edit-book-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              rows={3}
              disabled={isSaving}
              data-testid="edit-book-description"
            />
          </div>

          {/* Genre */}
          <div>
            <Label htmlFor="edit-book-genre">Genre</Label>
            <Select value={genre} onValueChange={setGenre} disabled={isSaving}>
              <SelectTrigger id="edit-book-genre" data-testid="edit-book-genre">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_GENRE}>None</SelectItem>
                {GENRES.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="edit-book-tags">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1"
                  data-testid={`tag-chip-${tag}`}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Remove tag ${tag}`}
                    data-testid={`remove-tag-${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input
                ref={tagInputRef}
                id="edit-book-tags"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value)
                  setShowTagSuggestions(true)
                }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowTagSuggestions(false), 200)
                }}
                placeholder="Type a tag and press Enter"
                disabled={isSaving}
                data-testid="edit-book-tag-input"
              />
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <ul
                  className="absolute z-50 mt-1 max-h-32 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
                  data-testid="tag-suggestions"
                >
                  {tagSuggestions.slice(0, 8).map(suggestion => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={e => {
                          e.preventDefault()
                          addTag(suggestion)
                          tagInputRef.current?.focus()
                        }}
                        data-testid={`tag-suggestion-${suggestion}`}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
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
              className="min-h-[44px]"
              data-testid="editor-save-button"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
