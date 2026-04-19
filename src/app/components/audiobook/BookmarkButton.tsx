/**
 * BookmarkButton — toggle-style bookmark at the current timestamp.
 *
 * Follows the Audible/Apple Books pattern:
 *  - If no bookmark exists within ±3s of currentTime → creates one (icon fills)
 *  - If a bookmark exists within ±3s → removes it (icon unfills)
 *  - Icon fills/unfills in real-time as playback moves near/away from bookmarks
 *
 * @module BookmarkButton
 * @since E87-S04
 */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db/schema'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { AudioBookmark } from '@/data/types'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

/** Bookmarks within this many seconds of currentTime are considered "at this position" */
const PROXIMITY_THRESHOLD_S = 3

interface BookmarkButtonProps {
  bookId: string
  chapterIndex: number
  currentTime: number
  /** Called after a bookmark is successfully created, with the new bookmark's ID */
  onBookmarkCreated?: (id: string) => void
  /** Called after a bookmark is removed (toggle off), with the deleted bookmark's ID */
  onBookmarkDeleted?: (id: string) => void
  /** If provided, renders the note input into this container via portal instead of inline */
  noteContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function BookmarkButton({
  bookId,
  chapterIndex,
  currentTime,
  onBookmarkCreated,
  onBookmarkDeleted,
  noteContainerRef,
}: BookmarkButtonProps) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isNearBookmark, setIsNearBookmark] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check proximity to existing bookmarks as playback position changes
  useEffect(() => {
    const flooredTime = Math.floor(currentTime)
    let cancelled = false

    db.audioBookmarks
      .where('bookId')
      .equals(bookId)
      .filter(
        b =>
          b.chapterIndex === chapterIndex &&
          Math.abs(b.timestamp - flooredTime) <= PROXIMITY_THRESHOLD_S
      )
      .first()
      .then(match => {
        if (!cancelled) setIsNearBookmark(!!match)
      })
      .catch(() => {
        // silent-catch-ok: non-critical UI state
      })

    return () => {
      cancelled = true
    }
  }, [bookId, chapterIndex, Math.floor(currentTime)])

  const handleBookmark = async () => {
    const flooredTime = Math.floor(currentTime)

    // Check for nearby bookmark (toggle off if found)
    const existing = await db.audioBookmarks
      .where('bookId')
      .equals(bookId)
      .filter(
        b =>
          b.chapterIndex === chapterIndex &&
          Math.abs(b.timestamp - flooredTime) <= PROXIMITY_THRESHOLD_S
      )
      .first()

    if (existing) {
      // Toggle off — remove existing bookmark
      try {
        // sync: local-only — audioBookmarks insertOnly; delete not propagated to Supabase
        await db.audioBookmarks.delete(existing.id)
        setIsNearBookmark(false)
        onBookmarkDeleted?.(existing.id)
        toast('Bookmark removed', { duration: 2000 })
      } catch {
        // silent-catch-ok: surfaced via toast
        toast.error('Failed to remove bookmark')
      }
      return
    }

    // Toggle on — create new bookmark
    const id = crypto.randomUUID()
    const record: AudioBookmark = {
      id,
      bookId,
      chapterIndex,
      timestamp: flooredTime,
      createdAt: new Date().toISOString(),
    }

    try {
      await syncableWrite('audioBookmarks', 'add', record as unknown as SyncableRecord)
      setIsNearBookmark(true)
      setPendingId(id)
      setNote('')
      setShowNote(true)
      setTimeout(() => inputRef.current?.focus(), 50)
      onBookmarkCreated?.(id)
      toast(`Bookmark saved at ${formatAudioTime(record.timestamp)}`, { duration: 2500 })
    } catch {
      // silent-catch-ok: surfaced via toast
      toast.error('Failed to save bookmark')
    }
  }

  const handleSaveNote = async () => {
    if (!pendingId) return
    const trimmed = note.trim()
    if (trimmed) {
      try {
        // sync: local-only — audio_bookmarks has no updated_at column; note edits cannot be LWW-synced
        await db.audioBookmarks.update(pendingId, { note: trimmed })
      } catch {
        // silent-catch-ok: note is optional, loss is non-fatal
      }
    }
    setShowNote(false)
    setPendingId(null)
    setNote('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveNote()
    if (e.key === 'Escape') {
      setShowNote(false)
      setPendingId(null)
      setNote('')
    }
  }

  const noteInput = (
    <AnimatePresence>
      {showNote && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center gap-1 w-full max-w-xs mx-auto rounded-full bg-card/40 backdrop-blur-2xl border border-white/20 px-3 py-1.5"
        >
          <input
            ref={inputRef}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note..."
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="Bookmark note"
          />
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleSaveNote}>
            Save
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground"
        onClick={handleBookmark}
        aria-label={isNearBookmark ? 'Remove bookmark' : 'Add bookmark'}
      >
        <Bookmark className={`size-5 ${isNearBookmark ? 'fill-current' : ''}`} aria-hidden="true" />
      </Button>
      {noteContainerRef?.current ? createPortal(noteInput, noteContainerRef.current) : noteInput}
    </>
  )
}
