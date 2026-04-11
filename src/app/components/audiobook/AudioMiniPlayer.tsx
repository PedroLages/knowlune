/**
 * AudioMiniPlayer — persistent fixed bottom bar showing when an audiobook is
 * playing and the user has navigated away from the full player page.
 *
 * Layout:
 * - Thin progress bar at the very top of the bar
 * - Desktop: cover thumbnail, title/chapter, play/pause, skip 15s/30s, speed, expand
 * - Mobile (< sm): cover, title, play/pause only; tap bar area to navigate to full player
 *
 * Visibility: shown when `useAudioPlayerStore.currentBookId` is set AND the
 * current route is NOT the book reader page (to avoid double-player).
 *
 * @module AudioMiniPlayer
 * @since E87-S05
 * @updated E107-S06 — fix interactivity: type="button", focus styles, cover error, stale closure
 */
import { useCallback, useEffect, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, ChevronUp, BookOpen } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useBookStore } from '@/stores/useBookStore'
import { sharedAudioRef } from '@/app/hooks/useAudioPlayer'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

export function AudioMiniPlayer() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const currentBookId = useAudioPlayerStore(s => s.currentBookId)
  // Subscribed for render (icon + aria-label); handlePlayPause reads getState() to avoid stale closure
  const isPlaying = useAudioPlayerStore(s => s.isPlaying)
  const currentTime = useAudioPlayerStore(s => s.currentTime)
  const currentChapterIndex = useAudioPlayerStore(s => s.currentChapterIndex)
  const playbackRate = useAudioPlayerStore(s => s.playbackRate)
  const setIsPlaying = useAudioPlayerStore(s => s.setIsPlaying)

  const books = useBookStore(s => s.books)
  const book = books.find(b => b.id === currentBookId) ?? null
  const resolvedCoverUrl = useBookCoverUrl({
    bookId: currentBookId ?? '',
    coverUrl: currentBookId ? book?.coverUrl : undefined,
  })

  // Track cover image load failures to show fallback icon (E107-S06: replaces inline style hack)
  const [coverError, setCoverError] = useState(false)

  // Reset cover error when the resolved URL changes (i.e. book changes without unmount)
  useEffect(() => {
    setCoverError(false)
  }, [resolvedCoverUrl, currentBookId])

  // Hide when no book or when on the full player page
  const isOnPlayerPage = pathname.includes(`/library/${currentBookId}/read`)
  if (!currentBookId || !book || isOnPlayerPage) return null

  const currentChapter = book.chapters[currentChapterIndex]
  const chapterTitle = currentChapter?.title ?? `Chapter ${currentChapterIndex + 1}`

  // Derive duration from audio element (not stored in Zustand)
  const duration = sharedAudioRef.current?.duration ?? 0
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // E107-S06: Read isPlaying from store.getState() to avoid stale closure
  const handlePlayPause = useCallback(() => {
    const audio = sharedAudioRef.current
    if (!audio) return
    const playing = useAudioPlayerStore.getState().isPlaying
    if (playing) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // silent-catch-ok: play() rejection is handled gracefully
        })
    }
  }, [setIsPlaying])

  const handleSkipBack = useCallback(() => {
    const audio = sharedAudioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 15)
  }, [])

  const handleSkipForward = useCallback(() => {
    const audio = sharedAudioRef.current
    if (!audio) return
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30)
  }, [])

  const handleExpand = () => {
    navigate(`/library/${currentBookId}/read`)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/70 backdrop-blur-[32px] shadow-[0_-12px_40px_-5px_rgba(27,28,21,0.08)]"
      data-testid="audio-mini-player"
      role="complementary"
      aria-label="Audiobook mini-player"
    >
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-muted absolute top-0 left-0 right-0">
        <div
          className="h-full bg-brand transition-none"
          style={{ width: `${progressPercent}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Controls row */}
      <div className="flex h-20 items-center gap-3 px-4">
        {/* Cover thumbnail */}
        <button
          type="button"
          onClick={handleExpand}
          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Open full player"
        >
          {resolvedCoverUrl && !coverError ? (
            <img
              src={resolvedCoverUrl}
              alt={`Cover of ${book.title}`}
              className="h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          ) : (
            <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {/* Title + Chapter — tap to expand on mobile */}
        <button
          type="button"
          onClick={handleExpand}
          className="flex flex-col items-start min-w-0 flex-1 text-left sm:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none rounded"
          aria-label="Open full player"
        >
          <span className="text-sm font-medium text-foreground truncate w-full">{book.title}</span>
          <span className="text-xs text-muted-foreground truncate w-full">{chapterTitle}</span>
        </button>
        <div className="hidden sm:flex flex-col items-start min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate w-full">{book.title}</span>
          <span className="text-xs text-muted-foreground truncate w-full">
            {chapterTitle} · {formatAudioTime(currentTime)}
          </span>
        </div>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          className="flex-shrink-0 flex w-12 h-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-hover text-brand-foreground shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="size-5" aria-hidden="true" />
          ) : (
            <Play className="size-5 ml-0.5" aria-hidden="true" />
          )}
        </button>

        {/* Skip controls — desktop only */}
        <button
          type="button"
          onClick={handleSkipBack}
          className="hidden sm:flex flex-shrink-0 size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Skip back 15 seconds"
        >
          <SkipBack className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleSkipForward}
          className="hidden sm:flex flex-shrink-0 size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Skip forward 30 seconds"
        >
          <SkipForward className="size-5" aria-hidden="true" />
        </button>

        {/* Speed indicator — desktop only */}
        <span className="hidden sm:block flex-shrink-0 text-xs text-muted-foreground tabular-nums w-9 text-center">
          {playbackRate % 1 === 0 ? `${playbackRate.toFixed(1)}×` : `${playbackRate}×`}
        </span>

        {/* Expand button — desktop only */}
        <button
          type="button"
          onClick={handleExpand}
          className="hidden sm:flex flex-shrink-0 size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Open full player"
        >
          <ChevronUp className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
