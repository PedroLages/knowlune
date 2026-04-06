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
import { useAudiobookshelfProgressSync } from '@/app/hooks/useAudiobookshelfProgressSync'
import { useAudiobookshelfSocket } from '@/app/hooks/useAudiobookshelfSocket'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { SpeedControl } from './SpeedControl'
import { SleepTimer } from './SleepTimer'
import { ChapterList } from './ChapterList'
import { BookmarkButton } from './BookmarkButton'
import { BookmarkListPanel } from './BookmarkListPanel'
import { PostSessionBookmarkReview } from './PostSessionBookmarkReview'
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
  // Post-session bookmark review
  const [postSessionOpen, setPostSessionOpen] = useState(false)
  const [sessionBookmarkIds, setSessionBookmarkIds] = useState<ReadonlySet<string>>(new Set())
  const prevIsPlayingRef = useRef(false)
  // Set to true when the user explicitly ends the session (unmount or audio reaches end).
  // Simple pauses should not open the post-session review.
  const deliberateStopRef = useRef(false)

  // Trigger post-session review only on deliberate stop, not every pause
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current
    prevIsPlayingRef.current = isPlaying
    if (wasPlaying && !isPlaying && deliberateStopRef.current && sessionBookmarkIds.size > 0) {
      deliberateStopRef.current = false
      setPostSessionOpen(true)
    }
  }, [isPlaying, sessionBookmarkIds.size])

  const handleBookmarkCreated = useCallback((bookmarkId: string) => {
    setSessionBookmarkIds(prev => new Set([...prev, bookmarkId]))
  }, [])

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

  // Bidirectional progress sync with Audiobookshelf (E102-S01)
  useAudiobookshelfProgressSync({ book, isPlaying, currentTime, seekTo })

  // Real-time Socket.IO sync with Audiobookshelf (E102-S04)
  // Upgrades REST polling to live push/pull when socket is available
  const absServer = book.absServerId
    ? useAudiobookshelfStore.getState().getServerById(book.absServerId)
    : null
  useAudiobookshelfSocket({
    server: absServer ?? null,
    activeItemId: book.absItemId ?? null,
    book,
    currentTime,
    isPlaying,
  })

  /** Persist current playback position and progress to Dexie (E101-S04, E101-S06) */
  const savePosition = useCallback(() => {
    const audio = sharedAudioRef.current
    if (!audio || !isFinite(audio.currentTime) || audio.currentTime === 0) return

    const position = { type: 'time' as const, seconds: audio.currentTime }
    const now = new Date().toISOString()

    // Calculate progress percentage from totalDuration (E101-S06: FR31/FR32)
    const totalDur = book.totalDuration ?? 0
    const progress =
      totalDur > 0 ? Math.min(100, Math.round((audio.currentTime / totalDur) * 100)) : undefined

    // Optimistic store update
    useBookStore.setState(state => ({
      books: state.books.map(b =>
        b.id === book.id
          ? {
              ...b,
              currentPosition: position,
              lastOpenedAt: now,
              ...(progress !== undefined && { progress }),
            }
          : b
      ),
    }))

    // Persist to Dexie — non-critical, never disrupt playback UX
    // silent-catch-ok: position will be re-saved on next pause (non-fatal)
    type DexiePositionUpdate = Partial<Pick<Book, 'currentPosition' | 'lastOpenedAt' | 'progress'>>
    const dexieUpdate: DexiePositionUpdate = { currentPosition: position, lastOpenedAt: now }
    if (progress !== undefined) dexieUpdate.progress = progress
    db.books
      .update(book.id, dexieUpdate as Parameters<typeof db.books.update>[1])
      .catch(err => console.error('[AudiobookRenderer] Failed to save position:', err))
  }, [book.id, book.totalDuration])

  // Save position when playback pauses
  useEffect(() => {
    if (!isPlaying) {
      savePosition()
    }
  }, [isPlaying, savePosition])

  // Debounced periodic progress save during playback (every 5s) — E101-S06
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(savePosition, 5000)
    return () => clearInterval(interval)
  }, [isPlaying, savePosition])

  // Save position on unmount (navigating away) and mark as deliberate stop
  useEffect(() => {
    return () => {
      deliberateStopRef.current = true
      savePosition()
    }
  }, [savePosition])

  // Mark as deliberate stop when audio track naturally ends (last chapter finished)
  useEffect(() => {
    const audio = sharedAudioRef.current
    if (!audio) return
    const handleEnded = () => {
      deliberateStopRef.current = true
    }
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Restore position on mount for remote books (session resume).
  // We track whether the initial load has been observed — once isLoading
  // transitions from true→false we do the seek. A ref prevents repeated seeks.
  //
  // `book.currentPosition.seconds` is captured once into a ref on mount so that
  // later playback-driven position updates don't re-trigger the effect and cause
  // an infinite seek loop (position changes → effect re-runs → seeks → position changes…).
  const sessionResumeSeekDoneRef = useRef(false)
  const savedSecondsRef = useRef<number | null>(
    book.source.type === 'remote' && book.currentPosition?.type === 'time'
      ? book.currentPosition.seconds
      : null
  )
  useEffect(() => {
    const savedSeconds = savedSecondsRef.current
    if (book.source.type !== 'remote' || savedSeconds === null || savedSeconds <= 0) {
      return
    }
    if (!isLoading && !sessionResumeSeekDoneRef.current) {
      sessionResumeSeekDoneRef.current = true
      seekTo(savedSeconds)
    }
  }, [isLoading, book.id, seekTo]) // book.id guards remount; seekTo is stable (useCallback)

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
        <div className="relative">
          <BookmarkButton
            bookId={book.id}
            chapterIndex={currentChapterIndex}
            currentTime={currentTime}
            onBookmarkCreated={handleBookmarkCreated}
          />
          {sessionBookmarkIds.size > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-brand text-brand-foreground text-[10px] font-semibold px-1 pointer-events-none"
              aria-label={`${sessionBookmarkIds.size} bookmark${sessionBookmarkIds.size !== 1 ? 's' : ''} this session`}
              data-testid="bookmark-count-badge"
            >
              {sessionBookmarkIds.size}
            </span>
          )}
        </div>
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

      {/* Post-session bookmark review panel (E101-S05) */}
      <PostSessionBookmarkReview
        open={postSessionOpen}
        onClose={() => {
          setPostSessionOpen(false)
          // Reset session tracking so a new session starts clean
          setSessionBookmarkIds(new Set())
        }}
        bookId={book.id}
        chapters={book.chapters}
        sessionBookmarkIds={sessionBookmarkIds}
      />
    </div>
  )
}
