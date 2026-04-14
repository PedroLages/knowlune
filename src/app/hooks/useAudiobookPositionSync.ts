/**
 * useAudiobookPositionSync — persists audiobook playback position to Dexie and
 * the book store, and restores saved position on mount for remote books.
 *
 * Extracted from AudiobookRenderer (E108-S04) to keep it under the 500-line
 * ESLint component-size limit. Encapsulates:
 *  - savePosition callback (updates store + Dexie on pause / every 5s / unmount)
 *  - Deliberate-stop tracking (marks stop on unmount and audio 'ended' event)
 *  - Session resume seek (remote books: seek to saved position after load)
 *
 * @module useAudiobookPositionSync
 * @since E108-S04
 */
import { useEffect, useCallback, useRef } from 'react'
import { useBookStore } from '@/stores/useBookStore'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { db } from '@/db/schema'
import { sharedAudioRef } from '@/app/hooks/useAudioPlayer'
import type { Book } from '@/data/types'

interface UseAudiobookPositionSyncParams {
  book: Book
  isPlaying: boolean
  isLoading: boolean
  seekTo: (seconds: number) => void
  /** Ref that the caller uses to detect deliberate stops (e.g. to gate post-session review) */
  deliberateStopRef: React.MutableRefObject<boolean>
}

export function useAudiobookPositionSync({
  book,
  isPlaying,
  isLoading,
  seekTo,
  deliberateStopRef,
}: UseAudiobookPositionSyncParams): { savePosition: () => void } {
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
    type DexiePositionUpdate = Partial<Pick<Book, 'currentPosition' | 'lastOpenedAt' | 'progress'>>
    const dexieUpdate: DexiePositionUpdate = { currentPosition: position, lastOpenedAt: now }
    if (progress !== undefined) dexieUpdate.progress = progress
    // silent-catch-ok: Dexie persist is non-critical, position re-saved on next pause
    db.books
      .update(book.id, dexieUpdate as Parameters<typeof db.books.update>[1])
      .catch(err => console.error('[useAudiobookPositionSync] Failed to save position:', err))
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
  }, [savePosition, deliberateStopRef])

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
  }, [deliberateStopRef])

  // Restore position on mount for remote books (session resume).
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
    // Skip seek if this book is already active (e.g. returning from mini-player) —
    // the singleton audio element already has the correct position
    const alreadyActive = useAudioPlayerStore.getState().currentBookId === book.id
    if (alreadyActive) {
      sessionResumeSeekDoneRef.current = true
      return
    }
    if (!isLoading && !sessionResumeSeekDoneRef.current) {
      sessionResumeSeekDoneRef.current = true
      seekTo(savedSeconds)
    }
  }, [isLoading, book.id, seekTo])

  return { savePosition }
}
