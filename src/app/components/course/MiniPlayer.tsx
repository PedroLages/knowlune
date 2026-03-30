/**
 * MiniPlayer — Fixed mini video player that appears when the main video
 * scrolls out of view. Shows play/pause and close controls.
 *
 * @see E91-S04
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { X, Play, Pause } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

interface MiniPlayerProps {
  /** Blob URL of the video being played */
  videoSrc: string
  /** Current playback time from the main player (seconds) */
  currentTime: number
  /** Whether the main video is currently playing */
  isMainPlaying: boolean
  /** Whether the mini-player should be visible */
  isVisible: boolean
  /** Called when the user clicks the close (X) button */
  onClose: () => void
  /** Called when the user toggles play/pause in the mini-player */
  onPlayPause: () => void
}

export function MiniPlayer({
  videoSrc,
  currentTime,
  isMainPlaying,
  isVisible,
  onClose,
  onPlayPause,
}: MiniPlayerProps) {
  const miniVideoRef = useRef<HTMLVideoElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // Manage mount/unmount with animation
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // Sync mini-player video time with main player
  useEffect(() => {
    const miniVideo = miniVideoRef.current
    if (!miniVideo) return
    // Only sync if drift exceeds 1 second to avoid constant seeking
    if (Math.abs(miniVideo.currentTime - currentTime) > 1) {
      miniVideo.currentTime = currentTime
    }
  }, [currentTime])

  // Sync play/pause state
  useEffect(() => {
    const miniVideo = miniVideoRef.current
    if (!miniVideo) return
    if (isMainPlaying) {
      miniVideo.play().catch(() => {
        // silent-catch-ok: autoplay may be blocked by browser policy
      })
    } else {
      miniVideo.pause()
    }
  }, [isMainPlaying])

  const handlePlayPause = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onPlayPause()
    },
    [onPlayPause]
  )

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose()
    },
    [onClose]
  )

  if (!shouldRender) return null

  return (
    <div
      data-testid="mini-player"
      className={cn(
        'fixed bottom-16 right-4 z-50 w-72 h-40 rounded-[16px] shadow-2xl overflow-hidden bg-black sm:bottom-4',
        'transition-all duration-200 ease-out',
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      role="region"
      aria-label="Mini video player"
    >
      {/* Video element — muted to prevent dual audio with main player */}
      <video
        ref={miniVideoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        playsInline
        muted
        aria-hidden="true"
      />

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-7 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
        onClick={handleClose}
        aria-label="Close mini player"
        data-testid="mini-player-close"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>

      {/* Play/pause button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute bottom-2 left-2 size-8 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
        onClick={handlePlayPause}
        aria-label={isMainPlaying ? 'Pause' : 'Play'}
        data-testid="mini-player-playpause"
      >
        {isMainPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}
