/**
 * useAudioListeningSession — tracks audiobook listening time and emits
 * study session events for streak counting.
 *
 * Session lifecycle (play/pause-driven, unlike useReadingSession which is
 * mount/unmount-driven):
 *   - Session starts when isPlaying transitions false → true
 *   - Session ends on: isPlaying → false, tab hidden, beforeunload, unmount
 *
 * Features:
 * - 30-second minimum threshold (ignore accidental plays)
 * - Each play/pause cycle is a separate session
 * - Persists to studySessions Dexie table with contentType-equivalent sentinel
 * - Emits `listening:session-ended` on event bus for streak / stats consumers
 * - Non-critical: Dexie failures are logged but never disrupt playback UX
 *
 * @module useAudioListeningSession
 * @since E87-S06
 */
import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/db/schema'
import { appEventBus } from '@/lib/eventBus'
import { logStudyAction } from '@/lib/studyLog'

const MIN_SESSION_SECONDS = 30

interface UseAudioListeningSessionOptions {
  bookId: string
  isPlaying: boolean
}

export function useAudioListeningSession({ bookId, isPlaying }: UseAudioListeningSessionOptions) {
  const sessionStartRef = useRef<number | null>(null)

  /** Persist the session if it meets the minimum threshold */
  const endSession = useCallback(() => {
    const sessionStart = sessionStartRef.current
    if (!sessionStart || !bookId) return
    // Clear immediately to prevent double-ending (e.g., visibilitychange + pause both fire)
    sessionStartRef.current = null

    const now = Date.now()
    const durationMs = now - sessionStart
    const durationMinutes = durationMs / 60000

    // Ignore accidental plays shorter than 30 seconds
    if (durationMs < MIN_SESSION_SECONDS * 1000) return

    const startTime = new Date(sessionStart).toISOString()
    const endTime = new Date(now).toISOString()

    // Reuse studySessions table — sentinel pattern mirrors useReadingSession:
    //   courseId: '' = non-course session
    //   contentItemId: bookId = the audiobook being listened to
    const sessionRecord = {
      id: crypto.randomUUID(),
      courseId: '', // non-course sentinel (same as reading sessions)
      contentItemId: bookId,
      startTime,
      endTime,
      duration: Math.round(durationMs / 1000), // seconds
      idleTime: 0,
      videosWatched: [],
      lastActivity: endTime,
      sessionType: 'mixed' as const,
    }

    // silent-catch-ok: session tracking is non-critical — never disrupt playback UX
    db.studySessions.add(sessionRecord).catch(err => {
      console.error('[useAudioListeningSession] Failed to persist listening session:', err)
    })

    // Log study action for streak counting — reuses studyLog streak pipeline
    logStudyAction({
      type: 'book_listened',
      courseId: bookId, // bookId as courseId sentinel (mirrors book_read pattern)
      timestamp: endTime,
      metadata: { durationMinutes },
    })

    // Emit event for ReadingStatsService and any other consumers (E87-S06)
    appEventBus.emit({
      type: 'listening:session-ended',
      bookId,
      durationMinutes,
    })
  }, [bookId])

  // Start / end session based on isPlaying transitions
  useEffect(() => {
    if (isPlaying) {
      // Play started — record session start
      sessionStartRef.current = Date.now()
    } else {
      // Paused — end the session
      endSession()
    }
  }, [isPlaying, endSession])

  // End session on unmount (e.g., navigating away while playing)
  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  // End session on tab hidden (visibilitychange) — treat hidden tab as pause
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endSession()
      } else if (isPlaying) {
        // Tab became visible again and audio is still playing — restart session timer
        sessionStartRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPlaying, endSession])

  // End session on beforeunload (tab close / page reload)
  // Note: async Dexie writes may not complete during beforeunload.
  // logStudyAction (localStorage) is synchronous and will always complete.
  useEffect(() => {
    const handleBeforeUnload = () => {
      endSession()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [endSession])
}
