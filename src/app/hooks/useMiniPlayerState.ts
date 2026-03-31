/**
 * useMiniPlayerState — Mini-player visibility and playback control for UnifiedLessonPlayer.
 *
 * Extracts: isVideoVisible, isVideoPlaying, isMiniPlayerDismissed, localVideoBlobUrl
 * state and their handler callbacks.
 *
 * @see E91-S04
 */

import { useCallback, type RefObject } from 'react'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'

export interface MiniPlayerStateParams {
  videoPlayerRef: RefObject<VideoPlayerHandle | null>
  setIsVideoVisible: React.Dispatch<React.SetStateAction<boolean>>
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>
  setIsMiniPlayerDismissed: React.Dispatch<React.SetStateAction<boolean>>
  setLocalVideoBlobUrl: React.Dispatch<React.SetStateAction<string | null>>
}

export interface MiniPlayerStateResult {
  handleVideoVisibilityChange: (visible: boolean) => void
  handlePlayStateChange: (playing: boolean) => void
  handleMiniPlayerClose: () => void
  handleMiniPlayerPlayPause: () => void
}

export function useMiniPlayerState(params: MiniPlayerStateParams): MiniPlayerStateResult {
  const {
    videoPlayerRef,
    setIsVideoVisible,
    setIsVideoPlaying,
    setIsMiniPlayerDismissed,
  } = params

  const handleVideoVisibilityChange = useCallback(
    (visible: boolean) => {
      setIsVideoVisible(visible)
    },
    [setIsVideoVisible]
  )

  const handlePlayStateChange = useCallback(
    (playing: boolean) => {
      setIsVideoPlaying(playing)
    },
    [setIsVideoPlaying]
  )

  const handleMiniPlayerClose = useCallback(() => {
    setIsMiniPlayerDismissed(true)
  }, [setIsMiniPlayerDismissed])

  const handleMiniPlayerPlayPause = useCallback(() => {
    const videoEl = videoPlayerRef.current?.getVideoElement()
    if (!videoEl) return
    if (videoEl.paused) {
      videoEl.play().catch(() => {
        // silent-catch-ok: autoplay may be blocked
      })
    } else {
      videoEl.pause()
    }
  }, [videoPlayerRef])

  return {
    handleVideoVisibilityChange,
    handlePlayStateChange,
    handleMiniPlayerClose,
    handleMiniPlayerPlayPause,
  }
}
