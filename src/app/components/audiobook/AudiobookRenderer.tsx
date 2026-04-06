/**
 * AudiobookRenderer — full-screen audiobook player with cover art, chapter title,
 * progress scrubber, play/pause/skip controls, speed control, sleep timer,
 * chapter list, and bookmark support.
 *
 * Lazy-loadable via React.lazy() for code splitting.
 * Uses useAudioPlayer hook for HTMLAudioElement management.
 *
 * @module AudiobookRenderer
 * @since E87-S02
 */
import { useEffect, useCallback, useState, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Slider } from '@/app/components/ui/slider'
import { useAudioPlayer, formatAudioTime } from '@/app/hooks/useAudioPlayer'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useSleepTimer, consumeSleepTimerEndedFlag } from '@/app/hooks/useSleepTimer'
import { useMediaSession } from '@/app/hooks/useMediaSession'
import { useAudioListeningSession } from '@/app/hooks/useAudioListeningSession'
import { SpeedControl } from './SpeedControl'
import { SleepTimer } from './SleepTimer'
import { ChapterList } from './ChapterList'
import { BookmarkButton } from './BookmarkButton'
import { BookmarkListPanel } from './BookmarkListPanel'
import { useBookStore } from '@/stores/useBookStore'
import { db } from '@/db/schema'
import { sharedAudioRef } from '@/app/hooks/useAudioPlayer'
import type { Book } from '@/data/types'

interface AudiobookRendererProps {
  book: Book
  /** Controlled from BookReader header to open the bookmark panel */
  bookmarksOpen?: boolean
  onBookmarksClose?: () => void
}

