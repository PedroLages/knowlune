import { create } from 'zustand'
import { db } from '@/db'
import type { StudySession } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateQualityScore } from '@/lib/qualityScore'
import { appEventBus } from '@/lib/eventBus'
import { getCurrentStreak } from '@/lib/studyLog'

interface SessionState {
  activeSession: StudySession | null
  sessions: StudySession[]
  isLoading: boolean
  error: string | null
  activeStartTime: string | null // When current active period began (for duration calc)
  lastHeartbeat: number | null // Last heartbeat timestamp (for periodic persistence)

  startSession: (
    courseId: string,
    contentItemId: string,
    sessionType: 'video' | 'pdf' | 'mixed'
  ) => Promise<void>
  updateLastActivity: (timestamp?: string) => void
  recordInteraction: () => void // Increment interaction counter for quality scoring
  pauseSession: () => Promise<void>
  resumeSession: () => void
  endSession: () => void // Synchronous for beforeunload compatibility
  loadSessionStats: (courseId?: string) => Promise<void>
  recoverOrphanedSessions: () => Promise<void>
  getTotalStudyTime: (courseId?: string) => number
  heartbeat: () => Promise<void> // Periodic persistence of lastActivity
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  sessions: [],
  isLoading: false,
  error: null,
  activeStartTime: null,
  lastHeartbeat: null,

