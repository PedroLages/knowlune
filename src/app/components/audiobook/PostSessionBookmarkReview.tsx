/**
 * PostSessionBookmarkReview — bottom Sheet that opens after playback stops
 * when bookmarks were created during the session. Shows only bookmarks created
 * during the current session (filtered by sessionBookmarkIds), with note editing
 * and flashcard creation via ClozeFlashcardCreator.
 *
 * @module PostSessionBookmarkReview
 * @since E101-S05
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Bookmark, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db/schema'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import { ClozeFlashcardCreator } from '@/app/components/reader/ClozeFlashcardCreator'
import type { AudioBookmark } from '@/data/types'

interface PostSessionBookmarkReviewProps {
  open: boolean
  onClose: () => void
  bookId: string
  chapters: { title?: string }[]
  /** IDs of bookmarks created during the current session. If provided, only these are shown. */
  sessionBookmarkIds?: ReadonlySet<string>
}

export function PostSessionBookmarkReview({
  open,
  onClose,
  bookId,
  chapters,
  sessionBookmarkIds,
}: PostSessionBookmarkReviewProps) {
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([])
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [clozeOpen, setClozeOpen] = useState(false)
  const [clozeText, setClozeText] = useState('')
  const [noteRequiredId, setNoteRequiredId] = useState<string | null>(null)

  // Ref so handleNoteSave always reads the latest editingNotes without being
  // recreated on every keystroke (avoids textarea losing focus on re-render).
  const editingNotesRef = useRef(editingNotes)
  useEffect(() => {
    editingNotesRef.current = editingNotes
  })

  // Load bookmarks when panel opens, filtered to session bookmarks when IDs are provided
  useEffect(() => {
    if (!open) return
    let cancelled = false

    db.audioBookmarks
      .where('bookId')
      .equals(bookId)
      .sortBy('timestamp')
      .then(results => {
        if (!cancelled) {
          // Filter to session bookmarks only when IDs are provided
          const filtered =
            sessionBookmarkIds && sessionBookmarkIds.size > 0
              ? results.filter(bm => sessionBookmarkIds.has(bm.id))
              : results
          setBookmarks(filtered)
          // Initialize editing notes from existing values
          const notes: Record<string, string> = {}
          for (const bm of filtered) {
            notes[bm.id] = bm.note ?? ''
          }
          setEditingNotes(notes)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load bookmarks')
      })

    return () => {
      cancelled = true
    }
  }, [open, bookId, sessionBookmarkIds])

  const handleNoteChange = useCallback((id: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [id]: value }))
    setNoteRequiredId(null)
  }, [])

  // Uses ref to always read latest notes without recreating on every keystroke
  const handleNoteSave = useCallback(async (id: string) => {
    const trimmed = (editingNotesRef.current[id] ?? '').trim()
    try {
      await db.audioBookmarks.update(id, { note: trimmed || undefined })
      // Update local state to reflect saved note
      setBookmarks(prev =>
        prev.map(bm => (bm.id === id ? { ...bm, note: trimmed || undefined } : bm))
      )
    } catch {
      // silent-catch-ok: surfaced via toast
      toast.error('Failed to save note')
    }
  }, [])

  const handleCreateFlashcard = useCallback(
    (bookmark: AudioBookmark) => {
      const note = (editingNotesRef.current[bookmark.id] ?? '').trim()
      if (!note) {
        setNoteRequiredId(bookmark.id)
        return
      }
      setClozeText(note)
      setClozeOpen(true)
    },
    []
  )

  const handleClozeClose = useCallback(() => {
    setClozeOpen(false)
    setClozeText('')
  }, [])

  const getChapterTitle = (chapterIndex: number) =>
    chapters[chapterIndex]?.title ?? `Chapter ${chapterIndex + 1}`

  return (
    <>
      <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] rounded-t-2xl px-4 pb-6 pt-0 overflow-y-auto"
          data-testid="post-session-review"
        >
          <SheetHeader className="py-4 border-b border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="size-4 text-brand" aria-hidden="true" />
                <SheetTitle className="text-base font-semibold">
                  Review Bookmarks ({bookmarks.length})
                </SheetTitle>
              </div>
              <button
                onClick={onClose}
                aria-label="Close bookmark review"
                className="flex items-center justify-center min-w-11 min-h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </SheetHeader>

          {bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No bookmarks to review.
            </p>
          ) : (
            <div className="flex flex-col gap-3" role="list" aria-label="Session bookmarks">
              {bookmarks.map(bm => (
                <div
                  key={bm.id}
                  className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-muted/20 border border-border/30"
                  role="listitem"
                  data-testid={`bookmark-row-${bm.id}`}
                >
                  {/* Chapter + timestamp */}
                  <span className="text-xs text-muted-foreground">
                    {getChapterTitle(bm.chapterIndex)} — {formatAudioTime(bm.timestamp)}
                  </span>

                  {/* Note textarea */}
                  <textarea
                    value={editingNotes[bm.id] ?? ''}
                    onChange={e => handleNoteChange(bm.id, e.target.value)}
                    onBlur={() => {
                      handleNoteSave(bm.id).catch(() => {
                        /* silent-catch-ok: handled in handleNoteSave */
                      })
                    }}
                    placeholder="Add a note about what you heard..."
                    rows={2}
                    className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                    aria-label={`Note for bookmark at ${formatAudioTime(bm.timestamp)}`}
                    data-testid={`bookmark-note-${bm.id}`}
                  />

                  {/* Note-required prompt */}
                  {noteRequiredId === bm.id && (
                    <p
                      className="text-xs text-warning"
                      role="alert"
                      data-testid="note-required-prompt"
                    >
                      Add a note first to create a flashcard
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        handleNoteSave(bm.id).catch(() => {
                          /* silent-catch-ok */
                        })
                      }}
                      data-testid={`bookmark-save-note-${bm.id}`}
                    >
                      Save Note
                    </Button>
                    <Button
                      variant="brand-outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCreateFlashcard(bm)}
                      data-testid={`bookmark-create-flashcard-${bm.id}`}
                    >
                      <Plus className="size-3 mr-1" aria-hidden="true" />
                      Create Flashcard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cloze flashcard creator */}
      <ClozeFlashcardCreator
        open={clozeOpen}
        onClose={handleClozeClose}
        text={clozeText}
        bookId={bookId}
      />
    </>
  )
}
