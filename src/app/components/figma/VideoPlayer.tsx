import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RectangleHorizontal,
  Settings,
  Settings2,
  Subtitles,
  Bookmark,
  SkipBack,
  SkipForward,
  PictureInPicture2,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Repeat,
  X,
} from 'lucide-react'
import type { CaptionTrack, Chapter } from '@/data/types'
import { ChapterProgressBar } from './ChapterProgressBar'
import type { StoryboardProp } from './ScrubPreview'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Slider } from '@/app/components/ui/slider'
import { cn } from '@/app/components/ui/utils'
import { VideoShortcutsOverlay } from '@/app/components/figma/VideoShortcutsOverlay'
import { formatTimestamp as formatTime } from '@/lib/format'
// ── Video seek diagnostics ────────────────────────────────────────────────
// Controlled by VITE_VIDEO_DIAGNOSTICS env var (set to 'true' to enable).
// Logs structured [VideoSeek] events for diagnosing Range/206 issues.

const VIDEO_DIAGNOSTICS = import.meta.env.VITE_VIDEO_DIAGNOSTICS === 'true'

/** Serialize TimeRanges to an array of {start, end} objects for logging. */
function formatTimeRanges(r: TimeRanges): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = []
  for (let i = 0; i < r.length; i++) {
    out.push({ start: r.start(i), end: r.end(i) })
  }
  return out
}

function videoDiag(label: string, detail?: Record<string, unknown>) {
  if (!VIDEO_DIAGNOSTICS) return
  if (detail) {
    console.info(`[VideoSeek] ${label}`, detail)
  } else {
    console.info(`[VideoSeek] ${label}`)
  }
}

