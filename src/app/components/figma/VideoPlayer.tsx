import { useRef, useEffect, useCallback, useState } from 'react'
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
  Minus,
  Plus,
} from 'lucide-react'
import type { CaptionTrack } from '@/data/types'
import { AspectRatio } from '@/app/components/ui/aspect-ratio'
import { Button, buttonVariants } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
// Radix Popover Portal miscalculates position inside scroll containers — using plain CSS dropdown
import { cn } from '@/app/components/ui/utils'

interface VideoPlayerProps {
  src: string
  title?: string
  initialPosition?: number
  captions?: CaptionTrack[]
  seekToTime?: number
  courseId?: string
  lessonId?: string
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
  onSeekComplete?: () => void
  onBookmarkAdd?: (timestamp: number) => void
  onAutoComplete?: () => void
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const STORAGE_KEY_PLAYBACK_SPEED = 'video-playback-speed'
const STORAGE_KEY_CAPTIONS_ENABLED = 'video-captions-enabled'
const STORAGE_KEY_CAPTION_FONT_SIZE = 'video-caption-font-size'
const CAPTION_FONT_SIZES = [14, 16, 18, 20]
const COMPLETION_THRESHOLD = 0.95

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
  onAutoComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const speedMenuRef = useRef<HTMLDivElement>(null)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [announcement, setAnnouncement] = useState('')

  // Completion tracking — ref prevents re-rendering and re-firing
  const hasAutoCompleted = useRef(false)

