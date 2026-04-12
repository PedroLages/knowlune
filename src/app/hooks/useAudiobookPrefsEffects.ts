/**
 * useAudiobookPrefsEffects — applies audiobook preferences side-effects to the player.
 *
 * Extracted from AudiobookRenderer (E108-S04) to keep it under the 500-line ESLint
 * component-size limit. Encapsulates three preference-driven effects:
 *  1. Default speed application on new session (AC-2 / AC-7)
 *  2. Auto-bookmark on stop (AC-5)
 *  3. Auto-start sleep timer from default pref (AC-4 Task 5)
 *
 * @module useAudiobookPrefsEffects
 * @since E108-S04
 */
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useAudiobookPrefsStore } from '@/stores/useAudiobookPrefsStore'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useBookStore } from '@/stores/useBookStore'
import { useSleepTimer } from '@/app/hooks/useSleepTimer'
import { db } from '@/db/schema'
import type { Book } from '@/data/types'

interface UseAudiobookPrefsEffectsParams {
  book: Book
  isPlaying: boolean
  currentTime: number
  currentChapterIndex: number
  audioRef: RefObject<HTMLAudioElement | null>
  onBookmarkCreated: (bookmarkId: string) => void
  activeOption: ReturnType<typeof useSleepTimer>['activeOption']
  setTimer: ReturnType<typeof useSleepTimer>['setTimer']
  pause: () => void
}

export function useAudiobookPrefsEffects({
  book,
  isPlaying,
  currentTime,
  currentChapterIndex,
  audioRef,
  onBookmarkCreated,
  activeOption,
  setTimer,
  pause,
}: UseAudiobookPrefsEffectsParams): void {
  // ── Effect 1: Apply per-book or global default speed on new book open (AC-6, AC-7) ──
  // Reads from get() inside the callback to avoid stale closure on book.playbackSpeed.
  const defaultSpeedAppliedForBookRef = useRef<string | null>(null)
  useEffect(() => {
    // Only apply once per book — prevents stale store rate from a previous book
    // incorrectly blocking the restored speed on return.
    if (defaultSpeedAppliedForBookRef.current === book.id) return
    defaultSpeedAppliedForBookRef.current = book.id
    // Per-book speed takes priority over global default (AC-6).
    // Fall back to global default for first-open books (AC-7).
    // Read via getState() to avoid book.playbackSpeed in dep array (would re-run on every speed change)
    const bookPlaybackSpeed = useBookStore
      .getState()
      .books.find(b => b.id === book.id)?.playbackSpeed
    const resolvedSpeed = bookPlaybackSpeed ?? useAudiobookPrefsStore.getState().defaultSpeed
    useAudioPlayerStore.getState().setPlaybackRate(resolvedSpeed)
  }, [book.id])

  // ── Effect 2: Auto-bookmark on stop (AC-5) ───────────────────────────────────
  // lastAutoBookmarkTimeRef prevents duplicate bookmarks on rapid pause/play toggles
  // by skipping if the last auto-bookmark was within 5 seconds of the current position.
  const prevIsPlayingForBookmarkRef = useRef(false)
  const lastAutoBookmarkTimeRef = useRef<number | null>(null)
  useEffect(() => {
    const wasPlaying = prevIsPlayingForBookmarkRef.current
    prevIsPlayingForBookmarkRef.current = isPlaying
    if (wasPlaying && !isPlaying) {
      // Read from get() to avoid stale closure on autoBookmarkOnStop
      const autoBookmark = useAudiobookPrefsStore.getState().autoBookmarkOnStop
      if (autoBookmark && currentTime > 0) {
        const last = lastAutoBookmarkTimeRef.current
        if (last !== null && Math.abs(currentTime - last) < 5) {
          // Within 5 seconds of last auto-bookmark — skip to avoid duplicates
          return
        }
        lastAutoBookmarkTimeRef.current = currentTime
        const bookmarkId = crypto.randomUUID()
        db.audioBookmarks
          .add({
            id: bookmarkId,
            bookId: book.id,
            chapterIndex: currentChapterIndex,
            timestamp: Math.floor(currentTime),
            note: 'Auto-bookmark',
            createdAt: new Date().toISOString(),
          })
          .then(() => {
            onBookmarkCreated(bookmarkId)
          })
          .catch(err => {
            // silent-catch-ok: auto-bookmark is non-critical — log but don't disrupt UX
            console.error('[useAudiobookPrefsEffects] Auto-bookmark failed:', err)
          })
      }
    }
  }, [isPlaying, currentTime, currentChapterIndex, book.id, onBookmarkCreated])

  // ── Effect 3: Auto-start sleep timer from default pref (AC-4 Task 5) ─────────
  // Fires once per session when playback first begins, if a default is configured
  // and no timer is already running.
  const defaultSleepTimerAppliedRef = useRef(false)
  useEffect(() => {
    if (!isPlaying) return
    if (defaultSleepTimerAppliedRef.current) return
    defaultSleepTimerAppliedRef.current = true
    const defaultTimer = useAudiobookPrefsStore.getState().defaultSleepTimer
    if (defaultTimer !== 'off' && activeOption === null) {
      setTimer(defaultTimer, audioRef, pause)
    }
  }, [isPlaying, activeOption, setTimer, audioRef, pause])
}
