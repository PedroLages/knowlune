/**
 * useVideoPositionSync — persists video playback position to Dexie during playback,
 * on pause, and on unmount. Follows the useAudiobookPositionSync pattern.
 *
 * F010: Sync uses LWW (last-writer-wins) via syncableWrite, which routes to
 * Supabase upsert_video_progress() with monotonic-write on watchedSeconds.
 * For two-tab conflicts, the last save wins — position data is a linear
 * value, so merge is unnecessary: the most recent write always represents
 * the user's true position.
 *
 * @module useVideoPositionSync
 * @since E93-S07
 */
import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/db/schema'
import { syncableWrite } from '@/lib/sync/syncableWrite'

export interface UseVideoPositionSyncParams {
  courseId: string
  lessonId: string
  /** Current playback time in seconds (passive — hook reads refs, not reactive value). */
  currentTime: number
  /** Total video duration in seconds. */
  duration: number
  /** Whether the video is currently playing. */
  isPlaying: boolean
  /**
   * When true, position data is NOT persisted. Prevents preview/autoplay
   * sessions from overwriting real progress data with inaccurate positions.
   */
  autoplay?: boolean
}

/**
 * Periodically persists video playback position to db.progress during playback,
 * on pause, on unmount, and on tab close/visibility change. Uses refs for
 * fast-changing values so the save callback and effects remain stable.
 *
 * @param params - See UseVideoPositionSyncParams
 */
export function useVideoPositionSync({
  courseId,
  lessonId,
  currentTime,
  duration,
  isPlaying,
  autoplay = false,
}: UseVideoPositionSyncParams): void {
  // All reactive values stored in a single composite ref so savePosition can be
  // fully stable. Ref-based approach ensures even stale cleanup calls (from
  // effect re-runs due to deps changes) read the latest values. F012: Single
  // composite ref replaces four individual useRef calls.
  const snapRef = useRef({ courseId, lessonId, currentTime, duration, autoplay })
  snapRef.current = { courseId, lessonId, currentTime, duration, autoplay }

  // F007: Stable fields (completedAt, currentPage) read once from Dexie and
  // spread from refs on periodic saves instead of querying db each time.
  const stableRefs = useRef<{ completedAt: string | null; currentPage: number | null }>({
    completedAt: null,
    currentPage: null,
  })
  const stableLoadedRef = useRef(false)

  // Generational cancel: increment when courseId/lessonId change to discard stale saves
  const generationRef = useRef(0)
  const prevIdsRef = useRef({ courseId, lessonId })

  if (prevIdsRef.current.courseId !== courseId || prevIdsRef.current.lessonId !== lessonId) {
    generationRef.current++
    prevIdsRef.current = { courseId, lessonId }
    // Reset stable field cache when courseId/lessonId change
    stableLoadedRef.current = false
    stableRefs.current = { completedAt: null, currentPage: null }
  }

  /** Persist current playback position and progress to Dexie via syncableWrite. */
  const savePosition = useCallback(async () => {
    const gen = generationRef.current
    const { courseId: cId, lessonId: lId, currentTime: time, duration: dur, autoplay: ap } = snapRef.current

    // F007: Don't persist position for preview/autoplay sessions
    if (ap) return

    // Guard against 0-position saves
    if (!time || !isFinite(time) || time <= 0) return
    if (!dur || !isFinite(dur) || dur <= 0) return

    try {
      // F007: Read stable fields once, spread from refs on periodic saves
      if (!stableLoadedRef.current) {
        const existing = await db.progress
          .where('[courseId+videoId]')
          .equals([cId, lId])
          .first()

        if (existing) {
          stableRefs.current = {
            completedAt: existing.completedAt ?? null,
            currentPage: existing.currentPage ?? null,
          }
        }
        stableLoadedRef.current = true
        // Generational cancel: discard if courseId/lessonId changed mid-read
        if (gen !== generationRef.current) return
      }

      const completionPercentage = Math.min(100, Math.round((time / dur) * 100))

      await syncableWrite('progress', 'put', {
        courseId: cId,
        videoId: lId,
        currentTime: time,
        completionPercentage,
        durationSeconds: dur,
        // Spread stable fields from refs so each periodic save doesn't re-query Dexie
        ...(stableRefs.current.completedAt !== null ? { completedAt: stableRefs.current.completedAt } : {}),
        ...(stableRefs.current.currentPage !== null ? { currentPage: stableRefs.current.currentPage } : {}),
      })
    } catch (err) {
      // silent-catch-ok — position save is non-critical; console.warn emitted for developer debugging
      console.warn('[useVideoPositionSync] Failed to save position:', err)
    }
  }, [])

  // Save position when playback pauses (isPlaying transitions false)
  useEffect(() => {
    if (!isPlaying) {
      savePosition()
    }
  }, [isPlaying, savePosition])

  // Periodic progress save during playback (every 5s)
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(savePosition, 5000)
    return () => clearInterval(interval)
  }, [isPlaying, savePosition])

  // Save position on unmount (SPA route transitions)
  useEffect(() => {
    return () => {
      savePosition()
    }
  }, [savePosition])

  // Save on visibilitychange (tab background/page hide)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        savePosition()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [savePosition])
}
