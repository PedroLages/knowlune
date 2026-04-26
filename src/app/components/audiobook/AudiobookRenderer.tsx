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
/* eslint-disable component-size/max-lines -- orchestrates hooks, media session, panels, and full-player layout */
import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, BookOpen, Settings, ListVideo } from 'lucide-react'
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
import { AudiobookPlayerAtmosphere } from './AudiobookPlayerAtmosphere'
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
  /**
   * When provided, renders a "Switch to Reading" button. Called with the user's
   * current chapter index, current playback time (for intra-chapter math —
   * E103 Story B), and the audio element's effective duration so the EPUB
   * receiver can land within the right paragraph rather than just the chapter.
   * Wired by BookReader when a chapter mapping exists.
   */
  onSwitchToReading?: (
    currentChapterIndex: number,
    currentTime: number,
    audioElementDuration?: number
  ) => void
  /** Initial chapter index to load on mount (E103-S02 format switching). Defaults to 0. */
  initialChapterIndex?: number
  /**
   * Initial seek (in seconds) within the loaded initial chapter (E103 Story B).
   * Applied after loadChapter; gracefully no-op when out of range.
   */
  initialSeekSeconds?: number
  /**
   * Initial chapter percentage [0..1] (E103 Story B audio-receiver path). When
   * present, it's converted to seconds using the loaded chapter's range and
   * applied after loadChapter. `initialSeekSeconds` takes precedence if both set.
   */
  initialChapterPct?: number
  /** Called when a bookmark is created or deleted — lets parent refresh bookmark state */
  onBookmarkChange?: () => void
}