export function AudiobookRenderer({
  book,
  bookmarksOpen: bookmarksOpenProp,
  onBookmarksClose,
}: AudiobookRendererProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    currentChapterIndex,
    isLoading,
    audioRef,
    toggle,
    seekTo,
    skipForward,
    skipBack,
    loadChapter,
    play,
    pause,
  } = useAudioPlayer(book)

  const setCurrentBook = useAudioPlayerStore(s => s.setCurrentBook)
  const { activeOption, badgeText, setTimer, cancelTimer } = useSleepTimer()
  // bookmarksOpen can be controlled externally (from BookReader header) or internally
  const [bookmarksOpenInternal, setBookmarksOpenInternal] = useState(false)
  const bookmarksOpen = bookmarksOpenProp ?? bookmarksOpenInternal
  const handleBookmarksClose = () => {
    setBookmarksOpenInternal(false)
    onBookmarksClose?.()
  }

  // Register this book as the active audiobook and load the first chapter
  useEffect(() => {
    setCurrentBook(book.id)
    loadChapter(0, false)
  }, [book.id]) // book.id is stable after mount; loadChapter/setCurrentBook identity stable

  // Check for post-sleep toast on mount
  useEffect(() => {
    if (consumeSleepTimerEndedFlag()) {
      toast('Sleep timer ended', { duration: 3000 })
    }
  }, [])

  const currentChapter = book.chapters[currentChapterIndex]
  const currentChapterTitle = currentChapter?.title ?? `Chapter ${currentChapterIndex + 1}`

  // Session tracking for streak counting and Reports (E87-S06)
  useAudioListeningSession({ bookId: book.id, isPlaying })

  /** Persist current playback position to Dexie for session resume (E101-S04) */
  const savePosition = useCallback(() => {
    const audio = sharedAudioRef.current
    if (!audio || !isFinite(audio.currentTime) || audio.currentTime === 0) return

    const position = { type: 'time' as const, seconds: audio.currentTime }
    const now = new Date().toISOString()

    // Optimistic store update
    useBookStore.setState(state => ({
      books: state.books.map(b =>
        b.id === book.id ? { ...b, currentPosition: position, lastOpenedAt: now } : b
      ),
    }))

    // Persist to Dexie — non-critical, never disrupt playback UX
    // silent-catch-ok: position will be re-saved on next pause (non-fatal)
    db.books
      .update(book.id, { currentPosition: position, lastOpenedAt: now })
      .catch(err => console.error('[AudiobookRenderer] Failed to save position:', err))
  }, [book.id])

  // Save position when playback pauses
  useEffect(() => {
    if (!isPlaying) {
      savePosition()
    }
  }, [isPlaying, savePosition])

  // Save position on unmount (navigating away)
  useEffect(() => {
    return () => {
      savePosition()
    }
  }, [savePosition])

  // Restore position on mount for remote books (session resume).
  // We track whether the initial load has been observed — once isLoading
  // transitions from true→false we do the seek. A ref prevents repeated seeks.
  const sessionResumeSeekDoneRef = useRef(false)
  useEffect(() => {
    if (
      book.source.type !== 'remote' ||
      book.currentPosition?.type !== 'time' ||
      book.currentPosition.seconds <= 0
    ) {
      return
    }
    if (!isLoading && !sessionResumeSeekDoneRef.current) {
      sessionResumeSeekDoneRef.current = true
      seekTo(book.currentPosition.seconds)
    }
  }, [isLoading, book.id]) // Re-runs whenever isLoading changes; book.id guards remount

  // Media Session API — OS-level lock screen / Bluetooth headset controls (E87-S05)
  useMediaSession({
    title: currentChapterTitle,
    artist: book.author,
    album: book.title,
    artworkUrl: book.coverUrl ?? undefined,
    isPlaying,
    onPlay: play,
    onPause: pause,
    onSkipBack: () => skipBack(15),
    onSkipForward: () => skipForward(30),
    onPrevTrack: () => loadChapter(Math.max(0, currentChapterIndex - 1), isPlaying),
    onNextTrack: () =>
      loadChapter(Math.min(book.chapters.length - 1, currentChapterIndex + 1), isPlaying),
  })

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleSleepTimerSelect = (option: Parameters<typeof setTimer>[0]) => {
    if (option === 'off') {
      cancelTimer()
    } else {
      setTimer(option, audioRef, pause)
    }
  }

  /** Seek to a bookmark: load correct chapter then seek to timestamp */
  const handleBookmarkSeek = async (chapterIndex: number, timestamp: number) => {
    await loadChapter(chapterIndex, false)
    // Wait a tick for the audio element to be ready after chapter load
    setTimeout(() => seekTo(timestamp), 100)
  }

  return (
    <div className="flex flex-col items-center gap-8 p-6 max-w-lg mx-auto w-full min-h-[60vh] justify-center">
      {/* Cover Art */}
      <div className="w-full max-w-80 aspect-square rounded-[24px] overflow-hidden shadow-lg bg-muted flex items-center justify-center">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen className="size-24 text-muted-foreground/40" aria-hidden="true" />
        )}
      </div>

      {/* Book & Chapter Title */}
      <div className="text-center space-y-1 w-full">
        <h1 className="text-xl font-semibold text-foreground truncate px-4">{book.title}</h1>
        <p className="text-sm text-muted-foreground truncate px-4">
          {currentChapter?.title ?? `Chapter ${currentChapterIndex + 1}`}
          {book.chapters.length > 1 && (
            <span className="ml-2 text-xs">
              ({currentChapterIndex + 1}/{book.chapters.length})
            </span>
          )}
        </p>
        {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
      </div>

      {/* Progress Scrubber */}
      <div className="w-full space-y-2 px-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={1}
          onValueChange={([val]) => seekTo(val)}
          aria-label="Playback position"
          disabled={isLoading || duration === 0}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-8">
        {/* Skip Back 15s */}
        <button
          onClick={() => skipBack(15)}
          disabled={isLoading}
          className="flex flex-col items-center gap-1 rounded-full p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 min-w-[48px] min-h-[48px] justify-center"
          aria-label="Skip back 15 seconds"
        >
          <SkipBack className="size-6" aria-hidden="true" />
          <span className="text-[10px] tabular-nums">15s</span>
        </button>

        {/* Play / Pause */}
        <button
          onClick={toggle}
          disabled={isLoading}
          className="flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground hover:bg-brand-hover transition-colors shadow-md disabled:opacity-40"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="size-8 animate-spin rounded-full border-2 border-brand-foreground border-t-transparent" />
          ) : isPlaying ? (
            <Pause className="size-8" aria-hidden="true" />
          ) : (
            <Play className="size-8 ml-1" aria-hidden="true" />
          )}
        </button>

        {/* Skip Forward 30s */}
        <button
          onClick={() => skipForward(30)}
          disabled={isLoading}
          className="flex flex-col items-center gap-1 rounded-full p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 min-w-[48px] min-h-[48px] justify-center"
          aria-label="Skip forward 30 seconds"
        >
          <SkipForward className="size-6" aria-hidden="true" />
          <span className="text-[10px] tabular-nums">30s</span>
        </button>
      </div>

      {/* Secondary Controls: Speed | Bookmark | Sleep Timer */}
      <div className="flex items-center gap-2">
        <SpeedControl />
        <BookmarkButton
          bookId={book.id}
          chapterIndex={currentChapterIndex}
          currentTime={currentTime}
        />
        <SleepTimer
          activeOption={activeOption}
          badgeText={badgeText}
          onSelect={handleSleepTimerSelect}
        />
      </div>

      {/* Progress percentage fallback */}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {Math.round(progressPercent)}% complete
      </p>

      {/* Chapter List — hidden for single-chapter audiobooks */}
      <ChapterList
        chapters={book.chapters}
        currentChapterIndex={currentChapterIndex}
        totalDuration={book.totalDuration}
        onChapterSelect={index => loadChapter(index, isPlaying)}
      />

      {/* Bookmark List Panel — slides in from right */}
      <BookmarkListPanel
        open={bookmarksOpen}
        onClose={handleBookmarksClose}
        bookId={book.id}
        chapters={book.chapters}
        onSeek={handleBookmarkSeek}
      />
    </div>
  )
}
