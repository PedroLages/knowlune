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
import { useEffect, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Slider } from '@/app/components/ui/slider'
import { useAudioPlayer, formatAudioTime } from '@/app/hooks/useAudioPlayer'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useSleepTimer, consumeSleepTimerEndedFlag } from '@/app/hooks/useSleepTimer'
import { SpeedControl } from './SpeedControl'
import { SleepTimer } from './SleepTimer'
import { ChapterList } from './ChapterList'
import { BookmarkButton } from './BookmarkButton'
import { BookmarkListPanel } from './BookmarkListPanel'
import type { Book } from '@/data/types'

interface AudiobookRendererProps {
  book: Book
  /** Controlled from BookReader header to open the bookmark panel */
  bookmarksOpen?: boolean
  onBookmarksClose?: () => void
}

export function AudiobookRenderer({ book, bookmarksOpen: bookmarksOpenProp, onBookmarksClose }: AudiobookRendererProps) {
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
        {book.author && (
          <p className="text-xs text-muted-foreground">{book.author}</p>
        )}
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
