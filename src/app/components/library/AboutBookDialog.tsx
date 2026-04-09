/**
 * About Book Dialog — Displays book metadata and details
 *
 * Opens from any book's context menu. Shows:
 *  - Cover image with fallback icon
 *  - Title, author, description
 *  - Metadata grid (format, publish date, ISBN, file size)
 *  - Tags display
 *
 * @since E107-S04
 */

import { BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Badge } from '@/app/components/ui/badge'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

interface AboutBookDialogProps {
  book: Book
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutBookDialog({ book, open, onOpenChange }: AboutBookDialogProps) {
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

  // Format file size for display
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '—'
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  }

  // Format publish date for display
  const formatPublishDate = (dateStr?: string): string => {
    if (!dateStr) return '—'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md w-full"
        aria-describedby="about-book-desc"
        data-testid="about-book-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" aria-hidden="true" />
            About Book
          </DialogTitle>
          <DialogDescription id="about-book-desc">
            Book details and metadata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cover and basic info */}
          <div className="flex gap-4">
            {/* Cover image with fallback */}
            <div className="w-32 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
              {resolvedCoverUrl ? (
                <img
                  src={resolvedCoverUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  data-testid="about-book-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  {book.format === 'audiobook' ? (
                    <Headphones
                      className="size-12 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <BookOpen className="size-12 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
              )}
            </div>

            {/* Title and author */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-card-foreground truncate" data-testid="about-book-title">
                {book.title}
              </h3>
              {book.author ? (
                <p className="text-base font-medium text-card-foreground" data-testid="about-book-author">
                  {book.author}
                </p>
              ) : (
                <p className="text-base font-medium text-muted-foreground italic">
                  Unknown author
                </p>
              )}
              <Badge
                variant="secondary"
                className="mt-2 bg-brand-soft text-brand-soft-foreground"
                data-testid="about-book-format"
              >
                {book.format === 'audiobook' ? 'Audiobook' : book.format.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {book.description ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </p>
              <p className="text-sm text-card-foreground leading-relaxed" data-testid="about-book-description">
                {book.description}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </p>
              <p className="text-sm text-muted-foreground italic">No description available</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Metadata
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-y-3 gap-x-4 text-sm">
              {/* Format */}
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium text-card-foreground">
                {book.format === 'audiobook' ? 'Audiobook' : book.format.toUpperCase()}
              </span>

              {/* Publish Date */}
              <span className="text-muted-foreground">Published</span>
              <span className="font-medium text-card-foreground" data-testid="about-book-publish-date">
                {formatPublishDate(book.publishDate)}
              </span>

              {/* ISBN */}
              <span className="text-muted-foreground">ISBN</span>
              <span className="font-medium text-card-foreground" data-testid="about-book-isbn">
                {book.isbn || '—'}
              </span>

              {/* File Size */}
              <span className="text-muted-foreground">File Size</span>
              <span className="font-medium text-card-foreground" data-testid="about-book-file-size">
                {formatFileSize(book.fileSize)}
              </span>
            </div>
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5" data-testid="about-book-tags">
                {book.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
