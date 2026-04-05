/**
 * useReadingSession — tracks reading time for an open EPUB book.
 *
 * Starts a session timestamp when the hook mounts (after EPUB renders).
 * Ends the session on unmount or beforeunload, persisting a StudySession
 * record to Dexie and logging a 'book_read' action for streak counting.
 *
 * Features:
 * - 30-second minimum threshold (AC2 — ignore accidental opens)
 * - Visibility API pausing: idle time >5 min is excluded (AC4)
 * - beforeunload handler for tab close/reload (AC2)
 * - Non-critical: Dexie failures are logged but never toast-displayed (AC4)
 *
 * @module useReadingSession
 */
import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/db/schema'
import { appEventBus } from '@/lib/eventBus'
import { logStudyAction } from '@/lib/studyLog'

const MIN_SESSION_SECONDS = 30 // Minimum session duration to persist (AC: 2.4)
const IDLE_PAUSE_MS = 5 * 60 * 1000 // 5 minutes of hidden tab = pause timer (AC: 4.1)

interface UseReadingSessionOptions {
  bookId: string
  /** Set to true once the EPUB has successfully rendered (AC: 1.3) */
  isReady: boolean
}

export function useReadingSession({ bookId, isReady }: UseReadingSessionOptions) {
  const sessionStartRef = useRef<number | null>(null)
  // Accumulated idle time to subtract from total duration
  const idleAccumulatedRef = useRef<number>(0)
  // Timestamp when the tab became hidden (for idle calculation)
  const hiddenAtRef = useRef<number | null>(null)

  /** Save the reading session to Dexie and emit events */
  const endSession = useCallback(() => {
    const sessionStart = sessionStartRef.current
    if (!sessionStart || !bookId) return
    // Only end session once
    sessionStartRef.current = null

    const now = Date.now()
    const rawDurationMs = now - sessionStart
    const activeDurationMs = rawDurationMs - idleAccumulatedRef.current
    const durationMinutes = activeDurationMs / 60000

    // Ignore sessions shorter than minimum threshold (AC: 2.4)
    if (durationMinutes < MIN_SESSION_SECONDS / 60) return

    const startTime = new Date(sessionStart).toISOString()
    const endTime = new Date(now).toISOString()

    // Persist to Dexie — reuse studySessions table with book sentinel fields (architecture decision 1)
    // courseId: '' and contentItemId: bookId are sentinels for book sessions (same pattern as Flashcard)
    const sessionRecord = {
      id: crypto.randomUUID(),
      courseId: '', // book-sourced session sentinel (mirrors Flashcard.courseId pattern)
      contentItemId: bookId, // bookId stored here for querying
      startTime,
      endTime,
      duration: Math.round(activeDurationMs / 1000), // seconds
      idleTime: Math.round(idleAccumulatedRef.current / 1000),
      videosWatched: [],
      lastActivity: endTime,
      sessionType: 'mixed' as const, // closest match; book sessions don't fit video/pdf exactly
    }

    // silent-catch-ok: reading session tracking is non-critical — never disrupt reading UX
    db.studySessions.add(sessionRecord).catch(err => {
      console.error('[useReadingSession] Failed to persist reading session:', err)
    })

    // Log study action for streak counting (E85-S06)
    logStudyAction({
      type: 'book_read',
      courseId: bookId, // bookId used as courseId sentinel for streak system
      timestamp: endTime,
      metadata: { durationMinutes },
    })

    // Emit event bus event for any other listeners (e.g., reading stats in E86)
    appEventBus.emit({
      type: 'reading:session-ended',
      bookId,
      durationMinutes,
    })
  }, [bookId])

  // Start session when EPUB is ready
  useEffect(() => {
    if (!isReady || !bookId) return
    sessionStartRef.current = Date.now()
    idleAccumulatedRef.current = 0
    hiddenAtRef.current = null
  }, [isReady, bookId])

  // End session on unmount
  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  // Handle tab visibility change (AC: 4.1) — pause timer when hidden >5 min
  useEffect(() => {
    if (!isReady) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden — record when it was hidden
        hiddenAtRef.current = Date.now()
      } else {
        // Tab visible again — check how long it was hidden
        if (hiddenAtRef.current !== null) {
          const hiddenDuration = Date.now() - hiddenAtRef.current
          if (hiddenDuration >= IDLE_PAUSE_MS) {
            // Subtract idle time from total (only counts periods > 5 min)
            idleAccumulatedRef.current += hiddenDuration
          }
          hiddenAtRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      // If tab goes hidden during cleanup, count that idle time before removing listener
      if (hiddenAtRef.current !== null) {
        const hiddenDuration = Date.now() - hiddenAtRef.current
        if (hiddenDuration >= IDLE_PAUSE_MS) {
          idleAccumulatedRef.current += hiddenDuration
        }
        hiddenAtRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isReady])

  // beforeunload handler for tab close/reload (AC: 2.2)
  // Note: async Dexie writes may not complete during beforeunload.
  // The Dexie write is fire-and-forget; logStudyAction is synchronous (localStorage).
  useEffect(() => {
    if (!isReady) return

    const handleBeforeUnload = () => {
      endSession()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isReady, endSession])
}
