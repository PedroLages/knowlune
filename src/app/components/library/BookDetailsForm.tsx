/**
 * Book details form shown after an EPUB file is selected in BookImportDialog.
 *
 * Displays cover preview, title/author inputs, genre/status selects,
 * file info, phase indicator, and import/cancel actions.
 *
 * @since E83-S02
 */

import { Loader2, BookOpen, X } from 'lucide-react'
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
import type { BookStatus } from '@/data/types'

export type ImportPhase = 'idle' | 'extracting' | 'fetching-cover' | 'storing' | 'done' | 'error'

export const PHASE_LABELS: Record<ImportPhase, string> = {
  idle: '',
  extracting: 'Extracting metadata...',
  'fetching-cover': 'Fetching cover...',
  storing: 'Storing file...',
  done: 'Done',
  error: 'Import failed',
}

import { ALL_GENRES } from '@/services/GenreDetectionService'
export const GENRES = ALL_GENRES

export const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Currently Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

export interface BookDetailsFormProps {
  file: File
  title: string
  author: string
  genre: string
  status: BookStatus
  coverPreviewUrl: string | null
  phase: ImportPhase
  isImporting: boolean
  onTitleChange: (v: string) => void
  onAuthorChange: (v: string) => void
  onGenreChange: (v: string) => void
  onStatusChange: (v: BookStatus) => void
  onReset: () => void
  onCancel: () => void
  onImport: () => void
}

export function BookDetailsForm({
  file,
  title,
  author,
  genre,
  status,
  coverPreviewUrl,
  phase,
  isImporting,
  onTitleChange,
  onAuthorChange,
  onGenreChange,
  onStatusChange,
  onReset,
  onCancel,
  onImport,
}: BookDetailsFormProps) {
  return (
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
              onChange={e => onTitleChange(e.target.value)}
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
              onChange={e => onAuthorChange(e.target.value)}
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
          <Select value={genre} onValueChange={onGenreChange} disabled={isImporting}>
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
            onValueChange={v => onStatusChange(v as BookStatus)}
            disabled={isImporting}
          >
            <SelectTrigger id="book-status" data-testid="book-status-select">
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
        <span className="shrink-0">({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
        {!isImporting && phase !== 'done' && (
          <button
            type="button"
            onClick={onReset}
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
          {isImporting && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          {PHASE_LABELS[phase]}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          variant="brand"
          onClick={onImport}
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
  )
}
