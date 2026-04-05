/**
 * useAudioPlayer — manages a singleton HTML5 <audio> element for audiobook playback.
 *
 * Features:
 * - Singleton audio element (module-level) — survives React route changes
 * - OPFS-backed MP3 loading via OpfsStorageService → URL.createObjectURL()
 * - requestAnimationFrame loop for smooth scrubber updates
 * - Cross-chapter skip (forward 30s, back 15s)
 * - Auto-rewind 5s when resuming after a pause > 30 seconds
 * - Playback rate control with preservesPitch
 *
 * @module useAudioPlayer
 * @since E87-S02
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import type React from 'react'
import { toast } from 'sonner'
import type { Book } from '@/data/types'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'

const AUTO_REWIND_THRESHOLD_MS = 30_000 // 30 seconds
const AUTO_REWIND_SECONDS = 5 // seconds to rewind on resume

/** Format seconds as mm:ss or h:mm:ss */
export function formatAudioTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Module-level singleton HTMLAudioElement — created once, survives route changes.
 * Lazy-initialized on first hook call (SSR-safe, avoids creating Audio in tests).
 */
let _sharedAudio: HTMLAudioElement | null = null
let _sharedObjectUrl: string | null = null

function getSharedAudio(): HTMLAudioElement {
  if (!_sharedAudio) {
    _sharedAudio = new Audio()
  }
  return _sharedAudio
}

function revokeSharedObjectUrl() {
  if (_sharedObjectUrl) {
    URL.revokeObjectURL(_sharedObjectUrl)
    _sharedObjectUrl = null
  }
}

/**
 * A stable React.RefObject-compatible wrapper around the singleton audio element.
 * Pass this to useSleepTimer for direct volume manipulation (fade-out).
 */
export const sharedAudioRef: React.RefObject<HTMLAudioElement | null> = {
  get current() {
    return _sharedAudio
  },
}

export interface UseAudioPlayerReturn {
  isPlaying: boolean
  currentTime: number
  duration: number
  currentChapterIndex: number
  isLoading: boolean
  /** Stable ref to the singleton HTMLAudioElement — for direct volume control (sleep timer fade-out) */
  audioRef: React.RefObject<HTMLAudioElement | null>
  play: () => void
  pause: () => void
  toggle: () => void
  seekTo: (seconds: number) => void
  skipForward: (seconds?: number) => void
  skipBack: (seconds?: number) => void
  loadChapter: (index: number, autoPlay?: boolean) => Promise<void>
}

