/**
 * Link Formats Dialog — Book Pairing Entry Point for Whispersync
 *
 * Opens from any book's context menu. Allows the user to:
 *  1. Select a compatible book (opposite format, not already linked)
 *  2. Auto-match chapters via computeChapterMapping()
 *  3. Review/edit low-confidence mappings in ChapterMappingEditor
 *  4. Save the pairing via linkBooks() or unlink an existing pair via unlinkBooks()
 *
 * @since E104-S01
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  BookOpen,
  Headphones,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Link2Off,
} from 'lucide-react'
import type { Book, ChapterMapping } from '@/data/types'
import { useBookStore } from '@/stores/useBookStore'
import {
  computeChapterMapping,
  type EpubChapterInput,
  type AudioChapterInput,
} from '@/lib/chapterMatcher'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { cn } from '@/app/components/ui/utils'
import { toast } from 'sonner'
import { ChapterMappingEditor } from './ChapterMappingEditor'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

/** Confidence threshold above which mappings auto-save after confirmation. */
const HIGH_CONFIDENCE_THRESHOLD = 0.85

/** View states of the dialog flow. */
type DialogView = 'select' | 'confirm' | 'editor' | 'unlink-confirm'

interface LinkFormatsDialogProps {
  /** The book from which the dialog was opened. */
  book: Book
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Render a small book thumbnail with title/author for the book picker. */
function BookPickerCard({
  book,
  selected,
  onClick,
}: {
  book: Book
  selected: boolean
  onClick: () => void
}) {
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-colors min-h-[44px]',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected ? 'border-brand bg-brand-soft' : 'border-border bg-card'
      )}
    >
      {/* Thumbnail */}
      <div className="size-12 flex-shrink-0 rounded-lg overflow-hidden">
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
            {book.format === 'audiobook' ? (
              <Headphones className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium truncate',
            selected ? 'text-brand-soft-foreground' : 'text-foreground'
          )}
        >
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
        <Badge variant="secondary" className="w-fit text-[10px] mt-0.5">
          {book.format === 'audiobook' ? 'Audiobook' : book.format.toUpperCase()}
        </Badge>
      </div>

      {/* Checkmark when selected */}
      {selected && <CheckCircle2 className="size-5 text-brand flex-shrink-0" aria-hidden="true" />}
    </button>
  )
}