export function AudiobookRenderer({
  book,
  bookmarksOpen: bookmarksOpenProp,
  onBookmarksClose,
  onSwitchToReading,
  initialChapterIndex = 0,
  initialSeekSeconds,
  initialChapterPct,
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
  const [coverLoadFailed, setCoverLoadFailed] = useState(false)
  /** Tracks the clip end boundary for clip-scoped playback (AC-4) */
  const [activeClipEnd, setActiveClipEnd] = useState<{
    chapterIndex: number
    endTime: number
  } | null>(null)
  const setCurrentBook = useAudioPlayerStore(s => s.setCurrentBook)
  const skipSilence = useAudiobookPrefsStore(s => s.skipSilence)
  const showRemainingTime = useAudiobookPrefsStore(s => s.showRemainingTime)
  const setShowRemainingTime = useAudiobookPrefsStore(s => s.setShowRemainingTime)
  const skipBackSeconds = useAudiobookPrefsStore(s => s.skipBackSeconds)
  const skipForwardSeconds = useAudiobookPrefsStore(s => s.skipForwardSeconds)
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
  }, [onBookmarkChange])

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

  // Register this book as the active audiobook and load the first chapter.
  // Skip loadChapter if this book is already active in the store (e.g. navigating back
  // from mini-player) — the singleton audio element already has the correct source and
  // position; calling loadChapter(0) would seek to the beginning unnecessarily.
  useEffect(() => {
    const alreadyActive = useAudioPlayerStore.getState().currentBookId === book.id
    setCurrentBook(book.id)
    if (!alreadyActive) {
      loadChapter(initialChapterIndex, false)

      // E103 — Story B: format-switch URL params land us inside the chapter.
      // Pattern matches handleBookmarkSeek (line ~362): wait one tick for the
      // audio element to settle after the chapter source change, then seek.
      if (typeof initialSeekSeconds === 'number' || typeof initialChapterPct === 'number') {
        const ch = book.chapters[initialChapterIndex]
        const chStart = ch && ch.position.type === 'time' ? ch.position.seconds : 0
        const next = book.chapters[initialChapterIndex + 1]
        const chEnd =
          next && next.position.type === 'time'
            ? next.position.seconds
            : (book.totalDuration ?? null)
        let target: number | null = null
        if (typeof initialSeekSeconds === 'number') {
          target = initialSeekSeconds
        } else if (typeof initialChapterPct === 'number' && chEnd !== null && chEnd > chStart) {
          target = chStart + initialChapterPct * (chEnd - chStart)
        }
        if (target !== null && Number.isFinite(target)) {
          // Clamp into the chapter range so we never jump out of bounds.
          const clamped =
            chEnd !== null
              ? Math.max(chStart, Math.min(target, Math.max(chStart, chEnd - 0.1)))
              : Math.max(chStart, target)
          const seekTimerId = setTimeout(() => seekTo(clamped), 100)
          return () => clearTimeout(seekTimerId)
        }
      }
    }
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

  // Skip handlers wrapped in useCallback so MediaSession re-registers handlers
  // when the configured intervals change (verified via Unit 0 discovery: useMediaSession's
  // setActionHandler effect depends on these callbacks, so a fresh identity = fresh closure).
  const handleSkipBack = useCallback(() => skipBack(skipBackSeconds), [skipBack, skipBackSeconds])
  const handleSkipForward = useCallback(
    () => skipForward(skipForwardSeconds),
    [skipForward, skipForwardSeconds]
  )

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
    onSkipBack: handleSkipBack,
    onSkipForward: handleSkipForward,
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
      description: `Skip back ${skipBackSeconds}s`,
      action: handleSkipBack,
    },
    {
      key: 'arrowright',
      description: `Skip forward ${skipForwardSeconds}s`,
      action: handleSkipForward,
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

  /** Screen-reader-friendly seek position (WAI-ARIA media seek slider pattern). */
  const playbackSliderAriaValueText = useMemo(() => {
    if (isLoading) return 'Loading'
    if (duration <= 0) return `${formatAudioTime(currentTime)}, duration unknown`
    return `${formatAudioTime(currentTime)} of ${formatAudioTime(duration)}`
  }, [currentTime, duration, isLoading])

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
      <AudiobookPlayerAtmosphere coverUrl={resolvedCoverUrl} />
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-lg min-w-0 flex-col">
          {/* Top: cover + metadata — compact so primary controls stay in view on short laptops */}
          <div className="flex min-h-0 shrink flex-col items-center gap-3 sm:gap-4">
            {/* Cover Art
             * shrink-0: prevents the parent flex column from collapsing the square
             * frame on short viewports — root cause of the letterbox bars.
             * testids support regression test (cover-letterbox.spec.ts).
             * Do not rename testids without updating the spec. */}
            <div
              data-testid="audiobook-cover-frame"
              className="flex aspect-square w-full max-w-[14rem] shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-muted [box-shadow:var(--player-cover-shadow),var(--player-cover-halo)] sm:max-w-[16rem] lg:max-w-[18rem]"
            >
              {resolvedCoverUrl && !coverLoadFailed ? (
                <img
                  data-testid="audiobook-cover-image"
                  src={resolvedCoverUrl}
                  alt={`Cover of ${book.title}`}
                  className="h-full w-full object-cover"
                  onError={() => setCoverLoadFailed(true)}
                />
              ) : (
                <BookOpen className="size-24 text-muted-foreground/40" aria-hidden="true" />
              )}
            </div>

            {/* Book & Chapter Title */}
            <div className="text-center space-y-1 w-full px-1">
              <h1 className="text-xl font-semibold text-foreground truncate sm:text-2xl md:text-3xl">
                {book.title}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
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
          </div>

          {/* Primary controls — fixed stack height; does not scroll with chapter list */}
          <div className="mt-3 flex w-full shrink-0 flex-col items-center gap-3 sm:mt-4 sm:gap-4">
            {/* Switch to Reading — only when a chapter mapping exists (E103-S02) */}
            {onSwitchToReading && (
              <Button
                variant="brand-outline"
                size="sm"
                onClick={() => {
                  savePosition()
                  onSwitchToReading?.(
                    currentChapterIndex,
                    currentTime,
                    audioRef.current?.duration && Number.isFinite(audioRef.current.duration)
                      ? audioRef.current.duration
                      : undefined
                  )
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

            {/* Progress scrubber — media-style track + high-contrast played range */}
            <div
              className="w-full space-y-2 px-3 py-2.5 sm:px-4"
              data-testid="audiobook-progress-panel"
            >
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={1}
                onValueChange={([val]) => seekTo(val)}
                aria-label="Playback position"
                aria-valuetext={playbackSliderAriaValueText}
                disabled={isLoading || duration === 0}
                className="w-full py-1.5"
                trackClassName="data-[orientation=horizontal]:h-2.5 bg-foreground/15 shadow-inner dark:bg-white/12"
                rangeClassName="bg-brand data-[orientation=horizontal]:h-full rounded-full"
                thumbClassName="size-4 border-2 border-background bg-foreground shadow-md ring-offset-background hover:ring-brand/40 focus-visible:ring-brand"
              />
              <div className="flex items-center justify-between text-sm text-foreground tabular-nums">
                <span data-testid="current-time-display" className="font-medium">
                  {formatAudioTime(currentTime)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRemainingTime(!showRemainingTime)}
                  aria-label="Toggle time display"
                  aria-pressed={showRemainingTime}
                  className="-my-1 -mr-1 flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-foreground tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none motion-reduce:transition-none"
                  data-testid="duration-display"
                >
                  {showRemainingTime
                    ? `−${formatAudioTime(Math.max(0, duration - currentTime))}`
                    : formatAudioTime(duration)}
                </button>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-6 sm:gap-8" data-testid="audiobook-primary-controls">
              <button
                onClick={handleSkipBack}
                disabled={isLoading}
                className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-full p-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Skip back ${skipBackSeconds} seconds`}
                data-testid="skip-back-button"
              >
                <SkipBack className="size-6" aria-hidden="true" />
                <span className="text-xs tabular-nums">{skipBackSeconds}s</span>
              </button>

              <button
                onClick={toggle}
                disabled={isLoading}
                className="flex size-16 items-center justify-center rounded-full bg-[var(--player-fab)] text-[var(--player-fab-foreground)] shadow-[var(--player-fab-shadow)] transition-[transform,box-shadow] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:scale-100 sm:size-20"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                data-testid={isPlaying ? 'audio-playing-indicator' : undefined}
              >
                {isLoading ? (
                  <div className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent sm:size-10" />
                ) : isPlaying ? (
                  <Pause className="size-8 sm:size-10" aria-hidden="true" fill="currentColor" />
                ) : (
                  <Play className="ml-0.5 size-8 sm:size-10 sm:ml-1" aria-hidden="true" fill="currentColor" />
                )}
              </button>

              <button
                onClick={handleSkipForward}
                disabled={isLoading}
                className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-full p-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Skip forward ${skipForwardSeconds} seconds`}
                data-testid="skip-forward-button"
              >
                <SkipForward className="size-6" aria-hidden="true" />
                <span className="text-xs tabular-nums">{skipForwardSeconds}s</span>
              </button>
            </div>

            <SkipSilenceActiveIndicator isActive={skipSilence} />

            {/* Secondary Controls: Speed | Bookmark | Sleep Timer */}
            <div
              className="flex max-w-full items-center gap-1 rounded-full border border-[var(--surface-player-panel-border)] bg-[var(--surface-player-panel)] px-2 py-1.5 backdrop-blur-2xl sm:gap-2 sm:px-4"
              data-testid="audiobook-secondary-controls"
            >
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
                    className="pointer-events-none absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground"
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
              <ClipButton
                bookId={book.id}
                chapterId={currentChapter?.title ?? `chapter-${currentChapterIndex}`}
                chapterIndex={currentChapterIndex}
                currentTime={currentTime}
              />
              <button
                onClick={() => setClipsOpen(true)}
                className="flex min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-muted-foreground transition-colors hover:text-foreground sm:min-w-[44px] sm:px-3"
                aria-label="Clips"
                data-testid="clips-panel-button"
              >
                <ListVideo className="size-5" aria-hidden="true" />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-muted-foreground transition-colors hover:text-foreground sm:min-w-[44px] sm:px-3"
                aria-label="Audiobook settings"
                data-testid="audiobook-settings-button"
              >
                <Settings className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-1 flex w-full flex-col items-center gap-2 sm:mt-2">
              <div ref={bookmarkNoteContainerRef} />
              <SilenceSkipIndicator lastSkip={silenceDetection.lastSkip} />
              <span className="sr-only" aria-live="polite">
                {Math.round(progressPercent / 10) * 10}% complete
              </span>
            </div>
          </div>

          <div
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-1"
            data-testid="audiobook-chapter-scroll-region"
          >
            <ChapterList
              chapters={book.chapters}
              currentChapterIndex={currentChapterIndex}
              totalDuration={book.totalDuration}
              onChapterSelect={index => loadChapter(index, isPlaying)}
            />
          </div>

          <BookmarkListPanel
            open={bookmarksOpen}
            onClose={handleBookmarksClose}
            bookId={book.id}
            chapters={book.chapters}
            onSeek={handleBookmarkSeek}
            onBookmarkDeleted={handleBookmarkDeleted}
          />

          <ClipListPanel
            open={clipsOpen}
            onClose={() => setClipsOpen(false)}
            bookId={book.id}
            chapters={book.chapters}
            onPlayClip={handlePlayClip}
          />

          <AudiobookSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

          <PostSessionBookmarkReview
            open={postSessionOpen}
            onClose={() => {
              setPostSessionOpen(false)
              setSessionBookmarkIds(new Set())
            }}
            bookId={book.id}
            chapters={book.chapters}
            sessionBookmarkIds={sessionBookmarkIds}
          />
        </div>
      </div>
    </>
  )
}