export function useAudioPlayer(book: Book | null): UseAudioPlayerReturn {
  // rafRef is per-hook-instance (can't be module-level since multiple hook calls could exist)
  const rafRef = useRef<number | null>(null)
  const pausedAtRef = useRef<number | null>(null) // timestamp of last pause (for auto-rewind)
  const [isLoading, setIsLoading] = useState(false)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)

  const {
    currentChapterIndex,
    isPlaying,
    playbackRate,
    setIsPlaying,
    setCurrentTime,
    setCurrentChapterIndex,
  } = useAudioPlayerStore()

  /** Start the rAF loop to update currentTime */
  const startRafLoop = useCallback(() => {
    const tick = () => {
      const audio = _sharedAudio
      if (!audio) return
      setLocalCurrentTime(audio.currentTime)
      setCurrentTime(audio.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [setCurrentTime])

  /** Stop the rAF loop */
  const stopRafLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /** Attach event listeners to the singleton audio element */
  useEffect(() => {
    const audio = getSharedAudio()

    const handleEnded = () => {
      // Auto-advance to next chapter
      const nextIndex = useAudioPlayerStore.getState().currentChapterIndex + 1
      const chapters = book?.chapters ?? []
      if (nextIndex < chapters.length) {
        loadChapterInternal(nextIndex, true)
      } else {
        setIsPlaying(false)
        stopRafLoop()
      }
    }

    const handleLoadedMetadata = () => {
      setLocalDuration(audio.duration)
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Restore current position from singleton state (when remounting after navigation)
    if (audio.currentTime > 0) {
      setLocalCurrentTime(audio.currentTime)
      setLocalDuration(audio.duration || 0)
    }
    // Restart rAF loop if already playing when component mounts (e.g. returning from another page)
    if (!audio.paused) {
      startRafLoop()
    }

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      // Do NOT pause or destroy — singleton must survive route changes
      stopRafLoop()
    }
  }, []) // intentionally run once on mount — event listener lifecycle

  /** Sync playback rate when it changes in the store */
  useEffect(() => {
    const audio = _sharedAudio
    if (audio) {
      audio.playbackRate = playbackRate
      // preservesPitch prevents chipmunk effect — Chrome 86+, Firefox 101+, Safari 15.4+
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(audio as any).preservesPitch = true
    }
  }, [playbackRate])

  const loadChapterInternal = useCallback(
    async (index: number, autoPlay = false) => {
      const audio = getSharedAudio()
      if (!book) return

      const chapters = book.chapters
      if (index < 0 || index >= chapters.length) return

      setIsLoading(true)
      audio.pause()
      stopRafLoop()

      try {
        // Build OPFS path for this chapter
        const chapterFilename = `chapter-${String(index).padStart(2, '0')}.mp3`
        const chapterPath = `${book.source.type === 'local' ? book.source.opfsPath.replace(/\/[^/]+$/, '') : ''}/${chapterFilename}`

        // Read from OPFS
        const file = await opfsStorageService.readBookFile(chapterPath, book.id)
        if (!file) {
          toast.error(`Could not load chapter ${index + 1}`)
          setIsLoading(false)
          return
        }

        revokeSharedObjectUrl()
        const url = URL.createObjectURL(file)
        _sharedObjectUrl = url

        audio.src = url
        audio.playbackRate = playbackRate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(audio as any).preservesPitch = true
        audio.load()

        setCurrentChapterIndex(index)

        if (autoPlay) {
          await audio.play()
          setIsPlaying(true)
          startRafLoop()
        }
      } catch {
        // silent-catch-ok: error surfaced via toast above
        toast.error('Failed to load audio chapter')
      } finally {
        setIsLoading(false)
      }
    },
    [book, playbackRate, startRafLoop, stopRafLoop, setIsPlaying, setCurrentChapterIndex]
  )

  const play = useCallback(async () => {
    const audio = _sharedAudio
    if (!audio) return

    // Auto-rewind if paused for > 30s
    if (pausedAtRef.current !== null) {
      const pausedDuration = Date.now() - pausedAtRef.current
      if (pausedDuration > AUTO_REWIND_THRESHOLD_MS) {
        const rewindTarget = Math.max(0, audio.currentTime - AUTO_REWIND_SECONDS)
        audio.currentTime = rewindTarget
        toast('Rewound 5s', { duration: 2000 })
      }
      pausedAtRef.current = null
    }

    await audio.play()
    setIsPlaying(true)
    startRafLoop()
  }, [setIsPlaying, startRafLoop])

  const pause = useCallback(() => {
    const audio = _sharedAudio
    if (!audio) return
    audio.pause()
    pausedAtRef.current = Date.now()
    setIsPlaying(false)
    stopRafLoop()
  }, [setIsPlaying, stopRafLoop])

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = _sharedAudio
      if (!audio) return
      audio.currentTime = Math.max(0, Math.min(seconds, localDuration))
      setLocalCurrentTime(audio.currentTime)
      setCurrentTime(audio.currentTime)
    },
    [localDuration, setCurrentTime]
  )

  const skipForward = useCallback(
    async (seconds = 30) => {
      const audio = _sharedAudio
      if (!audio || !book) return
      const newTime = audio.currentTime + seconds
      if (newTime <= localDuration) {
        seekTo(newTime)
      } else {
        // Cross-chapter: load next chapter at remaining time
        const remainingTime = newTime - localDuration
        const nextIndex = currentChapterIndex + 1
        if (nextIndex < book.chapters.length) {
          await loadChapterInternal(nextIndex, isPlaying)
          if (_sharedAudio)
            _sharedAudio.currentTime = Math.min(remainingTime, _sharedAudio.duration || 0)
        }
      }
    },
    [book, localDuration, seekTo, currentChapterIndex, isPlaying, loadChapterInternal]
  )

  const skipBack = useCallback(
    async (seconds = 15) => {
      const audio = _sharedAudio
      if (!audio || !book) return
      const newTime = audio.currentTime - seconds
      if (newTime >= 0) {
        seekTo(newTime)
      } else {
        // Cross-chapter: load previous chapter at end minus remaining
        const prevIndex = currentChapterIndex - 1
        if (prevIndex >= 0) {
          const remaining = Math.abs(newTime)
          await loadChapterInternal(prevIndex, isPlaying)
          if (_sharedAudio && _sharedAudio.duration) {
            _sharedAudio.currentTime = Math.max(0, _sharedAudio.duration - remaining)
          }
        }
        // At first chapter start — do nothing
      }
    },
    [book, seekTo, currentChapterIndex, isPlaying, loadChapterInternal]
  )

  const loadChapter = useCallback(
    async (index: number, autoPlay = false) => {
      await loadChapterInternal(index, autoPlay)
    },
    [loadChapterInternal]
  )

  return {
    isPlaying,
    currentTime: localCurrentTime,
    duration: localDuration,
    currentChapterIndex,
    isLoading,
    audioRef: sharedAudioRef,
    play,
    pause,
    toggle,
    seekTo,
    skipForward,
    skipBack,
    loadChapter,
  }
}