/** Confidence bar with colour coding. */
function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const isHigh = score >= HIGH_CONFIDENCE_THRESHOLD
  const isMedium = score >= 0.7 && score < HIGH_CONFIDENCE_THRESHOLD

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Chapter matching confidence</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            isHigh ? 'text-success' : isMedium ? 'text-warning' : 'text-destructive'
          )}
        >
          {pct}%
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Chapter matching confidence: ${pct}%`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh ? 'bg-success' : isMedium ? 'bg-warning' : 'bg-destructive'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isHigh
          ? 'High confidence — chapters will be linked automatically.'
          : isMedium
            ? 'Medium confidence — review the mapping before saving.'
            : 'Low confidence — manual mapping required.'}
      </p>
    </div>
  )
}

export function LinkFormatsDialog({ book, open, onOpenChange }: LinkFormatsDialogProps) {
  const books = useBookStore(s => s.books)
  const linkBooks = useBookStore(s => s.linkBooks)
  const unlinkBooks = useBookStore(s => s.unlinkBooks)

  const [view, setView] = useState<DialogView>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mappings, setMappings] = useState<ChapterMapping[] | null>(null)
  const [saving, setSaving] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Reset to initial state when dialog closes. */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setView(book.linkedBookId ? 'unlink-confirm' : 'select')
        setSelectedId(null)
        setMappings(null)
        setSaving(false)
        // Cancel any pending reset before scheduling a new one to avoid stale callbacks on rapid re-open
        if (resetTimerRef.current !== null) {
          clearTimeout(resetTimerRef.current)
        }
        resetTimerRef.current = setTimeout(() => {
          resetTimerRef.current = null
          setView('select')
        }, 300)
      }
      onOpenChange(next)
    },
    [book.linkedBookId, onOpenChange]
  )

  /** Determine which format to show as candidates. */
  const targetFormat = book.format === 'audiobook' ? 'epub' : 'audiobook'

  /** Candidate books: opposite format, not already linked. */
  const candidates = useMemo(
    () => books.filter(b => b.format === targetFormat && !b.linkedBookId && b.id !== book.id),
    [books, targetFormat, book.id]
  )

  const selectedBook = useMemo(
    () => (selectedId ? books.find(b => b.id === selectedId) : null),
    [books, selectedId]
  )

  /** Convert BookChapter[] to EpubChapterInput[]. */
  function toEpubInputs(b: Book): EpubChapterInput[] {
    return b.chapters.map(ch => ({
      href: ch.id,
      label: ch.title,
    }))
  }

  /** Convert BookChapter[] to AudioChapterInput[]. */
  function toAudioInputs(b: Book): AudioChapterInput[] {
    return b.chapters.map(ch => ({
      title: ch.title,
      startSeconds: ch.position.type === 'time' ? ch.position.seconds : 0,
    }))
  }

  /** Determine which book is epub and which is audio from a pair. */
  function resolveEpubAudio(bookA: Book, bookB: Book): { epubBook: Book; audioBook: Book } {
    return bookA.format === 'epub'
      ? { epubBook: bookA, audioBook: bookB }
      : { epubBook: bookB, audioBook: bookA }
  }

  /** Compute mappings and advance to the correct next view. */
  const handlePairPressed = useCallback(() => {
    // Read selectedId from state and resolve against a fresh books snapshot
    // to avoid stale closure on selectedBook derived during the previous render
    const currentSelectedId = selectedId
    if (!currentSelectedId) return
    const freshBooks = useBookStore.getState().books
    const freshSelected = freshBooks.find(b => b.id === currentSelectedId)
    if (!freshSelected) return

    const { epubBook, audioBook } = resolveEpubAudio(book, freshSelected)

    const computed = computeChapterMapping(toEpubInputs(epubBook), toAudioInputs(audioBook))
    setMappings(computed)

    // Compute average confidence
    const avg =
      computed.length > 0 ? computed.reduce((sum, m) => sum + m.confidence, 0) / computed.length : 0

    if (avg >= HIGH_CONFIDENCE_THRESHOLD) {
      setView('confirm')
    } else {
      setView('editor')
    }
  }, [book, selectedId])

  /** Save the pairing with whichever mappings we have. */
  const handleSave = useCallback(
    async (finalMappings?: ChapterMapping[]) => {
      if (!selectedBook) return
      setSaving(true)
      try {
        await linkBooks(book.id, selectedBook.id)
        // TODO E103-S01: persist finalMappings to ChapterMappingRecord table when that store action exists
        // finalMappings intentionally unused until the ChapterMappingRecord store action is implemented
        void finalMappings
        onOpenChange(false)
      } catch (err) {
        console.error('[LinkFormatsDialog] linkBooks failed:', err)
        toast.error('Failed to link formats. Please try again.')
      } finally {
        setSaving(false)
      }
    },
    [book.id, selectedBook, linkBooks, onOpenChange]
  )

  /** Unlink the current pairing. */
  const handleUnlink = useCallback(async () => {
    if (!book.linkedBookId) return
    setSaving(true)
    try {
      await unlinkBooks(book.id, book.linkedBookId)
      onOpenChange(false)
    } catch (err) {
      console.error('[LinkFormatsDialog] unlinkBooks failed:', err)
      toast.error('Failed to unlink formats. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [book.id, book.linkedBookId, unlinkBooks, onOpenChange])

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const alreadyLinked = !!book.linkedBookId
  const linkedBook = alreadyLinked ? books.find(b => b.id === book.linkedBookId) : null

  // Compute confidence for confirm view
  const avgConfidence = useMemo(() => {
    if (!mappings || mappings.length === 0) return 0
    return mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
  }, [mappings])

  // Resolve epub/audio roles for the editor view (avoids IIFE inside JSX)
  const editorBooks =
    selectedBook && mappings !== null ? resolveEpubAudio(book, selectedBook) : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="link-formats-desc">
        {/* ── Already linked → show unlink option ───────────────────────────── */}
        {alreadyLinked && view !== 'select' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-5" aria-hidden="true" />
                Linked Formats
              </DialogTitle>
              <DialogDescription id="link-formats-desc">
                This book is currently paired with another format.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Source book */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  This book
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="size-10 flex-shrink-0 rounded-lg overflow-hidden">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
                        {book.format === 'audiobook' ? (
                          <Headphones
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {book.format === 'audiobook' ? 'Audiobook' : book.format.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Link indicator */}
              <div className="flex justify-center">
                <ArrowRightLeft className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>

              {/* Paired book */}
              {linkedBook && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Paired with
                  </p>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <div className="size-10 flex-shrink-0 rounded-lg overflow-hidden">
                      {linkedBook.coverUrl ? (
                        <img
                          src={linkedBook.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
                          {linkedBook.format === 'audiobook' ? (
                            <Headphones
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : (
                            <BookOpen
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {linkedBook.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {linkedBook.format === 'audiobook'
                          ? 'Audiobook'
                          : linkedBook.format.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-[44px]"
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnlink}
                disabled={saving}
                className="min-h-[44px] flex items-center gap-2"
                data-testid="unlink-formats-button"
              >
                <Link2Off className="size-4" aria-hidden="true" />
                {saving ? 'Unlinking…' : 'Unlink Formats'}
              </Button>
            </DialogFooter>
          </>
        ) : view === 'select' ? (
          /* ── Step 1: Select target book ─────────────────────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-5" aria-hidden="true" />
                Link Formats
              </DialogTitle>
              <DialogDescription id="link-formats-desc">
                Choose a {targetFormat === 'audiobook' ? 'audiobook' : 'EPUB'} to pair with{' '}
                <strong className="text-foreground">{book.title}</strong> for Whispersync.
              </DialogDescription>
            </DialogHeader>

            {candidates.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <AlertCircle className="size-8 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  No unlinked {targetFormat === 'audiobook' ? 'audiobooks' : 'EPUBs'} found in your
                  library.
                </p>
                <p className="text-xs text-muted-foreground">
                  Import the {targetFormat === 'audiobook' ? 'audiobook' : 'EPUB'} edition first,
                  then link them here.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-3" role="list" aria-label="Available books to link">
                  {candidates.map(candidate => (
                    <div key={candidate.id} role="listitem">
                      <BookPickerCard
                        book={candidate}
                        selected={selectedId === candidate.id}
                        onClick={() =>
                          setSelectedId(prev => (prev === candidate.id ? null : candidate.id))
                        }
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              {alreadyLinked && (
                <Button
                  variant="ghost"
                  onClick={() => setView('unlink-confirm')}
                  className="min-h-[44px] text-destructive hover:text-destructive"
                >
                  Unlink current
                </Button>
              )}
              <Button
                variant="brand"
                onClick={handlePairPressed}
                disabled={!selectedId}
                className="min-h-[44px]"
                data-testid="pair-books-button"
              >
                Match Chapters
              </Button>
            </DialogFooter>
          </>
        ) : view === 'confirm' ? (
          /* ── Step 2 (high confidence): Confirm auto-save ────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                Chapters Matched
              </DialogTitle>
              <DialogDescription id="link-formats-desc">
                Review the confidence score and save to link the formats.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Books summary */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground truncate">{book.title}</span>
                <ArrowRightLeft className="size-4 flex-shrink-0" aria-hidden="true" />
                <span className="font-medium text-foreground truncate">{selectedBook?.title}</span>
              </div>

              {/* Confidence bar */}
              {mappings && <ConfidenceBar score={avgConfidence} />}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setView('select')} className="min-h-[44px]">
                Back
              </Button>
              <Button variant="outline" onClick={() => setView('editor')} className="min-h-[44px]">
                Review Mapping
              </Button>
              <Button
                variant="brand"
                onClick={() => handleSave(mappings ?? undefined)}
                disabled={saving}
                className="min-h-[44px]"
                data-testid="confirm-link-button"
              >
                {saving ? 'Saving…' : 'Save Link'}
              </Button>
            </DialogFooter>
          </>
        ) : view === 'editor' ? (
          /* ── Step 2 (low confidence): Manual editor ─────────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle>Review Chapter Mapping</DialogTitle>
              <DialogDescription id="link-formats-desc">
                Adjust chapter matches before linking{' '}
                <strong className="text-foreground">{book.title}</strong> and{' '}
                <strong className="text-foreground">{selectedBook?.title}</strong>.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[50vh]">
              {editorBooks && mappings !== null && (
                <ChapterMappingEditor
                  epubChapters={toEpubInputs(editorBooks.epubBook)}
                  audioChapters={toAudioInputs(editorBooks.audioBook)}
                  initialMappings={mappings}
                  onSave={finalMappings => handleSave(finalMappings)}
                  onCancel={() => setView('select')}
                />
              )}
            </ScrollArea>
            {/* ChapterMappingEditor renders its own Save/Cancel buttons */}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