  // Load saved playback speed from localStorage
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_SPEED)
    return saved ? parseFloat(saved) : 1
  })

  // Track whether speed menu is open (prevents controls auto-hide)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const speedButtonRef = useRef<HTMLButtonElement>(null)
  const speedMenuItemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const [focusedSpeedIndex, setFocusedSpeedIndex] = useState(0)

  // Load saved caption preference from localStorage
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTIONS_ENABLED)
    return saved === 'true'
  })

  // Caption font size (14-20pt, persisted to localStorage)
  const [captionFontSize, setCaptionFontSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTION_FONT_SIZE)
    return saved ? parseInt(saved, 10) : 18
  })

  // Reset position flag when source changes
  useEffect(() => {
    hasRestoredPosition.current = false
    hasAutoCompleted.current = false
  }, [src])

  // Apply playback speed to video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Dynamic <style> injection for ::cue font size (CSS custom properties don't inherit into ::cue)
  useEffect(() => {
    const styleEl = document.createElement('style')
    document.head.appendChild(styleEl)
    styleEl.textContent = `video::cue { font-size: ${captionFontSize / 16}rem; }`
    return () => { styleEl.remove() }
  }, [captionFontSize])

  // Close speed menu on click outside
  useEffect(() => {
    if (!speedMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!speedMenuRef.current?.contains(e.target as Node)) {
        setSpeedMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [speedMenuOpen])

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

      // Check if 95% threshold has been reached
      if (
        videoRef.current.duration > 0 &&
        time / videoRef.current.duration >= COMPLETION_THRESHOLD &&
        !hasAutoCompleted.current
      ) {
        hasAutoCompleted.current = true
        onAutoComplete?.()
      }
    }
  }, [onTimeUpdate, onAutoComplete])

  // Handle video ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false)
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

  // Change caption font size
  const changeCaptionFontSize = useCallback((delta: number) => {
    setCaptionFontSize(prev => {
      const rawIdx = CAPTION_FONT_SIZES.indexOf(prev)
      const currentIdx = rawIdx >= 0 ? rawIdx : CAPTION_FONT_SIZES.indexOf(18)
      const newIdx = Math.max(0, Math.min(CAPTION_FONT_SIZES.length - 1, currentIdx + delta))
      const newSize = CAPTION_FONT_SIZES[newIdx]
      localStorage.setItem(STORAGE_KEY_CAPTION_FONT_SIZE, newSize.toString())
      announce(`Caption font size ${newSize}pt`)
      return newSize
    })
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
    clearTimeout(announceTimerRef.current)
    announceTimerRef.current = setTimeout(() => setAnnouncement(''), 1000)
  }, [])

  // Add bookmark at current timestamp
  const handleAddBookmark = useCallback(() => {
    if (onBookmarkAdd) {
      onBookmarkAdd(currentTime)
      announce(`Bookmark added at ${formatTime(currentTime)}`)
    }
  }, [onBookmarkAdd, currentTime])

  // Focus speed menu items when index changes
  useEffect(() => {
    if (speedMenuOpen) {
      speedMenuItemsRef.current[focusedSpeedIndex]?.focus()
    }
  }, [focusedSpeedIndex, speedMenuOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if video player is in focus or controls are visible
      if (!containerRef.current?.contains(document.activeElement)) return

      // Speed menu keyboard navigation
      if (speedMenuOpen) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setFocusedSpeedIndex(prev => Math.min(PLAYBACK_SPEEDS.length - 1, prev + 1))
            return
          case 'ArrowUp':
            e.preventDefault()
            setFocusedSpeedIndex(prev => Math.max(0, prev - 1))
            return
          case 'Enter':
          case ' ':
            e.preventDefault()
            changePlaybackSpeed(PLAYBACK_SPEEDS[focusedSpeedIndex])
            setSpeedMenuOpen(false)
            requestAnimationFrame(() => speedButtonRef.current?.focus())
            return
          case 'Escape':
            e.preventDefault()
            setSpeedMenuOpen(false)
            requestAnimationFrame(() => speedButtonRef.current?.focus())
            return
        }
      }

      switch (e.key) {
        case ' ':
          // Don't toggle play/pause if a Slider thumb has focus — let Slider handle Space natively
          if (document.activeElement?.getAttribute('role') === 'slider') return
          // fall through to 'k'
        // eslint-disable-next-line no-fallthrough
        case 'k':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(e.shiftKey ? -10 : -5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(e.shiftKey ? 10 : 5)
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
    changeVolume,
    toggleMute,
    toggleCaptions,
    toggleFullscreen,
    jumpToPercentage,
    speedMenuOpen,
    focusedSpeedIndex,
    changePlaybackSpeed,
  ])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying && !speedMenuOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying, speedMenuOpen])

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimeoutRef.current)
      clearTimeout(announceTimerRef.current)
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
      className="relative w-full overflow-hidden rounded-2xl bg-black group"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && !speedMenuOpen && setShowControls(false)}
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
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300',
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Play/Pause Button Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-16 w-16 rounded-full bg-black/50 hover:bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-white"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-white text-xs font-medium min-w-[45px]" data-testid="current-time">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[progress]}
                onValueChange={handleProgressChange}
                max={100}
                step={0.1}
                className="flex-1"
                aria-label="Video progress"
              />
              <span className="text-white text-xs font-medium min-w-[45px] text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-y-1">
              <div className="flex items-center gap-1">
                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className="w-20 hidden sm:block"
                    aria-label="Volume"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Playback Speed */}
                <div className="relative" ref={speedMenuRef}>
                  <button
                    ref={speedButtonRef}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'sm' }),
                      'h-11 px-3 text-white hover:bg-white/20 text-xs font-medium focus-visible:ring-2 focus-visible:ring-white'
                    )}
                    aria-label="Playback speed"
                    aria-haspopup="menu"
                    aria-expanded={speedMenuOpen}
                    onClick={() => {
                      const opening = !speedMenuOpen
                      setSpeedMenuOpen(opening)
                      if (opening) {
                        const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
                        setFocusedSpeedIndex(idx >= 0 ? idx : 2)
                      }
                    }}
                  >
                    <Settings className="size-4 mr-1" />
                    {playbackSpeed}x
                  </button>
                  {speedMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Playback speed"
                      className="absolute bottom-full right-0 mb-2 w-32 rounded-md border bg-popover p-2 shadow-md z-50"
                    >
                      <p className="text-xs font-semibold mb-2">Speed</p>
                      {PLAYBACK_SPEEDS.map((speed, i) => (
                        <button
                          key={speed}
                          ref={el => { speedMenuItemsRef.current[i] = el }}
                          role="menuitem"
                          tabIndex={focusedSpeedIndex === i ? 0 : -1}
                          aria-current={speed === playbackSpeed ? true : undefined}
                          onClick={() => {
                            changePlaybackSpeed(speed)
                            setSpeedMenuOpen(false)
                            requestAnimationFrame(() => speedButtonRef.current?.focus())
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

                {/* Bookmark Button */}
                {onBookmarkAdd && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                    onClick={handleAddBookmark}
                    aria-label="Add bookmark at current time"
                  >
                    <Bookmark className="size-4" />
                  </Button>
                )}

                {/* Captions Toggle - Only show if captions are available */}
                {captions && captions.length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-11 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white',
                        captionsEnabled && 'bg-white/20'
                      )}
                      onClick={toggleCaptions}
                      aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
                      aria-pressed={captionsEnabled}
                    >
                      <Subtitles className="size-4" />
                    </Button>

                    {/* Caption Font Size Controls */}
                    {captionsEnabled && (
                      <div className="flex items-center gap-0.5" data-testid="caption-font-size">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                          onClick={() => changeCaptionFontSize(-1)}
                          aria-label="Decrease caption font size"
                          disabled={captionFontSize <= CAPTION_FONT_SIZES[0]}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="text-white text-[10px] font-medium min-w-[28px] text-center">
                          {captionFontSize}pt
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                          onClick={() => changeCaptionFontSize(1)}
                          aria-label="Increase caption font size"
                          disabled={captionFontSize >= CAPTION_FONT_SIZES[CAPTION_FONT_SIZES.length - 1]}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize className="size-4" />
                  ) : (
                    <Maximize className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AspectRatio>

      {/* ARIA Live Region for Announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
