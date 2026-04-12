/**
 * useSilenceDetection — Web Audio API-based silence detector for the audiobook player.
 *
 * Uses an AnalyserNode connected to the singleton HTMLAudioElement to monitor
 * audio levels in real-time. When audio RMS drops below the threshold for
 * >500ms while playing, the audio element is seeked past the silence segment.
 *
 * CRITICAL CONSTRAINT: createMediaElementSource() can only be called once per
 * HTMLAudioElement. A module-level guard (_mediaSource) persists across React
 * re-renders and component unmounts to prevent InvalidStateError.
 *
 * @module useSilenceDetection
 * @since E111-S02
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type { RefObject } from 'react'

// ── Module-level guards (survive React component lifecycle) ───────────────────
// Intentional: createMediaElementSource() throws InvalidStateError if called
// more than once per HTMLAudioElement — module scope persists across re-renders.
let _audioCtx: AudioContext | null = null
let _mediaSource: MediaElementAudioSourceNode | null = null
let _analyser: AnalyserNode | null = null

/** RMS amplitude below this level is treated as silence (~-40 dB) */
const SILENCE_THRESHOLD = 0.015
/** Silence must persist for this many ms before a skip is triggered */
const SILENCE_DURATION_MS = 500
/** FFT size for the AnalyserNode — must be power of 2 */
const FFT_SIZE = 2048
/** How far to skip forward after silence is detected (seconds) */
const SKIP_LOOKAHEAD_S = 0.1

export interface SilenceSkip {
  durationSeconds: number
  timestamp: number
}

interface UseSilenceDetectionParams {
  enabled: boolean
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
}

interface UseSilenceDetectionReturn {
  /** Whether silence detection is currently active */
  isActive: boolean
  /** Transient skip info for the visual indicator, null when no recent skip */
  lastSkip: SilenceSkip | null
}

function calculateRms(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    // Byte time-domain data: 128 = silence, 0–255 is the range
    const normalized = (data[i] - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / data.length)
}

export function useSilenceDetection({
  enabled,
  audioRef,
  isPlaying,
}: UseSilenceDetectionParams): UseSilenceDetectionReturn {
  const [isActive, setIsActive] = useState(false)
  const [lastSkip, setLastSkip] = useState<SilenceSkip | null>(null)

  const rafRef = useRef<number | null>(null)
  const silenceStartRef = useRef<number | null>(null)

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    silenceStartRef.current = null
  }, [])

  const runDetectionLoop = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !_analyser) return

    const dataArray = new Uint8Array(FFT_SIZE)

    const tick = () => {
      if (!_analyser || !audioRef.current) return

      _analyser.getByteTimeDomainData(dataArray)
      const rms = calculateRms(dataArray)
      const now = performance.now()

      if (rms < SILENCE_THRESHOLD) {
        // Start tracking silence duration
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now
        } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
          // Silence threshold exceeded — skip past it
          const silenceDurationS = (now - silenceStartRef.current) / 1000
          const audio = audioRef.current
          if (audio && !audio.ended) {
            audio.currentTime = audio.currentTime + SKIP_LOOKAHEAD_S
          }
          silenceStartRef.current = null
          setLastSkip({ durationSeconds: silenceDurationS, timestamp: Date.now() })
        }
      } else {
        // Audio is not silent — reset tracking
        silenceStartRef.current = null
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [audioRef])

  useEffect(() => {
    if (!enabled || !isPlaying) {
      stopLoop()
      setIsActive(false)
      return
    }

    const audio = audioRef.current
    if (!audio) return

    // Lazily create AudioContext on user gesture (play satisfies user gesture requirement)
    if (!_audioCtx) {
      _audioCtx = new AudioContext()
    }

    // Resume suspended context (browser may suspend before user gesture)
    // Intentional: AudioContext starts suspended — resume() re-activates it
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(err => {
        console.error('[useSilenceDetection] Failed to resume AudioContext:', err)
      })
    }

    // Connect media source only once per HTMLAudioElement lifetime
    if (!_mediaSource) {
      _mediaSource = _audioCtx.createMediaElementSource(audio)
    }

    // Create or reuse the AnalyserNode
    if (!_analyser) {
      _analyser = _audioCtx.createAnalyser()
      _analyser.fftSize = FFT_SIZE
      // Intentional: must reconnect through analyser to destination or audio output is muted
      _mediaSource.connect(_analyser)
      _analyser.connect(_audioCtx.destination)
    }

    setIsActive(true)
    runDetectionLoop()

    return () => {
      stopLoop()
      // Do NOT disconnect analyser here — disconnecting and reconnecting causes
      // audio glitches. The analyser stays connected; we just stop reading it.
      setIsActive(false)
    }
  }, [enabled, isPlaying, audioRef, runDetectionLoop, stopLoop])

  return { isActive, lastSkip }
}