interface VideoPlayerProps {
  src: string
  title?: string
  initialPosition?: number
  captions?: CaptionTrack[]
  chapters?: Chapter[]
  seekToTime?: number
  poster?: string
  onTimeUpdate?: (currentTime: number) => void
  /** Called when the video metadata loads and duration is known. */
  onDurationChange?: (duration: number) => void
  onEnded?: () => void
  onSeekComplete?: () => void
  onBookmarkAdd?: (timestamp: number) => void
  bookmarks?: Array<{ id: string; timestamp: number; label: string }>
  onBookmarkSeek?: (timestamp: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
  theaterMode?: boolean
  onTheaterModeToggle?: () => void
  onLoadCaptions?: (file: File) => void
  onFocusNotes?: () => void
  /**
   * Called when a network/media error occurs that requires source regeneration.
   * Receives the current playback time so the caller can restore position on
   * the new blob URL. Used together with retryKey in useVideoFromHandle.
   */
  onRecoveryNeeded?: (currentTime: number) => void
  /**
   * When true, autoplay the video as soon as it can play — preferring
   * audio-on. Used for preview surfaces (e.g. the course card preview
   * dialog) where the user initiated playback via a prior click gesture.
   * Browsers may block unmuted autoplay if the gesture token is stale;
   * we catch that rejection and retry muted so the preview still plays.
   * The isMuted state stays in sync with the actual fallback path.
   */
  autoplay?: boolean
  /** Storyboard sprite sheet for instant scrub previews (optional) */
  storyboard?: StoryboardProp
  /**
   * When true, renders the recovery spinner overlay over the video element.
   * Used by LocalVideoContent to persist the spinner across VideoPlayer
   * mount/unmount during blob URL regeneration. Internal state is insufficient
   * because the recovery flow un-mounts VideoPlayer while the new blob URL loads.
   */
  showRecoveryOverlay?: boolean
  /** When true, a storyboard is being generated — scrub preview shows a loading spinner. */
  storyboardLoading?: boolean
  /** When true, storyboard generation previously failed — scrub preview shows compact timestamp only. */
  storyboardFailed?: boolean
}

export interface VideoPlayerHandle {
  /** Returns the underlying <video> element for canvas capture */
  getVideoElement: () => HTMLVideoElement | null
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const STORAGE_KEY_PLAYBACK_SPEED = 'video-playback-speed'
const STORAGE_KEY_CAPTIONS_ENABLED = 'video-captions-enabled'
const STORAGE_KEY_CAPTION_FONT_SIZE = 'video-caption-font-size'
const STORAGE_KEY_CAPTION_BG_OPACITY = 'video-caption-bg-opacity'

type CaptionFontSize = 'small' | 'medium' | 'large'
const CAPTION_FONT_SIZE_MAP: Record<CaptionFontSize, string> = {
  small: '14px',
  medium: '18px',
  large: '24px',
}
const CAPTION_FONT_SIZE_OPTIONS: { value: CaptionFontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const ERROR_MESSAGES: Record<number, string> = {
  1: 'An error occurred. Please try again.',
  2: 'Playback interrupted — the video source became unavailable. This can happen when the file connection is lost. Retrying will attempt to reload the video.',
  3: 'Playback error — the video file may be corrupted or in an unsupported format.',
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    title,
    initialPosition,
    captions,
    chapters,
    seekToTime,
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
    onLoadCaptions,
    onFocusNotes,
    onDurationChange,
    onRecoveryNeeded,
    autoplay = false,
    storyboard,
    showRecoveryOverlay = false,
    storyboardLoading = false,
    storyboardFailed = false,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)
  const hasRestoredPosition = useRef(false)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const announceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bookmarkFlashRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seekOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastTapRef = useRef<{ time: number; x: number } | null>(null)
  const touchActiveRef = useRef(false)
  // Captures the error-time currentTime so the manual Retry button (error overlay)
  // can seek back to the exact position after videoRef.current?.load() resets the element.
  // handleLoadedMetadata reads and clears this ref.
  const retryPositionRef = useRef<number | null>(null)
  // Guard against infinite decode-error → skip → error loops.
  // Reset on src change so each new source gets a fresh skip budget.
  const decodeSkipAttemptRef = useRef(0)
  // Tracks the last user-requested seek target time (seconds).
  // Set by handleProgressChange / seek / jumpToPercentage; cleared on seeked.
  const pendingSeekRef = useRef<number | null>(null)
  // Captures whether the video was playing before a seek started, so seeked
  // can resume playback if it was interrupted.
  const wasPlayingBeforeSeekRef = useRef(false)
  // Monotonically increasing counter for external seek requests (seekToTime).
  // Prevents stale effect re-fires from re-applying an old seek target.
  const seekToTimeRequestIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }))

  const [justBookmarked, setJustBookmarked] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [bufferedRanges, setBufferedRanges] = useState<Array<{ start: number; end: number }>>([])

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

  // Load saved playback speed from localStorage (validated against allowed values)
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_SPEED)
    if (!saved) return 1
    const parsed = parseFloat(saved)
    return PLAYBACK_SPEEDS.includes(parsed) ? parsed : 1
  })

  // Track whether speed menu is open (prevents controls auto-hide)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)

  // Mobile volume popover state
  const [mobileVolumeOpen, setMobileVolumeOpen] = useState(false)

  // Video shortcuts overlay state
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const mobileVolumeWrapperRef = useRef<HTMLDivElement>(null)

  // Load saved caption preference from localStorage
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTIONS_ENABLED)
    return saved === 'true'
  })

  // Caption customization settings (persisted to localStorage)
  const [captionFontSize, setCaptionFontSize] = useState<CaptionFontSize>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTION_FONT_SIZE)
    if (saved && saved in CAPTION_FONT_SIZE_MAP) return saved as CaptionFontSize
    return 'medium'
  })
  const [captionBgOpacity, setCaptionBgOpacity] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CAPTION_BG_OPACITY)
    if (saved !== null) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed
    }
    return 80
  })
  const [captionSettingsOpen, setCaptionSettingsOpen] = useState(false)

  // AB-loop: dual ref+state pattern.
  // Refs are read inside handleTimeUpdate (avoids stale closure in video event handler).
  // State drives UI rendering.
  const loopStartRef = useRef<number | null>(null)
  const loopEndRef = useRef<number | null>(null)
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)

  // Reset position flag, error state, recovery state, seek state, and loop markers when source changes
  useEffect(() => {
    hasRestoredPosition.current = false
    setHasError(false)
    setErrorCode(null)
    retryPositionRef.current = null
    decodeSkipAttemptRef.current = 0
    pendingSeekRef.current = null
    wasPlayingBeforeSeekRef.current = false
    seekToTimeRequestIdRef.current = 0
    // Clear loop state so stale markers don't persist across lessons
    loopStartRef.current = null
    loopEndRef.current = null
    setLoopStart(null)
    setLoopEnd(null)
  }, [src])

  // Autoplay when the caller opts in (preview dialogs). Try unmuted first
  // — the click that opened the dialog is a user gesture, so browsers
  // usually allow audible playback. If the browser rejects (gesture token
  // stale due to blob-load delay), fall back to muted autoplay. State is
  // kept in sync with whichever path succeeded so the volume icon renders
  // correctly and a single Unmute tap actually unmutes.
  useEffect(() => {
    if (!autoplay) return
    const video = videoRef.current
    if (!video) return
    video.muted = false
    setIsMuted(false)
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Audible autoplay blocked — retry muted so the preview still plays.
        video.muted = true
        setIsMuted(true)
        video.play().catch(() => {
          // silent-catch-ok: both paths blocked — user can click Play
        })
      })
    }
  }, [autoplay, src])

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

  // Handle external seek requests from timestamp links.
  // Uses a monotonic request ID to treat seekToTime as an event, not persistent state.
  // Prevents re-application on rerenders when seekToTime hasn't changed.
  useEffect(() => {
    if (seekToTime === undefined || !videoRef.current) return

    let ignore = false
    const requestId = ++seekToTimeRequestIdRef.current
    const target = seekToTime

    // Set pending seek so the seeked handler can verify position
    if (!videoRef.current) return
    pendingSeekRef.current = target
    wasPlayingBeforeSeekRef.current = !videoRef.current.paused
    videoRef.current.currentTime = target
    setCurrentTime(target)

    videoDiag('seekToTime', { target, requestId })

    // In the next microtask, verify this request wasn't superseded.
    // If a newer request arrived, skip onSeekComplete for this stale one.
    Promise.resolve().then(() => {
      if (!ignore && seekToTimeRequestIdRef.current === requestId) {
        onSeekComplete?.()
      }
    })

    return () => {
      ignore = true
    }
  }, [seekToTime, onSeekComplete])

  // Restore initial position and report duration
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration
      setDuration(dur)
      onDurationChange?.(dur)
      videoDiag('loadedmetadata', {
        duration: dur,
        initialPosition,
        hasRestoredPosition: hasRestoredPosition.current,
        retryPosition: retryPositionRef.current,
      })
      // F002: Manual Retry position takes precedence — seek back to error-time position
      if (retryPositionRef.current !== null) {
        videoRef.current.currentTime = retryPositionRef.current
        retryPositionRef.current = null
        hasRestoredPosition.current = true
      } else if (initialPosition && !hasRestoredPosition.current) {
        videoRef.current.currentTime = initialPosition
        hasRestoredPosition.current = true
      }
    }
  }

  // Handle time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)
      // AB-loop enforcement: seek back to A when video reaches B
      const a = loopStartRef.current
      const b = loopEndRef.current
      if (a !== null && b !== null && time >= b) {
        videoRef.current.currentTime = a
      }
    }
  }

  // ── Seek lifecycle diagnostics ────────────────────────────────────────

  const handleSeeking = () => {
    if (!VIDEO_DIAGNOSTICS) return
    const v = videoRef.current
    if (!v) return
    videoDiag('seeking', {
      currentTime: v.currentTime,
      pendingSeek: pendingSeekRef.current,
      readyState: v.readyState,
      networkState: v.networkState,
    })
  }

  const handleSeeked = () => {
    const v = videoRef.current
    if (!v) return
    const pending = pendingSeekRef.current
    const currentTimeAfter = v.currentTime

    videoDiag('seeked', {
      requestedTime: pending,
      currentTimeAfter: currentTimeAfter,
      duration: v.duration,
      readyState: v.readyState,
      networkState: v.networkState,
      seekable: v.seekable.length > 0 ? formatTimeRanges(v.seekable) : [],
      buffered: v.buffered.length > 0 ? formatTimeRanges(v.buffered) : [],
    })

    // Verify seek completed to the requested position
    if (pending !== null) {
      const gap = Math.abs(currentTimeAfter - pending)
      if (gap > 0.5 && pending > 0) {
        console.warn(
          `[VideoSeek] Seek position mismatch: requested=${pending.toFixed(1)}s actual=${currentTimeAfter.toFixed(1)}s gap=${gap.toFixed(1)}s`
        )
      }
      pendingSeekRef.current = null
      // Resume playback if it was playing before the seek
      if (wasPlayingBeforeSeekRef.current && v.paused) {
        v.play().catch(() => {
          // silent-catch-ok: browser may block autoplay
        })
      }
      wasPlayingBeforeSeekRef.current = false
    }
  }

  const handleStalled = () => {
    const v = videoRef.current
    if (!v) return
    videoDiag('stalled', {
      currentTime: v.currentTime,
      buffered: v.buffered.length > 0 ? formatTimeRanges(v.buffered) : [],
      readyState: v.readyState,
    })
  }

  const handleSuspend = () => {
    videoDiag('suspend')
  }

  const handleEmptied = () => {
    videoDiag('emptied', {
      pendingSeek: pendingSeekRef.current,
      currentTime: videoRef.current?.currentTime,
    })
  }

  const handleAbort = () => {
    videoDiag('abort', {
      currentTime: videoRef.current?.currentTime,
      pendingSeek: pendingSeekRef.current,
    })
  }

  // Handle video ended
  const handleEnded = () => {
    setIsPlaying(false)
    onPlayStateChange?.(false)
    setShowControls(true)
    onEnded?.()
    announce('Video ended')
  }

  // Play/Pause toggle
  const togglePlayPause = () => {
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
  }

  // Seek forward/backward
  const seek = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(
        0,
        Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds)
      )
      pendingSeekRef.current = newTime
      wasPlayingBeforeSeekRef.current = !videoRef.current.paused

      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  // Change volume
  const changeVolume = (delta: number) => {
    if (videoRef.current) {
      const newVolume = Math.max(0, Math.min(1, volume + delta))
      setVolume(newVolume)
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
      announce(`Volume ${Math.round(newVolume * 100)}%`)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted
      setIsMuted(newMuted)
      videoRef.current.muted = newMuted
      announce(newMuted ? 'Muted' : 'Unmuted')
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          /* silent-catch-ok: fullscreen may be rejected by browser policy */
        })
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          /* silent-catch-ok: exit fullscreen may be rejected */
        })
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Handle caption file input change
  const handleCaptionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onLoadCaptions) {
      onLoadCaptions(file)
    }
    // Reset input so the same file can be re-selected
    if (captionInputRef.current) {
      captionInputRef.current.value = ''
    }
  }

  // Toggle captions or open file picker
  const toggleCaptions = () => {
    // If no captions loaded but onLoadCaptions is available, open file picker
    if ((!captions || captions.length === 0) && onLoadCaptions) {
      captionInputRef.current?.click()
      return
    }
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
  }

  // Caption customization handlers
  const handleCaptionFontSizeChange = (size: CaptionFontSize) => {
    setCaptionFontSize(size)
    localStorage.setItem(STORAGE_KEY_CAPTION_FONT_SIZE, size)
  }

  const handleCaptionBgOpacityChange = (values: number[]) => {
    const opacity = values[0]
    setCaptionBgOpacity(opacity)
    localStorage.setItem(STORAGE_KEY_CAPTION_BG_OPACITY, String(opacity))
  }

  // Change playback speed
  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed)
    localStorage.setItem(STORAGE_KEY_PLAYBACK_SPEED, speed.toString())
    announce(`Speed changed to ${speed}x`)
  }

  // Step playback speed up/down through PLAYBACK_SPEEDS list (</>  keyboard shortcuts)
  const stepPlaybackSpeed = (direction: 'up' | 'down') => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)

    // Guard: if current speed is not in the list (corrupted localStorage), snap to nearest
    if (currentIndex === -1) {
      const nearest = PLAYBACK_SPEEDS.reduce((prev, curr) =>
        Math.abs(curr - playbackSpeed) < Math.abs(prev - playbackSpeed) ? curr : prev
      )
      changePlaybackSpeed(nearest)
      return
    }

    if (direction === 'up') {
      if (currentIndex >= PLAYBACK_SPEEDS.length - 1) {
        announce('Already at maximum speed')
        return
      }
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex + 1])
    } else {
      if (currentIndex <= 0) {
        announce('Already at minimum speed')
        return
      }
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex - 1])
    }
  }

  // Jump to percentage
  const jumpToPercentage = (percentage: number) => {
    if (videoRef.current) {
      const newTime = (percentage / 100) * videoRef.current.duration
      pendingSeekRef.current = newTime
      wasPlayingBeforeSeekRef.current = !videoRef.current.paused

      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
      announce(`Jumped to ${percentage}%`)
    }
  }

  // ARIA announcement helper — clears after 3s so screen readers
  // have time to process and the next announcement triggers a fresh change
  const announce = useCallback((message: string) => {
    clearTimeout(announceTimeoutRef.current)
    setAnnouncement(message)
    announceTimeoutRef.current = setTimeout(() => setAnnouncement(''), 3000)
  }, [])

  // Buffering handlers (200ms debounce to avoid flicker on fast seeks)
  const handleWaiting = () => {
    bufferingTimeoutRef.current = setTimeout(() => setIsBuffering(true), 200)
    videoDiag('waiting', {
      currentTime: videoRef.current?.currentTime,
      pendingSeek: pendingSeekRef.current,
      readyState: videoRef.current?.readyState,
    })
  }
  const handleCanPlay = () => {
    clearTimeout(bufferingTimeoutRef.current)
    setIsBuffering(false)
    videoDiag('canplay', {
      currentTime: videoRef.current?.currentTime,
      pendingSeek: pendingSeekRef.current,
    })
  }

  // Buffered ranges (progress event)
  const handleProgress = () => {
    if (!videoRef.current) return
    const ranges: Array<{ start: number; end: number }> = []
    for (let i = 0; i < videoRef.current.buffered.length; i++) {
      ranges.push({
        start: videoRef.current.buffered.start(i),
        end: videoRef.current.buffered.end(i),
      })
    }
    setBufferedRanges(ranges)
  }

  // Error handler with type detection
  const handleVideoError = () => {
    const video = videoRef.current
    const code = video?.error?.code ?? null
    // Prefer the pending seek target over video.currentTime when a seek was in
    // flight. During a network error the browser never received the new byte range,
    // so video.currentTime still reflects the previous position — but the user
    // explicitly requested pendingSeekRef. Using the stale value causes recovery
    // to restore the wrong position (old position instead of intended seek target).
    const currentPos = pendingSeekRef.current ?? video?.currentTime ?? 0
    const dur = video?.duration ?? 0
    const bufferedEnd =
      video && video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0

    // Diagnostic log: capture error context for root-cause analysis.
    // Includes estimated byte-offset for correlating with file corruption.
    const codeLabel =
      code === 1
        ? 'MEDIA_ERR_ABORTED'
        : code === 2
          ? 'MEDIA_ERR_NETWORK'
          : code === 3
            ? 'MEDIA_ERR_DECODE'
            : code === 4
              ? 'MEDIA_ERR_SRC_NOT_SUPPORTED'
              : `UNKNOWN(${code})`
    console.warn(
      `[VideoPlayer] ${codeLabel} | file="${title ?? 'unknown'}" | ` +
        `currentTime=${currentPos.toFixed(1)}s | duration=${dur.toFixed(1)}s | ` +
        `bufferedEnd=${bufferedEnd.toFixed(1)}s | pendingSeek=${pendingSeekRef.current ?? 'none'} | ` +
        `src=${src?.substring(0, 60)}...`
    )

    // MEDIA_ERR_DECODE (code 3): source file corruption at a specific byte offset.
    // Blob URL regeneration won't fix this — the corruption is in the file itself.
    // Try skipping past the bad frame before escalating to full recovery.
    if (code === 3) {
      if (decodeSkipAttemptRef.current >= 3) {
        console.warn(
          '[VideoPlayer] MEDIA_ERR_DECODE: 3 skip attempts exhausted — showing error overlay'
        )
        setErrorCode(code)
        setHasError(true)
        return
      }
      decodeSkipAttemptRef.current++
      // Use the larger of error-time position and buffered end as the skip origin.
      // Chromium may reset currentTime to 0 during a decode error, but buffered
      // ranges often still reflect the actual playback position.
      const skipOrigin = Math.max(currentPos, bufferedEnd, 0)
      const skipTo = skipOrigin + 2 * decodeSkipAttemptRef.current
      if (isFinite(skipTo) && dur > 0 && skipTo < dur - 0.5) {
        console.warn(
          `[VideoPlayer] MEDIA_ERR_DECODE: attempt ${decodeSkipAttemptRef.current}/3 — ` +
            `skipping from ${skipOrigin.toFixed(1)}s to ${skipTo.toFixed(1)}s`
        )
        video!.currentTime = skipTo
        return
      }
      // Can't skip further — show error overlay
      console.warn(
        '[VideoPlayer] MEDIA_ERR_DECODE: cannot skip past (near end of video) — showing error overlay'
      )
      setErrorCode(code)
      setHasError(true)
      return
    }

    // MEDIA_ERR_NETWORK (code 2): blob URL may have become invalid (SMB hiccup,
    // permission expiry, etc.). Automatic recovery regenerates the blob URL.
    if (code === 2 && onRecoveryNeeded) {
      // F013: Guard against NaN/Infinity before dispatching recovery
      if (!isFinite(currentPos)) {
        console.warn('[VideoPlayer] Invalid recovery position; showing error overlay instead')
        setErrorCode(code)
        setHasError(true)
        return
      }
      setIsPlaying(false)
      onRecoveryNeeded(currentPos)
      return // Skip error overlay — auto-recovery regenerates the blob URL
    }

    // All other errors (or code 2 without onRecoveryNeeded): show error overlay
    setErrorCode(code)
    setHasError(true)
  }

  // Seek with overlay animation
  const seekWithOverlay = (seconds: number) => {
    seek(seconds)
    const direction = seconds > 0 ? 'right' : 'left'
    clearTimeout(seekOverlayTimeoutRef.current)
    setSeekOverlay({ direction, amount: Math.abs(seconds), id: Date.now() })
    seekOverlayTimeoutRef.current = setTimeout(() => setSeekOverlay(null), 650)
  }

  // Add bookmark at current timestamp
  const handleAddBookmark = () => {
    if (onBookmarkAdd) {
      onBookmarkAdd(currentTime)
      announce(`Bookmark added at ${formatTime(currentTime)}`)
      // Brief visual feedback: flash the button yellow for 600ms
      clearTimeout(bookmarkFlashRef.current)
      setJustBookmarked(true)
      bookmarkFlashRef.current = setTimeout(() => setJustBookmarked(false), 600)
    }
  }

  // AB-loop: set loop start (A point) at current time.
  // Clamps to duration to prevent markers beyond the video length.
  // If both A and B are already set (third press), clears both and re-sets A.
  const setLoopA = () => {
    if (!videoRef.current) return
    // Third-press re-set: if both markers exist, clear them first
    if (loopStartRef.current !== null && loopEndRef.current !== null) {
      loopEndRef.current = null
      setLoopEnd(null)
    }
    const time = Math.min(videoRef.current.currentTime, videoRef.current.duration)
    loopStartRef.current = time
    setLoopStart(time)
    announce(`Loop start set at ${formatTime(time)}`)
  }

  // AB-loop: set loop end (B point) at current time.
  // Auto-swaps A and B if the new B point is before A.
  const setLoopB = () => {
    if (!videoRef.current) return
    const time = Math.min(videoRef.current.currentTime, videoRef.current.duration)
    const a = loopStartRef.current
    if (a !== null && time <= a) {
      // User set B before A — swap so A is always earlier
      loopStartRef.current = time
      loopEndRef.current = a
      setLoopStart(time)
      setLoopEnd(a)
    } else {
      loopEndRef.current = time
      setLoopEnd(time)
    }
    const activeA = loopStartRef.current ?? 0
    announce(`Loop active: ${formatTime(activeA)} to ${formatTime(loopEndRef.current ?? 0)}`)
  }

  // AB-loop: clear all loop markers
  const clearLoop = () => {
    loopStartRef.current = null
    loopEndRef.current = null
    setLoopStart(null)
    setLoopEnd(null)
    announce('Loop cleared')
  }

  // Toggle Picture-in-Picture
  const togglePiP = async () => {
    if (!videoRef.current) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {
      // silent-catch-ok: error logged to console
      announce('Picture-in-Picture not available')
    }
  }

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

  // Click-outside handler for mobile volume popover (M1)
  useEffect(() => {
    if (!mobileVolumeOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mobileVolumeWrapperRef.current &&
        !mobileVolumeWrapperRef.current.contains(e.target as Node)
      ) {
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

      // Speed menu / caption settings handle their own keyboard events
      if (speedMenuOpen || captionSettingsOpen) return

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
        case 'a':
          // AB-loop: first press sets A, second sets B, third re-sets A (clearing B)
          e.preventDefault()
          if (loopStartRef.current === null) {
            setLoopA()
          } else if (loopEndRef.current === null) {
            setLoopB()
          } else {
            // Third press: re-set — setLoopA handles clearing B internally
            setLoopA()
          }
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'Escape':
          // Clear loop if any markers are set (shortcuts overlay is already handled above)
          if (loopStartRef.current !== null || loopEndRef.current !== null) {
            e.preventDefault()
            clearLoop()
          } else if (theaterMode && onTheaterModeToggle) {
            // Exit theater mode via ESC when no loop markers active
            e.preventDefault()
            onTheaterModeToggle()
          }
          break
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
        case '<':
          e.preventDefault()
          stepPlaybackSpeed('down')
          containerRef.current?.focus({ preventScroll: true })
          break
        case '>':
          e.preventDefault()
          stepPlaybackSpeed('up')
          containerRef.current?.focus({ preventScroll: true })
          break
        case 'n':
          e.preventDefault()
          onFocusNotes?.()
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
    captionSettingsOpen,
    handleAddBookmark,
    onTheaterModeToggle,
    setLoopA,
    setLoopB,
    clearLoop,
    stepPlaybackSpeed,
    onFocusNotes,
  ])

  // Auto-hide controls (mouse interaction — only hides when playing)
  const resetControlsTimeout = () => {
    // Skip synthesized mouse events that follow touch events on mobile
    if (touchActiveRef.current) return
    setShowControls(true)
    if (isPlaying && !speedMenuOpen && !shortcutsOpen && !captionSettingsOpen) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  // Touch-specific handler: always starts hide timeout + double-tap seek detection
  const handleTouchShow = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const now = Date.now()
    const lastTap = lastTapRef.current
    if (lastTap && now - lastTap.time < 300 && containerRef.current) {
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
    setTimeout(() => {
      touchActiveRef.current = false
    }, 500)

    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (!speedMenuOpen && !shortcutsOpen && !captionSettingsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimeoutRef.current)
      clearTimeout(announceTimeoutRef.current)
      clearTimeout(bookmarkFlashRef.current)
      clearTimeout(bufferingTimeoutRef.current)
      clearTimeout(seekOverlayTimeoutRef.current)
    }
  }, [])

  // Auto-hide controls when playback starts without a mouse interaction.
  // resetControlsTimeout only arms the 3s hide-timer from mouse/touch/focus
  // events — so programmatic play() (e.g. autoplay when a preview modal
  // opens) previously left controls visible forever. Mirror the same guards
  // used in resetControlsTimeout so menus/dialogs keep the chrome visible.
  useEffect(() => {
    if (!isPlaying) return
    if (speedMenuOpen || shortcutsOpen || captionSettingsOpen) return
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000)
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [isPlaying, speedMenuOpen, shortcutsOpen, captionSettingsOpen])

  // When controls auto-hide, move focus to the container so keyboard shortcuts remain active
  useEffect(() => {
    if (!showControls && containerRef.current?.contains(document.activeElement)) {
      containerRef.current?.focus()
    }
  }, [showControls])

  // Handle progress bar change (percent 0–100)
  const handleProgressChange = (percent: number) => {
    if (!isFinite(duration)) return
    if (videoRef.current) {
      const newTime = (percent / 100) * duration
      pendingSeekRef.current = newTime
      wasPlayingBeforeSeekRef.current = !videoRef.current.paused

      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
      videoDiag('progressChange', { percent: percent.toFixed(1), targetTime: newTime.toFixed(1) })
    }
  }

  // Handle volume slider change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      className={cn(
        'relative w-full h-full rounded-2xl bg-black group focus:outline-none',
        // overflow-toggle: When speed menu is open outside fullscreen, allow dropdown
        // overflow-visibility. In fullscreen the browser handles overflow naturally so
        // keep overflow-hidden. This avoids clipping the portaled dropdown menu.
        !speedMenuOpen || isFullscreen ? 'overflow-hidden' : 'overflow-visible',
        // Hide cursor when playing and controls auto-hide (YouTube-style)
        isPlaying && !showControls && 'cursor-none'
      )}
      // eslint-disable-next-line react-best-practices/no-inline-styles
      style={
        {
          '--caption-font-size': CAPTION_FONT_SIZE_MAP[captionFontSize],
          '--caption-bg-color': `rgba(0, 0, 0, ${captionBgOpacity / 100})`,
        } as React.CSSProperties
      }
      onMouseDown={() => containerRef.current?.focus()}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() =>
        isPlaying &&
        !speedMenuOpen &&
        !shortcutsOpen &&
        !captionSettingsOpen &&
        setShowControls(false)
      }
      onTouchStart={e => handleTouchShow(e)}
      tabIndex={0}
      role="region"
      aria-label={title || 'Video player'}
    >
      <div className="relative h-full">
        <video
          ref={videoRef}
          src={src}
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
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          onStalled={handleStalled}
          onSuspend={handleSuspend}
          onEmptied={handleEmptied}
          onAbort={handleAbort}
          onPlay={() => {
            setIsPlaying(true)
            onPlayStateChange?.(true)
          }}
          onPause={() => {
            setIsPlaying(false)
            onPlayStateChange?.(false)
          }}
          onProgress={handleProgress}
          onError={handleVideoError}
          onClick={togglePlayPause}
        >
          {captions?.map((caption, index) => (
            <track
              key={caption.src}
              kind="subtitles"
              src={caption.src}
              srcLang={caption.language}
              label={caption.label}
              default={caption.default || index === 0}
            />
          ))}
          Your browser does not support the video element.
        </video>

        {/* Hidden file input for caption loading */}
        {onLoadCaptions && (
          <input
            ref={captionInputRef}
            type="file"
            accept=".srt,.vtt"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            data-testid="caption-file-input"
            onChange={handleCaptionFileChange}
          />
        )}

        {/* Error Overlay */}
        {hasError && !showRecoveryOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 z-10"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-sm px-4 text-center">
              {ERROR_MESSAGES[errorCode ?? -1] ?? 'An error occurred. Please try again.'}
            </p>
            <Button
              variant="outline"
              className="text-white border-white/40 hover:bg-white/10 h-11"
              onClick={() => {
                // F002: Capture current error-time position before regeneration.
                // When onRecoveryNeeded is provided, trigger blob URL regeneration
                // (resolves revoked/corrupted source URLs). Falls back to reloading
                // the same src for standalone VideoPlayer usage without a recovery
                // handler. retryPositionRef is set for both paths — it's harmless
                // when recoveryPositionRef handles position via initialPosition.
                const currentPos = videoRef.current?.currentTime
                retryPositionRef.current =
                  currentPos != null && isFinite(currentPos) ? currentPos : null
                setHasError(false)
                setErrorCode(null)
                hasRestoredPosition.current = false
                if (onRecoveryNeeded) {
                  onRecoveryNeeded(currentPos ?? 0)
                } else {
                  videoRef.current?.load()
                }
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Recovery spinner — shown between Retry click and blob URL arrival */}
        {showRecoveryOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 z-10"
            role="status"
            aria-live="polite"
          >
            <div className="size-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            <p className="text-sm">Recovering...</p>
          </div>
        )}

        {/* Custom Controls Overlay */}
        <div
          data-testid="player-controls-overlay"
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-[opacity,visibility] duration-300 motion-reduce:transition-none',
            showControls ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'
          )}
          onTouchStart={e => handleTouchShow(e)}
          onClick={e => {
            // Toggle play/pause when clicking the canvas (not buttons, sliders, or controls bar)
            const target = e.target as HTMLElement
            if (
              target.closest('button') ||
              target.closest('input') ||
              target.closest('[data-controls]') ||
              target.closest('[role="menu"]')
            )
              return
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
                  <Play
                    className="size-9 text-brand fill-brand translate-x-0.5"
                    aria-hidden="true"
                  />
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
                <div
                  key={seekOverlay.id}
                  className="absolute left-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none animate-seek-flash"
                >
                  <div className="rounded-full bg-white/20 p-4 flex flex-col items-center gap-1">
                    <ChevronLeft className="size-6 text-white" />
                    <span className="text-white text-xs font-medium">-{seekOverlay.amount}s</span>
                  </div>
                </div>
              )}
              {seekOverlay.direction === 'right' && (
                <div
                  key={seekOverlay.id}
                  className="absolute right-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none animate-seek-flash"
                >
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
              <span
                data-testid="current-time"
                className="text-white text-xs font-medium min-w-[45px]"
              >
                {formatTime(currentTime)}
              </span>
              <ChapterProgressBar
                src={src}
                buffered={bufferedRanges}
                progress={progress}
                duration={duration}
                chapters={chapters}
                bookmarks={bookmarks}
                onSeek={handleProgressChange}
                onBookmarkSeek={onBookmarkSeek}
                loopStart={loopStart}
                loopEnd={loopEnd}
                storyboard={storyboard}
                storyboardLoading={storyboardLoading}
                storyboardFailed={storyboardFailed}
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
                  className="size-11 text-white hover:bg-white/20 hover:text-white"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>

                {/* Skip Back */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => {
                    seek(-10)
                    announce('Skipped back 10 seconds')
                  }}
                  aria-label="Skip back 10 seconds"
                >
                  <SkipBack className="size-5" />
                </Button>

                {/* Skip Forward */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => {
                    seek(10)
                    announce('Skipped forward 10 seconds')
                  }}
                  aria-label="Skip forward 10 seconds"
                >
                  <SkipForward className="size-5" />
                </Button>

                {/* Volume */}
                <div
                  ref={mobileVolumeWrapperRef}
                  className="relative flex items-center gap-2"
                  onWheel={e => {
                    e.preventDefault()
                    changeVolume(e.deltaY < 0 ? 0.05 : -0.05)
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="volume-button"
                    className="size-11 text-white hover:bg-white/20 hover:text-white"
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
                        'group-hover/volume:[&_[data-slot=slider-thumb]]:opacity-100 group-hover/volume:[&_[data-slot=slider-thumb]]:scale-100'
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
                <DropdownMenu open={speedMenuOpen} onOpenChange={setSpeedMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="speed-menu-trigger"
                      className="h-11 px-3 text-white hover:bg-white/20 hover:text-white text-xs font-medium"
                      aria-label="Playback speed"
                    >
                      <Settings className="size-5 mr-1" />
                      {playbackSpeed}x
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    className="w-32"
                    container={containerRef.current ?? undefined}
                  >
                    <DropdownMenuLabel className="text-xs font-semibold">Speed</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={String(playbackSpeed)}
                      onValueChange={value => changePlaybackSpeed(parseFloat(value))}
                    >
                      {PLAYBACK_SPEEDS.map(speed => (
                        <DropdownMenuRadioItem key={speed} value={String(speed)}>
                          {speed}x {speed === 1 && '(Normal)'}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* AB-Loop Button — cycles: no markers → set A → set B → (Escape to clear) */}
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="loop-toggle-button"
                  className={cn(
                    'size-11 text-white hover:bg-white/20 hover:text-white transition-colors duration-150',
                    loopStart !== null && loopEnd === null && 'bg-white/20',
                    loopStart !== null &&
                      loopEnd !== null &&
                      'bg-brand/30 text-brand-soft-foreground'
                  )}
                  onClick={() => {
                    if (loopStart === null) {
                      setLoopA()
                    } else if (loopEnd === null) {
                      setLoopB()
                    } else {
                      // Third press: re-set A (clears B internally)
                      setLoopA()
                    }
                  }}
                  aria-label={
                    loopStart === null
                      ? 'Set loop start (A)'
                      : loopEnd === null
                        ? 'Set loop end (B)'
                        : `Loop active: ${formatTime(loopStart)} to ${formatTime(loopEnd)}`
                  }
                  aria-pressed={loopStart !== null}
                >
                  <Repeat className="size-5" />
                </Button>

                {/* Clear loop — shown whenever any marker is set */}
                {(loopStart !== null || loopEnd !== null) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="loop-clear-button"
                    className="size-11 text-white/60 hover:text-white hover:bg-white/20 hover:text-white"
                    onClick={clearLoop}
                    aria-label="Clear loop"
                  >
                    <X className="size-3" />
                  </Button>
                )}

                {/* Bookmark Button */}
                {onBookmarkAdd && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-11 text-white hover:bg-white/20 hover:text-white transition-colors duration-150',
                      justBookmarked && 'bg-warning/30 text-warning hover:bg-warning/40'
                    )}
                    onClick={handleAddBookmark}
                    aria-label="Add bookmark at current time"
                  >
                    {justBookmarked ? (
                      <BookmarkCheck className="size-5" />
                    ) : (
                      <Bookmark className="size-5" />
                    )}
                  </Button>
                )}

                {/* Captions Toggle — opens file picker when no captions; toggles when loaded */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-11 text-white hover:bg-white/20 hover:text-white',
                    captionsEnabled && captions && captions.length > 0 && 'bg-white/20',
                    !onLoadCaptions &&
                      (!captions || captions.length === 0) &&
                      'opacity-40 cursor-not-allowed'
                  )}
                  onClick={toggleCaptions}
                  disabled={!onLoadCaptions && (!captions || captions.length === 0)}
                  aria-label={
                    !captions || captions.length === 0
                      ? 'Load captions'
                      : captionsEnabled
                        ? 'Disable captions'
                        : 'Enable captions'
                  }
                  aria-pressed={captions && captions.length > 0 ? captionsEnabled : undefined}
                  data-testid="caption-toggle-button"
                >
                  <Subtitles className="size-5" />
                </Button>

                {/* Caption Settings Popover — only visible when captions are active */}
                {captionsEnabled && captions && captions.length > 0 && (
                  <Popover open={captionSettingsOpen} onOpenChange={setCaptionSettingsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 text-white hover:bg-white/20 hover:text-white"
                        aria-label="Caption settings"
                        data-testid="caption-settings-button"
                      >
                        <Settings2 className="size-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-64 p-4 space-y-4 bg-popover"
                      side="top"
                      align="center"
                      sideOffset={8}
                      onOpenAutoFocus={e => e.preventDefault()}
                    >
                      {/* Font Size */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Font Size
                        </label>
                        <div className="flex gap-1">
                          {CAPTION_FONT_SIZE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              className={cn(
                                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                captionFontSize === opt.value
                                  ? 'bg-brand text-brand-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                              onClick={() => handleCaptionFontSizeChange(opt.value)}
                              data-testid={`caption-font-size-${opt.value}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Background Opacity */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Background Opacity: {captionBgOpacity}%
                        </label>
                        <Slider
                          value={[captionBgOpacity]}
                          onValueChange={handleCaptionBgOpacityChange}
                          min={0}
                          max={100}
                          step={5}
                          aria-label="Caption background opacity"
                          data-testid="caption-bg-opacity-slider"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Theater Mode - desktop only (sidebar already hidden on mobile) */}
                {onTheaterModeToggle && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'hidden xl:flex size-11 text-white hover:bg-white/20 hover:text-white',
                      theaterMode && 'bg-white/20'
                    )}
                    onClick={onTheaterModeToggle}
                    aria-label="Toggle theater mode"
                  >
                    <RectangleHorizontal className="size-5" />
                  </Button>
                )}

                {/* Picture-in-Picture */}
                {typeof document !== 'undefined' &&
                  'pictureInPictureEnabled' in document &&
                  document.pictureInPictureEnabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-11 text-white hover:bg-white/20 hover:text-white',
                        isPiP && 'bg-white/20'
                      )}
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
                  className="size-11 text-white hover:bg-white/20 hover:text-white"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
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
})
