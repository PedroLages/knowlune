/**
 * TtsControlBar — fixed read-aloud control bar for the EPUB reader.
 *
 * Appears at the bottom of the reader when TTS is active.
 * Contains: play/pause button, stop button, speed selector,
 * and a progress indicator (chunk N of M).
 *
 * @module TtsControlBar
 */
import { Play, Pause, Square, Volume2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { cn } from '@/app/components/ui/utils'
import type { TtsVoice } from '@/services/TtsService'
import type { ReaderTheme } from '@/stores/useReaderStore'
import { getReaderChromeClasses } from './readerThemeConfig'

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5×' },
  { value: '0.75', label: '0.75×' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
]

const DEFAULT_VOICE_VALUE = '__system-default__'

interface TtsControlBarProps {
  isPlaying: boolean
  currentChunk: number
  totalChunks: number
  rate: number
  voiceURI: string | null
  voices: TtsVoice[]
  theme: ReaderTheme
  onPlayPause: () => void
  onStop: () => void
  onRateChange: (rate: number) => void
  onVoiceChange: (voiceURI: string | null) => void
}

export function TtsControlBar({
  isPlaying,
  currentChunk,
  totalChunks,
  rate,
  voiceURI,
  voices,
  theme,
  onPlayPause,
  onStop,
  onRateChange,
  onVoiceChange,
}: TtsControlBarProps) {
  const chrome = getReaderChromeClasses(theme)

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[120] px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5',
        'border-t border-black/10 backdrop-blur-sm shadow-lg',
        'flex items-center gap-3',
        chrome.bgBar,
        chrome.text
      )}
      role="toolbar"
      aria-label="Read aloud controls"
      data-testid="tts-control-bar"
    >
      {/* Icon + label */}
      <Volume2 className="size-4 shrink-0 opacity-60" aria-hidden="true" />

      {/* Play / Pause */}
      <Button
        variant="brand"
        size="icon"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause reading' : 'Resume reading'}
        className="size-8 min-h-[44px] min-w-[44px] shrink-0"
        data-testid="tts-play-pause"
      >
        {isPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
      </Button>

      {/* Stop */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onStop}
        aria-label="Stop reading"
        className="size-8 min-h-[44px] min-w-[44px] shrink-0 hover:bg-black/10"
        data-testid="tts-stop"
      >
        <Square className="size-4" aria-hidden="true" />
      </Button>

      {/* Progress indicator */}
      {totalChunks > 0 && (
        <span className="flex-1 text-xs opacity-60 truncate" aria-live="polite" aria-atomic="true">
          {currentChunk} / {totalChunks} segments
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Voice selector */}
        <Select
          value={voiceURI ?? DEFAULT_VOICE_VALUE}
          onValueChange={val => onVoiceChange(val === DEFAULT_VOICE_VALUE ? null : val)}
          disabled={voices.length === 0}
        >
          <SelectTrigger
            className="h-8 w-36 cursor-pointer text-xs sm:w-48"
            aria-label="Reading voice"
            data-testid="tts-voice-select"
          >
            <SelectValue placeholder="Voice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VOICE_VALUE}>System voice</SelectItem>
            {voices.map(voice => (
              <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Speed selector */}
        <Select value={String(rate)} onValueChange={val => onRateChange(Number(val))}>
          <SelectTrigger
            className="h-8 w-20 cursor-pointer text-xs"
            aria-label="Reading speed"
            data-testid="tts-speed-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
