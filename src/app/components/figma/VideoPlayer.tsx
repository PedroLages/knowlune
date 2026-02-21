import { useRef, useEffect, useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  Bookmark,
  SkipBack,
  SkipForward,
  PictureInPicture2,
} from 'lucide-react'
import type { CaptionTrack } from '@/data/types'
import { AspectRatio } from '@/app/components/ui/aspect-ratio'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
// Radix Popover Portal miscalculates position inside scroll containers — using plain CSS dropdown
import { cn } from '@/app/components/ui/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'
import { VideoShortcutsOverlay } from '@/app/components/figma/VideoShortcutsOverlay'

interface VideoPlayerProps {
  src: string
  title?: string
  initialPosition?: number
  captions?: CaptionTrack[]
  seekToTime?: number
  courseId?: string
  lessonId?: string
  poster?: string
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
  onSeekComplete?: () => void
  onBookmarkAdd?: (timestamp: number) => void
  bookmarks?: Array<{ id: string; timestamp: number; label: string }>
  onBookmarkSeek?: (timestamp: number) => void
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const STORAGE_KEY_PLAYBACK_SPEED = 'video-playback-speed'
const STORAGE_KEY_CAPTIONS_ENABLED = 'video-captions-enabled'

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function VideoPlayer({
  src,
  title,
  initialPosition,
  captions,
  seekToTime,
  courseId: _courseId,
  lessonId: _lessonId,
  onTimeUpdate,
  onEnded,
  onSeekComplete,
  onBookmarkAdd,
  poster,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touchActiveRef = useRef(false)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [announcement, setAnnouncement] = useState('')

  // Load saved playback speed from localStorage
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_SPEED)
    return saved ? parseFloat(saved) : 1
  })

  // Track whether speed menu is open (prevents controls auto-hide)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)

  // Mobile volume popover state
  const [mobileVolumeOpen, setMobileVolumeOpen] = useState(false)

  // Picture-in-Picture state
  const [isPiP, setIsPiP] = useState(false)

  // Video shortcuts overlay state
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Refs for speed menu focus trap
  const speedTriggerRef = useRef<HTMLButtonElement>(null)
  const speedMenuItemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const speedMenuWrapperRef = useRef<HTMLDivElement>(null)
  const mobileVolumeWrapperRef = useRef<HTMLDivElement>(null)

  // Load saved caption preference from localStorage
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTIONS_ENABLED)
    return saved === 'true'
  })

  // Reset position flag when source changes
  useEffect(() => {
    hasRestoredPosition.current = false
  }, [src])

  // Apply playback speed to video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Manage caption track visibility
  useEffect(() => {
    if (videoRef.current?.textTracks && captions && captions.length > 0) {
      Array.from(videoRef.current.textTracks).forEach(track => {
        track.mode = captionsEnabled ? 'showing' : 'hidden'
      })
    }
  }, [captionsEnabled, captions])

  // Handle external seek requests from timestamp links
  useEffect(() => {
    if (seekToTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToTime
      setCurrentTime(seekToTime)
      announce(`Jumped to ${formatTime(seekToTime)}`)
      onSeekComplete?.()
    }
  }, [seekToTime, onSeekComplete])

  // Restore initial position
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      if (initialPosition && !hasRestoredPosition.current) {
        videoRef.current.currentTime = initialPosition
        hasRestoredPosition.current = true
      }
    }
  }, [initialPosition])

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)
    }
  }, [onTimeUpdate])

  // Handle video ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setShowControls(true)
    onEnded?.()
    announce('Video ended')
  }, [onEnded])

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
        announce('Paused')
      } else {
        videoRef.current.play()
        setIsPlaying(true)
        announce('Playing')
      }
    }
  }, [isPlaying])

  // Seek forward/backward
  const seek = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(
        0,
        Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds)
      )
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
      announce(`Seeked to ${formatTime(newTime)}`)
    }
  }, [])

  // Change volume
  const changeVolume = useCallback(
    (delta: number) => {
      if (videoRef.current) {
        const newVolume = Math.max(0, Math.min(1, volume + delta))
        setVolume(newVolume)
        videoRef.current.volume = newVolume
        setIsMuted(newVolume === 0)
        announce(`Volume ${Math.round(newVolume * 100)}%`)
      }
    },
    [volume]
  )

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted
      setIsMuted(newMuted)
      videoRef.current.muted = newMuted
      announce(newMuted ? 'Muted' : 'Unmuted')
    }
  }, [isMuted])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Toggle captions
  const toggleCaptions = useCallback(() => {
    if (!captions || captions.length === 0) return

    const newEnabled = !captionsEnabled
    setCaptionsEnabled(newEnabled)
    localStorage.setItem(STORAGE_KEY_CAPTIONS_ENABLED, newEnabled.toString())

    // Enable/disable all text tracks
    if (videoRef.current?.textTracks) {
      Array.from(videoRef.current.textTracks).forEach(track => {
        track.mode = newEnabled ? 'showing' : 'hidden'
      })
    }

    announce(newEnabled ? 'Captions enabled' : 'Captions disabled')
  }, [captions, captionsEnabled])

  // Change playback speed
  const changePlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed)
    localStorage.setItem(STORAGE_KEY_PLAYBACK_SPEED, speed.toString())
    announce(`Speed changed to ${speed}x`)
  }, [])

  // Jump to percentage
  const jumpToPercentage = useCallback((percentage: number) => {
    if (videoRef.current) {
      const newTime = (percentage / 100) * videoRef.current.duration
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
      announce(`Jumped to ${percentage}%`)
    }
  }, [])

  // ARIA announcement helper
  const announce = useCallback((message: string) => {
    setAnnouncement(message)
    setTimeout(() => setAnnouncement(''), 1000)
  }, [])

  // Add bookmark at current timestamp
  const handleAddBookmark = useCallback(() => {
    if (onBookmarkAdd) {
      onBookmarkAdd(currentTime)
      announce(`Bookmark added at ${formatTime(currentTime)}`)
    }
  }, [onBookmarkAdd, currentTime])

  // Toggle Picture-in-Picture
  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {
      announce('Picture-in-Picture not available')
    }
  }, [announce])

  // PiP event listeners for state sync
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnterPiP = () => {
      setIsPiP(true)
      announce('Picture-in-Picture activated')
    }
    const onLeavePiP = () => {
      setIsPiP(false)
      announce('Picture-in-Picture deactivated')
    }
    video.addEventListener('enterpictureinpicture', onEnterPiP)
    video.addEventListener('leavepictureinpicture', onLeavePiP)
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP)
      video.removeEventListener('leavepictureinpicture', onLeavePiP)
    }
  }, [announce])

  // Speed menu keyboard navigation — document-level handler for Safari compatibility
  // (Safari doesn't focus buttons on click, so element-level onKeyDown won't fire)
  useEffect(() => {
    if (!speedMenuOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = speedMenuItemsRef.current.filter(Boolean) as HTMLButtonElement[]
      const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement)

      switch (e.key) {
        case 'Tab': {
          e.preventDefault()
          if (currentIdx === -1) {
            // Focus not on any menu item — go to first
            items[0]?.focus()
          } else if (e.shiftKey) {
            const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1
            items[prevIdx]?.focus()
          } else {
            const nextIdx = currentIdx >= items.length - 1 ? 0 : currentIdx + 1
            items[nextIdx]?.focus()
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          if (currentIdx === -1) {
            items[0]?.focus()
          } else {
            const nextIdx = currentIdx >= items.length - 1 ? 0 : currentIdx + 1
            items[nextIdx]?.focus()
          }
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1
          items[prevIdx]?.focus()
          break
        }
        case 'Escape': {
          e.preventDefault()
          // flushSync ensures React re-renders synchronously so focus
          // lands on the trigger after menu DOM is removed (Safari compat)
          flushSync(() => setSpeedMenuOpen(false))
          speedTriggerRef.current?.focus()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [speedMenuOpen])

  // Click-outside handler for speed menu (B2)
  useEffect(() => {
    if (!speedMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuWrapperRef.current && !speedMenuWrapperRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [speedMenuOpen])

  // Click-outside handler for mobile volume popover (M1)
  useEffect(() => {
    if (!mobileVolumeOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileVolumeWrapperRef.current && !mobileVolumeWrapperRef.current.contains(e.target as Node)) {
        setMobileVolumeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileVolumeOpen])

  // ? key: capture phase on document to prevent Layout handler from firing
  useEffect(() => {
    const handleQuestionMark = (e: KeyboardEvent) => {
      if (e.key !== '?') return
      if (!containerRef.current?.contains(document.activeElement)) return
      if (speedMenuOpen) return
      e.stopPropagation()
      e.preventDefault()
      setShortcutsOpen(prev => !prev)
    }
    document.addEventListener('keydown', handleQuestionMark, true)
    return () => document.removeEventListener('keydown', handleQuestionMark, true)
  }, [speedMenuOpen])

  // Close mobile volume popover when controls hide
  useEffect(() => {
    if (!showControls) {
      setMobileVolumeOpen(false)
    }
  }, [showControls])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if video player is in focus or controls are visible
      if (!containerRef.current?.contains(document.activeElement)) return
      // Speed menu handles its own keyboard events
      if (speedMenuOpen) return

      // When shortcuts overlay is open, only Escape works
      if (shortcutsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShortcutsOpen(false)
        }
        return
      }

      switch (e.key) {
        case ' ':
          // Don't toggle play/pause if a Slider thumb has focus — let Slider handle Space natively
          if (document.activeElement?.getAttribute('role') === 'slider') return
          e.preventDefault()
          togglePlayPause()
          break
        case 'k':
          e.preventDefault()
          togglePlayPause()
          break
        case 'j':
          e.preventDefault()
          seek(-10)
          announce('Skipped back 10 seconds')
          break
        case 'l':
          e.preventDefault()
          seek(10)
          announce('Skipped forward 10 seconds')
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(5)
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(-0.05)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'c':
          e.preventDefault()
          toggleCaptions()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'p':
          e.preventDefault()
          togglePiP()
          break
        case 'b':
          e.preventDefault()
          handleAddBookmark()
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          jumpToPercentage(parseInt(e.key) * 10)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlayPause,
    seek,
    announce,
    changeVolume,
    toggleMute,
    toggleCaptions,
    toggleFullscreen,
    togglePiP,
    jumpToPercentage,
    speedMenuOpen,
    shortcutsOpen,
  ])

  // Auto-hide controls (mouse interaction — only hides when playing)
  const resetControlsTimeout = useCallback(() => {
    // Skip synthesized mouse events that follow touch events on mobile
    if (touchActiveRef.current) return
    setShowControls(true)
    if (isPlaying && !speedMenuOpen && !shortcutsOpen) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying, speedMenuOpen, shortcutsOpen])

  // Touch-specific handler: always starts hide timeout (mobile UX — tap to show, auto-hide)
  const handleTouchShow = useCallback(() => {
    // Block synthesized mouse events that follow touchstart (~300ms on mobile)
    touchActiveRef.current = true
    setTimeout(() => { touchActiveRef.current = false }, 500)

    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (!speedMenuOpen && !shortcutsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [speedMenuOpen, shortcutsOpen])

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Handle progress bar change
  const handleProgressChange = useCallback(
    (value: number[]) => {
      if (videoRef.current) {
        const newTime = (value[0] / 100) * duration
        videoRef.current.currentTime = newTime
        setCurrentTime(newTime)
      }
    },
    [duration]
  )

  // Handle volume slider change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0] / 100
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      className="relative w-full overflow-hidden rounded-2xl bg-black group focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && !speedMenuOpen && !shortcutsOpen && setShowControls(false)}
      onTouchStart={handleTouchShow}
      tabIndex={0}
      role="region"
      aria-label={title || 'Video player'}
    >
      <AspectRatio ratio={16 / 9}>
        <video
          ref={videoRef}
          src={src}
          title={title}
          className="h-full w-full object-contain"
          preload="metadata"
          playsInline
          poster={poster}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={togglePlayPause}
          crossOrigin="anonymous"
        >
          {captions?.map((caption, index) => (
            <track
              key={caption.language}
              kind="subtitles"
              src={caption.src}
              srcLang={caption.language}
              label={caption.label}
              default={caption.default || index === 0}
            />
          ))}
          Your browser does not support the video element.
        </video>

        {/* Custom Controls Overlay */}
        <div
          data-testid="player-controls-overlay"
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-[opacity,visibility] duration-300',
            showControls ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'
          )}
          onTouchStart={handleTouchShow}
        >
          {/* Play/Pause Button Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-16 rounded-full bg-black/50 hover:bg-black/70 text-white"
              onClick={togglePlayPause}
              tabIndex={-1}
              aria-hidden="true"
            >
              {isPlaying ? <Pause className="size-8" /> : <Play className="size-8 ml-1" />}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-white text-xs font-medium min-w-[45px]">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1">
                <Slider
                  value={[progress]}
                  onValueChange={handleProgressChange}
                  max={100}
                  step={0.1}
                  aria-label="Video progress"
                />
                {/* Bookmark markers — visible dot is w-2 h-2, wrapped in 44x44px hit area for touch targets */}
                {bookmarks && duration > 0 && bookmarks.map(bm => (
                  <Tooltip key={bm.id}>
                    <TooltipTrigger asChild>
                      <button
                        data-testid="bookmark-marker"
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center z-10 cursor-pointer group/marker"
                        style={{ left: `${(bm.timestamp / duration) * 100}%` }}
                        onClick={(e) => { e.stopPropagation(); onBookmarkSeek?.(bm.timestamp) }}
                        aria-label={`Bookmark at ${formatTime(bm.timestamp)}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-600 group-hover/marker:scale-150 transition-transform" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{formatTime(bm.timestamp)}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <span className="text-white text-xs font-medium min-w-[45px] text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div data-testid="player-bottom-controls" className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>

                {/* Skip Back */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20"
                  onClick={() => { seek(-10); announce('Skipped back 10 seconds') }}
                  aria-label="Skip back 10 seconds"
                >
                  <SkipBack className="size-5" />
                </Button>

                {/* Skip Forward */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20"
                  onClick={() => { seek(10); announce('Skipped forward 10 seconds') }}
                  aria-label="Skip forward 10 seconds"
                >
                  <SkipForward className="size-5" />
                </Button>

                {/* Volume */}
                <div ref={mobileVolumeWrapperRef} className="relative flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="volume-button"
                    className="size-11 text-white hover:bg-white/20"
                    onClick={() => {
                      const isMobile = !window.matchMedia('(min-width: 640px)').matches
                      if (isMobile) {
                        setMobileVolumeOpen(prev => !prev)
                      } else {
                        toggleMute()
                      }
                    }}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="size-5" />
                    ) : (
                      <Volume2 className="size-5" />
                    )}
                  </Button>

                  {/* Desktop: inline volume slider */}
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className="w-20 hidden sm:block"
                    aria-label="Volume"
                  />

                  {/* Mobile: volume popover */}
                  {mobileVolumeOpen && (
                    <div
                      data-testid="mobile-volume-popover"
                      className="absolute bottom-full left-0 mb-2 w-36 p-3 rounded-md bg-popover border shadow-md z-50 sm:hidden"
                    >
                      <Slider
                        value={[isMuted ? 0 : volume * 100]}
                        onValueChange={handleVolumeChange}
                        max={100}
                        step={1}
                        aria-label="Volume"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Playback Speed */}
                <div ref={speedMenuWrapperRef} className="relative">
                  <Button
                    ref={speedTriggerRef}
                    variant="ghost"
                    size="sm"
                    data-testid="speed-menu-trigger"
                    className="h-11 px-3 text-white hover:bg-white/20 text-xs font-medium"
                    aria-label="Playback speed"
                    aria-expanded={speedMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setSpeedMenuOpen(prev => !prev)}
                  >
                    <Settings className="size-5 mr-1" />
                    {playbackSpeed}x
                  </Button>
                  {speedMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Playback speed"
                      className="absolute bottom-full right-0 mb-2 w-32 rounded-md border bg-popover p-2 shadow-md z-50"
                    >
                      <p className="text-xs font-semibold mb-2">Speed</p>
                      {PLAYBACK_SPEEDS.map((speed, index) => (
                        <button
                          key={speed}
                          ref={(el) => { speedMenuItemsRef.current[index] = el }}
                          role="menuitem"
                          aria-checked={speed === playbackSpeed}
                          tabIndex={-1}
                          onClick={() => {
                            changePlaybackSpeed(speed)
                            setSpeedMenuOpen(false)
                            speedTriggerRef.current?.focus()
                          }}
                          className={cn(
                            'w-full text-left px-2 py-1 text-sm rounded hover:bg-accent',
                            speed === playbackSpeed && 'bg-accent font-semibold'
                          )}
                        >
                          {speed}x {speed === 1 && '(Normal)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Picture-in-Picture — only if browser supports it */}
                {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-11 text-white hover:bg-white/20',
                      isPiP && 'bg-white/20'
                    )}
                    onClick={togglePiP}
                    aria-label={isPiP ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
                    aria-pressed={isPiP}
                  >
                    <PictureInPicture2 className="size-5" />
                  </Button>
                )}

                {/* Bookmark Button */}
                {onBookmarkAdd && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white hover:bg-white/20"
                    onClick={handleAddBookmark}
                    aria-label="Add bookmark at current time"
                  >
                    <Bookmark className="size-5" />
                  </Button>
                )}

                {/* Captions Toggle - Only show if captions are available */}
                {captions && captions.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-11 text-white hover:bg-white/20',
                      captionsEnabled && 'bg-white/20'
                    )}
                    onClick={toggleCaptions}
                    aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
                  >
                    <Subtitles className="size-5" />
                  </Button>
                )}

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize className="size-5" />
                  ) : (
                    <Maximize className="size-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* Video Shortcuts Overlay */}
        <VideoShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </AspectRatio>

      {/* ARIA Live Region for Announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
