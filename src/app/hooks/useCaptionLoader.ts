import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { CaptionTrack } from '@/data/types'
import { saveCaptionForVideo, getCaptionForVideo } from '@/lib/captions'

/**
 * Manages user-loaded caption state, persistence, and blob URL lifecycle.
 *
 * - Loads persisted captions from Dexie on mount / lesson change
 * - Handles file loading with validation and error toasts
 * - Revokes blob URLs on lesson change and unmount to prevent memory leaks
 * - Resets caption state when navigating to a lesson with no persisted captions
 */
export function useCaptionLoader(courseId: string | undefined, lessonId: string | undefined) {
  const [userCaptions, setUserCaptions] = useState<CaptionTrack | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Load persisted user captions on mount / lesson change
  useEffect(() => {
    if (!courseId || !lessonId) return
    let cancelled = false

    getCaptionForVideo(courseId, lessonId)
      .then(track => {
        if (cancelled) return
        // Revoke any previous blob URL
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)

        if (track) {
          blobUrlRef.current = track.src
          setUserCaptions(track)
        } else {
          // No persisted captions for this lesson — clear stale state
          blobUrlRef.current = null
          setUserCaptions(null)
        }
      })
      .catch(err => {
        // silent-catch-ok — error state handled by component (captions reset to null)
        if (cancelled) return
        console.error('[captions] Failed to restore persisted captions:', err)
        blobUrlRef.current = null
        setUserCaptions(null)
      })

    return () => {
      cancelled = true
    }
  }, [courseId, lessonId])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  // Handle user loading a caption file
  const handleLoadCaptions = useCallback(
    async (file: File) => {
      if (!courseId || !lessonId) return

      try {
        const result = await saveCaptionForVideo(courseId, lessonId, file)
        if (!result.captionTrack) {
          toast.error(result.error)
          return
        }

        // Revoke previous blob URL before replacing
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = result.captionTrack.src
        setUserCaptions(result.captionTrack)
        toast.success(`Captions loaded: ${file.name}`)
      } catch (err) {
        console.error('[captions] Failed to save caption file:', err)
        toast.error('Failed to save captions. Please try again.')
      }
    },
    [courseId, lessonId]
  )

  return { userCaptions, handleLoadCaptions }
}
