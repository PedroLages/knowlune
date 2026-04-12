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
import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, BookOpen, Settings, Scissors } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { useAudioPlayer, formatAudioTime, isSingleFileAudiobook } from '@/app/hooks/useAudioPlayer'
import { getChapterStartTime } from '@/lib/audiobook-utils'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useSleepTimer, consumeSleepTimerEndedFlag } from '@/app/hooks/useSleepTimer'
import { useMediaSession } from '@/app/hooks/useMediaSession'
import { useAudioListeningSession } from '@/app/hooks/useAudioListeningSession'
import { useAudiobookshelfProgressSync } from '@/app/hooks/useAudiobookshelfProgressSync'
import { useAudiobookshelfSocket } from '@/app/hooks/useAudiobookshelfSocket'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useAudiobookPrefsStore } from '@/stores/useAudiobookPrefsStore'
import { useSilenceDetection } from '@/app/hooks/useSilenceDetection'
import { SpeedControl } from './SpeedControl'
import { SleepTimer } from './SleepTimer'
import { ChapterList } from './ChapterList'
import { BookmarkButton } from './BookmarkButton'
import { BookmarkListPanel } from './BookmarkListPanel'
import { ClipButton } from './ClipButton'
import { ClipListPanel } from './ClipListPanel'
import { PostSessionBookmarkReview } from './PostSessionBookmarkReview'
import { AudiobookSettingsPanel } from './AudiobookSettingsPanel'
import { SilenceSkipIndicator } from './SilenceSkipIndicator'
import { SkipSilenceActiveIndicator } from './SkipSilenceActiveIndicator'
import { useAudiobookPrefsEffects } from '@/app/hooks/useAudiobookPrefsEffects'
import { useAudiobookPositionSync } from '@/app/hooks/useAudiobookPositionSync'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts'
import type { Book } from '@/data/types'

interface AudiobookRendererProps {
  book: Book
  /** Controlled from BookReader header to open the bookmark panel */
  bookmarksOpen?: boolean
  onBookmarksClose?: () => void
  /** When provided, renders a "Switch to Reading" button. Called with current chapter index. Wired by BookReader when a chapter mapping exists (E103-S02). */
  onSwitchToReading?: (currentChapterIndex: number) => void
  /** Initial chapter index to load on mount (E103-S02 format switching). Defaults to 0. */
  initialChapterIndex?: number
  /** Called when a bookmark is created or deleted — lets parent refresh bookmark state */
  onBookmarkChange?: () => void
}

