import { useRef, useEffect, useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RectangleHorizontal,
  Settings,
  Subtitles,
  Bookmark,
  SkipBack,
  SkipForward,
  PictureInPicture2,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { CaptionTrack, Chapter } from '@/data/types'
import { ChapterProgressBar } from './ChapterProgressBar'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
// Radix Popover Portal miscalculates position inside scroll containers — using plain CSS dropdown
import { cn } from '@/app/components/ui/utils'
import { VideoShortcutsOverlay } from '@/app/components/figma/VideoShortcutsOverlay'

interface VideoPlayerProps {
  src: string
  title?: string
  initialPosition?: number
  captions?: CaptionTrack[]
  chapters?: Chapter[]
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
  onPlayStateChange?: (isPlaying: boolean) => void
  theaterMode?: boolean
  onTheaterModeToggle?: () => void
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
  chapters,
  seekToTime,
  courseId: _courseId,
  lessonId: _lessonId,
  onTimeUpdate,
  onEnded,
  onSeekComplete,
  onBookmarkAdd,
  bookmarks,
  onBookmarkSeek,
  poster,
  onPlayStateChange,
  theaterMode,
  onTheaterModeToggle,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const announceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bookmarkFlashRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seekOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastTapRef = useRef<{ time: number; x: number } | null>(null)
  const touchActiveRef = useRef(false)

  const [justBookmarked, setJustBookmarked] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [, setBufferedRanges] = useState<Array<{ start: number; end: number }>>([])

  type SeekOverlayState = { direction: 'left' | 'right'; amount: number; id: number } | null
  const [seekOverlay, setSeekOverlay] = useState<SeekOverlayState>(null)

  const [showRemainingTime, setShowRemainingTime] = useState(false)
  const [isPiP, setIsPiP] = useState(false)

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

  // Reset position flag and error state when source changes
  useEffect(() => {
    hasRestoredPosition.current = false
    setHasError(false)
  }, [src])

  // PiP enter/leave listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnter = () => setIsPiP(true)
    const onLeave = () => setIsPiP(false)
    video.addEventListener('enterpictureinpicture', onEnter)
    video.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter)
      video.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [])

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
    onPlayStateChange?.(false)
    setShowControls(true)
    onEnded?.()
    announce('Video ended')
  }, [onEnded, onPlayStateChange])

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
        onPlayStateChange?.(false)
        announce('Paused')
      } else {
        videoRef.current.play()
        setIsPlaying(true)
        onPlayStateChange?.(true)
        announce('Playing')
      }
    }
  }, [isPlaying, onPlayStateChange])

  // Seek forward/backward
  const seek = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(
        0,
        Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds)
      )
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
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

  // ARIA announcement helper — clears after 3s so screen readers
  // have time to process and the next announcement triggers a fresh change
  const announce = useCallback((message: string) => {
    clearTimeout(announceTimeoutRef.current)
    setAnnouncement(message)
    announceTimeoutRef.current = setTimeout(() => setAnnouncement(''), 3000)
  }, [])

  // Buffering handlers (200ms debounce to avoid flicker on fast seeks)
  const handleWaiting = useCallback(() => {
    bufferingTimeoutRef.current = setTimeout(() => setIsBuffering(true), 200)
  }, [])
  const handleCanPlay = useCallback(() => {
    clearTimeout(bufferingTimeoutRef.current)
    setIsBuffering(false)
  }, [])

  // Buffered ranges (progress event)
  const handleProgress = useCallback(() => {
    if (!videoRef.current) return
    const ranges: Array<{ start: number; end: number }> = []
    for (let i = 0; i < videoRef.current.buffered.length; i++) {
      ranges.push({ start: videoRef.current.buffered.start(i), end: videoRef.current.buffered.end(i) })
    }
    setBufferedRanges(ranges)
  }, [])

  // Error handler
  const handleVideoError = useCallback(() => setHasError(true), [])

  // Seek with overlay animation
  const seekWithOverlay = useCallback((seconds: number) => {
    seek(seconds)
    const direction = seconds > 0 ? 'right' : 'left'
    clearTimeout(seekOverlayTimeoutRef.current)
    setSeekOverlay({ direction, amount: Math.abs(seconds), id: Date.now() })
    seekOverlayTimeoutRef.current = setTimeout(() => setSeekOverlay(null), 650)
  }, [seek])

  // Add bookmark at current timestamp
  const handleAddBookmark = useCallback(() => {
    if (onBookmarkAdd) {
      onBookmarkAdd(currentTime)
      announce(`Bookmark added at ${formatTime(currentTime)}`)
      // Brief visual feedback: flash the button yellow for 600ms
      clearTimeout(bookmarkFlashRef.current)
      setJustBookmarked(true)
      bookmarkFlashRef.current = setTimeout(() => setJustBookmarked(false), 600)
    }
  }, [onBookmarkAdd, currentTime, announce])

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

  // Keyboard shortcuts — YouTube-style: all shortcuts fire globally, regardless of player focus.
  // Only blocked when: user is typing in an input/textarea/contenteditable, modifier keys held
  // (Cmd/Ctrl/Alt — reserved for browser shortcuts), or a speed menu is open.
  // Exception: ArrowUp/Down (volume) still requires player focus to avoid hijacking page scroll.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip all shortcuts when browser modifier keys are held (e.g. Cmd+F, Ctrl+C)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Skip when the user is actively typing
      const active = document.activeElement as HTMLElement | null
      const isInputFocused =
        active !== null &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable)
      if (isInputFocused) return

      // Speed menu handles its own keyboard events via a separate capture-phase handler
      if (speedMenuOpen) return

      // When shortcuts overlay is open, only Escape closes it
      if (shortcutsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShortcutsOpen(false)
        }
        return
      }

      // ArrowUp/Down: volume control — only when player has focus, to avoid hijacking page scroll
      const isPlayerFocused = containerRef.current?.contains(document.activeElement)

      switch (e.key) {
        case 't':
          e.preventDefault()
          onTheaterModeToggle?.()
          break
        case ' ':
          // Don't intercept if a Slider thumb is focused — Slider handles Space natively
          if (document.activeElement?.getAttribute('role') === 'slider') return
          e.preventDefault()
          togglePlayPause()
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'k':
          e.preventDefault()
          togglePlayPause()
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'j':
          e.preventDefault()
          seekWithOverlay(-10)
          announce('Skipped back 10 seconds')
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'l':
          e.preventDefault()
          seekWithOverlay(10)
          announce('Skipped forward 10 seconds')
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekWithOverlay(-5)
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'ArrowRight':
          e.preventDefault()
          seekWithOverlay(5)
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'ArrowUp':
          if (!isPlayerFocused) break
          e.preventDefault()
          changeVolume(0.05)
          break
        case 'ArrowDown':
          if (!isPlayerFocused) break
          e.preventDefault()
          changeVolume(-0.05)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          containerRef.current?.focus({ preventScroll: true })
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
          containerRef.current?.focus({ preventScroll: true })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlayPause,
    announce,
    seekWithOverlay,
    changeVolume,
    toggleMute,
    toggleCaptions,
    toggleFullscreen,
    togglePiP,
    jumpToPercentage,
    speedMenuOpen,
    shortcutsOpen,
    handleAddBookmark,
    onTheaterModeToggle,
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

  // Touch-specific handler: always starts hide timeout + double-tap seek detection
  const handleTouchShow = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const now = Date.now()
    const lastTap = lastTapRef.current
    if (lastTap && (now - lastTap.time) < 300 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const relX = (touch.clientX - rect.left) / rect.width
      if (relX < 0.4) {
        seekWithOverlay(-10)
      } else if (relX > 0.6) {
        seekWithOverlay(10)
      }
      lastTapRef.current = null
      return
    }
    lastTapRef.current = { time: now, x: touch.clientX }

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
  }, [speedMenuOpen, shortcutsOpen, seekWithOverlay])

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimeoutRef.current)
      clearTimeout(announceTimeoutRef.current)
      clearTimeout(bookmarkFlashRef.current)
      clearTimeout(bufferingTimeoutRef.current)
      clearTimeout(seekOverlayTimeoutRef.current)
    }
  }, [])

  // When controls auto-hide, move focus to the container so keyboard shortcuts remain active
  useEffect(() => {
    if (!showControls && containerRef.current?.contains(document.activeElement)) {
      containerRef.current?.focus()
    }
  }, [showControls])

  // Handle progress bar change (percent 0–100)
  const handleProgressChange = useCallback(
    (percent: number) => {
      if (videoRef.current) {
        const newTime = (percent / 100) * duration
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
      className={cn(
        'relative w-full h-full overflow-hidden rounded-2xl bg-black group focus:outline-none',
        // Hide cursor when playing and controls auto-hide (YouTube-style)
        isPlaying && !showControls && 'cursor-none'
      )}
      onMouseDown={() => containerRef.current?.focus()}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && !speedMenuOpen && !shortcutsOpen && setShowControls(false)}
      onTouchStart={(e) => handleTouchShow(e)}
      tabIndex={0}
      role="region"
      aria-label={title || 'Video player'}
    >
      <div className="relative h-full">
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
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onPlaying={handleCanPlay}
          onProgress={handleProgress}
          onError={handleVideoError}
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

        {/* Error Overlay */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 z-10">
            <p className="text-sm">An error occurred. Please try again.</p>
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/40 hover:bg-white/10"
              onClick={() => { setHasError(false); videoRef.current?.load() }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Custom Controls Overlay */}
        <div
          data-testid="player-controls-overlay"
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-[opacity,visibility] duration-300 motion-reduce:transition-none',
            showControls ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'
          )}
          onTouchStart={(e) => handleTouchShow(e)}
          onClick={(e) => {
            // Toggle play/pause when clicking the canvas (not buttons, sliders, or controls bar)
            const target = e.target as HTMLElement
            if (target.closest('button') || target.closest('input') || target.closest('[data-controls]')) return
            togglePlayPause()
          }}
        >
          {/* Buffering Spinner */}
          {isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            </div>
          )}

          {/* Play/Pause Button Center */}
          {!isBuffering && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                className="relative pointer-events-auto focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 rounded-full outline-none"
                onClick={togglePlayPause}
                tabIndex={-1}
                aria-hidden="true"
              >
                <div className="absolute -inset-3 rounded-full bg-brand/50 blur-lg" />
                <span className="play-pulse-ring absolute inset-0 rounded-full bg-white/60" />
                <div className="relative rounded-full bg-white p-5 shadow-2xl">
                  <Play className="size-9 text-brand fill-brand translate-x-0.5" aria-hidden="true" />
                </div>
              </button>
            </div>
          )}
          {!isBuffering && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                className="relative pointer-events-auto focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 rounded-full outline-none"
                onClick={togglePlayPause}
                tabIndex={-1}
                aria-hidden="true"
              >
                <div className="absolute -inset-3 rounded-full bg-brand/50 blur-lg" />
                <div className="relative rounded-full bg-white p-5 shadow-2xl">
                  <Pause className="size-9 text-brand fill-brand" aria-hidden="true" />
                </div>
              </button>
            </div>
          )}

          {/* Seek Overlay */}
          {seekOverlay && (
            <>
              {seekOverlay.direction === 'left' && (
                <div key={seekOverlay.id} className="absolute left-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none animate-seek-flash">
                  <div className="rounded-full bg-white/20 p-4 flex flex-col items-center gap-1">
                    <ChevronLeft className="size-6 text-white" />
                    <span className="text-white text-xs font-medium">-{seekOverlay.amount}s</span>
                  </div>
                </div>
              )}
              {seekOverlay.direction === 'right' && (
                <div key={seekOverlay.id} className="absolute right-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none animate-seek-flash">
                  <div className="rounded-full bg-white/20 p-4 flex flex-col items-center gap-1">
                    <ChevronRight className="size-6 text-white" />
                    <span className="text-white text-xs font-medium">+{seekOverlay.amount}s</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Bottom Controls */}
          <div data-controls className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span data-testid="current-time" className="text-white text-xs font-medium min-w-[45px]">
                {formatTime(currentTime)}
              </span>
              <ChapterProgressBar
                progress={progress}
                duration={duration}
                chapters={chapters}
                bookmarks={bookmarks}
                onSeek={handleProgressChange}
                onBookmarkSeek={onBookmarkSeek}
              />
              <button
                className="text-white text-xs font-medium min-w-[45px] text-right hover:text-white/80 transition-colors cursor-pointer"
                onClick={() => setShowRemainingTime(prev => !prev)}
                aria-label="Toggle remaining time display"
              >
                {showRemainingTime
                  ? `-${formatTime(Math.max(0, duration - currentTime))}`
                  : formatTime(duration)}
              </button>
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
                <div
                  ref={mobileVolumeWrapperRef}
                  className="relative flex items-center gap-2"
                  onWheel={(e) => {
                    e.preventDefault()
                    changeVolume(e.deltaY < 0 ? 0.05 : -0.05)
                  }}
                >
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
                  <div className="group/volume w-20 hidden sm:block">
                    <Slider
                      value={[isMuted ? 0 : volume * 100]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      aria-label="Volume"
                      className={cn(
                        '[&_[data-slot=slider-track]]:!h-1 [&_[data-slot=slider-track]]:bg-white/30 [&_[data-slot=slider-track]]:transition-[height] [&_[data-slot=slider-track]]:duration-150',
                        'group-hover/volume:[&_[data-slot=slider-track]]:!h-3',
                        '[&_[data-slot=slider-range]]:bg-white',
                        '[&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border-white/50 [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]]:scale-0 [&_[data-slot=slider-thumb]]:transition-[opacity,transform] [&_[data-slot=slider-thumb]]:duration-150',
                        'group-hover/volume:[&_[data-slot=slider-thumb]]:opacity-100 group-hover/volume:[&_[data-slot=slider-thumb]]:scale-100',
                      )}
                    />
                  </div>

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
                        trackClassName="bg-white/30"
                        rangeClassName="bg-white"
                        thumbClassName="bg-white border-white"
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

                {/* Bookmark Button */}
                {onBookmarkAdd && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-11 text-white hover:bg-white/20 transition-colors duration-150',
                      justBookmarked && 'bg-yellow-500/30 text-yellow-300 hover:bg-yellow-500/40'
                    )}
                    onClick={handleAddBookmark}
                    aria-label="Add bookmark at current time"
                  >
                    {justBookmarked
                      ? <BookmarkCheck className="size-5" />
                      : <Bookmark className="size-5" />
                    }
                  </Button>
                )}

                {/* Captions Toggle - always visible; grayed out when no captions available */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-11 text-white hover:bg-white/20',
                    captionsEnabled && 'bg-white/20',
                    (!captions || captions.length === 0) && 'opacity-40 cursor-not-allowed'
                  )}
                  onClick={toggleCaptions}
                  disabled={!captions || captions.length === 0}
                  aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
                  aria-pressed={captionsEnabled}
                >
                  <Subtitles className="size-5" />
                </Button>

                {/* Theater Mode - desktop only (sidebar already hidden on mobile) */}
                {onTheaterModeToggle && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'hidden xl:flex size-11 text-white hover:bg-white/20',
                      theaterMode && 'bg-white/20'
                    )}
                    onClick={onTheaterModeToggle}
                    aria-label="Toggle theater mode"
                  >
                    <RectangleHorizontal className="size-5" />
                  </Button>
                )}

                {/* Picture-in-Picture */}
                {typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('size-11 text-white hover:bg-white/20', isPiP && 'bg-white/20')}
                    onClick={togglePiP}
                    aria-label={isPiP ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
                    aria-pressed={isPiP}
                  >
                    <PictureInPicture2 className="size-5" />
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
      </div>

      {/* ARIA Live Region for Announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
