/**
 * useSessionTracking — Shared session tracking logic for lesson players.
 *
 * Handles study session lifecycle: start, pause/resume on idle, end on
 * visibility change / unload, and periodic heartbeat persistence.
 *
 * @see E89-S05 — extracted from ImportedLessonPlayer / YouTubeLessonPlayer
 */

import { useEffect } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useIdleDetection } from '@/app/hooks/useIdleDetection'

const HEARTBEAT_INTERVAL_MS = 30000

export function useSessionTracking(
  courseId: string | undefined,
  lessonId: string | undefined,
  type: 'video' | 'pdf' | null = 'video'
): void {
  const { startSession, updateLastActivity, pauseSession, resumeSession, endSession, heartbeat } =
    useSessionStore()

  // Idle detection (pause/resume session)
  useIdleDetection({
    onIdle: () => pauseSession(),
    onActive: () => resumeSession(),
    onActivity: () => updateLastActivity(),
  })

  // Start session when lesson player mounts.
  // Defers until type is resolved (non-null) to avoid double-start on type change.
  useEffect(() => {
    if (!courseId || !lessonId || type === null) return
    startSession(courseId, lessonId, type)
  }, [courseId, lessonId, type, startSession])

  // End session on navigation away / tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endSession()
      }
    }

    const handleBeforeUnload = () => {
      endSession()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [endSession])

  // Periodic heartbeat: persist session state every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      heartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [heartbeat])
}
