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
import type { ReaderTheme } from '@/stores/useReaderStore'

const BAR_BG: Record<ReaderTheme, string> = {
  light: 'bg-[#FAF5EE]/98',
  sepia: 'bg-[#F4ECD8]/98',
  dark: 'bg-[#1a1a1a]/98',
}

const BAR_TEXT: Record<ReaderTheme, string> = {
  light: 'text-[#1a1a1a]',
  sepia: 'text-[#3a2a1a]',
  dark: 'text-[#d4d4d4]',
}

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5×' },
  { value: '0.75', label: '0.75×' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
]

interface TtsControlBarProps {
  isPlaying: boolean
  currentChunk: number
  totalChunks: number
  rate: number
  theme: ReaderTheme
  onPlayPause: () => void
  onStop: () => void
  onRateChange: (rate: number) => void
}

export function TtsControlBar({
  isPlaying,
  currentChunk,
  totalChunks,
  rate,
  theme,
  onPlayPause,
  onStop,
  onRateChange,
}: TtsControlBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-12 left-0 right-0 z-40 px-4 py-2.5',
        'border-t border-black/10 backdrop-blur-sm shadow-lg',
        'flex items-center gap-3',
        BAR_BG[theme],
        BAR_TEXT[theme]
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
        className="size-8 shrink-0"
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
        className="size-8 shrink-0 hover:bg-black/10"
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

      {/* Speed selector */}
      <Select
        value={String(rate)}
        onValueChange={val => onRateChange(Number(val))}
      >
        <SelectTrigger
          className="w-20 h-8 text-xs"
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
  )
}
