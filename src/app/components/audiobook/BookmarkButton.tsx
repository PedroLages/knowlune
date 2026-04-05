/**
 * BookmarkButton — creates AudioBookmark records at the current timestamp.
 *
 * On tap:
 *  1. Creates an AudioBookmark in Dexie at currentTime
 *  2. Shows a slide-down note input
 *  3. On Enter/Save, updates the bookmark with an optional note
 *  4. Toasts "Bookmark saved at mm:ss"
 *
 * @module BookmarkButton
 * @since E87-S04
 */
import { useState, useRef } from 'react'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db/schema'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { AudioBookmark } from '@/data/types'

interface BookmarkButtonProps {
  bookId: string
  chapterIndex: number
  currentTime: number
}

export function BookmarkButton({ bookId, chapterIndex, currentTime }: BookmarkButtonProps) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBookmark = async () => {
    const id = crypto.randomUUID()
    const record: AudioBookmark = {
      id,
      bookId,
      chapterIndex,
      timestamp: Math.floor(currentTime),
      createdAt: new Date().toISOString(),
    }

    try {
      await db.audioBookmarks.add(record)
      setPendingId(id)
      setNote('')
      setShowNote(true)
      setTimeout(() => inputRef.current?.focus(), 50)
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

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground"
        onClick={handleBookmark}
        aria-label="Add bookmark"
      >
        <Bookmark className="size-5" aria-hidden="true" />
      </Button>

      {showNote && (
        <div className="flex items-center gap-1 w-full max-w-xs">
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
        </div>
      )}
    </div>
  )
}
