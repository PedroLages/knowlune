/**
 * useVideoPositionSync — persists video playback position to Dexie during playback,
 * on pause, and on unmount. Follows the useAudiobookPositionSync pattern.
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
}: UseVideoPositionSyncParams): void {
  // All reactive values stored in refs so savePosition can be fully stable.
  // Ref-based approach ensures even stale cleanup calls (from effect re-runs
  // due to deps changes) read the latest values.
  const courseIdRef = useRef(courseId)
  courseIdRef.current = courseId
  const lessonIdRef = useRef(lessonId)
  lessonIdRef.current = lessonId
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const durationRef = useRef(duration)
  durationRef.current = duration

  // Generational cancel: increment when courseId/lessonId change to discard stale saves
  const generationRef = useRef(0)
  const prevIdsRef = useRef({ courseId, lessonId })

  if (prevIdsRef.current.courseId !== courseId || prevIdsRef.current.lessonId !== lessonId) {
    generationRef.current++
    prevIdsRef.current = { courseId, lessonId }
  }

  /** Persist current playback position and progress to Dexie via syncableWrite. */
  const savePosition = useCallback(async () => {
    const gen = generationRef.current
    const cId = courseIdRef.current
    const lId = lessonIdRef.current
    const time = currentTimeRef.current
    const dur = durationRef.current

    // Guard against 0-position saves
    if (!time || !isFinite(time) || time <= 0) return
    if (!dur || !isFinite(dur) || dur <= 0) return

    try {
      // Read existing record to spread and preserve currentPage
      const existing = await db.progress
        .where('[courseId+videoId]')
        .equals([cId, lId])
        .first()

      // Generational cancel: discard if courseId/lessonId changed mid-read
      if (gen !== generationRef.current) return

      const completionPercentage = Math.min(100, Math.round((time / dur) * 100))

      await syncableWrite('progress', 'put', {
        ...(existing ?? { currentTime: 0, completionPercentage: 0 }),
        courseId: cId,
        videoId: lId,
        currentTime: time,
        completionPercentage,
        durationSeconds: dur,
      })
    } catch {
      // silent-catch-ok — position save is non-critical
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
