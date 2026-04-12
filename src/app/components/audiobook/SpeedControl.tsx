/**
 * SpeedControl — playback rate selector for the audiobook player.
 *
 * Renders a trigger button showing the current speed (e.g. "1.5×") and a
 * Popover with 9 speed options (0.5× to 3.0×). Selecting a speed:
 *  - Updates `useAudioPlayerStore.playbackRate`
 *  - The useAudioPlayer hook syncs it to `audio.playbackRate` + `audio.preservesPitch`
 *
 * @module SpeedControl
 * @since E87-S03
 */
import { Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useBookStore } from '@/stores/useBookStore'

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]

function formatSpeed(rate: number): string {
  return `${rate % 1 === 0 ? rate.toFixed(1) : rate}×`
}

interface SpeedControlProps {
  bookId: string
}

export function SpeedControl({ bookId }: SpeedControlProps) {
  const { playbackRate, setPlaybackRate } = useAudioPlayerStore()

  const handleSelect = (rate: number) => {
    setPlaybackRate(rate)
    // Persist per-book speed — fires-and-forgets; store handles rollback on failure
    useBookStore.getState().updateBookPlaybackSpeed(bookId, rate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] min-w-[44px] px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          aria-label={`Playback speed: ${formatSpeed(playbackRate)}`}
          data-testid="speed-button"
        >
          {formatSpeed(playbackRate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="center">
        <ul role="listbox" aria-label="Playback speed">
          {SPEED_OPTIONS.map(rate => {
            const isActive = rate === playbackRate
            return (
              <li key={rate} role="option" aria-selected={isActive}>
                <button
                  onClick={() => handleSelect(rate)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60',
                    isActive ? 'text-brand font-medium' : 'text-foreground'
                  )}
                  data-testid={`speed-option-${rate}`}
                >
                  <span>{formatSpeed(rate)}</span>
                  {isActive && <Check className="size-4 text-brand" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