export function AudiobookRenderer({
  book,
  bookmarksOpen: bookmarksOpenProp,
  onBookmarksClose,
  onSwitchToReading,
  initialChapterIndex = 0,
  onBookmarkChange,
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

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clipsOpen, setClipsOpen] = useState(false)
  /** Tracks the clip end boundary for clip-scoped playback (AC-4) */
  const [activeClipEnd, setActiveClipEnd] = useState<{
    chapterIndex: number
    endTime: number
  } | null>(null)
  const setCurrentBook = useAudioPlayerStore(s => s.setCurrentBook)
  const skipSilence = useAudiobookPrefsStore(s => s.skipSilence)
  const silenceDetection = useSilenceDetection({ enabled: skipSilence, audioRef, isPlaying })
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const { activeOption, badgeText, setTimer, cancelTimer } = useSleepTimer()
  // Post-session bookmark review
  const [postSessionOpen, setPostSessionOpen] = useState(false)
  const [sessionBookmarkIds, setSessionBookmarkIds] = useState<ReadonlySet<string>>(new Set())

  // Load existing bookmark IDs from Dexie on mount so the badge count persists across refreshes
  useEffect(() => {
    let cancelled = false
    db.audioBookmarks
      .where('bookId')
      .equals(book.id)
      .toArray()
      .then(bookmarks => {
        if (!cancelled && bookmarks.length > 0) {
          setSessionBookmarkIds(new Set(bookmarks.map(b => b.id)))
        }
      })
      .catch(() => {
        // silent-catch-ok: badge stays at 0
      })
    return () => {
      cancelled = true
    }
  }, [book.id])
  const prevIsPlayingRef = useRef(false)
  const bookmarkNoteContainerRef = useRef<HTMLDivElement>(null)
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

  const handleBookmarkCreated = useCallback(
    (bookmarkId: string) => {
      setSessionBookmarkIds(prev => new Set([...prev, bookmarkId]))
      onBookmarkChange?.()
    },
    [onBookmarkChange]
  )

  const handleBookmarkDeleted = useCallback((bookmarkId: string) => {
    setSessionBookmarkIds(prev => {
      const next = new Set(prev)
      next.delete(bookmarkId)
      onBookmarkChange?.()
      return next
    })
  }, [])

  // bookmarksOpen can be controlled externally (from BookReader header) or internally
  const [bookmarksOpenInternal, setBookmarksOpenInternal] = useState(false)
  const bookmarksOpen = bookmarksOpenProp ?? bookmarksOpenInternal
  const handleBookmarksClose = () => {
    setBookmarksOpenInternal(false)
    onBookmarksClose?.()
  }

  // Prefs-driven side-effects: default speed, auto-bookmark on stop, auto sleep timer (E108-S04)
  useAudiobookPrefsEffects({
    book,
    isPlaying,
    currentTime,
    currentChapterIndex,
    audioRef,
    onBookmarkCreated: handleBookmarkCreated,
    activeOption,
    setTimer,
    pause,
  })

  // Register this book as the active audiobook and load the first chapter
  useEffect(() => {
    setCurrentBook(book.id)
    loadChapter(initialChapterIndex, false)
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
  // Ensure ABS servers are loaded (BookReader is outside Layout, so Library page may not have mounted)
  const loadAbsServers = useAudiobookshelfStore(s => s.loadServers)
  useEffect(() => {
    loadAbsServers()
  }, [loadAbsServers])
  // Reactive selector — subscribes to store so server is available after Dexie hydration
  const absServer = useAudiobookshelfStore(state =>
    book.absServerId ? state.getServerById(book.absServerId) : undefined
  )
  useAudiobookshelfSocket({
    server: absServer ?? null, // undefined → null: hook treats both as "no server"
    activeItemId: book.absItemId ?? null,
    book,
    currentTime,
    isPlaying,
  })

  // Position persistence and session-resume seek (E101-S04, E101-S06)
  const { savePosition } = useAudiobookPositionSync({
    book,
    isPlaying,
    isLoading,
    seekTo,
    deliberateStopRef,
  })

  // Media Session API — OS-level lock screen / Bluetooth headset controls (E87-S05)
  useMediaSession({
    title: currentChapterTitle,
    artist: book.author ?? '',
    album: book.title,
    artworkUrl:
      resolvedCoverUrl && /^(blob:|https?:|data:image\/)/.test(resolvedCoverUrl)
        ? resolvedCoverUrl
        : undefined,
    isPlaying,
    onPlay: play,
    onPause: pause,
    onSkipBack: () => skipBack(15),
    onSkipForward: () => skipForward(30),
    onPrevTrack: () => loadChapter(Math.max(0, currentChapterIndex - 1), isPlaying),
    onNextTrack: () =>
      loadChapter(Math.min(book.chapters.length - 1, currentChapterIndex + 1), isPlaying),
  })

  // Audiobook keyboard shortcuts (E108-S03)
  useKeyboardShortcuts([
    {
      key: ' ',
      description: 'Play/Pause',
      action: toggle,
    },
    {
      key: 'arrowleft',
      description: 'Skip back 15s',
      action: () => skipBack(15),
    },
    {
      key: 'arrowright',
      description: 'Skip forward 30s',
      action: () => skipForward(30),
    },
    {
      key: 'arrowup',
      description: 'Volume up',
      action: () => {
        const audio = audioRef.current
        if (audio) audio.volume = Math.min(1, audio.volume + 0.1)
      },
    },
    {
      key: 'arrowdown',
      description: 'Volume down',
      action: () => {
        const audio = audioRef.current
        if (audio) audio.volume = Math.max(0, audio.volume - 0.1)
      },
    },
    {
      key: '[',
      description: 'Decrease speed',
      action: () => {
        const current = useAudioPlayerStore.getState().playbackRate
        useAudioPlayerStore.getState().setPlaybackRate(Math.max(0.25, current - 0.25))
      },
    },
    {
      key: ']',
      description: 'Increase speed',
      action: () => {
        const current = useAudioPlayerStore.getState().playbackRate
        useAudioPlayerStore.getState().setPlaybackRate(Math.min(3, current + 0.25))
      },
    },
    {
      key: 'm',
      description: 'Toggle mute',
      action: () => {
        const audio = audioRef.current
        if (audio) audio.muted = !audio.muted
      },
    },
    {
      key: 's',
      description: 'Toggle skip silence',
      action: () => useAudiobookPrefsStore.getState().toggleSkipSilence(),
    },
  ])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // Chapter progress for sleep timer EOC indicator.
  // Rounded to nearest integer — fractional % changes are invisible at 208px popover width
  // but would trigger SleepTimer re-renders ~4× per second, remounting Popover content
  // and causing button detach during rapid re-open. useMemo memoizes on integer boundaries.
  const chapterProgressPercent = useMemo(() => {
    if (activeOption !== 'end-of-chapter') return null
    const chapter = book.chapters[currentChapterIndex]
    if (!chapter) return null
    const singleFile = isSingleFileAudiobook(book)
    if (singleFile) {
      // Single-file M4B: chapter duration derived from gap between start times
      const chapterStart = getChapterStartTime(chapter)
      const nextChapter = book.chapters[currentChapterIndex + 1]
      const chapterEnd = nextChapter
        ? getChapterStartTime(nextChapter)
        : (book.totalDuration ?? duration)
      const chapterDuration = chapterEnd - chapterStart
      if (chapterDuration <= 0) return null
      const elapsed = currentTime - chapterStart
      return Math.round(Math.min(100, Math.max(0, (elapsed / chapterDuration) * 100)))
    }
    // Multi-file: duration is the current audio file's duration
    if (duration <= 0) return null
    return Math.round(Math.min(100, Math.max(0, (currentTime / duration) * 100)))
  }, [activeOption, book, currentChapterIndex, currentTime, duration])

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

  /** Play a clip: seek to startTime and auto-pause at endTime (AC-4) */
  const handlePlayClip = useCallback(
    async (chapterIndex: number, startTime: number, endTime: number) => {
      setActiveClipEnd({ chapterIndex, endTime })
      await loadChapter(chapterIndex, false)
      // Intentional: short delay lets the audio element settle after chapter load
      setTimeout(() => {
        seekTo(startTime)
        play()
      }, 100)
      setClipsOpen(false)
    },
    [loadChapter, seekTo, play]
  )

  // Clip-scoped playback: auto-pause when currentTime reaches clip endTime (AC-4)
  // Tolerance of 0.1s accounts for timeupdate firing at ~4Hz — prevents missing the boundary
  useEffect(() => {
    if (!activeClipEnd) return
    if (
      currentChapterIndex === activeClipEnd.chapterIndex &&
      currentTime >= activeClipEnd.endTime - 0.1
    ) {
      pause()
      setActiveClipEnd(null)
    }
  }, [currentTime, currentChapterIndex, activeClipEnd, pause])

  return (
    <>
      {/* Blurred cover background */}
      {resolvedCoverUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${resolvedCoverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(80px) saturate(1.5)',
            opacity: 0.4,
            transform: 'scale(1.1)',
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-8 p-6 max-w-lg mx-auto w-full min-h-[60vh] justify-center">
        {/* Cover Art */}
        <div className="w-full max-w-80 aspect-square rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-muted flex items-center justify-center">
          {resolvedCoverUrl ? (
            <img
              src={resolvedCoverUrl}
              alt={`Cover of ${book.title}`}
              className="h-full w-full object-cover"
              onError={e => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <BookOpen className="size-24 text-muted-foreground/40" aria-hidden="true" />
          )}
        </div>

        {/* Book & Chapter Title */}
        <div className="text-center space-y-1 w-full">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground truncate px-4">
            {book.title}
          </h1>
          <p className="text-sm text-muted-foreground truncate px-4">
            {currentChapter?.title ?? `Chapter ${currentChapterIndex + 1}`}
            {book.chapters.length > 1 && (
              <span className="ml-2 text-xs">
                ({currentChapterIndex + 1}/{book.chapters.length})
              </span>
            )}
          </p>
          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
          {book.narrator && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Narrated by {book.narrator}
            </p>
          )}
        </div>

        {/* Switch to Reading — only when a chapter mapping exists (E103-S02) */}
        {onSwitchToReading && (
          <Button
            variant="brand-outline"
            size="sm"
            onClick={() => {
              // Save position before navigating away (AC2 / E103-S02)
              savePosition()
              onSwitchToReading?.(currentChapterIndex)
            }}
            aria-label="Switch to reading"
            title="Switch to reading"
            className="min-h-[44px] min-w-[44px]"
            data-testid="switch-to-reading-button"
          >
            <BookOpen className="size-4 mr-2" aria-hidden="true" />
            Switch to Reading
          </Button>
        )}

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
            <span data-testid="current-time-display">{formatAudioTime(currentTime)}</span>
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
            data-testid={isPlaying ? 'audio-playing-indicator' : undefined}
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

        {/* Skip silence active indicator — shown when skip silence feature is enabled */}
        <SkipSilenceActiveIndicator isActive={skipSilence} />

        {/* Secondary Controls: Speed | Bookmark | Sleep Timer */}
        <div className="flex items-center gap-2 bg-card/40 backdrop-blur-2xl rounded-full px-4 py-1.5 border border-white/20">
          <SpeedControl bookId={book.id} />
          <div className="relative">
            <BookmarkButton
              bookId={book.id}
              chapterIndex={currentChapterIndex}
              currentTime={currentTime}
              onBookmarkCreated={handleBookmarkCreated}
              onBookmarkDeleted={handleBookmarkDeleted}
              noteContainerRef={bookmarkNoteContainerRef}
            />
            {sessionBookmarkIds.size > 0 && (
              <span
                className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-brand text-brand-foreground text-[10px] font-semibold px-1 pointer-events-none"
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
            chapterProgressPercent={chapterProgressPercent}
          />
          {/* Clip Button — two-phase start/end recording (E111-S01) */}
          <ClipButton
            bookId={book.id}
            chapterId={currentChapter?.title ?? `chapter-${currentChapterIndex}`}
            chapterIndex={currentChapterIndex}
            currentTime={currentTime}
          />
          {/* Clips panel trigger */}
          <button
            onClick={() => setClipsOpen(true)}
            className="flex items-center justify-center rounded-full min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clips"
            data-testid="clips-panel-button"
          >
            <Scissors className="size-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center rounded-full min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Audiobook settings"
            data-testid="audiobook-settings-button"
          >
            <Settings className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Bookmark note + progress — tighter spacing than the main gap-8 */}
        <div className="-mt-4 flex flex-col items-center gap-3">
          <div ref={bookmarkNoteContainerRef} />
          {/* Transient silence skip notification */}
          <SilenceSkipIndicator lastSkip={silenceDetection.lastSkip} />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {Math.round(progressPercent)}% complete
          </p>
        </div>

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
          onBookmarkDeleted={handleBookmarkDeleted}
        />

        {/* Clip List Panel — slides in from right (E111-S01) */}
        <ClipListPanel
          open={clipsOpen}
          onClose={() => setClipsOpen(false)}
          bookId={book.id}
          chapters={book.chapters}
          onPlayClip={handlePlayClip}
        />

        {/* Audiobook settings panel (E108-S04) */}
        <AudiobookSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

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
    </>
  )
}