  startSession: async (
    courseId: string,
    contentItemId: string,
    sessionType: 'video' | 'pdf' | 'mixed'
  ) => {
    const { activeSession, endSession } = get()

    // End any existing active session first
    if (activeSession) {
      await endSession()
    }

    const now = new Date().toISOString()
    const newSession: StudySession = {
      id: crypto.randomUUID(),
      courseId,
      contentItemId,
      startTime: now,
      endTime: undefined,
      duration: 0,
      idleTime: 0,
      videosWatched: [],
      lastActivity: now,
      sessionType,
      interactionCount: 0,
      breakCount: 0,
    }

    // Optimistic update + track when active period started
    set({
      activeSession: newSession,
      activeStartTime: now,
      lastHeartbeat: Date.now(),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.studySessions.add(newSession)
      })
    } catch (error) {
      // Rollback on failure
      set({ activeSession: null, activeStartTime: null, error: 'Failed to start session' })
      console.error('[SessionStore] Failed to start session:', error)
    }
  },

  updateLastActivity: (timestamp?: string) => {
    const { activeSession, lastHeartbeat } = get()
    if (!activeSession) return

    const now = timestamp || new Date().toISOString()
    const currentTime = Date.now()

    // Throttle: only update Zustand state (triggers re-render) if 30s have passed since last heartbeat
    // This reduces re-render churn while still tracking activity for orphan recovery
    const shouldUpdate = !lastHeartbeat || currentTime - lastHeartbeat >= 30000

    if (shouldUpdate) {
      set({
        activeSession: { ...activeSession, lastActivity: now },
        lastHeartbeat: currentTime,
      })
    } else {
      // Immutable update without heartbeat advancement — ensures Zustand's
      // shallow comparison detects the change and subscribers re-render.
      // Previously this was a direct mutation which caused stale references.
      set({
        activeSession: { ...activeSession, lastActivity: now },
      })
    }
  },

  recordInteraction: () => {
    const { activeSession } = get()
    if (!activeSession) return
    // Immutable update — ensures Zustand detects the change via shallow comparison.
    // Previously this was a direct mutation which meant subscribers holding a
    // reference to activeSession would never see interactionCount change.
    set({
      activeSession: {
        ...activeSession,
        interactionCount: (activeSession.interactionCount ?? 0) + 1,
      },
    })
  },

  pauseSession: async () => {
    const { activeSession, activeStartTime } = get()
    if (!activeSession || !activeStartTime) return

    const now = new Date().toISOString()
    const activeStartMs = new Date(activeStartTime).getTime()
    const lastActivityMs = new Date(activeSession.lastActivity).getTime()

    // Active time = from when session/resume started to last user activity
    const activeSeconds = Math.floor((lastActivityMs - activeStartMs) / 1000)

    // Idle time = 5 minutes (the timeout that triggered this pause)
    const IDLE_TIMEOUT_SECONDS = 5 * 60

    const updatedSession: StudySession = {
      ...activeSession,
      duration: activeSession.duration + Math.max(0, activeSeconds),
      idleTime: activeSession.idleTime + IDLE_TIMEOUT_SECONDS,
      lastActivity: now, // Update to current time for heartbeat
      breakCount: (activeSession.breakCount ?? 0) + 1,
    }

    // Optimistic update (keep activeStartTime - will reset on resume)
    set({ activeSession: updatedSession, error: null })

    try {
      await persistWithRetry(async () => {
        await db.studySessions.put(updatedSession)
      })
    } catch (error) {
      // Rollback on failure
      set({ activeSession, error: 'Failed to pause session' })
      console.error('[SessionStore] Failed to pause session:', error)
    }
  },

  resumeSession: () => {
    const { activeSession } = get()
    if (!activeSession) return

    const now = new Date().toISOString()
    set({
      activeSession: { ...activeSession, lastActivity: now },
      activeStartTime: now, // Reset active start time to now
      lastHeartbeat: Date.now(),
    })
  },

  endSession: () => {
    const { activeSession, activeStartTime } = get()
    if (!activeSession) return

    const now = new Date().toISOString()
    const activeStartMs = activeStartTime
      ? new Date(activeStartTime).getTime()
      : new Date(activeSession.startTime).getTime()
    const lastActivityMs = new Date(activeSession.lastActivity).getTime()

    // Calculate active time from session start (or last resume) to last activity
    // Use lastActivity instead of currentTime because user may have been idle before closing
    const activeSeconds = Math.floor((lastActivityMs - activeStartMs) / 1000)

    const sessionWithDuration: StudySession = {
      ...activeSession,
      endTime: now,
      duration: activeSession.duration + Math.max(0, activeSeconds),
    }

    // Minimum session duration (60s) to show quality score popup.
    // Short visits (e.g., quickly browsing between lessons) should not trigger
    // the disruptive QualityScoreDialog.
    const MIN_QUALITY_SCORE_DURATION_MS = 60_000
    const totalSessionDurationMs =
      new Date(now).getTime() - new Date(activeSession.startTime).getTime()
    const isLongEnoughForQualityScore = totalSessionDurationMs >= MIN_QUALITY_SCORE_DURATION_MS

    // Calculate quality score only for sessions >= 60 seconds
    const closedSession: StudySession = isLongEnoughForQualityScore
      ? (() => {
          const qualityResult = calculateQualityScore(sessionWithDuration)
          return {
            ...sessionWithDuration,
            qualityScore: qualityResult.score,
            qualityFactors: qualityResult.factors,
          }
        })()
      : sessionWithDuration

    // Persist to database async (fire-and-forget for beforeunload compatibility)
    // If this fails, orphan recovery will handle it on next load
    persistWithRetry(async () => {
      await db.studySessions.put(closedSession)
    })
      .then(() => {
        // Notify listeners (e.g., momentum scores) that session data changed
        window.dispatchEvent(new CustomEvent('study-log-updated'))

        // Only show quality score popup for sessions >= 60 seconds
        if (isLongEnoughForQualityScore) {
          const qualityResult = {
            score: closedSession.qualityScore!,
            factors: closedSession.qualityFactors!,
          }
          // Notify quality score UI to show the result dialog
          // Event detail includes all needed data so listeners don't need store access
          window.dispatchEvent(
            new CustomEvent('session-quality-calculated', {
              detail: qualityResult,
            })
          )
        }

        // E43-S07: Only emit streak:milestone for meaningful thresholds.
        // The service also filters, but the store is the first gate to avoid
        // unnecessary event traffic for every positive streak.
        const STREAK_THRESHOLDS = [7, 14, 30, 60, 100, 365] as const
        const currentStreak = getCurrentStreak()
        if (
          currentStreak > 0 &&
          STREAK_THRESHOLDS.includes(currentStreak as (typeof STREAK_THRESHOLDS)[number])
        ) {
          appEventBus.emit({ type: 'streak:milestone', days: currentStreak })
        }
      })
      .catch(error => {
        console.error('[SessionStore] Failed to end session:', error)
        // Don't rollback - let orphan recovery handle incomplete writes
      })

    // Clear active state after dispatching persistence — synchronous for beforeunload
    // compatibility. Events fire after persistence succeeds (async), so listeners
    // can safely read from the store if needed before state is cleared.
    set({ activeSession: null, activeStartTime: null, lastHeartbeat: null, error: null })
  },

  loadSessionStats: async (courseId?: string) => {
    set({ isLoading: true, error: null })
    try {
      let sessions: StudySession[]
      if (courseId) {
        sessions = await db.studySessions.where({ courseId }).toArray()
      } else {
        sessions = await db.studySessions.toArray()
      }
      set({ sessions, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load session stats' })
      console.error('[SessionStore] Failed to load sessions:', error)
    }
  },

  recoverOrphanedSessions: async () => {
    try {
      // Find sessions where endTime is undefined (orphaned)
      const orphanedSessions = await db.studySessions
        .filter(session => session.endTime === undefined)
        .toArray()

      if (orphanedSessions.length === 0) {
        console.log('[SessionStore] No orphaned sessions to recover')
        return
      }

      // Close each orphaned session with lastActivity timestamp
      for (const session of orphanedSessions) {
        const lastActivityTime = new Date(session.lastActivity).getTime()
        const startTime = new Date(session.startTime).getTime()
        const totalSeconds = Math.floor((lastActivityTime - startTime) / 1000)

        const closedSession: StudySession = {
          ...session,
          endTime: session.lastActivity,
          duration: Math.max(session.duration, totalSeconds), // Use calculated if greater
        }

        await db.studySessions.put(closedSession)
      }

      console.log(`[SessionStore] Recovered ${orphanedSessions.length} orphaned session(s)`)
    } catch (error) {
      console.error('[SessionStore] Failed to recover orphaned sessions:', error)
    }
  },

  getTotalStudyTime: (courseId?: string) => {
    const { sessions } = get()

    let filteredSessions = sessions
    if (courseId) {
      filteredSessions = sessions.filter(s => s.courseId === courseId)
    }

    return filteredSessions.reduce((total, session) => {
      // Only count completed sessions (with endTime)
      return session.endTime ? total + session.duration : total
    }, 0)
  },

  heartbeat: async () => {
    const { activeSession, lastHeartbeat } = get()
    if (!activeSession) return

    const now = Date.now()
    // Only persist if 30+ seconds since last heartbeat (throttle database writes)
    if (lastHeartbeat && now - lastHeartbeat < 30000) return

    try {
      // Persist current session state to database (ensures orphan recovery has recent data)
      await db.studySessions.put(activeSession)
      set({ lastHeartbeat: now })
    } catch (error) {
      console.error('[SessionStore] Heartbeat failed:', error)
      // Don't set error state - heartbeat failures are non-critical
    }
  },
}))
